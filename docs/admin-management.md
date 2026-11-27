# WPSent administrator management

This feature is intended for the existing **single PM2 fork / single application instance**.
Control mutations use a process-local serialized lock; do not run multiple WPSent replicas
against the same database without adding distributed locking or transactions.

## Initial setup

1. Before deploying, generate a secret using openssl rand -hex 32.
2. Add ADMIN_BOOTSTRAP_TOKEN to .env (minimum 32 characters).
3. Restart WPSent and visit /admin over HTTPS.
4. Create an email/password account with the token. The first administrator is automatically
   approved and signed in. Remove the token from .env after successful setup, then restart.
5. Other users create administrator accounts at the same page; they remain pending until
   an active administrator approves them. The existing WhatsApp phone sign-in is unchanged.

Passwords use bcrypt (cost 12, at least 12 characters, maximum 72 UTF-8 bytes).
Admin cookies are signed, HttpOnly, SameSite=Strict, path-scoped, and Secure on HTTPS.
The database stores hashed random session tokens; expiry is 12 hours. Logout deletes the
token; password reset and revocation invalidate all previous sessions. A last active
administrator cannot be revoked. Login/signup attempts are limited per IP in memory.
Admin mutations require JSON and X-WPSent-Admin: 1; cross-origin browser requests are rejected.
Use HTTPS and a trusted reverse proxy which overwrites forwarding headers.

## Phones and registration policy

The console shows every registered phone, state, creation and last-seen time. API keys and
message bodies are not shown. A limit of null means unlimited, 0 blocks new registrations.
SINGLE_USER=true is the default limit of 1 until an admin saves a policy; otherwise unlimited.
Lowering the limit never automatically disconnects existing accounts. Revoked phones do not
count toward capacity. Revocation records a persistent tombstone, blocks login, API access,
reconnect and restart restoration, and deletes local and MongoDB WPSent authentication
backups. Cleanup can be retried if it fails. Existing logs remain. Revoked phone numbers
cannot self-register again; deliberate reactivation is not implemented. Revocation does
not guarantee WhatsApp's server-side linked-device unlink; remove the device from the
phone's Linked Devices screen if needed. Already transmitted/in-flight messages cannot
be recalled.

## Endpoints

All /admin/api routes except signup/login/logout require the signed admin session cookie.
All POST/PUT requests require JSON and X-WPSent-Admin: 1.
- POST /admin/api/signup {email,password,bootstrapToken} (token only for first account)
- POST /admin/api/login {email,password}
- POST /admin/api/logout {}
- GET /admin/api/me
- GET /admin/api/phones
- PUT /admin/api/phone-limit {limit: 5} (null for unlimited)
- POST /admin/api/phones/:phone/revoke {}
- GET /admin/api/admins
- POST /admin/api/admins/approve {email}
- POST /admin/api/admins/revoke {email}
- POST /admin/api/admins/password {email,password}

## Support and testing

Set GITHUB_URL, INSTAGRAM_URL, SUPPORT_EMAIL, CONTRIBUTOR_NAME and SITE_URL in .env.
The documentation page links to /docs/postman.json (Postman v2.1 collection, no secrets).
Do not run the destructive admin requests against production as a batch.

Run node --test test/*.test.js. On a disposable instance verify first admin bootstrap,
pending approval, login, password reset session invalidation, last admin protection,
registration limit under concurrent signup, phone revocation and restart persistence.
Existing phones require no migration or re-pairing.
