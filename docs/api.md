# WPSent API Reference

> Version: current API on `feat/native-media-messaging` (PR #17). Examples contain fictional identifiers and placeholder credentials. Use the base URL of your own deployment. Live WhatsApp behavior is subject to the linked session and WhatsApp Web compatibility.

**Base URL:** `https://wpsent.xyz`

**Postman:** [WPSent.postman_collection.json](./WPSent.postman_collection.json) · [Hosted API docs](https://wpsent.xyz/docs)

## Endpoint index

| Method | Endpoint | Description |
|---|---|---|
| GET | `/status` | Connection status |
| GET | `/logs` | Message logs |
| GET | `/media/:mediaId` | Download inbound media |
| GET | `/lid/resolve` | Resolve LID |
| GET | `/chats` | List chats |
| GET | `/contacts` | List contacts |
| POST | `/send` | Send text, poll, document, contact, location, image, video or voice note |
| POST | `/seen` | Mark chat as seen |
| POST | `/reply` | Reply to message |
| POST | `/webhooks` | Add webhook |
| PATCH | `/webhooks/:webhookId` | Toggle webhook |
| DELETE | `/webhooks/:webhookId` | Delete webhook |
| POST | `/admin/api/signup` | Create administrator account |
| POST | `/admin/api/login` | Admin login |
| GET | `/admin/api/me` | Current administrator |
| GET | `/admin/api/phones` | List phones |
| GET | `/admin/api/admins` | List administrators |
| POST | `/admin/api/logout` | Admin logout |
| PUT | `/admin/api/phone-limit` | Set phone limit |
| POST | `/admin/api/admins/approve` | Approve administrator |
| POST | `/admin/api/admins/password` | Reset administrator password |
| POST | `/admin/api/admins/revoke` | Revoke administrator |
| POST | `/admin/api/phones/:targetPhone/revoke` | Revoke phone — destructive |
| POST | `/groups` | Create group |
| POST | `/groups/:groupId/participants` | Add group participants |
| DELETE | `/groups/:groupId/participants` | Remove group participants |
| PATCH | `/groups/:groupId/subject` | Change group subject |
| PATCH | `/groups/:groupId/description` | Change group description |
| GET | `/groups/:groupId/invite` | Get group invite link |

## Contents

- [Authentication](#authentication)
- [Self-Hosting](#self-hosting)
- [Send a Message](#send-a-message)
- [Send and receive images, videos and voice notes](#send-and-receive-images-videos-and-voice-notes)
- [Mark as seen and quoted reply](#mark-as-seen-and-quoted-reply)
- [Message Logs](#message-logs)
- [Connection Status](#connection-status)
- [Resolve WhatsApp LID](#resolve-whatsapp-lid)
- [List WhatsApp chats and contacts](#list-whatsapp-chats-and-contacts)
- [Group management](#group-management)
- [Webhooks](#webhooks)
- [Code Examples](#code-examples)
- [Message Types](#message-types)
- [Administration](#administration)
- [Contact & Support](#contact--support)

WPSent is a self-hosted WhatsApp API gateway. Link your number once, get a Client ID and Secret Key, then send and receive messages via REST API.

Simple HTTP, any language

Receive inbound messages

Self-hosted, always free


## Authentication

Every API request requires two credentials:

| Credential | Query param | Header |
| --- | --- | --- |
| clientid | `?clientid=` | `x-client-id` |
| key | `?key=` | `x-api-key` |

Your Secret Key is also your dashboard login password. Find both on your dashboard after scanning the QR code.


## Self-Hosting

### Railway (recommended)

```text
1. Fork: https://github.com/brightbrill-org/WPSent
2. New project on railway.app → Deploy from GitHub
3. Add env var: MONGO_URI = your MongoDB Atlas URI
4. Add env var: SINGLE_USER = true (optional, initial phone limit of 1; admin settings override this)
5. Deploy — Chromium installs automatically
```

### Local

```bash
git clone https://github.com/brightbrill-org/WPSent
cd WPSent
cp .env.example .env   # add MONGO_URI
npm install
npm start              # visit http://localhost:3000
```


## Send a Message

POST`/send`

| Param | Where | Notes |
| --- | --- | --- |
| clientid (required) | query or header | Your client ID |
| key (required) | query or header | Your secret key |
| to (required) | query or body | Phone number. + and spaces accepted. @lid and @g.us passed as-is. |
| message | JSON body | Text, or supply another message type below. |

```bash
curl -X POST "https://wpsent.xyz/send?clientid=YOUR_CID&key=YOUR_KEY&to=8801711000000" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!"}'
```

Response:

```json
{ "ok": true, "logId": "64f3a..." }
```

### Poll

To send a WhatsApp poll instead of a text message, provide a `question` and at least two `options`. You can send them at the top level of the JSON body, or nest them under `poll`. Polls are logged as type `poll`.

```bash
curl -X POST "https://wpsent.xyz/send?clientid=YOUR_CID&key=YOUR_KEY&to=8801711000000" \
  -H "Content-Type: application/json" \
  -d '{"question": "What is your favorite color?", "options": ["Red", "Blue", "Green"]}'
```

Or nested:

```bash
curl -X POST "https://wpsent.xyz/send?clientid=YOUR_CID&key=YOUR_KEY&to=8801711000000" \
  -H "Content-Type: application/json" \
  -d '{"poll": {"question": "What is your favorite color?", "options": ["Red", "Blue", "Green"]}}'
```

### Document (base64)

Authenticated `POST /send` accepts JSON bodies up to 20 MiB by default, configurable by the server administrator (1–50 MiB). Base64 adds about 33% overhead, so the default allows an original file slightly below 15 MiB. Use `application/json`. Oversized requests return HTTP 413; proxy and WhatsApp limits may be lower. Other endpoints and URL-encoded forms retain the 100 KiB limit.

To send a document, provide a `document` object with `mimetype`, `filename`, and base64 `data`. A `data:...;base64,` prefix is stripped if present. `document.caption` is optional and is stored on the message log.

| Field | Where | Notes |
| --- | --- | --- |
| document.mimetype (required) | JSON body | MIME type, e.g. `application/pdf` |
| document.filename (required) | JSON body | File name shown in WhatsApp |
| document.data (required) | JSON body | Base64 file contents. A `data:` prefix is allowed. |
| document.caption | JSON body | Optional. Recorded in the log; not sent as a WhatsApp caption. |

```bash
curl -X POST "https://wpsent.xyz/send?clientid=YOUR_CID&key=YOUR_KEY&to=8801711000000" \
  -H "Content-Type: application/json" \
  -d '{"document": {"mimetype": "application/pdf", "filename": "invoice.pdf", "data": "JVBERi0xLjc...", "caption": "Invoice"}}'
```

### Contact card

Send one native WhatsApp contact card. `contact.name` and `contact.phone` (international number including country code) are required. `organization` and `email` are optional. The contact need not be saved; WPSent does not modify the phonebook. Logged as type `contact`.

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

### Location pin

Send a static native WhatsApp location. `location.latitude` and `location.longitude` must be JSON numbers in ranges -90 to 90 and -180 to 180. Optional `name`, `address` and HTTP(S) `url` describe the pin. This does not send live location or access GPS. Logged as type `location`.

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

Both examples use POST `/send` with headers `x-client-id`, `x-api-key` and `Content-Type: application/json`. Replace sample details with authorized values. Use one payload type per request when sending a contact or location. Invalid or mixed payloads return 400; send failures return 500 with a log ID. Verify delivery before retrying.


## Send and receive images, videos and voice notes

POST`/send` supports native media using exactly one of these JSON objects. Use existing API authentication headers.

```json
{ "to": "919000000001", "image": {
  "mimetype": "image/jpeg", "data": "BASE64_IMAGE",
  "filename": "photo.jpg", "caption": "Product photo"
}}
```

```json
{ "to": "919000000001", "video": {
  "mimetype": "video/mp4", "data": "BASE64_VIDEO",
  "filename": "demo.mp4", "caption": "Product demonstration"
}}
```

```json
{ "to": "919000000001", "voiceNote": {
  "mimetype": "audio/ogg", "data": "BASE64_OGG_OPUS",
  "filename": "voice.ogg"
}}
```

Outgoing formats: JPEG/PNG, MP4 (WhatsApp-compatible codecs such as H.264/AAC), Ogg Opus. Standard padded base64 or matching data URL. Header checks are not full codec validation; no transcoding. Format mismatch errors identify the declared MIME type and detected file header when recognized, with guidance specific to the requested media type. Filename optional; image/video caption optional (1024 characters); no voice captions. Decoded limit 10 MiB, subject to the existing JSON request limit. Native inline media, not documents. Ready session required; one media send per account, two globally, 90-second deadline. No automatic retries.

```json
{ "ok": true, "chatId": "919000000001@c.us",
  "messageId": "true_919000000001@c.us_EXAMPLE456",
  "type": "voice_note", "logId": "64f3a1234567890123456789" }
```

HTTP 400 invalid media, 413 size limit, 503 not ready/busy, 504 timeout, 502 unconfirmed send. Confirm actual delivery before retrying. Outbound voice notes return type voice_note; inbound PTT keeps legacy type audio with mediaKind voice_note and isVoiceNote true.

### Receive media and download

```json
{
  "event": "message_received",
  "type": "audio", "mediaKind": "voice_note", "isVoiceNote": true,
  "chatId": "919000000001@c.us",
  "messageId": "false_919000000001@c.us_EXAMPLE123",
  "mediaStatus": "available", "mediaMimetype": "audio/ogg",
  "mediaFilename": "voice.ogg", "mediaSize": 32000,
  "mediaId": "12345678-1234-4234-8234-123456789012",
  "mediaDownloadPath": "/media/12345678-1234-4234-8234-123456789012"
}
```

Images/videos expose mediaKind image/video and mediaCaption; ordinary audio exposes mediaKind audio and isVoiceNote false. Existing authenticated GET /media/:id returns original bytes, default 8 MiB capture limit and 24-hour retention (configurable up to 10 MiB and 168 hours). Download before expiry; mediaStatus indicates availability. View-once and disappearing media are skipped. No media bytes in webhooks.


## Mark as seen and quoted reply

Use existing `x-client-id`, `x-api-key` and `Content-Type: application/json` headers. Both endpoints require the authenticated account's WhatsApp session to be ready.

### Mark chat as seen

POST`/seen` marks the conversation read (not just one message). Use the original `chatId` from a new inbound webhook/log, an ID from List Chats, or an international phone number. Group IDs and LIDs are supported.

```json
{ "chatId": "919000000001@c.us" }
```

```json
{ "ok": true, "chatId": "919000000001@c.us", "seen": true }
```

### Reply to a message

POST`/reply` sends a native quoted text reply in the original conversation. Copy the full WhatsApp `messageId` from a new inbound webhook/log, not the WPSent `logId`. The destination is determined from the original message, not the request. Optional boolean `markSeen` defaults to false; true also marks the conversation as seen during sending.

```json
{
  "messageId": "false_919000000001@c.us_EXAMPLE123",
  "message": "Thank you for your message!",
  "markSeen": false
}
```

```json
{
  "ok": true,
  "chatId": "919000000001@c.us",
  "messageId": "true_919000000001@c.us_EXAMPLE456",
  "replyToMessageId": "false_919000000001@c.us_EXAMPLE123",
  "logId": "64f3a1234567890123456789"
}
```

New inbound message webhooks/logs expose the original `chatId` and WhatsApp `messageId` when available. Webhooks also include `logId` for every normal inbound message. Older logs are not backfilled; reaction notifications do not supply a reply target. Reply uses the linked account's available original message, with no silent unquoted fallback. Text replies only (max 16000 characters). HTTP 400 invalid request, 401/403 invalid credentials, 404 original message/chat unavailable, 503 session not ready/busy, 504 timeout, 502 unconfirmed action, 500 unexpected error. On uncertain send results, check the actual conversation before retrying to avoid duplicates. If a reply is sent but log creation fails, the successful response includes a warning and null logId. Read receipt visibility is subject to WhatsApp settings.


## Message Logs

GET`/logs` — last 100 messages, oldest auto-deleted.

```bash
curl "https://wpsent.xyz/logs?clientid=YOUR_CID&key=YOUR_KEY"
```

### Download inbound media

GET`/media/:id` returns the original binary file as an attachment. Authenticate using `x-client-id` and `x-api-key`. The inbound webhook and logs include `mediaStatus`, and when available, `mediaId`, `mediaFilename`, `mediaMimetype`, `mediaSize` (bytes), `mediaExpiresAt` and `mediaDownloadPath`. GET webhook fields are flat query parameters. Prefix the relative download path with your WPSent base URL. No API key is embedded in the path.

```bash
curl "https://wpsent.xyz/media/MEDIA_ID" -H "x-client-id: YOUR_CID" -H "x-api-key: YOUR_KEY" -o received-file
```

Default maximum 8 MiB per file; retention 24 hours; configurable by the server administrator. Media capture is best effort (available, unavailable, too_large, skipped, busy, timeout). View-once and identifiable disappearing media are skipped. No historical backfill. Missing, expired or other-account media returns 404. Download via dashboard Logs using the signed session cookie.


## Connection Status

GET`/status`

```json
{ "phone": "8801711000000", "status": "ready" }
```

Status values: `initializing`, `qr_ready`, `ready`, `disconnected`, `auth_failure`, `error`.


## Resolve WhatsApp LID

GET`/lid/resolve?lid=123456789012345%40lid`

Resolve a known WhatsApp LID to its international phone number using your authenticated, ready WhatsApp session. Supply the complete LID including `@lid`. Authentication uses the existing client ID and API key (headers recommended).

```bash
curl "https://wpsent.xyz/lid/resolve?lid=123456789012345%40lid" \
  -H "x-client-id: YOUR_CID" \
  -H "x-api-key: YOUR_KEY"
```

### Resolved — HTTP 200

```json
{
  "ok": true,
  "lid": "123456789012345@lid",
  "phone": "919876543210",
  "phoneId": "919876543210@c.us",
  "resolved": true
}
```

### Mapping unavailable — HTTP 200

```json
{
  "ok": true,
  "lid": "123456789012345@lid",
  "phone": null,
  "phoneId": null,
  "resolved": false
}
```

HTTP 400: missing or invalid LID. 401/403: missing or invalid credentials. 503: WhatsApp session not ready. 500: unexpected server error. A lookup may return unresolved on a missing mapping, timeout or temporary lookup failure. Successful mappings share the inbound-message cache; no number is inferred from LID digits. Use the original LID with `/send` if necessary. Examples use fictional identifiers.


## List WhatsApp chats and contacts

GET`/chats` and GET`/contacts` return the authenticated account's currently available WhatsApp directory. Use existing API headers. No message history, group participants, profile photos or raw WhatsApp objects are returned.

```text
GET /chats?limit=50&offset=0&type=group
GET /chats?unreadOnly=true&archived=false
GET /contacts?search=Support&savedOnly=true
GET /contacts?resolveLid=true
```

Common parameters: `limit` (1–200, default 50), `offset` (0–1000000, default 0), `search` (case-insensitive name, ID or known phone), `resolveLid` (true/false, default false; resolves at most 20 LIDs on the returned page). Chats also accept `type` (all/individual/group), `unreadOnly` and `archived` (true/false). Contacts accept `savedOnly` and `businessOnly` (true filters, false/omitted does not filter). Search runs before optional LID resolution. Unresolved LID phone numbers are null, never inferred from the ID digits.

### Chat response

```json
{
  "ok": true, "total": 1, "limit": 50, "offset": 0, "hasMore": false,
  "items": [{
    "id": "123456789-123456789@g.us", "phone": null, "lid": null,
    "name": "Example group", "isGroup": true, "unreadCount": 2,
    "timestamp": 1795775400, "archived": false, "pinned": false, "isMuted": false
  }]
}
```

### Contact response

```json
{
  "ok": true, "total": 1, "limit": 50, "offset": 0, "hasMore": false,
  "items": [{
    "id": "919000000001@c.us", "phone": "919000000001", "lid": null,
    "name": "Example Support", "pushname": null, "shortName": null,
    "isMyContact": true, "isBusiness": false, "isWAContact": true,
    "isMe": false, "isBlocked": false
  }]
}
```

Chat timestamps are Unix seconds; chats sorted most recent first, contacts by name. Missing fields are null. Use returned `id` as `to` in Send API. Contacts reflect the linked WhatsApp Web session, not necessarily the complete phone address book. Broadcast/status/newsletter entries are excluded. Pagination is over a live directory, not a fixed snapshot; concurrent changes can move items between pages. Invalid query: 400; credentials: 401/403; session unavailable/busy: 503; directory timeout: 504. Responses are private and not cacheable.


## Group management

All group APIs require the existing Client ID and API key headers and a ready linked WhatsApp account. Existing-group operations require the linked account to be a WhatsApp group administrator; WPSent administrator status does not grant WhatsApp permissions. Use `GET /chats?type=group` to find group IDs.

```text
POST /groups
{ "subject": "Project team", "participants": ["919000000001", "919000000002@c.us"] }

POST /groups/123456789-123456789@g.us/participants
{ "participants": ["919000000003"] }

DELETE /groups/123456789-123456789@g.us/participants
{ "participants": ["919000000003@c.us"] }

PATCH /groups/123456789-123456789@g.us/subject
{ "subject": "Updated project team" }

PATCH /groups/123456789-123456789@g.us/description
{ "description": "Project coordination and updates" }

GET /groups/123456789-123456789@g.us/invite
```

Subject: non-empty, max 100 characters. Description: max 2048 characters; empty string clears it. Participants: 1–20 per add/remove, 0–20 for creation; international phone numbers, individual phone IDs or LIDs. Duplicates are normalized. No automatic private invitation messages: privacy restrictions remain respected. Add/create return per-participant codes (200 added, 409 already a member, 403 invite required, 404 unavailable; null means result not matched). Group creation returns HTTP 201 with groupId even when participant additions are partial; inspect allAdded and participants. Remove checks membership before dispatch and re-reads the group; removed is true only when absence is observed, otherwise unconfirmed. The linked account and group owner cannot be removed by this API.

```json
{
  "ok": true,
  "groupId": "123456789-123456789@g.us",
  "inviteCode": "EXAMPLE_INVITE_CODE",
  "inviteLink": "https://chat.whatsapp.com/EXAMPLE_INVITE_CODE"
}
```

Group creation prepares the WhatsApp Web group creation module before dispatch; missing or incompatible modules return 503. Native creation errors return 502 with the available library error. Verify group state before retrying. Group description updates check the required WhatsApp Web modules and group metadata before dispatch and use the current named-object signature to avoid the upstream toJid error. Missing dependencies return 503 with a diagnostic reason; unexpected native update failures return 502 and technical details are recorded in server logs. Check actual group state before retrying. Invite retrieval prepares the lazy WhatsApp Web invite query module when necessary. Missing modules return 503 and native query failures return 502 or 503 for connection loss. Invite links are sensitive; distribute only to intended participants. The invite endpoint retrieves the current code without resetting it. HTTP 400 invalid input, 401/403 authentication or permissions, 404 group not found, 502 unconfirmed operation, 503 busy/not ready/unavailable, 504 timeout. Operations have a 45-second deadline, one outstanding operation per linked session and four globally. Timeout cannot undo an already dispatched operation; inspect group state before retrying. WhatsApp may impose stricter limits or permissions. No raw group models or invite codes are saved by WPSent.


## Webhooks

Register a separate URL for each event type. Existing subscriptions and requests without an event remain inbound-message webhooks. Query params in your URL are preserved.

### Add

```text
POST /webhooks
x-client-id: YOUR_CID
x-api-key: YOUR_KEY
{ "url": "https://yoursite.com/hook?key=abc", "method": "POST", "label": "My CRM", "event": "message_received" }
```

Supported events: `message_received` (default) and `auth_rescan_required`. Unsupported values return HTTP 400.

### Toggle / Delete

```text
PATCH /webhooks/:id  { "active": false }
DELETE /webhooks/:id
```

### Payload

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

For direct messages, `from` is the phone number when available, otherwise the original WhatsApp ID (including @lid). `fromId` always preserves the original ID; `fromLid` and `fromPhone` are null when unavailable. For group messages, `from` remains the group ID and `authorId`, `authorLid` and `authorPhone` describe the participant when present. GET webhooks omit null fields. Never interpret LID digits as a phone number. Use the original ID for replies when no phone mapping is available.

### Authentication — rescan required webhook

```text
POST /webhooks
x-client-id: YOUR_CID
x-api-key: YOUR_KEY
{ "url": "https://yoursite.com/auth-alert", "method": "POST", "label": "WhatsApp reconnect alert", "event": "auth_rescan_required" }
```

Example event:

```json
{
  "event": "auth_rescan_required",
  "eventId": "12345678-1234-4234-8234-123456789012",
  "phone": "919000000001",
  "reason": "qr_required",
  "status": "rescan_required",
  "timestamp": "2026-11-27T10:30:00.000Z"
}
```

Reasons: `qr_required` (actual QR), `auth_failure` (library reports failed authentication), `logged_out`, `unpaired`. The alert also applies if an already registered account requests a manual rescan. It is not triggered by ordinary disconnects, PM2 restart, Puppeteer target errors or readiness retries without auth evidence. Only active subscriptions of this event receive it. Repeated QR refreshes and reconnects are deduplicated across restarts until genuine Ready. GET uses flat query parameters. No QR code, API key or secret is included. Delivery is best effort with the existing webhook timeout; there is no persistent retry queue. Use the existing toggle/delete endpoints to manage each subscription independently.


## Code Examples

### Node.js

```javascript
const res = await fetch(
  'https://wpsent.xyz/send?clientid=YOUR_CID&key=YOUR_KEY&to=8801711000000',
  { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ message: 'Hello!' }) }
);
console.log(await res.json());
```

### Python

```python
import requests
r = requests.post('https://wpsent.xyz/send',
    params={'clientid':'YOUR_CID','key':'YOUR_KEY','to':'8801711000000'},
    json={'message': 'Hello!'})
print(r.json())
```

### Webhook receiver (Flask)

```python
from flask import Flask, request
app = Flask(__name__)
@app.route('/hook', methods=['POST'])
def hook():
    d = request.json
    print(f"{d['from']}: {d['body']} ({d['type']})")
    return {'ok': True}
app.run(port=5000)
```


## Message Types

| type | body value |
| --- | --- |
| text | The message text |
| reaction | [Reaction: 👍] |
| sticker | [Sticker] |
| image | [Image] or caption |
| video | [Video] or caption |
| audio | [Audio] or [Voice note] (see `mediaKind`) |
| document | [Document: filename] |
| location | [Location: lat,lng] |
| contact | [Contact card] |
| voice_note | Outbound native voice note |


## Administration

Open the administrator console. The first email/password account requires the configured ADMIN_BOOTSTRAP_TOKEN and is automatically approved. Subsequent accounts need approval. Administrators can view and revoke registered phone sessions, set the registration limit, approve or revoke administrators, and reset passwords.

Admin mutations require JSON, X-WPSent-Admin: 1 and a signed administrator session cookie (except signup/login/logout). Password reset and revocation invalidate previous sessions. See the Postman collection for admin API requests.

```text
POST /admin/api/signup
POST /admin/api/login
POST /admin/api/logout
GET /admin/api/me
GET /admin/api/phones
PUT /admin/api/phone-limit
POST /admin/api/phones/:phone/revoke
GET /admin/api/admins
POST /admin/api/admins/approve
POST /admin/api/admins/revoke
POST /admin/api/admins/password
```


## Contact & Support

See the [repository](https://github.com/brightbrill-org/WPSent) and the deployed documentation for configured support contacts.

## Recommended authentication example

```bash
curl -X POST 'https://wpsent.xyz/send' \
  -H 'x-client-id: YOUR_CID' \
  -H 'x-api-key: YOUR_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"to":"919000000001","message":"Hello!"}'
```

Prefer headers over URL query credentials to reduce exposure in URL logs. Keep API keys and invite links private.

## Related documentation

- [Administrator management](./admin-management.md)
- [LID resolution](./lid-resolution.md)
- [Session persistence](./session-persistence.md)
- [Readiness watchdog](./readiness-watchdog.md)
- [Code organization](./code-organization.md)

### Poll management

Send via authenticated POST /send with either nested poll or legacy top-level question/options. Example:
```json
{"to":"919000000001","poll":{"question":"Choose a product","options":["E360","HireHub"],"allowMultipleAnswers":true}}
```
2–12 unique options (max 100 characters each), question max 255, default single-choice. Returns ok, chatId, messageId, type, poll and logId. Incoming polls use message_received with type poll and nested poll metadata when available. Register a separate webhook with event poll_vote_updated; fields include pollMessageId, chatId, voterId, voterPhone, voterLid, selectedOptions, selectionComplete, withdrawn, votedAt and timestamp. Empty selectedOptions with withdrawn true means deselection. GET webhook structured values are JSON strings; POST recommended. Best-effort delivery, no replay or durable vote history.

GET /polls/:messageId/results returns live session-visible poll question, allowMultipleAnswers, totalVoters, options (name/votes) and voters (current selections including withdrawn entries). Use full serialized WhatsApp message ID, URL encoded as needed. Counts use latest entry per raw voter ID; no assumption that different LID and phone IDs are the same person. Multiple-choice percentages need not sum to 100. Missing/incomplete data fails explicitly where detectable; results depend on WhatsApp Web's local data, not guaranteed complete server history. At most 20 LID lookups. 

POST /polls/:messageId/vote with {"selectedOptions":["E360"]} submits the linked account's own vote; [] withdraws. Response status submitted, confirmed false: native method returns no confirmation; check results before retrying. Poll operations require Ready, are account scoped, bounded to one per session and four globally, deadline 30 seconds. HTTP 400 invalid, 404 poll unavailable, 502 unconfirmed/incomplete, 503 unavailable/busy, 504 timeout. No automatic retries.

### Dashboard code examples

Open the signed-in dashboard and select Examples. Choose an API operation and cURL (Bash), Node.js or Python. The generated snippets use the current dashboard origin, not a fixed WPSent domain. Replace `YOUR_CLIENT_ID`, `YOUR_API_KEY` and request-specific placeholders. The copy button copies only the code; no request is executed. Media download examples write a file. Administrative APIs remain documented separately.


## Broadcast lists and outbound pacing

WPSent-managed lists are separate from native WhatsApp broadcast lists. Text-only, consented notifications; no group recipients, no scraping or automatic retries. Record explicit consent for each recipient (phone, consent:true, consentSource) and confirm at send time. Record opt-outs using POST /broadcasts/opt-out; account-wide suppression is permanent via this API and removes the number from all lists. Opt-outs, list membership and account state are checked again immediately before dispatch. Maximum 20 lists/account, 25 recipients/list or job, 100 reserved recipient slots per rolling 24 hours, one job per account and two globally. These are resource/consent safeguards, not WhatsApp-approved sending limits. Use official WhatsApp Business tools for large-scale messaging.

| Method | Path | Purpose |
|---|---|---|
| GET | `/sending/settings` | Get sending settings |
| GET | `/broadcasts` | List broadcasts |
| POST | `/broadcasts` | Create broadcast |
| GET | `/broadcasts/jobs` | Broadcast job history |
| GET | `/broadcasts/jobs/:jobId` | Get broadcast job |
| POST | `/broadcasts/jobs/:jobId/cancel` | Cancel broadcast job |
| POST | `/broadcasts/opt-out` | Record broadcast opt-out |
| GET | `/broadcasts/:broadcastId` | Get broadcast list |
| PATCH | `/broadcasts/:broadcastId` | Rename broadcast list |
| DELETE | `/broadcasts/:broadcastId` | Delete broadcast list |
| POST | `/broadcasts/:broadcastId/recipients` | Add broadcast recipients |
| DELETE | `/broadcasts/:broadcastId/recipients` | Remove broadcast recipients |
| POST | `/broadcasts/:broadcastId/send` | Send text broadcast |

Create: `POST /broadcasts`, body `{"name":"Service updates","recipients":[{"phone":"919000000001","consent":true,"consentSource":"Customer opt-in record 123"}]}`. PATCH supports name and/or replacement recipients; add accepts recipients array, remove accepts phones array. International numbers with country code only. DELETE removes list, not job history.

Send: `POST /broadcasts/:id/send`, body `{"message":"Your requested update is ready.","requestId":"unique-request-123","confirmConsent":true}`. HTTP 202 returns job ID and initial recipient states. Repeat the same requestId for the same list/message to retrieve existing job, not resubmit. Job history retained 30 days. GET /broadcasts/jobs/:jobId returns pending/sending/submitted/not_sent/unknown. Submitted means native message ID returned, NOT delivered/read. On error stop remaining recipients; an uncertain send is unknown, never retried automatically. Cancellation stops remaining sends, cannot recall a dispatched message. Restart marks active jobs interrupted (in-flight unknown, pending not_sent), never replays. Jobs run in the server process, no external worker required. All operations require API headers and are account scoped.

### Outbound pacing (server-wide)

| Environment variable | Default | Range |
|---|---:|---|
| WA_SEND_INTERVAL_MS | 1000 | 0–5000 ms |
| WA_SEND_QUEUE_MAX | 4 | 1–8 pending sends |
| WA_SEND_QUEUE_WAIT_MS | 5000 | 1000–10000 ms |
| WA_BROADCAST_INTERVAL_MS | 3000 | 3000–60000 ms |

One native client.sendMessage operation at a time across all linked accounts, with a fixed gap AFTER completion. Applies to text, documents, contact/location, native media, poll creation and quoted replies. Not inbound traffic, reads, group management, vote mutations or browser/background traffic. It smooths application dispatch, not a bandwidth guarantee or a way to bypass WhatsApp restrictions. A full/expired queue returns 503 where exposed; no dispatch occurred for that queued request. Existing action timeouts can still leave a dispatched send uncertain. Set environment variables and restart PM2 to change policy; GET /sending/settings shows effective values and current queue status. Zero interval retains serialization. Single PM2 fork only.

Dashboard Broadcasts tab supports list creation/edit/delete, pasted numbers, explicit consent confirmation, text job submission, latest job status/cancel and opt-out. Direct contact selection and full CSV parsing, media broadcasts, durable replay and delivery receipts are not included.

Broadcast submission has a 90-second response deadline. If the deadline expires, the job stops and records the current recipient as unknown; the underlying native operation may still be running, so the global scheduler retains its slot until that operation settles. The dashboard shows the effective sending policy read-only. Consent/opt-out checks run again before native dispatch, but cannot recall an already dispatched message.
