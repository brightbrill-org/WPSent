# Readiness diagnostics and recovery

Observed on whatsapp-web.js 1.34.8 / Puppeteer 24.38.0 with WhatsApp Web build
2.3000.1056415710: authenticated, connected socket, visible chat list and WWebJS
helpers, but callback bindings after onRemoveChatEvent were missing. The first
missing binding was onArchiveChatEvent. The exact CDP error is not yet known.

WPSent instruments the current client's attachEventListeners method and traces
the binding-presence checks, exposeFunction calls and final evaluation. Each
operation has a bounded timeout. The application does not modify node_modules,
skip event listeners or synthesize Ready. It abandons a failed page instead of
retrying a partially attached listener sequence on that page.

The post-authentication watchdog starts on authenticated, cancels on Ready,
auth failure or teardown, and does not extend its deadline on repeated
authenticated events. Failure triggers per-phone recovery with exponential
delays, up to WA_READY_MAX_RETRIES automatic attempts. Only the actual Ready
event clears the retry budget. Late events from abandoned sessions are ignored.
No authentication wipe occurs during recovery. If browser shutdown cannot be
confirmed, recovery stops rather than risking two browsers on one profile.
The administrator must perform a controlled restart when recovery is exhausted.

Configuration:
- WA_READY_TIMEOUT_MS: 120000
- WA_CALLBACK_TIMEOUT_MS: 20000
- WA_READY_MAX_RETRIES: 3 (0 disables automatic retries)
- WA_CLOSE_TIMEOUT_MS: 30000 per close/wait operation

On a live test, monitor fresh PM2 logs for the exact binding start/complete/fail
stage. Verify Ready, send and receive, reactions, LID resolution, webhooks,
periodic backups and graceful restart. Do not rescan or wipe a working profile.
The watchdog is resilience and diagnostics, not proof that an upstream
Puppeteer defect has been fixed. This change does not upgrade dependencies.
