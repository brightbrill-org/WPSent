'use strict';

const crypto   = require('crypto');

const str = (v) => (typeof v === 'string' ? v : (Array.isArray(v) ? String(v[0] ?? '') : '')).trim();

function safeEq(a, b) {
  const x = Buffer.from(String(a ?? '')), y = Buffer.from(String(b ?? ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const ah = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((e) => {
    console.error('[route error]', req.method, req.path, e);
    if (res.headersSent) return res.end();
    res.status(500).json({ error: 'Internal server error' });
  });

module.exports = { str, safeEq, ah };
