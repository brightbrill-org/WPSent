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
    <h3>API Reference</h3>
    <a href="#send">Send Message</a>
    <a href="#logs">Message Logs</a>
    <a href="#status">Status</a>
    <a href="#lid">Resolve LID</a>
    <a href="#webhooks">Webhooks</a>
    <h3>Guides</h3>
    <a href="#examples">Code Examples</a>
    <a href="#types">Message Types</a>
    <a href="#admin">Administration</a>
    <a href="#contact">Contact</a>
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
4. Add env var: SINGLE_USER = true  (optional, limits to 1 user)
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
        <tr><td>message<span class="req">required</span></td><td>JSON body</td><td>Message text</td></tr>
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

    <h2 id="logs">Message Logs</h2>
    <p><span class="mt get">GET</span><code>/logs</code> &mdash; last 100 messages, oldest auto-deleted.</p>
    <pre>curl "${host}/logs?clientid=YOUR_CID&key=YOUR_KEY"</pre>

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

    <h2 id="webhooks">Webhooks</h2>
    <p>Add URLs to receive a request on every inbound message. Query params in your URL are preserved.</p>
    <h3>Add</h3>
    <pre>POST /webhooks
x-client-id: YOUR_CID
x-api-key: YOUR_KEY
{ "url": "https://yoursite.com/hook?key=abc", "method": "POST", "label": "My CRM" }</pre>
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
