'use strict';

const express = require('express');
const DEFAULT_SEND_LIMIT_MB = 20;
const MAX_SEND_LIMIT_MB = 50;
function sendLimitMb(raw) {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw.trim())) return DEFAULT_SEND_LIMIT_MB;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= MAX_SEND_LIMIT_MB ? n : DEFAULT_SEND_LIMIT_MB;
}

function registerRequestBodyParsers(app, requireKey, raw = process.env.WA_SEND_JSON_LIMIT_MB) {
  const limit = sendLimitMb(raw) * 1024 * 1024;
  // Authenticate by headers/query before buffering a large JSON upload.
  // The /send router checks the key again before dispatch, including revocation.
  // Matching the actual POST route avoids increasing the admin/other API limits.
  app.post('/send', requireKey, express.json({ limit }));
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
}

module.exports = { registerRequestBodyParsers, sendLimitMb };
