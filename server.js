require('dotenv').config();

process.on('uncaughtException', (err) => {
  const msg = err?.message || '';
  if (msg.includes('Target closed') || msg.includes('TargetCloseError') ||
      msg.includes('Session closed') || msg.includes('Protocol error') || msg.includes('detached Frame')) {
    console.error('[WARN] Recoverable session error:', msg);
    return;
  }
  console.error('[ERROR] Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[ERROR] Unhandled rejection:', reason?.message || reason);
});

const crypto       = require('crypto');
const express      = require('express');
const mongoose     = require('mongoose');
const cookieParser = require('cookie-parser');
const wa           = require('./waManager');
const routes       = require('./routes/index.js');
const { withControlLock } = require('./services/controlLock');

const app  = express();
const PORT = process.env.PORT || 3000;
let httpServer;
let closing = false;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('MONGO_URI is not set. Add it to your .env file.');
  process.exit(1);
}

async function getCookieSecret() {
  if (process.env.COOKIE_SECRET) return process.env.COOKIE_SECRET;
  const col = mongoose.connection.db.collection('wpsent_settings');
  await col.updateOne({ _id: 'cookieSecret' },
    { $setOnInsert: { value: crypto.randomBytes(32).toString('hex') } }, { upsert: true });
  return (await col.findOne({ _id: 'cookieSecret' })).value;
}

async function start() {
  try {
    await mongoose.connect(MONGO_URI, { dbName: 'wpsent' });
    console.log('MongoDB connected');

    const secret = await getCookieSecret();
    app.set('trust proxy', 1);
    app.disable('x-powered-by');
    app.use(express.json({ limit: '100kb' }));
    app.use(express.urlencoded({ extended: true, limit: '100kb' }));
    app.use(cookieParser(secret));
    app.use('/', routes);

    app.use((err, req, res, next) => {
      if (res.headersSent) return next(err);
      const status = err.status || err.statusCode || 500;
      if (status >= 500) console.error('[ERROR]', err);
      res.status(status).json({ error: status < 500 ? err.message : 'Internal server error' });
    });

    const n = await wa.restoreAllSessions();
    console.log(`Restoring ${n} WhatsApp session(s) in the background`);
    httpServer = app.listen(PORT, () => {
      console.log(`WPSent running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start:', err.message);
    process.exit(1);
  }
}

async function onSignal(sig) {
  if (closing) return;
  closing = true;
  console.log(`${sig} received — saving WhatsApp sessions before exit...`);
  if (httpServer) httpServer.close();
  let exitCode = 0;
  const started = Date.now();
  try {
    await withControlLock(() => wa.shutdown());
    console.log('[WA] Shutdown: all sessions processed');
  } catch (e) { console.error('Shutdown error:', e.message); exitCode = 1; }
  try {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  } catch (e) { console.error('MongoDB close error:', e.message); exitCode = 1; }
  console.log('Shutdown complete: exit code ' + exitCode + ' (' + (Date.now() - started) + ' ms)');
  process.exit(exitCode);
}
process.on('SIGINT',  () => onSignal('SIGINT'));
process.on('SIGTERM', () => onSignal('SIGTERM'));
process.on('SIGHUP',  () => onSignal('SIGHUP'));

start();
