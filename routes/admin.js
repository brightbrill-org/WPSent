'use strict';
const store = require('../services/adminStore');
const policy=require('../services/sendingPolicy');
const { withControlLock } = require('../services/controlLock');
const { WpUser } = require('./modelAccess');
const { pending } = require('./authState');
const wa = require('../waManager');
const adminHTML = require('../views/admin');
const COOKIE = 'wpsent_admin';
const cookieOpts = req => ({ httpOnly: true, signed: true, sameSite: 'strict', secure: !!req.secure, path: '/admin' });
const tokenOf = req => req.signedCookies?.[COOKIE];
function handler(fn) {
  return async (req, res, next) => {
    try { res.set('Cache-Control', 'no-store'); await fn(req, res, next); }
    catch (e) {
      if (e.status >= 400 && e.status < 500) return res.status(e.status).json({ error: e.message });
      console.error('[admin] request failed:', e.code || e.name);
      if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
    }
  };
}
const requireAdmin = handler(async (req, res, next) => {
  const admin = await store.currentAdmin(tokenOf(req));
  if (!admin) return res.status(401).json({ error: 'Administrator sign-in required' });
  req.admin = admin; next();
});
function requireMutation(req, res, next) {
  if (req.get('x-wpsent-admin') !== '1' || !req.is('application/json'))
    return res.status(403).json({ error: 'JSON and X-WPSent-Admin: 1 required' });
  const origin = req.get('origin');
  if (origin && origin !== req.protocol + '://' + req.get('host'))
    return res.status(403).json({ error: 'Cross-origin request rejected' });
  next();
}
const attempts = new Map();
function throttle(req, res, next) {
  const now = Date.now();
  for (const [k, v] of attempts) if (v.until <= now) attempts.delete(k);
  const key = req.ip || 'unknown';
  const entry = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
  if (entry.count >= 12 || (!attempts.has(key) && attempts.size >= 5000))
    return res.status(429).json({ error: 'Too many sign-in attempts; try again later' });
  entry.count++; attempts.set(key, entry); next();
}
function signInCookie(req, res, result) {
  res.cookie(COOKIE, result.token, { ...cookieOpts(req), maxAge: store.SESSION_MS });
}
module.exports = function registerAdmin(router) {
  router.get('/admin', (req, res) => { res.set('Cache-Control', 'no-store'); res.send(adminHTML()); });
  router.post('/admin/api/signup', requireMutation, throttle, handler(async (req, res) => {
    const { email, password, bootstrapToken } = req.body || {};
    const admin = await store.signup(email, password, bootstrapToken);
    if (admin.status === 'active') signInCookie(req, res, await store.login(email, password));
    res.status(201).json({ ok: true, admin });
  }));
  router.post('/admin/api/login', requireMutation, throttle, handler(async (req, res) => {
    const result = await store.login(req.body?.email, req.body?.password);
    signInCookie(req, res, result); res.json({ ok: true, admin: result.admin });
  }));
  router.post('/admin/api/logout', requireMutation, handler(async (req, res) => {
    await store.logout(tokenOf(req)); res.clearCookie(COOKIE, cookieOpts(req)); res.json({ ok: true });
  }));
  router.get('/admin/api/me', requireAdmin, handler(async (req, res) => res.json({ admin: req.admin })));
  router.get('/admin/api/phones', requireAdmin, handler(async (req, res) => {
    const phones = await WpUser.find({}).select('phone createdAt lastSeen revokedAt revocationCompleteAt').sort({ createdAt: 1 }).lean();
    res.json({ limit: await store.getPhoneLimit(), activeCount: phones.filter(p => !p.revokedAt).length,
      phones: phones.map(p => ({ phone: p.phone, createdAt: p.createdAt, lastSeen: p.lastSeen, revokedAt: p.revokedAt || null, revocationComplete: !!p.revocationCompleteAt, status: p.revokedAt ? 'revoked' : wa.getStatus(p.phone) })) });
  }));
  router.put('/admin/api/phone-limit', requireAdmin, requireMutation, handler(async (req, res) => {
    await withControlLock(async () => { await store.assertActor(req.admin.email, tokenOf(req)); await store.setPhoneLimit(req.body?.limit); });
    res.json({ ok: true, limit: await store.getPhoneLimit() });
  }));
  router.post('/admin/api/phones/:phone/revoke', requireAdmin, requireMutation, handler(async (req, res) => {
    const phone = req.params.phone;
    if (!/^\d{1,32}$/.test(phone)) return res.status(400).json({ error: 'Invalid phone' });
    await withControlLock(async () => {
      await store.assertActor(req.admin.email, tokenOf(req));
      const user = await WpUser.findOne({ phone });
      if (!user) throw Object.assign(new Error('Phone not found'), { status: 404 });
      await WpUser.updateOne({ phone, revokedAt: null }, { $set: { revokedAt: new Date() } });
      wa.blockPhone(phone); pending.delete(phone);
      try {
        await wa.destroySession(phone, { wipe: true });
        await WpUser.updateOne({ phone }, { $set: { revocationCompleteAt: new Date() } });
      } catch (e) {
        console.error('[admin] phone cleanup failed:', e.code || e.name);
        throw Object.assign(new Error('Phone revoked; authentication cleanup failed. Retry revocation.'), { status: 409 });
      }
    });
    res.json({ ok: true });
  }));
  router.get('/admin/api/sending-policy',requireAdmin,handler(async(req,res)=>res.json({global:policy.global(),fields:policy.fields,sessionKeys:policy.sessionKeys})));
  router.put('/admin/api/sending-policy',requireAdmin,requireMutation,handler(async(req,res)=>{
    const global=await withControlLock(async()=>{await store.assertActor(req.admin.email,tokenOf(req));return policy.setGlobal(req.body?.policy,req.admin.email);});
    res.json({ok:true,global});
  }));
  router.get('/admin/api/phones/:phone/sending-policy',requireAdmin,handler(async(req,res)=>{
    const phone=req.params.phone;if(!/^\d{1,32}$/.test(phone)||!await WpUser.findOne({phone,revokedAt:null}))return res.status(404).json({error:'Active phone not found'});
    res.json(policy.session(phone));
  }));
  router.put('/admin/api/phones/:phone/sending-policy',requireAdmin,requireMutation,handler(async(req,res)=>{
    const phone=req.params.phone;
    const result=await withControlLock(async()=>{await store.assertActor(req.admin.email,tokenOf(req));if(!/^\d{1,32}$/.test(phone)||!await WpUser.findOne({phone,revokedAt:null}))throw Object.assign(new Error('Active phone not found'),{status:404});return policy.setSession(phone,req.body?.override,req.admin.email);});
    res.json({ok:true,...result});
  }));
  router.get('/admin/api/admins', requireAdmin, handler(async (req, res) => res.json({ admins: await store.listAdmins() })));
  router.post('/admin/api/admins/approve', requireAdmin, requireMutation, handler(async (req, res) => {
    await store.approve(req.admin.email, tokenOf(req), req.body?.email); res.json({ ok: true });
  }));
  router.post('/admin/api/admins/revoke', requireAdmin, requireMutation, handler(async (req, res) => {
    await store.revoke(req.admin.email, tokenOf(req), req.body?.email); res.json({ ok: true });
  }));
  router.post('/admin/api/admins/password', requireAdmin, requireMutation, handler(async (req, res) => {
    await store.resetPassword(req.admin.email, tokenOf(req), req.body?.email, req.body?.password); res.json({ ok: true });
  }));
};
module.exports.requireAdmin = requireAdmin;
module.exports.requireMutation = requireMutation;
