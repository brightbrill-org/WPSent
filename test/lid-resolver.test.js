'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createLidResolver, webhookSender } = require('../utils/lidResolver');

const lid = '123456789012345@lid';
const pn = '919876543210';

test('ordinary phone IDs and group IDs retain existing behavior', async () => {
  const resolve = createLidResolver({ getContactLidAndPhone() { assert.fail('unexpected lookup'); } });
  assert.deepEqual(webhookSender(await resolve(pn + '@c.us')), {
    from: pn, fromId: pn + '@c.us', fromLid: null, fromPhone: pn
  });
  assert.equal((await resolve('12345@g.us')).from, '12345@g.us');
  assert.equal((await resolve('12345@g.us')).fromPhone, null);
});

test('maps LID to phone while retaining original ID for logs and webhooks', async () => {
  const resolve = createLidResolver({ async getContactLidAndPhone(ids) {
    assert.deepEqual(ids, [lid]);
    return [{ lid, pn: pn + '@c.us' }];
  } });
  const result = await resolve(lid);
  assert.deepEqual(result, { from: pn + '@c.us', fromId: lid, fromLid: lid, fromPhone: pn });
  assert.equal(webhookSender(result).from, pn);
});

test('concurrent lookups share a request and successful mappings are cached per client', async () => {
  let calls = 0;
  const resolve = createLidResolver({ async getContactLidAndPhone() { calls++; return [{ lid, pn: pn + '@s.whatsapp.net' }]; } });
  const result = await Promise.all([resolve(lid), resolve(lid)]);
  assert.equal(result[0].fromPhone, pn);
  assert.equal(result[1].fromPhone, pn);
  assert.equal((await resolve(lid)).fromPhone, pn);
  assert.equal(calls, 1);
  assert.equal((await createLidResolver({})(lid)).fromPhone, null);
});

test('unavailable, invalid, mismatched and failed lookups never fabricate phone numbers', async () => {
  for (const client of [
    {},
    { async getContactLidAndPhone() { return []; } },
    { async getContactLidAndPhone() { return [{ lid, pn: lid }]; } },
    { async getContactLidAndPhone() { return [{ lid: '999@lid', pn: pn + '@c.us' }]; } },
    { async getContactLidAndPhone() { throw Error('browser unavailable'); } }
  ]) {
    const result = await createLidResolver(client)(lid);
    assert.equal(result.from, lid);
    assert.equal(result.fromPhone, null);
    assert.equal(webhookSender(result).from, lid);
  }
});

test('lookup timeout does not block inbound message processing indefinitely', async () => {
  const resolve = createLidResolver({ getContactLidAndPhone: () => new Promise(() => {}) }, { timeoutMs: 10 });
  assert.equal((await resolve(lid)).from, lid);
});

test('failed mapping is retried on subsequent messages', async () => {
  let calls = 0;
  const resolve = createLidResolver({ async getContactLidAndPhone() {
    return ++calls === 1 ? [] : [{ lid, pn: pn + '@c.us' }];
  } });
  assert.equal((await resolve(lid)).fromPhone, null);
  assert.equal((await resolve(lid)).fromPhone, pn);
});
