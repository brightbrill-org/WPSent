const { Client } = require('whatsapp-web.js');
const { HybridAuth, deleteBackups } = require('./auth/HybridAuth');
const mongoose               = require('mongoose');
const loadModels = () => {
  for (const p of ['./models/models.js', './models/index.js', './models.js']) {
    try { return require(p); }
    catch (e) { if (e.code !== 'MODULE_NOT_FOUND' || !e.message.includes(p.slice(2))) throw e; }
  }
  throw new Error('Models file not found. Put it at ./models/models.js');
};
const lazyModel = (name) => new Proxy({}, {
  get: (_, key) => {
    const exported = loadModels();
    const model = (exported && exported[name]) || (exported && exported.default && exported.default[name]) || (mongoose.models || {})[name];
    if (!model) {
      throw new Error(`Model "${name}" not found. models exports: [${Object.keys(exported || {}).join(', ')}]`);
    }
    const value = model[key];
    return typeof value === 'function' ? value.bind(model) : value;
  }
});
const WpUser = lazyModel('WpUser');
const MessageLog = lazyModel('MessageLog');
const axios                  = require('axios');
const { execSync }           = require('child_process');
const fs                     = require('fs');
const path                   = require('path');

const sessions     = new Map();
const qrCallbacks  = new Map();
const logListeners = new Map();
const reconnectTimers = new Map();
const retryCount      = new Map();
const pairedAtMap     = new Map();

const RECONNECT_MS = Number(process.env.WA_RECONNECT_MS) || 5000;
const STAGGER_MS   = Number(process.env.WA_STAGGER_MS)   || 3000;
const MAX_RETRIES  = 10;
const AUTH_TIMEOUT_MS = Number(process.env.WA_AUTH_TIMEOUT_MS) || 300000;
const QR_POLL_MS = 3000;
const BACKUP_INTERVAL_MS = Math.max(60000, Number(process.env.WA_BACKUP_INTERVAL_MS) || 60000);
const closingSessions = new Map();
const AUTH_ROOT = path.resolve(process.env.WA_REMOTE_AUTH_DIR || path.join(__dirname, '.wwebjs_remote_auth'));
const restoreTimers = new Set();
let shuttingDown = false;

function isRealBrowser(p) {
  try {
    execSync(`test -f "${p}"`, { stdio: 'ignore' });
    const out = execSync(`"${p}" --version 2>&1 || true`, { timeout: 3000, encoding: 'utf8' });
    if (out.toLowerCase().includes('snap')) return false;
    console.log(`[WA] Browser: ${p} (${out.trim()})`);
    return true;
  } catch (_) { return false; }
}

function findBrowser() {
  const candidates = [
    '/usr/bin/google-chrome-stable',
    '/nix/var/nix/profiles/default/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const p of candidates) { if (isRealBrowser(p)) return p; }
  console.log('[WA] Using Puppeteer bundled Chromium');
  return null;
}

const BROWSER_PATH = findBrowser();

function sanitizePhone(raw) {
  return String(raw).replace(/[^0-9]/g, '');
}

async function pruneOldLogs(userId) {
  const total = await MessageLog.countDocuments({ userId });
  if (total > 100) {
    const toDelete = total - 100;
    const oldest   = await MessageLog.find({ userId }).sort({ timestamp: 1 }).limit(toDelete).select('_id');
    await MessageLog.deleteMany({ _id: { $in: oldest.map(d => d._id) } });
  }
}

async function fireWebhooks(userId, payload) {
  const freshUser = await WpUser.findById(userId).lean();
  if (!freshUser) return;
  const active = (freshUser.webhooks || []).filter(w => w.active);
  if (!active.length) return;
  console.log(`[WH] Firing ${active.length} webhook(s)`);
  await Promise.allSettled(active.map(async (wh) => {
    try {
      if (wh.method === 'POST') {
        await axios.post(wh.url, payload, { timeout: 8000 });
      } else {
        const sep    = wh.url.includes('?') ? '&' : '?';
        const params = new URLSearchParams(payload).toString();
        await axios.get(`${wh.url}${sep}${params}`, { timeout: 8000 });
      }
      console.log(`[WH] OK: ${wh.url}`);
    } catch (e) {
      console.error(`[WH] Failed: ${wh.url} — ${e.message}`);
    }
  }));
}

function classifyMessage(msg) {
  const t = msg.type;
  if (t === 'reaction') return 'reaction';
  if (t === 'sticker')  return 'sticker';
  if (t === 'image')    return 'image';
  if (t === 'video')    return 'video';
  if (t === 'audio')    return 'audio';
  if (t === 'document') return 'document';
  if (t === 'location') return 'location';
  if (t === 'vcard')    return 'contact';
  return 'text';
}

function extractBody(msg) {
  if (msg.type === 'reaction') {
    const emoji = msg.reaction?.text || msg._data?.reactionText || '👍';
    return `[Reaction: ${emoji}]`;
  }
  if (msg.type === 'sticker')  return '[Sticker]';
  if (msg.type === 'image')    return msg.body || '[Image]';
  if (msg.type === 'video')    return '[Video]';
  if (msg.type === 'audio')    return '[Audio]';
  if (msg.type === 'document') return `[Document: ${msg.body || 'file'}]`;
  if (msg.type === 'location') return `[Location: ${msg.location?.latitude || '?'},${msg.location?.longitude || '?'}]`;
  if (msg.type === 'vcard')    return '[Contact card]';
  const body = msg.body || msg.caption || msg._data?.body || '';
  return body || `[${msg.type || 'message'}]`;
}

async function teardown(phone) {
  if (closingSessions.has(phone)) return closingSessions.get(phone);
  const s = sessions.get(phone);
  if (!s) return;
  s.destroyed = true;
  stopQR(s);
  const task = (async () => {
    if (shuttingDown) console.log('[WA] Shutdown: stopping periodic backups: ' + phone);
    await s.auth.stopBackups();
    if (shuttingDown) console.log('[WA] Shutdown: backups drained: ' + phone);
    // Do not open a second browser on the same profile until the first closes.
    if (shuttingDown) console.log('[WA] Shutdown: closing Chrome: ' + phone);
    if (s.client.pupBrowser) await s.client.destroy();
    if (s.initTask) await s.initTask.catch(() => {});
    if (s.client.pupBrowser?.connected) await s.client.destroy();
    if (shuttingDown) console.log('[WA] Shutdown: Chrome closed: ' + phone);
    if (sessions.get(phone) === s) sessions.delete(phone);
  })();
  closingSessions.set(phone, task);
  try { await task; } finally { closingSessions.delete(phone); }
}

function scheduleReconnect(phone, delay = RECONNECT_MS) {
  if (shuttingDown || reconnectTimers.has(phone)) return;
  const s = sessions.get(phone);
  if (s) s.reconnecting = true;
  reconnectTimers.set(phone, setTimeout(async () => {
    reconnectTimers.delete(phone);
    try {
      await teardown(phone);
      if (!shuttingDown) createSession(phone);
    } catch (e) {
      console.error('[WA] Reconnect teardown failed:', e.message);
      if (!shuttingDown) scheduleReconnect(phone, RECONNECT_MS);
    }
  }, delay));
}

function stopQR(session) {
  clearInterval(session.qrTimer);
  session.qrTimer = null;
  session.qr = null;
}

function publishQR(phone, session, qr) {
  if (session.destroyed || session.authenticated || session.status === 'ready' ||
      typeof qr !== 'string' || !qr || session.qr === qr) return;
  session.qr = qr;
  session.status = 'qr_ready';
  session.needsPair = true;
  (qrCallbacks.get(phone) || []).forEach(fn => { try { fn(qr); } catch (_) {} });
}

function startQRFallback(phone, session) {
  let busy = false;
  session.qrTimer = setInterval(async () => {
    if (busy || session.destroyed || session.authenticated) return;
    const page = session.client.pupPage;
    if (!page || page.isClosed()) return;
    busy = true;
    try {
      const info = await page.evaluate(() => {
        const holder = document.querySelector('[data-ref]');
        return {
          login: location.pathname.startsWith('/login'),
          qr: holder?.querySelector('canvas') ? holder.getAttribute('data-ref') : null
        };
      });
      if (session.destroyed || session.authenticated) return;
      if (info.login && info.qr) publishQR(phone, session, info.qr);
      else if (!info.login && session.status === 'qr_ready') {
        session.qr = null;
        session.status = 'initializing';
      }
    } catch (_) {
      // Navigation during pairing can invalidate the execution context.
    } finally { busy = false; }
  }, QR_POLL_MS);
}

function createSession(phone) {
  if (shuttingDown) throw new Error('WhatsApp manager is shutting down');
  if (!/^\d+$/.test(String(phone))) throw new Error('Invalid session phone');
  const existing = sessions.get(phone);
  if (existing) {
    if (existing.status !== 'error' || existing.reconnecting) return existing;
    scheduleReconnect(phone, 0);
    return existing;
  }

  fs.mkdirSync(AUTH_ROOT, { recursive: true, mode: 0o700 });
  const auth = new HybridAuth({
    clientId: String(phone),
    mongoose,
    dataPath: AUTH_ROOT,
    backupSyncIntervalMs: BACKUP_INTERVAL_MS
  });
  const client = new Client({
    authStrategy: auth,
    authTimeoutMs: AUTH_TIMEOUT_MS,
    webVersionCache: { type: 'none' },
    puppeteer: {
      headless: true,
      // server.js owns shutdown; Puppeteer must not exit Node on SIGINT.
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
      ...(BROWSER_PATH && { executablePath: BROWSER_PATH }),
      protocolTimeout: 300000,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
  });

  const session = { client, auth, status: 'initializing', qr: null, needsPair: false, destroyed: false, reconnecting: false, authenticated: false, qrTimer: null };
  sessions.set(phone, session);

  client.on('qr', qr => publishQR(phone, session, qr));
  client.on('authenticated', () => {
    if (session.destroyed) return;
    session.authenticated = true;
    stopQR(session);
    session.status = 'initializing';
    console.log(`[WA] Authenticated: ${phone}`);
  });
  startQRFallback(phone, session);

  client.on('ready', async () => {
    if (session.destroyed) return;
    session.authenticated = true;
    stopQR(session);
    session.status = 'ready';
    session.qr     = null;
    retryCount.delete(phone);
    if (session.needsPair) {
      pairedAtMap.set(phone, Date.now());
      session.needsPair = false;
    }
    console.log(`[WA] Ready: ${phone}`);
    try { await WpUser.updateOne({ phone }, { lastSeen: new Date() }); }
    catch (e) { console.error('[WA] lastSeen update failed:', e.message); }
  });

  client.on('remote_session_saved', () => {
    console.log(`[WA] Session saved to MongoDB: ${phone}`);
  });

  client.on('auth_failure', (msg) => {
    if (session.destroyed) return;
    session.auth.canBackup = false;
    stopQR(session);
    session.status = 'auth_failure';
    console.error(`[WA] Auth failure for ${phone}:`, msg);
  });

  client.on('disconnected', (reason) => {
    if (session.destroyed) return;
    session.auth.canBackup = false;
    stopQR(session);
    session.status = 'disconnected';
    console.log(`[WA] Disconnected ${phone}: ${reason} — reconnecting`);
    scheduleReconnect(phone);
  });

  client.on('error', (err) => {
    if (session.destroyed) return;
    const msg = err?.message || '';
    console.error(`[WA] Error ${phone}:`, msg);
    if (msg.includes('Target closed') || msg.includes('detached Frame') || msg.includes('Session closed') || msg.includes('Protocol error')) {
      stopQR(session);
    session.status = 'disconnected';
      scheduleReconnect(phone);
    }
  });

  client.on('message', async (msg) => {
    try {
      if (msg.from === 'status@broadcast' || msg.isStatus) return;
      const user = await WpUser.findOne({ phone });
      if (!user) return;
      const type = classifyMessage(msg);
      const body = extractBody(msg);
      const log  = await MessageLog.create({ userId: user._id, direction: 'inbound', from: msg.from, body, type, status: 'received' });
      await pruneOldLogs(user._id);
      emitLog(user._id.toString(), log.toObject());
      await fireWebhooks(user._id, { event: 'message_received', from: msg.from.replace('@c.us',''), body, type, timestamp: (log.timestamp || new Date()).toISOString() });
    } catch (e) { console.error('[WA] message handler error:', e.message); }
  });

  client.on('message_reaction', async (reaction) => {
    try {
      const user = await WpUser.findOne({ phone });
      if (!user) return;
      const body = `[Reaction: ${reaction.reaction || '👍'}]`;
      const log  = await MessageLog.create({ userId: user._id, direction: 'inbound', from: reaction.senderId || 'unknown', body, type: 'reaction', status: 'received' });
      await pruneOldLogs(user._id);
      emitLog(user._id.toString(), log.toObject());
      await fireWebhooks(user._id, { event: 'message_received', from: (reaction.senderId || 'unknown').replace('@c.us',''), body, type: 'reaction', timestamp: (log.timestamp || new Date()).toISOString() });
    } catch (e) { console.error('[WA] reaction handler error:', e.message); }
  });

  session.initTask = client.initialize().catch(err => {
    if (session.destroyed) return;
    console.error(`[WA] Init error for ${phone}:`, err.message);
    stopQR(session);
    session.status = 'error';
    const n = (retryCount.get(phone) || 0) + 1;
    retryCount.set(phone, n);
    if (n <= MAX_RETRIES) scheduleReconnect(phone, Math.min(RECONNECT_MS * 2 ** (n - 1), 5 * 60_000));
    else console.error(`[WA] Giving up on ${phone} after ${MAX_RETRIES} failed attempts`);
  });

  return session;
}

async function wipeRemoteSession(phone) {
  if (!/^\d+$/.test(String(phone))) throw new Error('Invalid session phone');
  const name = 'RemoteAuth-' + phone;
  await deleteBackups(mongoose, name);
  const roots = new Set([AUTH_ROOT, path.join(__dirname, '.wwebjs_remote_auth')]);
  for (const root of roots) {
    await fs.promises.rm(path.join(root, name), { recursive: true, force: true });
    await fs.promises.rm(path.join(root, name + '.zip'), { force: true });
  }
}

async function destroySession(phone, { wipe = false } = {}) {
  const t = reconnectTimers.get(phone);
  if (t) { clearTimeout(t); reconnectTimers.delete(phone); }
  await teardown(phone);
  qrCallbacks.delete(phone);
  retryCount.delete(phone);
  pairedAtMap.delete(phone);
  if (wipe) await wipeRemoteSession(phone);
  console.log(`[WA] Session destroyed${wipe ? ' (remote session wiped)' : ''}: ${phone}`);
}

async function rescanSession(phone) {
  await destroySession(phone, { wipe: true });
  return createSession(phone);
}

function getSession(phone) { return sessions.get(phone) || null; }
function getStatus(phone)  { return sessions.get(phone)?.status || 'not_started'; }
function getPairedAt(phone) { return pairedAtMap.get(phone) || 0; }
function getOwnId(phone) {
  return sessions.get(phone)?.client?.info?.wid?._serialized || `${sanitizePhone(phone)}@c.us`;
}

function onQR(phone, fn) {
  if (!qrCallbacks.has(phone)) qrCallbacks.set(phone, []);
  qrCallbacks.get(phone).push(fn);
  const s = sessions.get(phone);
  if (s?.qr) fn(s.qr);
}
function offQR(phone, fn) {
  if (!qrCallbacks.has(phone)) return;
  qrCallbacks.set(phone, qrCallbacks.get(phone).filter(f => f !== fn));
}

function onLog(userId, fn) {
  if (!logListeners.has(userId)) logListeners.set(userId, []);
  logListeners.get(userId).push(fn);
}
function offLog(userId, fn) {
  if (!logListeners.has(userId)) return;
  logListeners.set(userId, logListeners.get(userId).filter(f => f !== fn));
}
function emitLog(userId, log) {
  (logListeners.get(userId) || []).forEach(fn => { try { fn(log); } catch (_) {} });
}

async function sendMessage(phone, to, body) {
  const session = sessions.get(phone);
  if (!session || session.status !== 'ready') throw new Error('WhatsApp session not ready');
  const clean = to.includes('@') ? to : sanitizePhone(to) + '@c.us';
  if (!clean || clean === '@c.us') throw new Error('Invalid phone number');
  try {
    await session.client.sendMessage(clean, body);
  } catch (err) {
    const msg = err?.message || '';
    if (msg.includes('detached Frame') || msg.includes('Target closed') || msg.includes('Session closed')) {
      stopQR(session);
    session.status = 'disconnected';
      scheduleReconnect(phone, 3000);
      throw new Error('Session lost — reconnecting, please retry in 30 seconds');
    }
    throw err;
  }
}

async function shutdown() {
  shuttingDown = true;
  for (const t of restoreTimers) clearTimeout(t);
  restoreTimers.clear();
  for (const t of reconnectTimers.values()) clearTimeout(t);
  reconnectTimers.clear();
  const results = await Promise.allSettled([...sessions.entries()].map(async ([phone, s]) => {
    const wasReady = s.status === 'ready' && s.auth.canBackup;
    console.log('[WA] Shutdown: session ' + phone + ', status=' + s.status + ', backupEligible=' + wasReady);
    await teardown(phone);
    // Chrome has closed: on-disk storage is no longer being mutated by the browser.
    if (wasReady && !s.auth.loggedOut) {
      const started = Date.now();
      console.log('[WA] Shutdown: saving clean MongoDB backup: ' + phone);
      const saved = await s.auth.storeRemoteSession({ clean: true });
      if (!saved) throw new Error('Session not eligible for backup: ' + phone);
      console.log('[WA] Saved clean session before shutdown: ' + phone + ' (' + (Date.now() - started) + ' ms)');
    } else {
      console.log('[WA] Shutdown: clean backup skipped (not ready or logged out): ' + phone);
    }
  }));
  for (const result of results) {
    if (result.status === 'rejected') console.error('[WA] Shutdown session error:', result.reason?.message);
  }
  if (results.some(r => r.status === 'rejected')) throw new Error('One or more WhatsApp sessions failed to shut down or back up');
}

async function restoreAllSessions() {
  const users = await WpUser.find({}).select('phone').lean();
  users.forEach((u, i) => {
    const timer = setTimeout(() => {
      restoreTimers.delete(timer);
      if (shuttingDown) return;
      console.log(`[WA] Restoring session: ${u.phone}`);
      try { createSession(u.phone); } catch (e) { console.error('[WA] Restore failed:', e.message); }
    }, i * STAGGER_MS);
    restoreTimers.add(timer);
  });
  return users.length;
}

module.exports = {
  createSession, destroySession, rescanSession, getSession, getStatus, getPairedAt, getOwnId,
  onQR, offQR, sendMessage, restoreAllSessions,
  pruneOldLogs, sanitizePhone, onLog, offLog, emitLog, shutdown
};
