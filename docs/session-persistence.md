# WPSent session persistence

HybridAuth keeps a dedicated Chrome profile per phone at WA_REMOTE_AUTH_DIR/RemoteAuth-<phone>.
The existing QR fallback and messaging APIs are unchanged. Existing local profiles are used
first, without deleting them. If no local profile exists, the app tries new hybrid GridFS
snapshots and then the legacy wwebjs-mongo archive. A legacy backup may still need pairing once.
A failed extraction does not silently create an empty session.

New backups use a separate GridFS bucket per session (wpsent-hybrid-RemoteAuth-<phone>).
A live snapshot is best-effort because Chromium may be writing files. A clean snapshot
is taken after Chrome closes on orderly shutdown and is preferred during disaster recovery.
Caches and browser locks are excluded. The old MongoStore backup remains untouched except
on explicit rescan or WhatsApp logout. A new backup is uploaded before older snapshots
are removed; up to two clean and two live copies are retained.

## Deployment on a single VPS

- Keep the existing WA_REMOTE_AUTH_DIR value and ensure it is on persistent storage.
- Protect that directory and MongoDB as credentials; never expose them via HTTP or Git.
- Stop the old process gracefully, then start the new branch via ecosystem.config.js.
- Use exactly one process per profile directory; don't run the old and new app concurrently.
- Wait for a successful MongoDB backup and then restart to confirm no QR is requested.
- Verify send/receive and webhooks. Repeat with two accounts.
- Test disaster recovery in a separate isolated environment using a disposable account.
  Do not remove the production profile to test recovery.
- Rescan intentionally deletes both local and remote authentication data.

The PM2 kill timeout is 120 seconds; slow or failed backups can still exceed this limit.
Local profiles remain on disk even if the remote backup fails. MongoDB must be available
for WPSent startup itself, because the application uses it for users and messages.
A revoked WhatsApp linked device cannot be restored by a backup.

Run syntax checks: node --check auth/HybridAuth.js && node --check waManager.js &&
node --check server.js && node --check routes/index.js && node --check ecosystem.config.js.
Run unit tests: node --test test/hybrid-auth.test.js.

## Graceful shutdown diagnostics

WPSent owns SIGINT, SIGTERM and SIGHUP handling; Puppeteer's independent signal handlers
are disabled so it cannot exit the process before clean backups finish.
On a normal PM2 restart with a ready account, expect logs for stopping backups, Chrome
closure, saving a clean MongoDB backup, MongoDB disconnection and `Shutdown complete: exit code 0`.
Check `~/.pm2/pm2.log` for the actual exit code. If a stage stalls, inspect the last stage log.
The 120-second PM2 timeout remains an upper limit; local profiles are preserved.
