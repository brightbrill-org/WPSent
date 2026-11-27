'use strict';

const crypto   = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { WpUser } = require('./modelAccess');
const { safeEq } = require('./helpers');

function genClientId() { return 'cid_' + crypto.randomBytes(6).toString('hex'); }
async function uniqueClientId() {
  for (let i = 0; i < 10; i++) {
    const id = genClientId();
    if (!(await WpUser.exists({ clientId: id }))) return id;
  }
  throw new Error('Could not generate a unique client ID');
}

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const PAIR_TTL   = 10 * 60 * 1000;
const cookieOpts = (req, maxAge) => ({ httpOnly: true, sameSite: 'lax', signed: true, secure: !!req.secure, maxAge });
const keyTag     = (user) => crypto.createHash('sha256').update(String(user.apiKey)).digest('hex').slice(0, 16);

function setSession(req, res, user) {
  res.cookie('wpsent_phone', `${user.phone}:${keyTag(user)}`, cookieOpts(req, SESSION_MS));
}
async function userFromCookie(req) {
  const raw = req.signedCookies && req.signedCookies.wpsent_phone;
  if (typeof raw !== 'string') return null;
  const [phone, tag] = raw.split(':');
  if (!phone || !tag) return null;
  const user = await WpUser.findOne({ phone });
  return user && safeEq(keyTag(user), tag) ? user : null;
}

const pending = new Map();
function startPairing(req, res, phone, rotate) {
  for (const [p, v] of pending) if (Date.now() - v.createdAt > PAIR_TTL) pending.delete(p);
  const nonce = crypto.randomBytes(16).toString('hex');
  pending.set(phone, { nonce, rotate, createdAt: Date.now() });
  res.cookie('wpsent_pair', `${phone}:${nonce}`, cookieOpts(req, PAIR_TTL));
}
function getPairing(req) {
  const raw = req.signedCookies && req.signedCookies.wpsent_pair;
  if (typeof raw !== 'string') return null;
  const [phone, nonce] = raw.split(':');
  const p = pending.get(phone);
  if (!p || Date.now() - p.createdAt > PAIR_TTL || !safeEq(p.nonce, nonce)) return null;
  return { phone, ...p };
}

async function rotateCredentials(phone) {
  return WpUser.findOneAndUpdate({ phone }, {
    clientId: await uniqueClientId(), apiKey: uuidv4(),
    loginAttempts: 0, lockedUntil: null,
    webhooks: []
  }, { new: true });
}

module.exports = { uniqueClientId, setSession, userFromCookie, pending, startPairing, getPairing, rotateCredentials };
