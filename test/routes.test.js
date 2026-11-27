'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Loading the router must not launch a browser or connect to MongoDB.
const waPath = require.resolve('../waManager');
require.cache[waPath] = {
  id: waPath,
  filename: waPath,
  loaded: true,
  exports: {}
};

const router = require('../routes');
const { requireKey, requireDashboard } = require('../routes/authMiddleware');
const { setSession, startPairing, getPairing, pending } = require('../routes/authState');
const landingHTML = require('../views/landing');
const dashboardHTML = require('../views/dashboard');
const docsHTML = require('../views/docs');

const expected = [
  ['get', '/', null],
  ['get', '/docs', null],
  ['post', '/auth/start', null],
  ['post', '/auth/login', null],
  ['post', '/auth/reset', null],
  ['post', '/auth/reset/confirm', null],
  ['get', '/auth/claim', null],
  ['get', '/auth/qr-stream', null],
  ['get', '/dashboard', requireDashboard],
  ['get', '/logout', null],
  ['get', '/api/me', requireDashboard],
  ['get', '/api/status', requireDashboard],
  ['post', '/api/rescan', requireDashboard],
  ['get', '/api/qr-stream', requireDashboard],
  ['get', '/api/logs-stream', requireDashboard],
  ['post', '/send', requireKey],
  ['get', '/logs', requireKey],
  ['get', '/status', requireKey],
  ['post', '/webhooks', requireKey],
  ['delete', '/webhooks/:id', requireKey],
  ['patch', '/webhooks/:id', requireKey]
];

test('all existing routes retain method, path, registration order and auth guard', () => {
  const actual = router.stack.map(layer => {
    const r = layer.route;
    assert.ok(r, 'expected a direct route registration');
    const guard = r.stack.length > 1 ? r.stack[0].handle : null;
    return [Object.keys(r.methods)[0], r.path, guard];
  });
  assert.deepEqual(actual, expected);
});

test('protected dashboard API rejects missing signed cookie', async () => {
  const response = {
    statusCode: 200,
    clearCookie() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; }
  };
  await requireDashboard({ path: '/api/me', signedCookies: {} }, response, () => assert.fail('unauthenticated'));
  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: 'Not signed in' });
});

test('public messaging API rejects missing credentials', async () => {
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; }
  };
  await requireKey({ query: {}, headers: {} }, response, () => assert.fail('unauthenticated'));
  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: 'Missing clientid' });
});

test('pairing state remains shared and signed cookies retain security options', () => {
  const phone = '1234567890';
  const cookies = {};
  const req = { secure: true, signedCookies: {} };
  const res = { cookie(name, value, options) { cookies[name] = { value, options }; } };
  try {
    startPairing(req, res, phone, true);
    req.signedCookies.wpsent_pair = cookies.wpsent_pair.value;
    assert.equal(getPairing(req).phone, phone);
    assert.equal(getPairing(req).rotate, true);
    assert.equal(getPairing({ signedCookies: { wpsent_pair: phone + ':wrong' } }), null);
    setSession(req, res, { phone, apiKey: 'test-key' });
    for (const { options } of Object.values(cookies)) {
      assert.equal(options.httpOnly, true);
      assert.equal(options.signed, true);
      assert.equal(options.secure, true);
      assert.equal(options.sameSite, 'lax');
    }
  } finally { pending.delete(phone); }
});

test('page renderers retain existing titles and dynamic values', () => {
  assert.match(landingHTML(), /<title>WPSent - WhatsApp API Gateway<\/title>/);
  const dashboard = dashboardHTML({ phone: '1234567890' });
  assert.match(dashboard, /<title>WPSent Dashboard<\/title>/);
  assert.ok(dashboard.includes('1234567890'));
  const docs = docsHTML('https://example.test');
  assert.match(docs, /<title>WPSent API Docs<\/title>/);
  assert.ok(docs.includes('https://example.test'));
});
