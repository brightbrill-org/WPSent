'use strict';

const crypto   = require('crypto');
const qrcode   = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { WpUser } = require('./modelAccess');
const { str, safeEq, ah } = require('./helpers');
const { CONFIG, MAX_ATTEMPTS, LOCKOUT_MS } = require('./config');
const { uniqueClientId, setSession, pending, startPairing, getPairing, rotateCredentials } = require('./authState');
const wa = require('../waManager');
const { withControlLock } = require('../services/controlLock');
const { getPhoneLimit } = require('../services/adminStore');

module.exports = function registerAuth(router) {
  const resetCodes   = new Map();
  const codeCooldown = new Map();

  router.post('/auth/start', ah(async (req, res) => withControlLock(async () => {
    const phone = wa.sanitizePhone(str(req.body?.phone));
    if (!phone) return res.status(400).json({ error: 'Phone number required' });

    const user = await WpUser.findOne({ phone });

    if (user?.revokedAt || wa.isPhoneBlocked(phone)) return res.status(403).json({ error: 'Phone registration revoked' });
    if (user) {
      return res.json({ ok: true, phone, existing: true });
    }

    const limit = await getPhoneLimit();
    if (limit !== null) {
      const count = await WpUser.countDocuments({ revokedAt: null });
      if (count >= limit) {
        return res.status(503).json({
          error: 'server_full',
          message: 'This server is at capacity. Please self-host your own instance.',
          github: CONFIG.GITHUB_URL,
          instagram: CONFIG.INSTAGRAM_URL,
          email: CONFIG.EMAIL
        });
      }
    }

    try {
      await WpUser.create({ phone, clientId: await uniqueClientId(), apiKey: uuidv4() });
    } catch (e) {
      if (e && e.code === 11000) return res.json({ ok: true, phone, existing: true });
      throw e;
    }
    wa.createSession(phone);
    startPairing(req, res, phone, false);
    res.json({ ok: true, phone, existing: false });
  })));

  router.post('/auth/login', ah(async (req, res) => {
    const phone = wa.sanitizePhone(str(req.body?.phone));
    const key   = str(req.body?.key);
    if (!phone || !key) return res.status(400).json({ error: 'phone and key required' });

    const user = await WpUser.findOne({ phone });
    if (!user || user.revokedAt || wa.isPhoneBlocked(phone)) return res.status(403).json({ error: 'User not found or revoked' });

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remaining = Math.ceil((user.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({ error: `Locked. Try again in ${remaining} minute${remaining !== 1 ? 's' : ''}.`, locked: true, remaining });
    }

    if (!safeEq(user.apiKey, key)) {
      const attempts = (user.loginAttempts || 0) + 1;
      const left     = MAX_ATTEMPTS - attempts;
      if (attempts >= MAX_ATTEMPTS) {
        await WpUser.updateOne({ phone }, { loginAttempts: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MS) });
        return res.status(429).json({ error: 'Too many attempts. Locked for 15 minutes.', locked: true, remaining: 15 });
      }
      await WpUser.updateOne({ phone }, { loginAttempts: attempts });
      return res.status(403).json({ error: `Wrong secret key. ${left} attempt${left !== 1 ? 's' : ''} remaining.`, attemptsLeft: left });
    }

    await WpUser.updateOne({ phone }, { loginAttempts: 0, lockedUntil: null, lastSeen: new Date() });
    if (wa.getStatus(phone) === 'not_started') wa.createSession(phone);
    setSession(req, res, user);
    res.json({ ok: true, phone });
  }));

  router.post('/auth/reset', ah(async (req, res) => {
    const phone = wa.sanitizePhone(str(req.body?.phone));
    if (!phone) return res.status(400).json({ error: 'phone required' });
    const user = await WpUser.findOne({ phone });
    if (!user || user.revokedAt || wa.isPhoneBlocked(phone)) return res.status(403).json({ error: 'User not found or revoked' });

    const st = wa.getStatus(phone);
    if (st === 'ready') {
      if (Date.now() - (codeCooldown.get(phone) || 0) < 60_000)
        return res.status(429).json({ error: 'Please wait a minute before requesting another code.' });
      codeCooldown.set(phone, Date.now());
      const code = String(crypto.randomInt(100000, 1000000));
      resetCodes.set(phone, { code, exp: Date.now() + 10 * 60_000, attempts: 0 });
      try {
        await wa.sendMessage(phone, wa.getOwnId(phone), `WPSent reset code: ${code}\nValid for 10 minutes. If you didn't request this, ignore it.`);
      } catch (e) {
        resetCodes.delete(phone);
        return res.status(502).json({ error: 'Could not deliver the code via WhatsApp: ' + e.message });
      }
      return res.json({ ok: true, mode: 'code' });
    }

    if (st === 'auth_failure') await wa.destroySession(phone);
    else if (st === 'error')   await wa.destroySession(phone);
    if (wa.getStatus(phone) === 'not_started') wa.createSession(phone);
    startPairing(req, res, phone, true);
    res.json({ ok: true, mode: 'qr' });
  }));

  router.post('/auth/reset/confirm', ah(async (req, res) => {
    const phone = wa.sanitizePhone(str(req.body?.phone));
    const code  = str(req.body?.code);
    if (wa.isPhoneBlocked(phone) || !await WpUser.exists({ phone, revokedAt: null })) return res.status(403).json({ error: 'Phone registration revoked or not found' });
    const entry = resetCodes.get(phone);
    if (!entry || entry.exp < Date.now()) { resetCodes.delete(phone); return res.status(400).json({ error: 'Code expired. Request a new one.' }); }
    entry.attempts++;
    if (entry.attempts > 5) { resetCodes.delete(phone); return res.status(429).json({ error: 'Too many wrong codes. Request a new one.' }); }
    if (!safeEq(entry.code, code)) return res.status(403).json({ error: `Wrong code. ${5 - entry.attempts} attempt(s) left.` });
    resetCodes.delete(phone);
    const user = await rotateCredentials(phone);
    if (!user) return res.status(404).json({ error: 'User not found' });
    setSession(req, res, user);
    res.json({ ok: true });
  }));

  router.get('/auth/claim', ah(async (req, res) => {
    const p = getPairing(req);
    if (!p || wa.isPhoneBlocked(p.phone) || !await WpUser.exists({ phone: p.phone, revokedAt: null }) || wa.getPairedAt(p.phone) < p.createdAt) return res.redirect('/');
    pending.delete(p.phone);
    res.clearCookie('wpsent_pair');
    const user = p.rotate ? await rotateCredentials(p.phone) : await WpUser.findOne({ phone: p.phone });
    if (!user) return res.redirect('/');
    setSession(req, res, user);
    res.redirect('/dashboard');
  }));

  router.get('/auth/qr-stream', (req, res) => {
    const p = getPairing(req);
    if (!p || wa.isPhoneBlocked(p.phone)) return res.status(403).end('Start sign-in first');
    const phone = p.phone;

    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.flushHeaders();

    const send = (event, data) => { try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch(_){} };
    const sendQR = async (qr) => {
      try { send('qr', { dataUrl: await qrcode.toDataURL(qr, { width: 300 }) }); }
      catch (e) { console.error('[qr] render failed', e.message); }
    };
    let timer = null;
    const cleanup = () => { clearInterval(timer); wa.offQR(phone, sendQR); };

    const check = () => {
      if (wa.isPhoneBlocked(phone)) { send('blocked', {}); cleanup(); res.end(); return true; }
      if (wa.getPairedAt(phone) >= p.createdAt) { send('ready', {}); cleanup(); res.end(); return true; }
      if (wa.getStatus(phone) === 'ready')       { send('blocked', {}); cleanup(); res.end(); return true; }
      return false;
    };

    if (check()) return;
    wa.onQR(phone, sendQR);
    timer = setInterval(check, 2000);
    req.on('close', cleanup);
  });
};
