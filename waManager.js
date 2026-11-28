const { Client } = require('whatsapp-web.js');
const { deadline, positiveInt, createWatchdog, retryDelay, instrumentAttachment } = require('./utils/readiness');
const { createLidResolver, webhookSender } = require('./utils/lidResolver');
const { createDirectoryReader } = require('./utils/directory');
const { createMessageActions, messageIdOf } = require('./utils/messageActions');
const {nativeOptions,confirmNativeMedia,inboundMediaIdentity}=require('./utils/nativeMedia');
const {createGroupActions}=require('./utils/groupActions');
const { createInboundCapture } = require('./utils/inboundMedia');
const inboundMediaStore = require('./services/inboundMediaStore');
const captureInboundMedia = createInboundCapture({store: inboundMediaStore.store});
const { HybridAuth, deleteBackups } = require('./auth/HybridAuth');
const { selectWebhooks, rescanReason, AUTH_RESCAN_REQUIRED } = require('./utils/webhookEvents');
const { createAuthRescanNotifier } = require('./utils/authRescanNotifier');
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
const blockedPhones = new Set();
function isPhoneBlocked(phone) { return blockedPhones.has(String(phone)); }
function blockPhone(phone) {
  blockedPhones.add(String(phone));
  sessions.get(String(phone))?.watchdog?.stop();
  const timer = reconnectTimers.get(String(phone));
  if (timer) { clearTimeout(timer); reconnectTimers.delete(String(phone)); }
}

const qrCallbacks  = new Map();
const logListeners = new Map();
const reconnectTimers = new Map();
const retryCount      = new Map();
const pairedAtMap     = new Map();

const RECONNECT_MS = Number(process.env.WA_RECONNECT_MS) || 5000;
const STAGGER_MS   = Number(process.env.WA_STAGGER_MS)   || 3000;
const MAX_RETRIES  = positiveInt(process.env.WA_READY_MAX_RETRIES, 3, 0, 20);
const READY_TIMEOUT_MS = positiveInt(process.env.WA_READY_TIMEOUT_MS, 120000, 1000, 600000);
const CALLBACK_TIMEOUT_MS = positiveInt(process.env.WA_CALLBACK_TIMEOUT_MS, 20000, 1000, 120000);
const CLOSE_TIMEOUT_MS = positiveInt(process.env.WA_CLOSE_TIMEOUT_MS, 30000, 1000, 90000);
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
  if (!freshUser || freshUser.revokedAt || isPhoneBlocked(freshUser.phone)) return;
  const active = selectWebhooks(freshUser.webhooks, payload.event);
  if (!active.length) return;
  console.log(`[WH] Firing ${active.length} webhook(s)`);
  await Promise.allSettled(active.map(async (wh) => {
    try {
      if (wh.method === 'POST') {
        await axios.post(wh.url, payload, { timeout: 8000 });
      } else {
        const sep    = wh.url.includes('?') ? '&' : '?';
        const params = new URLSearchParams(Object.entries(payload).filter(([, value]) => value != null)).toString();
        await axios.get(`${wh.url}${sep}${params}`, { timeout: 8000 });
      }
      console.log(`[WH] OK: ${wh.url}`);
    } catch (e) {
      console.error(`[WH] Failed: ${wh.url} — ${e.message}`);
    }
  }));
}

// Claim a notification episode only for an account with an active rescan
// subscription. Existing message-only webhooks never receive auth events.
const authRescanNotifier = createAuthRescanNotifier({
  claim: (phone, timestamp) => WpUser.findOneAndUpdate({
    phone, revokedAt: null, authRescanRequiredAt: null,
    webhooks: {$elemMatch:{event:AUTH_RESCAN_REQUIRED,active:true}}
  }, {$set:{authRescanRequiredAt:timestamp}}, {new:true}).select('_id').lean(),
  clear: phone => WpUser.updateOne({phone,revokedAt:null},{$set:{authRescanRequiredAt:null}}),
  deliver: fireWebhooks,
  onError: e => console.error('[WA] Rescan webhook state error:',e.message)
});
function notifyRescan(phone,session,reason) {
  if(shuttingDown||isPhoneBlocked(phone)||session.destroyed||session.initFailed||sessions.get(phone)!==session)return;
  // An explicit logout may destroy the session before the queued notification
  // is dispatched. Account revocation and shutdown are still checked.
  void authRescanNotifier.notify(phone,reason,()=>!shuttingDown&&!isPhoneBlocked(phone));
}

function classifyMessage(msg) {
  const t = msg.type;
  if (t === 'reaction') return 'reaction';
  if (t === 'sticker')  return 'sticker';
  if (t === 'image')    return 'image';
  if (t === 'video')    return 'video';
  if (t === 'audio' || t === 'ptt') return 'audio';
  if (t === 'document') return 'document';
  if (t === 'location') return 'location';
  if (t === 'vcard' || t === 'multi_vcard') return 'contact';
  return 'text';
}

function extractBody(msg) {
  if (msg.type === 'reaction') {
    const emoji = msg.reaction?.text || msg._data?.reactionText || '👍';
    return `[Reaction: ${emoji}]`;
  }
  if (msg.type === 'sticker')  return '[Sticker]';
  if (msg.type === 'image')    return msg.body || '[Image]';
  if (msg.type === 'video')    return msg.body || '[Video]';
  if (msg.type === 'ptt') return '[Voice note]';
  if (msg.type === 'audio') return '[Audio]';
  if (msg.type === 'document') return `[Document: ${msg.body || 'file'}]`;
  if (msg.type === 'location') return `[Location: ${msg.location?.latitude || '?'},${msg.location?.longitude || '?'}]`;
  if (msg.type === 'vcard' || msg.type === 'multi_vcard') return '[Contact card]';
  const body = msg.body || msg.caption || msg._data?.body || '';
  return body || `[${msg.type || 'message'}]`;
}

async function teardown(phone) {
  if (closingSessions.has(phone)) return closingSessions.get(phone);
  const s = sessions.get(phone);
  if (!s) return;
  if (s.terminal) { sessions.delete(phone); return; }
  s.destroyed = true;
  s.watchdog?.stop();
  stopQR(s);
  const task = (async () => {
    if (shuttingDown) console.log('[WA] Shutdown: stopping periodic backups: ' + phone);
    await s.auth.stopBackups();
    if (shuttingDown) console.log('[WA] Shutdown: backups drained: ' + phone);
    // Do not open a second browser on the same profile until the first closes.
    if (shuttingDown) console.log('[WA] Shutdown: closing Chrome: ' + phone);
    if (s.client.pupBrowser) await deadline(() => s.client.destroy(), CLOSE_TIMEOUT_MS, 'Chrome shutdown');
    if (s.initTask) await deadline(() => s.initTask.catch(() => {}), CLOSE_TIMEOUT_MS, 'Initialization shutdown');
    if (s.client.pupBrowser?.connected) await deadline(() => s.client.destroy(), CLOSE_TIMEOUT_MS, 'Chrome shutdown');
    // Fail closed rather than starting a second browser on this profile.
    const process = s.client.pupBrowser?.process?.();
    if (s.client.pupBrowser?.connected || (process && process.exitCode === null && process.signalCode === null)) {
      throw new Error('Chrome termination not confirmed');
    }
    if (shuttingDown) console.log('[WA] Shutdown: Chrome closed: ' + phone);
    if (sessions.get(phone) === s) sessions.delete(phone);
  })();
  closingSessions.set(phone, task);
  try { await task; } finally { closingSessions.delete(phone); }
}

function scheduleReconnect(phone, delay = RECONNECT_MS) {
  if (shuttingDown || isPhoneBlocked(phone) || reconnectTimers.has(phone)) return;
  const s = sessions.get(phone);
  if (s) s.reconnecting = true;
  reconnectTimers.set(phone, setTimeout(async () => {
    reconnectTimers.delete(phone);
    try {
      await teardown(phone);
      if (!shuttingDown && !isPhoneBlocked(phone)) createSession(phone);
    } catch (e) {
      console.error('[WA] Reconnect teardown failed:', e.message);
      if (!shuttingDown && !isPhoneBlocked(phone)) {
        const current = sessions.get(phone);
        if (current) { current.reconnecting = false; current.status = 'initialization_failed'; }
        console.error('[WA] Recovery stopped: browser termination not confirmed; controlled PM2 restart required: ' + phone);
      }
    }
  }, delay));
}

function failInitialization(phone, session, error) {
  if (shuttingDown || isPhoneBlocked(phone) || session.destroyed || session.status === 'ready' || session.initFailed || sessions.get(phone) !== session) return;
  session.initFailed = true;
  session.watchdog?.stop();
  stopQR(session);
  session.auth.canBackup = false;
  session.status = 'initialization_failed';
  const n = (retryCount.get(phone) || 0) + 1;
  retryCount.set(phone, n);
  console.error('[WA] Initialization failed: ' + phone + ' — ' + (error?.message || String(error)));
  if (n <= MAX_RETRIES) {
    const delay = retryDelay(n, RECONNECT_MS);
    session.status = 'recovering';
    console.warn('[WA] Readiness recovery ' + n + '/' + MAX_RETRIES + ' in ' + delay + 'ms; preserving authentication: ' + phone);
    scheduleReconnect(phone, delay);
  } else {
    console.error('[WA] Readiness retries exhausted: ' + phone + '; preserving authentication, restart required');
    // Close the stalled client, but leave a terminal status in the session map.
    session.reconnecting = true;
    teardown(phone).then(() => {
      if (!shuttingDown && !isPhoneBlocked(phone) && !sessions.has(phone) && retryCount.get(phone) === n) {
        sessions.set(phone, { terminal: true, status: 'initialization_failed', destroyed: true, reconnecting: false });
      }
    }).catch(e => console.error('[WA] Exhausted session shutdown failed:', e.message));
  }
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
  notifyRescan(phone, session, 'qr_required');
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
  if (isPhoneBlocked(phone)) throw new Error('Phone registration revoked');
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
  session.watchdog = createWatchdog({ timeoutMs: READY_TIMEOUT_MS, onTimeout: () => {
    failInitialization(phone, session, new Error('Authenticated but Ready not received within ' + READY_TIMEOUT_MS + 'ms'));
  }});
  instrumentAttachment(client, {
    timeoutMs: CALLBACK_TIMEOUT_MS,
    log: msg => console.log('[WA] Init ' + phone + ': ' + msg),
    onFailure: err => failInitialization(phone, session, err)
  });
  // afterAuthReady may still be called by a late library callback; never allow
  // an abandoned initialization to start new backups.
  const afterAuthReady = auth.afterAuthReady.bind(auth);
  auth.afterAuthReady = async () => {
    if (session.destroyed || session.initFailed || isPhoneBlocked(phone) || shuttingDown || session.status !== 'ready') return;
    await afterAuthReady();
  };
  const resolveSender = createLidResolver(client);
  session.resolveSender = resolveSender;

  client.on('qr', qr => publishQR(phone, session, qr));
  client.on('authenticated', () => {
    if (session.destroyed || session.initFailed || session.status === 'ready' || shuttingDown || isPhoneBlocked(phone)) return;
    session.authenticated = true;
    stopQR(session);
    session.status = 'initializing';
    console.log(`[WA] Authenticated: ${phone}`);
    session.watchdog.start();
  });
  startQRFallback(phone, session);

  client.on('ready', async () => {
    if (session.destroyed || session.initFailed || shuttingDown || isPhoneBlocked(phone)) return;
    session.watchdog.stop();
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
    void authRescanNotifier.ready(phone,()=>!shuttingDown&&!isPhoneBlocked(phone));
    try { await WpUser.updateOne({ phone }, { lastSeen: new Date() }); }
    catch (e) { console.error('[WA] lastSeen update failed:', e.message); }
  });

  client.on('remote_session_saved', () => {
    console.log(`[WA] Session saved to MongoDB: ${phone}`);
  });

  client.on('auth_failure', (msg) => {
    if (session.destroyed || session.initFailed) return;
    session.watchdog.stop();
    session.auth.canBackup = false;
    stopQR(session);
    session.status = 'auth_failure';
    notifyRescan(phone, session, 'auth_failure');
    console.error(`[WA] Auth failure for ${phone}:`, msg);
  });

  client.on('disconnected', (reason) => {
    if (session.destroyed || session.initFailed) return;
    const authReason = rescanReason(reason);
    if (authReason) notifyRescan(phone, session, authReason);
    session.watchdog.stop();
    if (session.status !== 'ready') { failInitialization(phone, session, new Error('Disconnected during initialization: ' + reason)); return; }
    session.auth.canBackup = false;
    stopQR(session);
    session.status = 'disconnected';
    console.log(`[WA] Disconnected ${phone}: ${reason} — reconnecting`);
    scheduleReconnect(phone);
  });

  client.on('error', (err) => {
    if (session.destroyed || session.initFailed) return;
    if (session.status !== 'ready') { failInitialization(phone, session, err); return; }
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
      if (session.destroyed || session.initFailed || session.status !== 'ready') return;
      if (msg.from === 'status@broadcast' || msg.isStatus) return;
      const user = await WpUser.findOne({ phone, revokedAt: null });
      if (!user || isPhoneBlocked(phone)) return;
      const type = classifyMessage(msg);
      const body = extractBody(msg);
      const sender = await resolveSender(msg.from);
      // Group chat identity remains in from; expose the participant separately.
      const author = msg.author ? await resolveSender(msg.author) : null;
      const participant = author ? { authorId: author.fromId, authorPhone: author.fromPhone, authorLid: author.fromLid } : {};
      if (isPhoneBlocked(phone)) return;
      const allowed = () => !shuttingDown && !session.destroyed && !session.initFailed && session.status === 'ready' && !isPhoneBlocked(phone);
      const media = await captureInboundMedia(msg, user._id, allowed);
      if (!allowed()) return;
      const messageId = messageIdOf(msg);
      const identity = {chatId: msg.from, ...(messageId ? {messageId} : {}), ...inboundMediaIdentity(msg)};
      const log  = await MessageLog.create({ userId: user._id, direction: 'inbound', ...sender, ...participant, ...identity, body, type, status: 'received', ...(media || {}) });
      await pruneOldLogs(user._id);
      emitLog(user._id.toString(), log.toObject());
      await fireWebhooks(user._id, { event: 'message_received', ...webhookSender(sender), ...participant, ...identity, body, type, logId: String(log._id), ...(media || {}), timestamp: (log.timestamp || new Date()).toISOString() });
    } catch (e) { console.error('[WA] message handler error:', e.message); }
  });

  client.on('message_reaction', async (reaction) => {
    try {
      if (session.destroyed || session.initFailed || session.status !== 'ready') return;
      const user = await WpUser.findOne({ phone, revokedAt: null });
      if (!user || isPhoneBlocked(phone)) return;
      const body = `[Reaction: ${reaction.reaction || '👍'}]`;
      const sender = await resolveSender(reaction.senderId);
      if (isPhoneBlocked(phone)) return;
      const log  = await MessageLog.create({ userId: user._id, direction: 'inbound', ...sender, body, type: 'reaction', status: 'received' });
      await pruneOldLogs(user._id);
      emitLog(user._id.toString(), log.toObject());
      await fireWebhooks(user._id, { event: 'message_received', ...webhookSender(sender), body, type: 'reaction', timestamp: (log.timestamp || new Date()).toISOString() });
    } catch (e) { console.error('[WA] reaction handler error:', e.message); }
  });

  session.initTask = client.initialize().catch(err => failInitialization(phone, session, err));

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
  if (isPhoneBlocked(phone)) throw new Error('Phone registration revoked');
  await destroySession(phone, { wipe: true });
  return createSession(phone);
}

async function resolveLid(phone, lid) {
  if (isPhoneBlocked(phone)) throw Object.assign(new Error('Phone registration revoked'), { code: 'WA_NOT_READY' });
  const session = sessions.get(phone);
  if (!session || session.destroyed || session.status !== 'ready') {
    const err = new Error('WhatsApp session not ready');
    err.code = 'WA_NOT_READY';
    throw err;
  }
  const sender = await session.resolveSender(lid);
  return { lid: sender.fromLid, phone: sender.fromPhone, phoneId: sender.fromPhone ? sender.fromPhone + '@c.us' : null, resolved: !!sender.fromPhone };
}

function getSession(phone) { return sessions.get(phone) || null; }
const listDirectory = createDirectoryReader({getSession,isBlocked:phone=>shuttingDown||isPhoneBlocked(phone)});
const {markSeen,reply:replyMessage}=createMessageActions({getSession,isBlocked:phone=>shuttingDown||isPhoneBlocked(phone)});
const groupAction=createGroupActions({getSession,isBlocked:phone=>shuttingDown||isPhoneBlocked(phone)});
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

const nativeMediaBusy=new WeakSet();
let nativeMediaActive=0;
async function sendNativeMedia(phone,chatId,payload,media){
  const session=sessions.get(phone);
  const fail=(message,code)=>{throw Object.assign(new Error(message),{code});};
  const check=()=>{if(shuttingDown||isPhoneBlocked(phone)||!session||sessions.get(phone)!==session||session.destroyed||session.initFailed||session.status!=='ready')fail('WhatsApp session not ready','WA_NOT_READY');};
  check();
  if(nativeMediaActive>=2||nativeMediaBusy.has(session))fail('Another media send is in progress','WA_NATIVE_MEDIA_BUSY');
  nativeMediaBusy.add(session);nativeMediaActive++;
  let expired=false;
  const work=Promise.resolve().then(async()=>{
    check();
    if(expired)fail('Media send timed out','WA_NATIVE_MEDIA_TIMEOUT');
    const sent=confirmNativeMedia(await session.client.sendMessage(chatId,payload,nativeOptions(media)),media);
    const messageId=messageIdOf(sent);
    if(!messageId)fail('WhatsApp did not confirm message identity','WA_NATIVE_MEDIA_FAILED');
    return {messageId};
  }).finally(()=>{nativeMediaActive--;nativeMediaBusy.delete(session);});
  try{return await deadline(()=>work,90000,'WhatsApp native media send');}
  catch(e){if(e.code==='WA_READY_TIMEOUT'){expired=true;fail('Media send timed out; verify recipient before retrying','WA_NATIVE_MEDIA_TIMEOUT');}throw e;}
}
async function sendMessage(phone, to, body, shareType) {
  if (isPhoneBlocked(phone)) throw new Error('Phone registration revoked');
  const session = sessions.get(phone);
  if (!session || session.status !== 'ready') throw new Error('WhatsApp session not ready');
  const clean = to.includes('@') ? to : sanitizePhone(to) + '@c.us';
  if (!clean || clean === '@c.us') throw new Error('Invalid phone number');
  try {
    if (shareType === 'contact' || shareType === 'location') {
      const sent = await session.client.sendMessage(clean, body, shareType === 'contact' ? { parseVCards: true, waitUntilMsgSent: true } : { waitUntilMsgSent: true });
      const expected = shareType === 'contact' ? 'vcard' : 'location';
      if (!sent || sent.type !== expected) throw new Error('WhatsApp did not confirm native ' + shareType + ' message; verify recipient before retrying');
    } else {
      await session.client.sendMessage(clean, body);
    }
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
    const wasReady = s.status === 'ready' && s.auth?.canBackup;
    console.log('[WA] Shutdown: session ' + phone + ', status=' + s.status + ', backupEligible=' + wasReady);
    await teardown(phone);
    // Chrome has closed: on-disk storage is no longer being mutated by the browser.
    if (wasReady && !s.auth.loggedOut && !isPhoneBlocked(phone)) {
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
  const revoked = await WpUser.find({ revokedAt: { $ne: null } }).select('phone').lean();
  for (const user of revoked) blockPhone(user.phone);
  const users = await WpUser.find({ revokedAt: null }).select('phone').lean();
  users.forEach((u, i) => {
    const timer = setTimeout(() => {
      restoreTimers.delete(timer);
      if (shuttingDown || isPhoneBlocked(u.phone)) return;
      console.log(`[WA] Restoring session: ${u.phone}`);
      try { createSession(u.phone); } catch (e) { console.error('[WA] Restore failed:', e.message); }
    }, i * STAGGER_MS);
    restoreTimers.add(timer);
  });
  return users.length;
}

module.exports = {
  createSession, destroySession, rescanSession, getSession, getStatus, getPairedAt, getOwnId, blockPhone, isPhoneBlocked,
  onQR, offQR, sendMessage, sendNativeMedia, resolveLid, listDirectory, markSeen, replyMessage, groupAction, restoreAllSessions,
  pruneOldLogs, sanitizePhone, onLog, offLog, emitLog, shutdown
};
