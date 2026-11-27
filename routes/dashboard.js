'use strict';

const qrcode   = require('qrcode');
const { MessageLog } = require('./modelAccess');
const { ah } = require('./helpers');
const { requireDashboard } = require('./authMiddleware');
const wa = require('../waManager');
const dashboardHTML = require('../views/dashboard');

module.exports = function registerDashboard(router) {
  router.get('/dashboard', requireDashboard, (req, res) => {
    res.send(dashboardHTML(req.wpUser));
  });

  router.get('/logout', (req, res) => { res.clearCookie('wpsent_phone'); res.clearCookie('wpsent_pair'); res.redirect('/'); });

  router.get('/api/me', requireDashboard, ah(async (req, res) => {
    const logs = await MessageLog.find({ userId: req.wpUser._id }).sort({ timestamp: -1 }).limit(100).lean();
    res.set('Cache-Control', 'no-store');
    res.json({
      apiKey:   req.wpUser.apiKey,
      clientId: req.wpUser.clientId,
      phone:    req.wpUser.phone,
      webhooks: req.wpUser.webhooks || [],
      status:   wa.getStatus(req.wpUser.phone),
      logs
    });
  }));

  router.get('/api/status', requireDashboard, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ status: wa.getStatus(req.wpPhone) });
  });

  const rescanCooldown = new Map();
  router.post('/api/rescan', requireDashboard, ah(async (req, res) => {
    const phone = req.wpPhone;
    if (Date.now() - (rescanCooldown.get(phone) || 0) < 10_000)
      return res.status(429).json({ error: 'Please wait a few seconds before trying again.' });
    rescanCooldown.set(phone, Date.now());
    await wa.rescanSession(phone);
    res.json({ ok: true });
  }));

  router.get('/api/qr-stream', requireDashboard, (req, res) => {
    const phone = req.wpPhone;
    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.flushHeaders();

    const send = (event, data) => { try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch(_){} };
    const sendQR = async (qr) => {
      try { const dataUrl = await qrcode.toDataURL(qr, { width: 300 }); if (!wa.isPhoneBlocked(phone)) send('qr', { dataUrl }); }
      catch (e) { console.error('[qr] render failed', e.message); }
    };
    let timer = null;
    const cleanup = () => { clearInterval(timer); wa.offQR(phone, sendQR); };
    const check = () => {
      if (wa.isPhoneBlocked(phone)) { cleanup(); res.end(); return true; }
      if (wa.getStatus(phone) === 'ready') { send('ready', {}); cleanup(); res.end(); return true; }
      return false;
    };

    if (check()) return;
    wa.onQR(phone, sendQR);
    timer = setInterval(check, 2000);
    req.on('close', cleanup);
  });

  router.get('/api/logs-stream', requireDashboard, (req, res) => {
    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.flushHeaders();

    const send = (data) => { if (wa.isPhoneBlocked(req.wpPhone)) return; try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch(_){} };
    const uid  = req.wpUser._id.toString();
    wa.onLog(uid, send);
    const hb = setInterval(() => { if (wa.isPhoneBlocked(req.wpPhone)) { res.end(); return; } try { res.write(': heartbeat\n\n'); } catch(_){} }, 10000);
    req.on('close', () => { clearInterval(hb); wa.offLog(uid, send); });
  });
};
