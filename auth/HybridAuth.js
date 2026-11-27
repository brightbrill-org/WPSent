'use strict';

const { LocalAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const unzipper = require('unzipper');

const exists = async p => {
  try { await fsp.access(p); return true; }
  catch (e) { if (e.code === 'ENOENT') return false; throw e; }
};
const transient = new Set([
  'SingletonLock', 'SingletonCookie', 'SingletonSocket', 'DevToolsActivePort',
  'LOCK', 'Cache', 'Code Cache', 'GPUCache', 'ShaderCache', 'GrShaderCache',
  'GraphiteDawnCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'Crashpad',
  'BrowserMetrics', 'chrome_debug.log'
]);

function bucketName(session) { return 'wpsent-hybrid-' + session; }
function bucketFor(mongoose, session) {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: bucketName(session)
  });
}

async function deleteBackups(mongoose, session) {
  const bucket = bucketFor(mongoose, session);
  for (const file of await bucket.find({}).toArray()) await bucket.delete(file._id);
  const legacy = new MongoStore({ mongoose });
  if (await legacy.sessionExists({ session })) await legacy.delete({ session });
}

async function validateProfile(dir) {
  if (!(await exists(path.join(dir, 'Default'))))
    throw new Error('Backup contains no Chromium Default profile');
  if (!(await exists(path.join(dir, 'Default', 'IndexedDB'))) &&
      !(await exists(path.join(dir, 'Default', 'Local Storage'))))
    throw new Error('Backup contains no expected authentication storage');
}

// Extract into a private staging directory, never over an active Chrome profile.
async function extractZip(zip, target) {
  const archive = await unzipper.Open.file(zip);
  for (const entry of archive.files) {
    const dest = path.resolve(target, entry.path);
    if (dest !== target && !dest.startsWith(target + path.sep))
      throw new Error('Unsafe ZIP entry');
    if (entry.type === 'Directory') {
      await fsp.mkdir(dest, { recursive: true, mode: 0o700 });
    } else {
      if (dest === target) throw new Error('Invalid ZIP entry');
      await fsp.mkdir(path.dirname(dest), { recursive: true, mode: 0o700 });
      await pipeline(entry.stream(), fs.createWriteStream(dest, { mode: 0o600, flags: 'wx' }));
    }
  }
  await validateProfile(target);
}

async function createZip(source, zip) {
  // archiver 8 is ESM; older versions expose a callable default export.
  const mod = await import('archiver');
  const archive = mod.ZipArchive
    ? new mod.ZipArchive({ zlib: { level: 3 } })
    : mod.default('zip', { zlib: { level: 3 } });
  const out = fs.createWriteStream(zip, { mode: 0o600, flags: 'wx' });
  archive.on('warning', err => archive.destroy(err));
  const finished = pipeline(archive, out);
  archive.directory(source, false);
  try { await Promise.all([archive.finalize(), finished]); }
  catch (e) { archive.destroy(); await finished.catch(() => {}); throw e; }
}

class HybridAuth extends LocalAuth {
  constructor({ clientId, dataPath, mongoose, backupSyncIntervalMs = 60000 }) {
    super({ clientId, dataPath });
    this.sessionName = 'RemoteAuth-' + clientId;
    this.userDataDir = path.join(this.dataPath, this.sessionName);
    this.mongoose = mongoose;
    this.intervalMs = Math.max(60000, Number(backupSyncIntervalMs) || 60000);
    this.backupSync = null;
    this.backupInFlight = null;
    this.canBackup = false;
    this.stopped = false;
    this.loggedOut = false;
  }

  async beforeBrowserInitialized() {
    this.stopped = false;
    const opts = this.client.options.puppeteer;
    if (opts.userDataDir && path.resolve(opts.userDataDir) !== this.userDataDir)
      throw new Error('HybridAuth requires its own userDataDir');
    await fsp.mkdir(this.dataPath, { recursive: true, mode: 0o700 });
    await this.restoreIfMissing();
    this.client.options.puppeteer = { ...opts, userDataDir: this.userDataDir };
  }

  async restoreIfMissing() {
    if (await exists(this.userDataDir)) {
      console.log('[WA] Using existing local profile: ' + this.sessionName);
      return;
    }
    // Keep the previous default directory usable during migration to a new AUTH_ROOT.
    const previous = path.join(__dirname, '..', '.wwebjs_remote_auth', this.sessionName);
    if (path.resolve(previous) !== this.userDataDir && await exists(previous)) {
      const work = await fsp.mkdtemp(path.join(this.dataPath, '.hybrid-restore-'));
      try {
        const stage = path.join(work, 'profile');
        await fsp.cp(previous, stage, { recursive: true, filter: copyFilter });
        await validateProfile(stage);
        await fsp.rename(stage, this.userDataDir);
        console.log('[WA] Migrated existing local profile: ' + this.sessionName);
        return;
      } finally { await fsp.rm(work, { recursive: true, force: true }); }
    }
    const bucket = bucketFor(this.mongoose, this.sessionName);
    const candidates = await bucket.find({}).sort({ uploadDate: -1 }).limit(5).toArray();
    // Prefer a clean browser-close snapshot over a best-effort live copy.
    candidates.sort((a, b) => Number(!!b.metadata?.clean) - Number(!!a.metadata?.clean));
    const legacy = new MongoStore({ mongoose: this.mongoose });
    const hasLegacy = await legacy.sessionExists({ session: this.sessionName });
    if (!candidates.length && !hasLegacy) {
      await fsp.mkdir(this.userDataDir, { recursive: true, mode: 0o700 });
      console.log('[WA] No backup; new pairing required: ' + this.sessionName);
      return;
    }
    const sources = candidates.map(file => ({ file }));
    if (hasLegacy) sources.push({ legacy: true });
    let lastError;
    for (const source of sources) {
      const work = await fsp.mkdtemp(path.join(this.dataPath, '.hybrid-restore-'));
      try {
        const zip = path.join(work, 'session.zip');
        const stage = path.join(work, 'profile');
        await fsp.mkdir(stage, { mode: 0o700 });
        if (source.legacy) await legacy.extract({ session: this.sessionName, path: zip });
        else await pipeline(bucket.openDownloadStream(source.file._id),
          fs.createWriteStream(zip, { mode: 0o600, flags: 'wx' }));
        await extractZip(zip, stage);
        await fsp.rename(stage, this.userDataDir);
        console.log('[WA] Restored ' + (source.legacy ? 'legacy' : 'hybrid') + ' MongoDB profile: ' + this.sessionName);
        return;
      } catch (e) {
        lastError = e;
        console.warn('[WA] Backup restore failed: ' + this.sessionName + ': ' + e.message);
      } finally { await fsp.rm(work, { recursive: true, force: true }); }
    }
    // A failed database restore is not evidence that the account is unpaired.
    throw new Error('No usable backup for ' + this.sessionName + ': ' + lastError?.message);
  }

  async afterAuthReady() {
    if (this.stopped) return;
    this.loggedOut = false;
    this.canBackup = true;
    clearInterval(this.backupSync);
    this.backupSync = setInterval(() => {
      if (this.stopped || !this.canBackup) return;
      this.storeRemoteSession({ emit: true }).catch(e =>
        console.warn('[WA] MongoDB backup failed: ' + this.sessionName + ': ' + e.message));
    }, this.intervalMs);
  }

  // Single-flight backup: periodic, logout and shutdown cannot race on ZIP paths.
  storeRemoteSession({ emit = false, clean = false } = {}) {
    if (this.loggedOut || !this.canBackup) return Promise.resolve(false);
    if (this.backupInFlight) return this.backupInFlight;
    this.backupInFlight = this.snapshot(clean).then(() => {
      if (emit) this.client.emit('remote_session_saved');
      return true;
    }).finally(() => { this.backupInFlight = null; });
    return this.backupInFlight;
  }

  async snapshot(clean) {
    const work = await fsp.mkdtemp(path.join(this.dataPath, '.hybrid-backup-'));
    try {
      const stage = path.join(work, 'profile');
      const zip = path.join(work, 'session.zip');
      await fsp.cp(this.userDataDir, stage, { recursive: true, filter: copyFilter });
      await validateProfile(stage);
      await createZip(stage, zip);
      const archive = await unzipper.Open.file(zip);
      if (!archive.files.length) throw new Error('Empty profile archive');
      const bucket = bucketFor(this.mongoose, this.sessionName);
      const upload = bucket.openUploadStream(this.sessionName + '.zip', {
        metadata: { clean, version: 1 }
      });
      await pipeline(fs.createReadStream(zip), upload);
      // Never delete the last good backup before the new upload completes.
      // Retain two clean and two live snapshots for fallback.
      try {
        const all = await bucket.find({}).sort({ uploadDate: -1 }).toArray();
        const kept = { clean: 0, live: 0 };
        for (const file of all) {
          const kind = file.metadata?.clean ? 'clean' : 'live';
          if (++kept[kind] > 2) await bucket.delete(file._id);
        }
      } catch (e) { console.warn('[WA] Backup retention cleanup failed: ' + e.message); }
    } finally { await fsp.rm(work, { recursive: true, force: true }); }
  }

  async stopBackups() {
    this.stopped = true;
    clearInterval(this.backupSync);
    this.backupSync = null;
    if (this.backupInFlight) await this.backupInFlight.catch(() => {});
  }

  async destroy() { await this.stopBackups(); }

  // A transport disconnect must not erase the profile or its backups.
  async disconnect() { await this.stopBackups(); this.canBackup = false; }

  // WhatsApp can call logout while Chrome is still running. Do not rm a live profile.
  async logout() {
    this.loggedOut = true;
    this.canBackup = false;
    await this.stopBackups();
    await deleteBackups(this.mongoose, this.sessionName);
  }
}

async function copyFilter(src) {
  if (transient.has(path.basename(src))) return false;
  const stat = await fsp.lstat(src);
  return stat.isDirectory() || stat.isFile();
}

module.exports = { HybridAuth, deleteBackups };
