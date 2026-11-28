'use strict';

const { HTML_CONFIG: CONFIG, escapeHTML } = require('../routes/config');

function docsHTML(host) {
  host = host ? escapeHTML(host) : CONFIG.SITE_URL;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>WPSent API Docs</title>
<meta name="description" content="WPSent API documentation - send WhatsApp messages, webhooks, authentication guide."/>
<meta name="robots" content="index, follow"/>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='%2325d366'/><polygon points='14,30 50,18 42,46 28,32' fill='%230d0d0d'/></svg>"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
:root{--bg:#0d0d0d;--surf:#161616;--surf2:#1f1f1f;--border:#2a2a2a;
  --green:#25d366;--text:#e8e8e8;--muted:#666;--danger:#e74c3c;--blue:#3498db;--r:12px;--rs:8px;}
body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;line-height:1.6;}
.nav{display:flex;align-items:center;justify-content:space-between;padding:13px 24px;
  border-bottom:1px solid var(--border);position:sticky;top:0;z-index:100;
  background:rgba(13,13,13,.95);backdrop-filter:blur(10px);}
.nav-logo{display:flex;align-items:center;gap:8px;font-weight:700;font-size:15px;text-decoration:none;color:var(--text);}
.nav-icon{width:28px;height:28px;background:var(--green);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:14px;}
.nav-links{display:flex;gap:6px;}
.nav-link{font-size:12px;color:var(--muted);text-decoration:none;padding:5px 11px;border-radius:20px;border:1px solid transparent;transition:all .15s;}
.nav-link:hover,.nav-link.on{color:var(--text);border-color:var(--border);}
.nav-link.gh{background:var(--surf2);border-color:var(--border);color:var(--text);display:flex;align-items:center;gap:5px;}
.layout{display:grid;grid-template-columns:210px 1fr;max-width:1080px;margin:0 auto;}
.sb{padding:24px 16px;border-right:1px solid var(--border);position:sticky;top:57px;height:calc(100vh - 57px);overflow-y:auto;}
.sb h3{font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);font-weight:600;margin-bottom:8px;margin-top:18px;}
.sb h3:first-child{margin-top:0;}
.sb a{display:block;font-size:13px;color:var(--muted);text-decoration:none;padding:4px 8px;border-radius:6px;margin-bottom:2px;}
.sb a:hover{color:var(--text);background:var(--surf2);}
.doc{padding:36px 44px;max-width:740px;}
h1{font-size:26px;font-weight:700;margin-bottom:8px;}
h2{font-size:17px;font-weight:600;margin:36px 0 10px;padding-top:18px;border-top:1px solid var(--border);}
h2:first-of-type{border-top:none;margin-top:16px;}
h3{font-size:14px;font-weight:600;margin:18px 0 7px;}
p{font-size:14px;color:#bbb;margin-bottom:10px;}
code{font-family:'JetBrains Mono',monospace;font-size:12px;background:var(--surf2);padding:2px 6px;border-radius:4px;color:var(--green);}
pre{background:var(--surf2);border:1px solid var(--border);border-radius:var(--rs);padding:14px;
  font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.7;overflow-x:auto;margin-bottom:14px;color:#aaa;}
.mt{display:inline-block;font-size:11px;font-weight:700;padding:2px 7px;border-radius:4px;margin-right:6px;font-family:'JetBrains Mono',monospace;}
.get{background:#1a2a3a;color:var(--blue);}
.post{background:#1a3a26;color:var(--green);}
.del{background:#3a1a1a;color:var(--danger);}
.ptch{background:#2a2010;color:#f39c12;}
table{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:13px;}
th{text-align:left;padding:7px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);border-bottom:1px solid var(--border);}
td{padding:9px 10px;border-bottom:1px solid var(--surf2);color:#bbb;}
td:first-child{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--green);}
.req{display:inline-block;font-size:10px;padding:1px 6px;border-radius:10px;background:#3a1a1a;color:var(--danger);font-weight:600;margin-left:4px;}
.cards{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:16px 0;}
.card{background:var(--surf);border:1px solid var(--border);border-radius:var(--rs);padding:12px;}
.card .icon{font-size:18px;margin-bottom:6px;}
.card h4{font-size:13px;font-weight:600;margin-bottom:3px;}
.card p{font-size:12px;color:var(--muted);margin:0;}
@media(max-width:700px){.layout{grid-template-columns:1fr;}.sb{display:none;}.doc{padding:20px;}}
</style>
</head>
<body>
<nav class="nav">
  <a class="nav-logo" href="/"><div class="nav-icon">💬</div>WPSent</a>
  <div class="nav-links">
    <a class="nav-link on" href="/docs">Docs</a>
    <a class="nav-link" href="/dashboard">Dashboard</a>
    <a class="nav-link" href="/admin">Admin</a>
    <a class="nav-link gh" href="${CONFIG.GITHUB_URL}" target="_blank">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
      GitHub
    </a>
    <a class="nav-link" href="/">Sign In</a>
  </div>
</nav>
<div class="layout">
  <div class="sb">
    <h3>Getting Started</h3>
    <a href="#intro">Introduction</a>
    <a href="#auth">Authentication</a>
    <a href="#self-host">Self-Hosting</a>
    <h3>Messaging APIs</h3>
    <a href="#send">Send Message</a>
    <a href="#polls">Poll Management</a>
    <a href="#native-media">Images, Videos &amp; Voice Notes</a>
    <a href="#seen-reply">Mark as Seen &amp; Reply</a>
    <a href="#logs">Message Logs &amp; Media Download</a>
    <h3>Account &amp; Directory APIs</h3>
    <a href="#status">Connection Status</a>
    <a href="#lid">Resolve LID</a>
    <a href="#directory">Chats &amp; Contacts</a>
    <h3>Group &amp; Webhook APIs</h3>
    <a href="#groups">Group Management</a>
    <a href="#webhooks">Webhooks</a>
    <a href="#broadcasts">Broadcasts &amp; Sending Settings</a>
    <h3>Guides &amp; Support</h3>
    <a href="#examples">Code Examples</a>
    <a href="#types">Message Types</a>
    <a href="#admin">Administration</a>
    <a href="#contact">Contact &amp; Support</a>
  </div>
  <div class="doc">
    <h1 id="intro">WPSent API Docs</h1>
    <p><a href="/docs/postman.json" download>Download WPSent Postman collection (.json)</a> — import into Postman, configure baseUrl, clientId and apiKey.</p>
    <p>WPSent is a self-hosted WhatsApp API gateway. Link your number once, get a Client ID and Secret Key, then send and receive messages via REST API.</p>
    <div class="cards">
      <div class="card"><div class="icon">&#9889;</div><h4>REST API</h4><p>Simple HTTP, any language</p></div>
      <div class="card"><div class="icon">&#128279;</div><h4>Webhooks</h4><p>Receive inbound messages</p></div>
      <div class="card"><div class="icon">&#128994;</div><h4>No fees</h4><p>Self-hosted, always free</p></div>
    </div>

    <h2 id="auth">Authentication</h2>
    <p>Every API request requires two credentials:</p>
    <table>
      <thead><tr><th>Credential</th><th>Query param</th><th>Header</th></tr></thead>
      <tbody>
        <tr><td>clientid</td><td><code>?clientid=</code></td><td><code>x-client-id</code></td></tr>
        <tr><td>key</td><td><code>?key=</code></td><td><code>x-api-key</code></td></tr>
      </tbody>
    </table>
    <p>Your Secret Key is also your dashboard login password. Find both on your dashboard after scanning the QR code.</p>

    <h2 id="self-host">Self-Hosting</h2>
    <h3>Railway (recommended)</h3>
    <pre>1. Fork: ${CONFIG.GITHUB_URL}
2. New project on railway.app &rarr; Deploy from GitHub
3. Add env var: MONGO_URI = your MongoDB Atlas URI
4. Add env var: SINGLE_USER = true (optional, initial phone limit of 1; admin settings override this)
5. Deploy &mdash; Chromium installs automatically</pre>
    <h3>Local</h3>
    <pre>git clone ${CONFIG.GITHUB_URL}
cd wpsent
cp .env.example .env   # add MONGO_URI
npm install
npm start              # visit http://localhost:3000</pre>

    <h2 id="send">Send a Message</h2>
    <p><span class="mt post">POST</span><code>/send</code></p>
    <table>
      <thead><tr><th>Param</th><th>Where</th><th>Notes</th></tr></thead>
      <tbody>
        <tr><td>clientid<span class="req">required</span></td><td>query or header</td><td>Your client ID</td></tr>
        <tr><td>key<span class="req">required</span></td><td>query or header</td><td>Your secret key</td></tr>
        <tr><td>to<span class="req">required</span></td><td>query or body</td><td>Phone number. + and spaces accepted. @lid and @g.us passed as-is.</td></tr>
        <tr><td>message</td><td>JSON body</td><td>Text, or supply another message type below.</td></tr>
      </tbody>
    </table>
    <pre>curl -X POST "${host}/send?clientid=YOUR_CID&key=YOUR_KEY&to=8801711000000" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello!"}'</pre>
    <p>Response:</p>
    <pre>{ "ok": true, "logId": "64f3a..." }</pre>

    <h3>Poll</h3>
    <p>To send a WhatsApp poll instead of a text message, provide a <code>question</code> and at least two <code>options</code>. You can send them at the top level of the JSON body, or nest them under <code>poll</code>. Polls are logged as type <code>poll</code>.</p>
    <pre>curl -X POST "${host}/send?clientid=YOUR_CID&key=YOUR_KEY&to=8801711000000" \\
  -H "Content-Type: application/json" \\
  -d '{"question": "What is your favorite color?", "options": ["Red", "Blue", "Green"]}'</pre>
    <p>Or nested:</p>
    <pre>curl -X POST "${host}/send?clientid=YOUR_CID&key=YOUR_KEY&to=8801711000000" \\
  -H "Content-Type: application/json" \\
  -d '{"poll": {"question": "What is your favorite color?", "options": ["Red", "Blue", "Green"]}}'</pre>

    <h3>Document (base64)</h3>
    <p>Authenticated <code>POST /send</code> accepts JSON bodies up to 20 MiB by default, configurable by the server administrator (1&ndash;50 MiB). Base64 adds about 33% overhead, so the default allows an original file slightly below 15 MiB. Use <code>application/json</code>. Oversized requests return HTTP 413; proxy and WhatsApp limits may be lower. Other endpoints and URL-encoded forms retain the 100 KiB limit.</p>
    <p>To send a document, provide a <code>document</code> object with <code>mimetype</code>, <code>filename</code>, and base64 <code>data</code>. A <code>data:...;base64,</code> prefix is stripped if present. <code>document.caption</code> is optional and is stored on the message log.</p>
    <table>
      <thead><tr><th>Field</th><th>Where</th><th>Notes</th></tr></thead>
      <tbody>
        <tr><td>document.mimetype<span class="req">required</span></td><td>JSON body</td><td>MIME type, e.g. <code>application/pdf</code></td></tr>
        <tr><td>document.filename<span class="req">required</span></td><td>JSON body</td><td>File name shown in WhatsApp</td></tr>
        <tr><td>document.data<span class="req">required</span></td><td>JSON body</td><td>Base64 file contents. A <code>data:</code> prefix is allowed.</td></tr>
        <tr><td>document.caption</td><td>JSON body</td><td>Optional. Recorded in the log; not sent as a WhatsApp caption.</td></tr>
      </tbody>
    </table>
    <pre>curl -X POST "${host}/send?clientid=YOUR_CID&key=YOUR_KEY&to=8801711000000" \\
  -H "Content-Type: application/json" \\
  -d '{"document": {"mimetype": "application/pdf", "filename": "invoice.pdf", "data": "JVBERi0xLjc...", "caption": "Invoice"}}'</pre>

    
    <h3>Contact card</h3>
    <p>Send one native WhatsApp contact card. <code>contact.name</code> and <code>contact.phone</code> (international number including country code) are required. <code>organization</code> and <code>email</code> are optional. The contact need not be saved; WPSent does not modify the phonebook. Logged as type <code>contact</code>.</p>
    <pre>{
  "to": "919000000001",
  "contact": {
    "name": "Example Support",
    "phone": "+919000000002",
    "organization": "Example Company",
    "email": "support@example.com"
  }
}</pre>
    <h3>Location pin</h3>
    <p>Send a static native WhatsApp location. <code>location.latitude</code> and <code>location.longitude</code> must be JSON numbers in ranges -90 to 90 and -180 to 180. Optional <code>name</code>, <code>address</code> and HTTP(S) <code>url</code> describe the pin. This does not send live location or access GPS. Logged as type <code>location</code>.</p>
    <pre>{
  "to": "919000000001",
  "location": {
    "latitude": 10.0731,
    "longitude": 78.7802,
    "name": "Example Office",
    "address": "Karaikudi, Tamil Nadu"
  }
}</pre>
    <p>Both examples use POST <code>/send</code> with headers <code>x-client-id</code>, <code>x-api-key</code> and <code>Content-Type: application/json</code>. Replace sample details with authorized values. Use one payload type per request when sending a contact or location. Invalid or mixed payloads return 400; send failures return 500 with a log ID. Verify delivery before retrying.</p>
    <h2 id="polls">Poll Management</h2>
    <p>POST /send supports nested poll or legacy question/options. Set allowMultipleAnswers to true for multiple choices. 2–12 unique options, max 100 characters each, question max 255. Response includes the WhatsApp messageId.</p>
    <pre>{"to":"919000000001","poll":{"question":"Choose a product","options":["E360","HireHub"],"allowMultipleAnswers":true}}</pre>
    <p>Incoming polls use message_received with type poll and structured poll metadata when available. Register poll_vote_updated for current selections, voter identity and withdrawn votes. POST webhooks recommended; structured values in GET webhooks are JSON strings. Best-effort delivery.</p>
    <pre>GET /polls/:messageId/results
POST /polls/:messageId/vote
{"selectedOptions":["E360"]}</pre>
    <p>Results reflect local WhatsApp Web data and include option counts and voters, not guaranteed complete history. Empty selections withdraw a vote. Vote response status submitted, confirmed false, because native dispatch has no confirmation. Ready required; one operation per session, four globally, 30-second deadline. 400 invalid, 404 unavailable poll, 502 incomplete or unconfirmed, 503 busy/not ready, 504 timeout. Verify state before retrying.</p>
    <h2 id="native-media">Send and receive images, videos and voice notes</h2>
    <p><span class="mt post">POST</span><code>/send</code> supports native media using exactly one of these JSON objects. Use existing API authentication headers.</p>
    <pre>{ "to": "919000000001", "image": {
  "mimetype": "image/jpeg", "data": "BASE64_IMAGE",
  "filename": "photo.jpg", "caption": "Product photo"
}}</pre>
    <pre>{ "to": "919000000001", "video": {
  "mimetype": "video/mp4", "data": "BASE64_VIDEO",
  "filename": "demo.mp4", "caption": "Product demonstration"
}}</pre>
    <pre>{ "to": "919000000001", "voiceNote": {
  "mimetype": "audio/ogg", "data": "BASE64_OGG_OPUS",
  "filename": "voice.ogg"
}}</pre>
    <p>Outgoing formats: JPEG/PNG, MP4 (WhatsApp-compatible codecs such as H.264/AAC), Ogg Opus. Standard padded base64 or matching data URL. Header checks are not full codec validation; no transcoding. Format mismatch errors identify the declared MIME type and detected file header when recognized, with guidance specific to the requested media type. Filename optional; image/video caption optional (1024 characters); no voice captions. Decoded limit 10 MiB, subject to the existing JSON request limit. Native inline media, not documents. Ready session required; one media send per account, two globally, 90-second deadline. No automatic retries.</p>
    <pre>{ "ok": true, "chatId": "919000000001@c.us",
  "messageId": "true_919000000001@c.us_EXAMPLE456",
  "type": "voice_note", "logId": "64f3a1234567890123456789" }</pre>
    <p>HTTP 400 invalid media, 413 size limit, 503 not ready/busy, 504 timeout, 502 unconfirmed send. Confirm actual delivery before retrying. Outbound voice notes return type voice_note; inbound PTT keeps legacy type audio with mediaKind voice_note and isVoiceNote true.</p>
    <h3>Receive media and download</h3>
    <pre>{
  "event": "message_received",
  "type": "audio", "mediaKind": "voice_note", "isVoiceNote": true,
  "chatId": "919000000001@c.us",
  "messageId": "false_919000000001@c.us_EXAMPLE123",
  "mediaStatus": "available", "mediaMimetype": "audio/ogg",
  "mediaFilename": "voice.ogg", "mediaSize": 32000,
  "mediaId": "12345678-1234-4234-8234-123456789012",
  "mediaDownloadPath": "/media/12345678-1234-4234-8234-123456789012"
}</pre>
    <p>Images/videos expose mediaKind image/video and mediaCaption; ordinary audio exposes mediaKind audio and isVoiceNote false. Existing authenticated GET /media/:id returns original bytes, default 8 MiB capture limit and 24-hour retention (configurable up to 10 MiB and 168 hours). Download before expiry; mediaStatus indicates availability. View-once and disappearing media are skipped. No media bytes in webhooks.</p>

    <h2 id="seen-reply">Mark as seen and quoted reply</h2>
    <p>Use existing <code>x-client-id</code>, <code>x-api-key</code> and <code>Content-Type: application/json</code> headers. Both endpoints require the authenticated account's WhatsApp session to be ready.</p>
    <h3>Mark chat as seen</h3>
    <p><span class="mt post">POST</span><code>/seen</code> marks the conversation read (not just one message). Use the original <code>chatId</code> from a new inbound webhook/log, an ID from List Chats, or an international phone number. Group IDs and LIDs are supported.</p>
    <pre>{ "chatId": "919000000001@c.us" }</pre>
    <pre>{ "ok": true, "chatId": "919000000001@c.us", "seen": true }</pre>
    <h3>Reply to a message</h3>
    <p><span class="mt post">POST</span><code>/reply</code> sends a native quoted text reply in the original conversation. Copy the full WhatsApp <code>messageId</code> from a new inbound webhook/log, not the WPSent <code>logId</code>. The destination is determined from the original message, not the request. Optional boolean <code>markSeen</code> defaults to false; true also marks the conversation as seen during sending.</p>
    <pre>{
  "messageId": "false_919000000001@c.us_EXAMPLE123",
  "message": "Thank you for your message!",
  "markSeen": false
}</pre>
    <pre>{
  "ok": true,
  "chatId": "919000000001@c.us",
  "messageId": "true_919000000001@c.us_EXAMPLE456",
  "replyToMessageId": "false_919000000001@c.us_EXAMPLE123",
  "logId": "64f3a1234567890123456789"
}</pre>
    <p>New inbound message webhooks/logs expose the original <code>chatId</code> and WhatsApp <code>messageId</code> when available. Webhooks also include <code>logId</code> for every normal inbound message. Older logs are not backfilled; reaction notifications do not supply a reply target. Reply uses the linked account's available original message, with no silent unquoted fallback. Text replies only (max 16000 characters). HTTP 400 invalid request, 401/403 invalid credentials, 404 original message/chat unavailable, 503 session not ready/busy, 504 timeout, 502 unconfirmed action, 500 unexpected error. On uncertain send results, check the actual conversation before retrying to avoid duplicates. If a reply is sent but log creation fails, the successful response includes a warning and null logId. Read receipt visibility is subject to WhatsApp settings.</p>

    <h2 id="logs">Message Logs</h2>
    <p><span class="mt get">GET</span><code>/logs</code> &mdash; last 100 messages, oldest auto-deleted.</p>
    <pre>curl "${host}/logs?clientid=YOUR_CID&key=YOUR_KEY"</pre>

    <h3>Download inbound media</h3>
    <p><span class="mt get">GET</span><code>/media/:id</code> returns the original binary file as an attachment. Authenticate using <code>x-client-id</code> and <code>x-api-key</code>. The inbound webhook and logs include <code>mediaStatus</code>, and when available, <code>mediaId</code>, <code>mediaFilename</code>, <code>mediaMimetype</code>, <code>mediaSize</code> (bytes), <code>mediaExpiresAt</code> and <code>mediaDownloadPath</code>. GET webhook fields are flat query parameters. Prefix the relative download path with your WPSent base URL. No API key is embedded in the path.</p>
    <pre>curl "${host}/media/MEDIA_ID" -H "x-client-id: YOUR_CID" -H "x-api-key: YOUR_KEY" -o received-file</pre>
    <p>Default maximum 8 MiB per file; retention 24 hours; configurable by the server administrator. Media capture is best effort (available, unavailable, too_large, skipped, busy, timeout). View-once and identifiable disappearing media are skipped. No historical backfill. Missing, expired or other-account media returns 404. Download via dashboard Logs using the signed session cookie.</p>

    <h2 id="status">Connection Status</h2>
    <p><span class="mt get">GET</span><code>/status</code></p>
    <pre>{ "phone": "8801711000000", "status": "ready" }</pre>
    <p>Status values: <code>initializing</code>, <code>qr_ready</code>, <code>ready</code>, <code>disconnected</code>, <code>auth_failure</code>, <code>error</code>.</p>

    <h2 id="lid">Resolve WhatsApp LID</h2>
    <p><span class="mt get">GET</span><code>/lid/resolve?lid=123456789012345%40lid</code></p>
    <p>Resolve a known WhatsApp LID to its international phone number using your authenticated, ready WhatsApp session. Supply the complete LID including <code>@lid</code>. Authentication uses the existing client ID and API key (headers recommended).</p>
    <pre>curl "${host}/lid/resolve?lid=123456789012345%40lid" \\
  -H "x-client-id: YOUR_CID" \\
  -H "x-api-key: YOUR_KEY"</pre>
    <h3>Resolved — HTTP 200</h3>
    <pre>{
  "ok": true,
  "lid": "123456789012345@lid",
  "phone": "919876543210",
  "phoneId": "919876543210@c.us",
  "resolved": true
}</pre>
    <h3>Mapping unavailable — HTTP 200</h3>
    <pre>{
  "ok": true,
  "lid": "123456789012345@lid",
  "phone": null,
  "phoneId": null,
  "resolved": false
}</pre>
    <p>HTTP 400: missing or invalid LID. 401/403: missing or invalid credentials. 503: WhatsApp session not ready. 500: unexpected server error. A lookup may return unresolved on a missing mapping, timeout or temporary lookup failure. Successful mappings share the inbound-message cache; no number is inferred from LID digits. Use the original LID with <code>/send</code> if necessary. Examples use fictional identifiers.</p>

    <h2 id="directory">List WhatsApp chats and contacts</h2>
    <p><span class="mt get">GET</span><code>/chats</code> and <span class="mt get">GET</span><code>/contacts</code> return the authenticated account's currently available WhatsApp directory. Use existing API headers. No message history, group participants, profile photos or raw WhatsApp objects are returned.</p>
    <pre>GET /chats?limit=50&amp;offset=0&amp;type=group
GET /chats?unreadOnly=true&amp;archived=false
GET /contacts?search=Support&amp;savedOnly=true
GET /contacts?resolveLid=true</pre>
    <p>Common parameters: <code>limit</code> (1–200, default 50), <code>offset</code> (0–1000000, default 0), <code>search</code> (case-insensitive name, ID or known phone), <code>resolveLid</code> (true/false, default false; resolves at most 20 LIDs on the returned page). Chats also accept <code>type</code> (all/individual/group), <code>unreadOnly</code> and <code>archived</code> (true/false). Contacts accept <code>savedOnly</code> and <code>businessOnly</code> (true filters, false/omitted does not filter). Search runs before optional LID resolution. Unresolved LID phone numbers are null, never inferred from the ID digits.</p>
    <h3>Chat response</h3>
    <pre>{
  "ok": true, "total": 1, "limit": 50, "offset": 0, "hasMore": false,
  "items": [{
    "id": "123456789-123456789@g.us", "phone": null, "lid": null,
    "name": "Example group", "isGroup": true, "unreadCount": 2,
    "timestamp": 1795775400, "archived": false, "pinned": false, "isMuted": false
  }]
}</pre>
    <h3>Contact response</h3>
    <pre>{
  "ok": true, "total": 1, "limit": 50, "offset": 0, "hasMore": false,
  "items": [{
    "id": "919000000001@c.us", "phone": "919000000001", "lid": null,
    "name": "Example Support", "pushname": null, "shortName": null,
    "isMyContact": true, "isBusiness": false, "isWAContact": true,
    "isMe": false, "isBlocked": false
  }]
}</pre>
    <p>Chat timestamps are Unix seconds; chats sorted most recent first, contacts by name. Missing fields are null. Use returned <code>id</code> as <code>to</code> in Send API. Contacts reflect the linked WhatsApp Web session, not necessarily the complete phone address book. Broadcast/status/newsletter entries are excluded. Pagination is over a live directory, not a fixed snapshot; concurrent changes can move items between pages. Invalid query: 400; credentials: 401/403; session unavailable/busy: 503; directory timeout: 504. Responses are private and not cacheable.</p>

    <h2 id="groups">Group management</h2>
    <p>All group APIs require the existing Client ID and API key headers and a ready linked WhatsApp account. Existing-group operations require the linked account to be a WhatsApp group administrator; WPSent administrator status does not grant WhatsApp permissions. Use <code>GET /chats?type=group</code> to find group IDs.</p>
    <pre>POST /groups
{ "subject": "Project team", "participants": ["919000000001", "919000000002@c.us"] }

POST /groups/123456789-123456789@g.us/participants
{ "participants": ["919000000003"] }

DELETE /groups/123456789-123456789@g.us/participants
{ "participants": ["919000000003@c.us"] }

PATCH /groups/123456789-123456789@g.us/subject
{ "subject": "Updated project team" }

PATCH /groups/123456789-123456789@g.us/description
{ "description": "Project coordination and updates" }

GET /groups/123456789-123456789@g.us/invite</pre>
    <p>Subject: non-empty, max 100 characters. Description: max 2048 characters; empty string clears it. Participants: 1–20 per add/remove, 0–20 for creation; international phone numbers, individual phone IDs or LIDs. Duplicates are normalized. No automatic private invitation messages: privacy restrictions remain respected. Add/create return per-participant codes (200 added, 409 already a member, 403 invite required, 404 unavailable; null means result not matched). Group creation returns HTTP 201 with groupId even when participant additions are partial; inspect allAdded and participants. Remove checks membership before dispatch and re-reads the group; removed is true only when absence is observed, otherwise unconfirmed. The linked account and group owner cannot be removed by this API.</p>
    <pre>{
  "ok": true,
  "groupId": "123456789-123456789@g.us",
  "inviteCode": "EXAMPLE_INVITE_CODE",
  "inviteLink": "https://chat.whatsapp.com/EXAMPLE_INVITE_CODE"
}</pre>
    <p>Group creation prepares the WhatsApp Web group creation module before dispatch; missing or incompatible modules return 503. Native creation errors return 502 with the available library error. Verify group state before retrying. Group description updates check the required WhatsApp Web modules and group metadata before dispatch and use the current named-object signature to avoid the upstream toJid error. Missing dependencies return 503 with a diagnostic reason; unexpected native update failures return 502 and technical details are recorded in server logs. Check actual group state before retrying. Invite retrieval prepares the lazy WhatsApp Web invite query module when necessary. Missing modules return 503 and native query failures return 502 or 503 for connection loss. Invite links are sensitive; distribute only to intended participants. The invite endpoint retrieves the current code without resetting it. HTTP 400 invalid input, 401/403 authentication or permissions, 404 group not found, 502 unconfirmed operation, 503 busy/not ready/unavailable, 504 timeout. Operations have a 45-second deadline, one outstanding operation per linked session and four globally. Timeout cannot undo an already dispatched operation; inspect group state before retrying. WhatsApp may impose stricter limits or permissions. No raw group models or invite codes are saved by WPSent.</p>

    <h2 id="webhooks">Webhooks</h2>
    <p>Register a separate URL for each event type. Existing subscriptions and requests without an event remain inbound-message webhooks. Query params in your URL are preserved.</p>
    <h3>Add</h3>
    <pre>POST /webhooks
x-client-id: YOUR_CID
x-api-key: YOUR_KEY
{ "url": "https://yoursite.com/hook?key=abc", "method": "POST", "label": "My CRM", "event": "message_received" }</pre>
    <p>Supported events: <code>message_received</code> (default) <code>auth_rescan_required</code> and <code>poll_vote_updated</code>. Unsupported values return HTTP 400.</p>
    <h3>Toggle / Delete</h3>
    <pre><span class="mt ptch">PATCH</span> /webhooks/:id  { "active": false }
<span class="mt del">DELETE</span> /webhooks/:id</pre>
    <h3>Payload</h3>
    <pre>{
  "event":     "message_received",
  "from":      "8801711000000",
  "fromId":    "123456789012345@lid",
  "fromLid":   "123456789012345@lid",
  "fromPhone": "8801711000000",
  "body":      "Hello!",
  "type":      "text",
  "timestamp": "2024-01-01T10:30:00.000Z"
}</pre>

    <p>For direct messages, <code>from</code> is the phone number when available, otherwise the original WhatsApp ID (including @lid). <code>fromId</code> always preserves the original ID; <code>fromLid</code> and <code>fromPhone</code> are null when unavailable. For group messages, <code>from</code> remains the group ID and <code>authorId</code>, <code>authorLid</code> and <code>authorPhone</code> describe the participant when present. GET webhooks omit null fields. Never interpret LID digits as a phone number. Use the original ID for replies when no phone mapping is available.</p>

    <h3>Authentication — rescan required webhook</h3>
    <pre>POST /webhooks
x-client-id: YOUR_CID
x-api-key: YOUR_KEY
{ "url": "https://yoursite.com/auth-alert", "method": "POST", "label": "WhatsApp reconnect alert", "event": "auth_rescan_required" }</pre>
    <p>Example event:</p>
    <pre>{
  "event": "auth_rescan_required",
  "eventId": "12345678-1234-4234-8234-123456789012",
  "phone": "919000000001",
  "reason": "qr_required",
  "status": "rescan_required",
  "timestamp": "2026-11-27T10:30:00.000Z"
}</pre>
    <p>Reasons: <code>qr_required</code> (actual QR), <code>auth_failure</code> (library reports failed authentication), <code>logged_out</code>, <code>unpaired</code>. The alert also applies if an already registered account requests a manual rescan. It is not triggered by ordinary disconnects, PM2 restart, Puppeteer target errors or readiness retries without auth evidence. Only active subscriptions of this event receive it. Repeated QR refreshes and reconnects are deduplicated across restarts until genuine Ready. GET uses flat query parameters. No QR code, API key or secret is included. Delivery is best effort with the existing webhook timeout; there is no persistent retry queue. Use the existing toggle/delete endpoints to manage each subscription independently.</p>

    <h2 id="broadcasts">Broadcasts &amp; Sending Settings</h2>
    <p>WPSent-managed broadcast lists, not native WhatsApp lists. Record consent for each recipient; confirm at send time. Opt-out removes and suppresses a number account-wide. Maximum 25 recipients/list, 20 lists/account and 100 reserved recipients per rolling 24 hours. No automatic retry or restart replay.</p>
    <pre>GET /sending/settings
GET /broadcasts
POST /broadcasts
GET /broadcasts/jobs
GET /broadcasts/jobs/:jobId
POST /broadcasts/jobs/:jobId/cancel
POST /broadcasts/opt-out
GET /broadcasts/:broadcastId
PATCH /broadcasts/:broadcastId
DELETE /broadcasts/:broadcastId
POST /broadcasts/:broadcastId/recipients
DELETE /broadcasts/:broadcastId/recipients
POST /broadcasts/:broadcastId/send</pre>
    <pre>{"name":"Service updates","recipients":[{"phone":"919000000001","consent":true,"consentSource":"Recorded opt-in"}]}</pre>
    <pre>{"message":"Your requested update is ready.","requestId":"unique-request-123","confirmConsent":true}</pre>
    <p>Send returns HTTP 202 and a job ID. Reusing the same requestId with the same list and message returns the existing job. Check results; submitted is not delivered. Cancel stops remaining sends, not in-flight messages. Interrupted jobs are not replayed. History retained 30 days.</p>
    <p>WA_SEND_INTERVAL_MS (1000 default, 0–5000), WA_SEND_QUEUE_MAX (4 default, 1–8), WA_SEND_QUEUE_WAIT_MS (5000 default, 1000–10000), WA_BROADCAST_INTERVAL_MS (3000 default, 3000–60000) control server-wide serialization, gap after completion, pending queue and additional broadcast spacing. Environment variables seed policy on first startup. Admin console changes global and stricter session policy live, persisted in MongoDB. GET /sending/settings shows effective configuration. Admin APIs: GET/PUT /admin/api/sending-policy and GET/PUT /admin/api/phones/:phone/sending-policy. Broadcast submission has a 90-second deadline; an uncertain send stops the job while the scheduler keeps any still-running native operation active. Pacing covers native sendMessage calls, not inbound/background traffic. Not a bandwidth guarantee or policy bypass.</p>
    <p>Broadcasts support text, image, video, voice note, document, contact card, location and single/multiple-choice polls. Use the same payload as /send without to, plus requestId and confirmConsent:true. Maximum decoded media 10 MiB; authenticated JSON limit is capped at 15 MiB. Files are held in memory for the job, not stored as Base64 in MongoDB. Each poll has its own message ID. All types use the same sending policy and consent checks.</p>
    <pre>{"requestId":"product-update-001","confirmConsent":true,"image":{"mimetype":"image/png","data":"YOUR_IMAGE_BASE64","filename":"product.png","caption":"Requested update"}}</pre>
    <h2 id="examples">Code Examples</h2>
    <h3>Node.js</h3>
    <pre>const res = await fetch(
  '${host}/send?clientid=YOUR_CID&key=YOUR_KEY&to=8801711000000',
  { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ message: 'Hello!' }) }
);
console.log(await res.json());</pre>
    <h3>Python</h3>
    <pre>import requests
r = requests.post('${host}/send',
    params={'clientid':'YOUR_CID','key':'YOUR_KEY','to':'8801711000000'},
    json={'message': 'Hello!'})
print(r.json())</pre>
    <h3>Webhook receiver (Flask)</h3>
    <pre>from flask import Flask, request
app = Flask(__name__)
@app.route('/hook', methods=['POST'])
def hook():
    d = request.json
    print(f"{d['from']}: {d['body']} ({d['type']})")
    return {'ok': True}
app.run(port=5000)</pre>

    <h2 id="types">Message Types</h2>
    <table>
      <thead><tr><th>type</th><th>body value</th></tr></thead>
      <tbody>
        <tr><td>text</td><td>The message text</td></tr>
        <tr><td>reaction</td><td>[Reaction: &#128077;]</td></tr>
        <tr><td>sticker</td><td>[Sticker]</td></tr>
        <tr><td>image</td><td>[Image] or caption</td></tr>
        <tr><td>video</td><td>[Video]</td></tr>
        <tr><td>audio</td><td>[Audio]</td></tr>
        <tr><td>document</td><td>[Document: filename]</td></tr>
        <tr><td>location</td><td>[Location: lat,lng]</td></tr>
        <tr><td>contact</td><td>[Contact card]</td></tr>
      </tbody>
    </table>

    <h2 id="admin">Administration</h2>
    <p>Open <a href="/admin">the administrator console</a>. The first email/password account requires the configured ADMIN_BOOTSTRAP_TOKEN and is automatically approved. Subsequent accounts need approval. Administrators can view and revoke registered phone sessions, set the registration limit, approve or revoke administrators, and reset passwords.</p>
    <p>Admin mutations require JSON, X-WPSent-Admin: 1 and a signed administrator session cookie (except signup/login/logout). Password reset and revocation invalidate previous sessions. See the Postman collection for admin API requests.</p>
    <pre>POST /admin/api/signup
POST /admin/api/login
POST /admin/api/logout
GET /admin/api/me
GET /admin/api/phones
PUT /admin/api/phone-limit
POST /admin/api/phones/:phone/revoke
GET /admin/api/admins
POST /admin/api/admins/approve
POST /admin/api/admins/revoke
POST /admin/api/admins/password</pre>
    <h2 id="contact">Contact &amp; Support</h2>
    <p>Contributor / support: ${CONFIG.CONTRIBUTOR_NAME}</p>
    <p>Need help setting up your own instance?</p>
    <p>&#128247; Instagram: <a href="${CONFIG.INSTAGRAM_URL}" target="_blank" style="color:var(--green)">${CONFIG.INSTAGRAM_URL}</a></p>
    <p>&#128140; Email: <a href="mailto:${CONFIG.EMAIL}" style="color:var(--green)">${CONFIG.EMAIL}</a></p>
    <p>&#128196; GitHub: <a href="${CONFIG.GITHUB_URL}" target="_blank" style="color:var(--green)">${CONFIG.GITHUB_URL}</a></p>
  </div>
</div>
</body>
</html>`;
}

module.exports = docsHTML;
