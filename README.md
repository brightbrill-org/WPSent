# 💬 WPSent

Self-hosted WhatsApp Web API bridge.

---

## Quick Start (Local)

```bash
# 1. Install a browser (if you don't have Chrome/Chromium)
sudo apt-get install -y chromium-browser   # Ubuntu/Debian

# 2. Configure
cp .env.example .env
# Edit .env → paste your MongoDB URI

# 3. Run
npm install
npm start
```

Open **http://localhost:3000** → enter phone → scan QR → dashboard.

---

## Administrator console

Open `/admin` to manage registered phones, registration capacity and administrator accounts.
Generate a strong `ADMIN_BOOTSTRAP_TOKEN` before deployment (`openssl rand -hex 32`),
then create the first administrator over HTTPS. Later administrator accounts require approval.
Remove the bootstrap token after setup. Existing WhatsApp phone sign-in is unchanged.

Configure `GITHUB_URL`, `INSTAGRAM_URL`, `SUPPORT_EMAIL`, `CONTRIBUTOR_NAME` and `SITE_URL`
in `.env` for public support and documentation information. Download the ready-to-import
Postman collection from `/docs/postman.json` or [the repository](docs/WPSent.postman_collection.json).
See [administrator setup and API reference](docs/admin-management.md), including the single-instance
requirement and destructive revocation behavior.

## Authentication

WhatsApp messaging API calls require **both** credentials. Administrator endpoints use a separate signed session cookie:

| Query param | Header | Description |
|---|---|---|
| `clientid` | `x-client-id` | Public identifier |
| `key` | `x-api-key` | Secret key |

Both are shown on your dashboard after scanning the QR.

---

## REST API

### Send a message (text)
```
POST /send?clientid=YOUR_CLIENT_ID&key=YOUR_SECRET_KEY&to=8801711000000
Content-Type: application/json

{ "message": "Hello!" }
```
Phone numbers are cleaned automatically — `+880 171...`, `880171...`, `+8801711000000` all work.
Groups: use `to=120363...@g.us`.

### Send a poll
```
POST /send?clientid=YOUR_CLIENT_ID&key=YOUR_SECRET_KEY&to=8801711000000
Content-Type: application/json

{
  "question": "What is your favorite color?",
  "options": ["Red", "Blue", "Green"]
}
```
Or nested under `"poll"`. Requires at least 2 options. Logged as type `poll`.

### Send a document (base64)
```
POST /send?clientid=YOUR_CLIENT_ID&key=YOUR_SECRET_KEY&to=8801711000000
Content-Type: application/json

{
  "document": {
    "mimetype": "application/pdf",
    "filename": "invoice.pdf",
    "data": "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC...",
    "caption": "Here is the invoice"
  }
}
```
`data` is base64 (optional `data:...;base64,` prefix is stripped). Works for images, PDFs, etc. Logged as type `document`.

Authenticated `POST /send` accepts up to **20 MiB of JSON** by default. Set `WA_SEND_JSON_LIMIT_MB` in `.env` to an integer from 1 to 50 to change this limit (invalid values fall back to 20). Base64 expands binary data by approximately one third, so keep the original file below roughly 15 MiB at the default setting, with additional room for JSON metadata. Send media as `application/json`, not a URL-encoded form. Other endpoints and URL-encoded forms retain the 100 KiB limit. Requests above the configured JSON limit return HTTP 413; reverse-proxy and WhatsApp media limits can be lower.

### Get logs
```
GET /logs?clientid=YOUR_CLIENT_ID&key=YOUR_SECRET_KEY
```

### Check status
```
GET /status?clientid=YOUR_CLIENT_ID&key=YOUR_SECRET_KEY
```

### Resolve WhatsApp LID

GET /lid/resolve?lid=123456789012345%40lid

```bash
curl 'https://wpsent.xyz/lid/resolve?lid=123456789012345%40lid' \
  -H 'x-client-id: YOUR_CLIENT_ID' \
  -H 'x-api-key: YOUR_SECRET_KEY'
```

HTTP 200 (resolved):

```json
{"ok":true,"lid":"123456789012345@lid","phone":"919876543210","phoneId":"919876543210@c.us","resolved":true}
```

HTTP 200 (unavailable):

```json
{"ok":true,"lid":"123456789012345@lid","phone":null,"phoneId":null,"resolved":false}
```

The full LID is required. Missing/malformed input returns 400, missing/invalid credentials 401/403, a non-ready session 503, unexpected failures 500. The lookup is scoped to the authenticated account, shares the existing per-session cache and timeout, and never guesses numbers. An unresolved result may be temporary. Responses are not cacheable by HTTP clients. This API does not send a message or modify message history. Existing query-string authentication also works; prefer headers to avoid logging credentials in URLs. Examples are fictional.

### Webhooks
```bash
# Add
POST /webhooks
x-client-id: YOUR_CLIENT_ID
x-api-key: YOUR_SECRET_KEY
{ "url": "https://yoursite.com/hook", "method": "POST", "label": "My Hook" }

# Toggle active/paused
PATCH /webhooks/:id   { "active": false }

# Delete
DELETE /webhooks/:id
```

---

## Webhook Payload

Fired on every inbound message — text, emoji, reaction, sticker, image, etc. This remains the default `message_received` subscription.

```json
{
  "event":     "message_received",
  "from":      "8801711000000",
  "fromId":    "123456789012345@lid",
  "fromLid":   "123456789012345@lid",
  "fromPhone": "8801711000000",
  "body":      "Hello!",
  "type":      "text",
  "timestamp": "2024-01-01T10:30:00.000Z"
}
```

For unresolved LIDs, `from` retains the original ID and `fromPhone` is null. Group messages retain the group ID and may include `authorId`, `authorLid`, and `authorPhone`. GET webhooks omit null fields.

**Types:** `text` · `reaction` → `[Reaction: 👍]` · `sticker` · `image` · `video` · `audio` · `document` · `location` · `contact`

---

## MongoDB Collections

**`wpusers`**
```js
{ phone, clientId, apiKey, webhooks: [{url, method, label, active}], createdAt, lastSeen }
```

**`messagelogs`**
```js
{ userId, direction, to, from, body, type, status, error, timestamp }
```

**`whatsapp-sessions`** (auto-managed by MongoStore)
```js
{ sessionId, session }  ← full Chromium session, restored on restart
```

> Per-user log cap: **100 messages**. Oldest deleted automatically.

---

## Browser Support

The server auto-detects whichever browser is installed:

| Browser | Works? |
|---|---|
| Google Chrome | ✅ |
| Chromium | ✅ |
| Brave / Firefox / Safari | ❌ not supported by Puppeteer |

## WhatsApp readiness recovery

After authentication, WPSent waits for the real library Ready event. Callback checks and
registrations are traced; timeouts trigger bounded per-phone browser recovery without
wiping local authentication or MongoDB backups. Configure WA_READY_TIMEOUT_MS,
WA_CALLBACK_TIMEOUT_MS, WA_READY_MAX_RETRIES and WA_CLOSE_TIMEOUT_MS in .env.
See [readiness troubleshooting](docs/readiness-watchdog.md).

### Download inbound media

New inbound media is downloaded best effort and stored as private binary data in MongoDB with a TTL. Images, video, audio/voice notes, documents and stickers are supported when WhatsApp makes media available. Webhooks and logs expose flat metadata: `mediaStatus`; on success `mediaId`, `mediaFilename`, `mediaMimetype`, `mediaSize`, `mediaExpiresAt`, `mediaDownloadPath`. Media webhooks also include the message `logId`. Text and reaction webhook formats remain unchanged.

`GET /media/:id` with existing API headers returns a binary attachment. Dashboard Logs offers a cookie-authenticated Download link. No media or credentials are embedded in webhook URLs. Expired/missing/other-account media returns 404. Files expire independently of the 100-message log cap; MongoDB TTL cleanup is asynchronous, but expired files cannot be downloaded. Default 8 MiB/file, 24 hours, two concurrent captures, 20s capture deadline. Set WA_INBOUND_MEDIA_MAX_MB (1-10), WA_INBOUND_MEDIA_TTL_HOURS (1-168) or WA_INBOUND_MEDIA_TIMEOUT_MS (1000-60000). Capture is best effort; busy, timeout, unavailable, too_large and skipped statuses do not prevent message logging. View-once and identifiable disappearing media are skipped; no historical backfill. MongoDB storage usage increases; monitor quota. Only download files you are authorized to access.

### Send a contact card or static location

Use `POST /send` with `x-client-id`, `x-api-key` and `Content-Type: application/json` headers. Existing query-string authentication also works.

**Contact:**
```json
{
  "to": "919000000001",
  "contact": {
    "name": "Example Support",
    "phone": "+919000000002",
    "organization": "Example Company",
    "email": "support@example.com"
  }
}
```

**Location:**
```json
{
  "to": "919000000001",
  "location": {
    "latitude": 10.0731,
    "longitude": 78.7802,
    "name": "Example Office",
    "address": "Karaikudi, Tamil Nadu"
  }
}
```

Contact requires `name` and international `phone`; `organization` and `email` are optional. A native vCard is sent without editing the address book. Location requires numeric `latitude` (-90 to 90) and `longitude` (-180 to 180); `name`, `address`, and HTTP(S) `url` are optional. Static pins only, not live GPS. Use one payload type per request; invalid or mixed contact/location requests return 400 before sending. Successful responses retain `{ok:true,logId}`; logs use `contact` or `location`. Failed sends return 500 with a log ID; check delivery before retrying. Examples are illustrative; share only authorized information.

### Authentication rescan-required webhook

Register a separate URL using `POST /webhooks` with the existing API headers:

```json
{
  "url": "https://example.com/auth-alert",
  "method": "POST",
  "label": "WhatsApp reconnect alert",
  "event": "auth_rescan_required"
}
```

Payload contains `event`, `eventId`, `phone`, `reason`, `status: rescan_required`, and ISO `timestamp`. Reasons: `qr_required` (actual QR), `auth_failure` (library reports failed authentication), `logged_out`, or `unpaired`. Existing message hooks stay separate; a hook without an event defaults to `message_received`. Both GET and POST work; each subscription can be paused or deleted independently. Duplicate alerts are suppressed in MongoDB until a genuine Ready event, including across process restarts. Only accounts with an active rescan subscription receive an alert; manual rescan can also trigger it. Ordinary disconnects or readiness retries without authentication evidence do not. No QR data or credentials are sent. Delivery is best effort (existing 8-second timeout), not a durable notification retry queue; use `/status` for independent monitoring. Invalid event values return 400.

### List WhatsApp chats and contacts

Authenticated read-only endpoints:

```http
GET /chats?limit=50&offset=0&type=all
GET /contacts?limit=50&offset=0&savedOnly=true
```

Use `x-client-id` and `x-api-key`. Each response is `{ok,total,limit,offset,hasMore,items}`. Common optional parameters: `search` (case-insensitive name/ID/known phone, max 200 chars), `limit` (1–200), `offset` (0–1000000), `resolveLid` (true/false, default false; resolves up to 20 LIDs on current page only). Chats: `type=all|individual|group`, `unreadOnly=true`, `archived=true|false`. Contacts: `savedOnly=true`, `businessOnly=true`. Chats expose ID, name, phone/LID, group flag, unread count, Unix seconds timestamp, archived/pinned/muted flags. Contacts expose ID, name/pushname/shortName, phone/LID, saved/business/WhatsApp/self/blocked flags. Unknown fields are null. No LID digits are treated as phone numbers; optional resolution runs after search and pagination. Use the original ID in `/send`. Directories are live, not stable snapshots; only data available to the linked Web session is returned, and status/broadcast/newsletters are excluded. No message history or group member enumeration. The browser fetch has a 20-second deadline, single-flight per account/type and a global cap of four outstanding browser calls. No directory storage or new dependencies. HTTP 400 invalid query, 401/403 auth, 503 unavailable/busy/not ready, 504 timeout.

### Mark a chat as seen and reply to a message

Authenticated `POST /seen` with JSON `{"chatId":"919000000001@c.us"}` marks a whole conversation as read; returns `{ok:true,chatId,seen:true}`. Supports group IDs, LIDs and international phone numbers. WhatsApp controls read-receipt visibility.

Authenticated `POST /reply` with JSON `{"messageId":"false_919000000001@c.us_EXAMPLE123","message":"Thank you!","markSeen":false}` sends a native quoted text reply in the original conversation. The message ID is the full WhatsApp identifier, not the database log ID. New inbound webhooks and logs expose `chatId` and, when available, `messageId`; normal inbound webhooks now always include `logId`. No old-log backfill and no reaction reply target. Replies return `{ok,chatId,messageId,replyToMessageId,logId}`. Only text (max 16000 chars), optional boolean markSeen defaults false. Original message must still be available in the linked WhatsApp session. No caller-selected destination or silent unquoted fallback. Both APIs require Ready. HTTP 400 invalid input, 401/403 auth, 404 missing original/chat, 503 busy/not ready, 504 timeout, 502 unconfirmed action, 500 unexpected failure. Check the conversation before retrying an uncertain send. A successful send with failed DB logging returns ok=true and a warning with null logId. One outstanding action per account and four globally, 20-second request deadline (cannot cancel a browser operation already issued).

### WhatsApp group management

Use existing API authentication headers. All existing-group operations require the linked WhatsApp account to be a group admin (not merely a WPSent admin).

| Method | Path | JSON body |
|---|---|---|
| POST | `/groups` | `{"subject":"Project team","participants":["919000000001"]}` |
| POST | `/groups/:groupId/participants` | `{"participants":["919000000002"]}` |
| DELETE | `/groups/:groupId/participants` | `{"participants":["919000000002@c.us"]}` |
| PATCH | `/groups/:groupId/subject` | `{"subject":"New name"}` |
| PATCH | `/groups/:groupId/description` | `{"description":"New description"}` |
| GET | `/groups/:groupId/invite` | None |

Create returns 201 with groupId, participant results and allAdded. Add returns participant codes and allAdded. Remove checks actual membership and re-reads the group after removal, reports removed/unconfirmed/not_found/ambiguous/owner_protected and allRemoved. A successful HTTP response does not imply all members were added/removed. Subject max 100 characters; description max 2048, empty clears; participants max 20 per operation. Phone IDs and LIDs supported; no guessing LID digits, no automatic private invitations, no self-removal. Invite retrieval returns inviteCode and inviteLink; it does not reset links. Keep links private. Find group IDs via GET /chats?type=group. Ready session required; one outstanding group action per session, four globally, 45-second deadline. Verify actual group state before retrying uncertain operations. No new dependencies or schema changes.

Group creation compatibility: WPSent prepares the lazy-loaded WhatsApp Web group creation job before invoking the native API. If the job or loader is unavailable, it returns 503 before attempting creation. Native library string errors are surfaced as 502; check the actual group list before retrying. Internal WhatsApp Web modules are version-dependent.

Group description compatibility: a read-only preflight checks the native library's required modules and group metadata before updating the description. Missing dependencies return 503 with a diagnostic reason; native exceptions return 502 (503 for interrupted browser connections) and details are recorded in server logs. No automatic mutation retries. The browser adapter uses the current named-object signature of setGroupDescription (WAHA issue #2199) instead of the outdated positional call in whatsapp-web.js 1.34.8.
