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
const { requireAdmin, requireMutation } = require('../routes/admin');
const { setSession, startPairing, getPairing, pending } = require('../routes/authState');
const landingHTML = require('../views/landing');
const dashboardHTML = require('../views/dashboard');
const docsHTML = require('../views/docs');

const expected = [
  ['get', '/', null],
  ['get', '/docs/postman.json', null],
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
  ['patch', '/webhooks/:id', requireKey],
  ['get', '/lid/resolve', requireKey],
  ['get', '/admin', null],
  ['post', '/admin/api/signup', requireMutation],
  ['post', '/admin/api/login', requireMutation],
  ['post', '/admin/api/logout', requireMutation],
  ['get', '/admin/api/me', requireAdmin],
  ['get', '/admin/api/phones', requireAdmin],
  ['put', '/admin/api/phone-limit', requireAdmin],
  ['post', '/admin/api/phones/:phone/revoke', requireAdmin],
  ['get', '/admin/api/admins', requireAdmin],
  ['post', '/admin/api/admins/approve', requireAdmin],
  ['post', '/admin/api/admins/revoke', requireAdmin],
  ['post', '/admin/api/admins/password', requireAdmin]
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

const wa = require('../waManager');
const lidRoute = router.stack.find(layer => layer.route?.path === '/lid/resolve').route;
const lidHandler = lidRoute.stack[1].handle;
function lidResponse() {
  return {
    statusCode: 200, headers: {},
    set(key, value) { this.headers[key] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('LID lookup rejects missing or malformed IDs and duplicate parameters', async () => {
  for (const lid of [undefined, '1234', '919876543210@c.us', '123@g.us', ['123@lid', '456@lid']]) {
    const res = lidResponse();
    await lidHandler({ query: { lid }, wpUser: { phone: 'account-a' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.headers['Cache-Control'], 'no-store');
  }
});

test('LID lookup uses only authenticated account, returns resolved and unresolved results', async () => {
  const lid = '123456789012345@lid';
  for (const phone of ['919876543210', null]) {
    wa.resolveLid = async (account, id) => {
      assert.equal(account, 'account-a');
      assert.equal(id, lid);
      return { lid, phone, phoneId: phone ? phone + '@c.us' : null, resolved: !!phone };
    };
    const res = lidResponse();
    await lidHandler({ query: { lid, phone: 'other-account' }, wpUser: { phone: 'account-a' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true, lid, phone, phoneId: phone ? phone + '@c.us' : null, resolved: !!phone });
  }
});

test('LID lookup returns 503 for a session that is not ready', async () => {
  wa.resolveLid = async () => { throw Object.assign(new Error('not ready'), { code: 'WA_NOT_READY' }); };
  const res = lidResponse();
  await lidHandler({ query: { lid: '123@lid' }, wpUser: { phone: 'account-a' } }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, 'WhatsApp session not ready');
});

test('API documentation includes the authenticated LID endpoint', () => {
  const docs = docsHTML('https://example.test');
  assert.ok(docs.includes('/lid/resolve'));
  assert.ok(docs.includes('resolved'));
});

test('administrator guard rejects anonymous requests', async () => {
  const res = { set(){}, status(code){this.code=code;return this;},json(body){this.body=body;} };
  await requireAdmin({signedCookies:{}},res,()=>assert.fail('anonymous'));
  assert.equal(res.code,401);
});
test('administrator mutations reject missing CSRF header and foreign origins', () => {
  const res = {status(code){this.code=code;return this;},json(body){this.body=body;}};
  requireMutation({get:()=>undefined,is:()=>true},res,()=>assert.fail('missing header'));
  assert.equal(res.code,403);
  const headers={'x-wpsent-admin':'1','origin':'https://other.test','host':'wpsent.xyz'};
  requireMutation({get:k=>headers[k],is:()=>true,protocol:'https'},res,()=>assert.fail('foreign origin'));
  assert.equal(res.code,403);
  headers.origin='https://wpsent.xyz';
  let accepted=false;
  requireMutation({get:k=>headers[k],is:()=>true,protocol:'https'},res,()=>{accepted=true;});
  assert.equal(accepted,true);
});
