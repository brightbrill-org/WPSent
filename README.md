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

## Authentication

Every API call requires **both** credentials:

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

Fired on every inbound message — text, emoji, reaction, sticker, image, etc.

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
