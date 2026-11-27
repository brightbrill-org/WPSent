# Route and view organization

The Express entry point remains server.js -> routes/index.js. The route index
registers modules on a single router in the original order, without URL prefixes.

| File | Responsibility |
| --- | --- |
| routes/index.js | Route composition only |
| routes/pages.js | Public landing and API documentation pages |
| routes/auth.js | Registration, login, password reset, pairing claim and QR stream |
| routes/dashboard.js | Dashboard, logout, session status, rescan and log streams |
| routes/messages.js | API-key-protected send, logs and status endpoints |
| routes/webhooks.js | API-key-protected webhook CRUD |
| routes/authMiddleware.js | API-key and dashboard cookie authentication |
| routes/authState.js | Signed cookie, pairing state and credential helpers |
| routes/modelAccess.js | Shared lazy access to Mongoose models |
| routes/helpers.js | Input normalization, safe equality and async route wrapper |
| routes/config.js | Site and authentication configuration |
| views/landing.js | Landing page HTML, CSS and browser JavaScript |
| views/dashboard.js | Dashboard HTML, CSS and browser JavaScript |
| views/docs.js | API documentation HTML and CSS |

The route bodies and HTML templates were moved as-is, except for indentation
of route modules. Existing paths, request/response contracts, authentication
checks and configuration values are unchanged. The existing waManager and
HybridAuth implementation are not modified. Pairing and cooldown state remain
process-local, as before; all pairing consumers import the same authState module.

For a new endpoint, add it to the module that owns its concern and add its method,
path and guard to test/routes.test.js. Keep template work within the matching
view. Separating embedded CSS and browser scripts into static assets is a
possible subsequent refactor, not part of this change.

## Verification

Run on a checkout with dependencies installed:

    node --test test/routes.test.js test/hybrid-auth.test.js

Then smoke-test registration/login, reset, pairing, dashboard, send/receive,
logs/SSE, webhook CRUD and PM2 restart on a test instance. Do not rescan a
production account solely to test routing.
