'use strict';

const { WpUser } = require('./modelAccess');
const { str, safeEq, ah } = require('./helpers');
const { userFromCookie } = require('./authState');
const wa = require('../waManager');

const requireKey = ah(async (req, res, next) => {
  const clientId = str(req.query.clientid || req.headers['x-client-id']);
  const key      = str(req.query.key      || req.headers['x-api-key']);
  if (!clientId) return res.status(401).json({ error: 'Missing clientid' });
  if (!key)      return res.status(401).json({ error: 'Missing key' });
  const user = await WpUser.findOne({ clientId });
  if (!user)                       return res.status(403).json({ error: 'Unknown client ID' });
  if (!safeEq(user.apiKey, key))   return res.status(403).json({ error: 'Invalid API key' });
  req.wpUser = user;
  next();
});

const requireDashboard = ah(async (req, res, next) => {
  const user = await userFromCookie(req);
  if (!user) {
    res.clearCookie('wpsent_phone');
    return req.path.startsWith('/api/') ? res.status(401).json({ error: 'Not signed in' }) : res.redirect('/');
  }
  if (wa.getStatus(user.phone) === 'not_started') wa.createSession(user.phone);
  req.wpPhone = user.phone;
  req.wpUser  = user;
  next();
});

module.exports = { requireKey, requireDashboard };
