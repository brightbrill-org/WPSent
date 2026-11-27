'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { HybridAuth } = require('../auth/HybridAuth');

test('existing local profile is preserved without touching MongoDB', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wpsent-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const auth = new HybridAuth({ clientId: '123', dataPath: root, mongoose: {} });
  await fs.mkdir(auth.userDataDir);
  const marker = path.join(auth.userDataDir, 'keep');
  await fs.writeFile(marker, 'local');
  auth.client = { options: { puppeteer: {} } };
  await auth.beforeBrowserInitialized();
  assert.equal(await fs.readFile(marker, 'utf8'), 'local');
  assert.equal(auth.client.options.puppeteer.userDataDir, auth.userDataDir);
});

test('concurrent backup calls share a single snapshot', async () => {
  const auth = new HybridAuth({ clientId: '123', dataPath: os.tmpdir(), mongoose: {} });
  auth.canBackup = true;
  let calls = 0, release;
  auth.snapshot = async () => { calls++; await new Promise(r => { release = r; }); };
  const a = auth.storeRemoteSession();
  const b = auth.storeRemoteSession();
  assert.equal(a, b);
  assert.equal(calls, 1);
  release();
  assert.equal(await a, true);
  assert.equal(auth.backupInFlight, null);
});

test('temporary disconnect does not remove local profile', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wpsent-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const auth = new HybridAuth({ clientId: '123', dataPath: root, mongoose: {} });
  await fs.mkdir(auth.userDataDir);
  auth.canBackup = true;
  await auth.disconnect();
  assert.equal(auth.canBackup, false);
  assert.equal((await fs.stat(auth.userDataDir)).isDirectory(), true);
});
