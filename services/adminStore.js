'use strict';
const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { withControlLock } = require('./controlLock');
const { safeEq } = require('../routes/helpers');
const SESSION_MS = 12 * 60 * 60 * 1000;
const col = name => mongoose.connection.db.collection(name);
const admins = () => col('wpsent_admins');
const sessions = () => col('wpsent_admin_sessions');
const settings = () => col('wpsent_settings');
const digest = token => crypto.createHash('sha256').update(token).digest('hex');
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function normalizeEmail(value) {
  if (typeof value !== 'string') fail(400, 'Valid email required');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Valid email required');
  return email;
}
function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72)
    fail(400, 'Password must be at least 12 characters and at most 72 UTF-8 bytes');
  return password;
}
function validateLimit(value) {
  if (value !== null && (!Number.isSafeInteger(value) || value < 0 || value > 100000))
    fail(400, 'Limit must be null (unlimited) or an integer from 0 to 100000');
  return value;
}
function publicAdmin(a) { return { email: a._id, status: a.status, createdAt: a.createdAt, approvedAt: a.approvedAt || null }; }
async function signup(email, password, bootstrapToken) {
  email = normalizeEmail(email); validatePassword(password);
  return withControlLock(async () => {
    if (await admins().findOne({ _id: email })) fail(409, 'Account already exists');
    const first = !(await admins().countDocuments());
    if (first) {
      const expected = process.env.ADMIN_BOOTSTRAP_TOKEN || '';
      if (expected.length < 32 || typeof bootstrapToken !== 'string' || !safeEq(expected, bootstrapToken))
        fail(403, 'Initial administrator requires the configured bootstrap token');
    }
    const now = new Date();
    const a = { _id: email, passwordHash: await bcrypt.hash(password, 12), status: first ? 'active' : 'pending', version: 1, createdAt: now, approvedAt: first ? now : null };
    await admins().insertOne(a);
    return publicAdmin(a);
  });
}
async function login(email, password) {
  email = normalizeEmail(email);
  if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 72) fail(403, 'Invalid credentials');
  const a = await admins().findOne({ _id: email });
  const hash = a?.passwordHash || '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxVEQ6F9Y9tA2vS2zqKk1iOQzeG';
  if (!(await bcrypt.compare(password, hash)) || !a) fail(403, 'Invalid credentials');
  if (a.status !== 'active') fail(403, a.status === 'pending' ? 'Awaiting administrator approval' : 'Administrator access revoked');
  const token = crypto.randomBytes(32).toString('hex');
  await sessions().deleteMany({ expiresAt: { $lte: new Date() } });
  await sessions().insertOne({ _id: digest(token), email, version: a.version, expiresAt: new Date(Date.now() + SESSION_MS) });
  return { token, admin: publicAdmin(a) };
}
async function currentAdmin(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
  const s = await sessions().findOne({ _id: digest(token), expiresAt: { $gt: new Date() } });
  if (!s) return null;
  const a = await admins().findOne({ _id: s.email, status: 'active', version: s.version });
  return a ? publicAdmin(a) : null;
}
async function logout(token) {
  if (typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)) await sessions().deleteOne({ _id: digest(token) });
}
async function listAdmins() {
  return (await admins().find({}, { projection: { passwordHash: 0, version: 0 } }).sort({ createdAt: 1 }).toArray()).map(publicAdmin);
}
async function assertActor(email, token) {
  const actor = await currentAdmin(token);
  if (!actor || actor.email !== email) fail(403, 'Administrator access revoked or session expired');
}
async function approve(actor, token, email) {
  return withControlLock(async () => {
    await assertActor(actor, token); email = normalizeEmail(email);
    const result = await admins().updateOne({ _id: email, status: 'pending' }, { $set: { status: 'active', approvedAt: new Date() }, $inc: { version: 1 } });
    if (!result.matchedCount) fail(404, 'Pending administrator not found');
  });
}
async function revoke(actor, token, email) {
  return withControlLock(async () => {
    await assertActor(actor, token); email = normalizeEmail(email);
    const target = await admins().findOne({ _id: email });
    if (!target) fail(404, 'Administrator not found');
    if (target.status === 'active' && await admins().countDocuments({ status: 'active' }) <= 1) fail(409, 'Cannot revoke the last active administrator');
    await admins().updateOne({ _id: email }, { $set: { status: 'revoked', revokedAt: new Date() }, $inc: { version: 1 } });
    await sessions().deleteMany({ email });
  });
}
async function resetPassword(actor, token, email, password) {
  validatePassword(password);
  return withControlLock(async () => {
    await assertActor(actor, token); email = normalizeEmail(email);
    const hash = await bcrypt.hash(password, 12);
    const result = await admins().updateOne({ _id: email, status: { $ne: 'revoked' } }, { $set: { passwordHash: hash }, $inc: { version: 1 } });
    if (!result.matchedCount) fail(404, 'Administrator not found or revoked');
    await sessions().deleteMany({ email });
  });
}
async function getPhoneLimit() {
  const s = await settings().findOne({ _id: 'phoneRegistrationLimit' });
  return s ? validateLimit(s.value) : (process.env.SINGLE_USER === 'true' ? 1 : null);
}
async function setPhoneLimit(value) {
  validateLimit(value);
  await settings().updateOne({ _id: 'phoneRegistrationLimit' }, { $set: { value } }, { upsert: true });
}
module.exports = { SESSION_MS, normalizeEmail, validatePassword, validateLimit, signup, login, currentAdmin, logout, listAdmins, assertActor, approve, revoke, resetPassword, getPhoneLimit, setPhoneLimit };
