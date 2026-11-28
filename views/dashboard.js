'use strict';
const {EXAMPLES,buildExample}=require('../utils/dashboardExamples');

function dashboardHTML(user) {
  return String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>WPSent Dashboard</title>
<meta name="robots" content="noindex,nofollow"/>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='%2325d366'/><polygon points='14,30 50,18 42,46 28,32' fill='%230d0d0d'/></svg>"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
:root{--bg:#0d0d0d;--surf:#161616;--surf2:#1f1f1f;--border:#2a2a2a;
  --green:#25d366;--gdim:#1a9e4a;--text:#e8e8e8;--muted:#666;
  --danger:#e74c3c;--warn:#f39c12;--blue:#3498db;--purple:#9b59b6;--r:12px;--rs:8px;}
body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;min-height:100vh;}

.bar{display:flex;align-items:center;justify-content:space-between;padding:12px 24px;
  border-bottom:1px solid var(--border);position:sticky;top:0;z-index:100;
  background:rgba(13,13,13,.95);backdrop-filter:blur(10px);}
.bar-logo{display:flex;align-items:center;gap:8px;font-weight:700;font-size:15px;}
.bar-icon{width:28px;height:28px;background:var(--green);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:14px;}
.bar-right{display:flex;align-items:center;gap:8px;}
.pill{display:flex;align-items:center;gap:5px;font-size:12px;background:var(--surf2);
  border:1px solid var(--border);padding:5px 11px;border-radius:20px;}
.dot{width:7px;height:7px;border-radius:50%;background:var(--green);}
.live-pill{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;
  color:var(--green);background:#1a3a26;border:1px solid #2a5a36;padding:5px 10px;border-radius:20px;}
.live-dot{width:6px;height:6px;border-radius:50%;background:var(--green);animation:pulse 1s ease-in-out infinite;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.out-btn{font-size:12px;color:var(--muted);background:none;border:1px solid var(--border);
  padding:5px 11px;border-radius:20px;cursor:pointer;text-decoration:none;}
.out-btn:hover{color:var(--text);border-color:var(--muted);}
.dot.off{background:var(--danger);}
.banner{display:none;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
  background:#2a1613;border:1px solid #5a2a24;color:#f0b4ad;border-radius:var(--r);padding:12px 16px;margin-bottom:16px;font-size:13px;}
.banner.on{display:flex;}
.banner button{background:var(--danger);color:#fff;border:none;border-radius:var(--rs);padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.75);display:none;align-items:center;justify-content:center;z-index:300;padding:20px;}
.modal-bg.on{display:flex;}
.modal{background:var(--surf);border:1px solid var(--border);border-radius:14px;padding:24px;max-width:380px;width:100%;text-align:center;}
.modal h3{font-size:16px;margin-bottom:8px;}
.modal p{font-size:13px;color:var(--muted);line-height:1.5;margin-bottom:14px;}
.modal img{width:260px;height:260px;max-width:100%;background:#fff;border-radius:10px;padding:8px;display:none;margin:0 auto 12px;}
.modal .mrow{display:flex;gap:8px;justify-content:center;}
.modal .mbtn{border:1px solid var(--border);background:var(--surf2);color:var(--text);border-radius:var(--rs);padding:9px 16px;font-size:13px;cursor:pointer;}
.modal .mbtn.go{background:var(--green);color:#0d0d0d;border-color:var(--green);font-weight:600;}

main{max-width:1140px;margin:0 auto;padding:24px;}

.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;}
@media(max-width:680px){.stats{grid-template-columns:repeat(2,1fr);}}
.stat{background:var(--surf);border:1px solid var(--border);border-radius:var(--r);padding:16px;text-align:center;}
.stat-n{font-size:28px;font-weight:700;color:var(--green);}
.stat-l{font-size:11px;color:var(--muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px;}

.cred-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:24px;}
@media(max-width:680px){.cred-grid{grid-template-columns:1fr;}}
.card{background:var(--surf);border:1px solid var(--border);border-radius:var(--r);padding:20px;}
.ct{font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);margin-bottom:10px;font-weight:600;}
.ci{margin-bottom:12px;}.ci:last-child{margin-bottom:0;}
.cl{font-size:11px;color:var(--muted);margin-bottom:4px;}
.cv{font-family:'JetBrains Mono',monospace;font-size:13px;background:var(--surf2);
  border:1px solid var(--border);border-radius:var(--rs);padding:9px 12px;
  color:var(--green);word-break:break-all;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;transition:border-color .15s;}
.cv:hover{border-color:var(--green);}
.cc{font-size:10px;color:var(--muted);white-space:nowrap;flex-shrink:0;}

.tabs{display:flex;gap:2px;margin-bottom:18px;border-bottom:1px solid var(--border);}
.tab{padding:9px 16px;font-size:13px;font-weight:500;cursor:pointer;border-bottom:2px solid transparent;
  color:var(--muted);transition:all .15s;white-space:nowrap;}
.tab.on{color:var(--text);border-bottom-color:var(--green);}
.panel{display:none;}.panel.on{display:block;}

.twrap{overflow-x:auto;}
table{width:100%;border-collapse:collapse;min-width:580px;}
th{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);font-weight:600;
  padding:9px 11px;text-align:left;border-bottom:1px solid var(--border);}
td{padding:10px 11px;font-size:13px;border-bottom:1px solid var(--surf2);vertical-align:middle;}
tr:last-child td{border-bottom:none;}
tr.nr{animation:fi .4s ease;}
@keyframes fi{from{background:#1a3a26;opacity:.6}to{background:transparent;opacity:1}}
.b{display:inline-flex;align-items:center;font-size:11px;font-weight:500;padding:2px 8px;border-radius:20px;white-space:nowrap;}
.bs{background:#1a3a26;color:var(--green);}
.bf{background:#3a1a1a;color:var(--danger);}
.br{background:#1a2a3a;color:var(--blue);}
.bx{background:#2a1a3a;color:var(--purple);}
.bo{background:#2a2010;color:var(--warn);}
.mono{font-family:'JetBrains Mono',monospace;font-size:12px;}
.empty{text-align:center;padding:40px 20px;color:var(--muted);}

label{font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.8px;text-transform:uppercase;display:block;margin-bottom:6px;}
input.fi,select.fi,textarea.fi{width:100%;background:var(--surf2);border:1px solid var(--border);
  border-radius:var(--rs);padding:10px 12px;color:var(--text);font-size:13px;font-family:inherit;outline:none;margin-bottom:12px;}
input.fi:focus,select.fi:focus,textarea.fi:focus{border-color:var(--green);}
textarea.fi{resize:vertical;min-height:80px;}
.btn{background:var(--green);color:#000;font-weight:600;font-size:13px;border:none;border-radius:var(--rs);padding:9px 16px;cursor:pointer;transition:opacity .15s;}
.btn:hover{opacity:.85;}
.btn-g{background:var(--surf2);color:var(--text);border:1px solid var(--border);}
.btn-d{background:#3a1a1a;color:var(--danger);border:1px solid #5a2a2a;}
.btn-s{padding:5px 11px;font-size:12px;}
.row{display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap;}

.pr{background:var(--surf2);border:1px solid var(--border);border-radius:var(--rs);padding:12px;
  min-height:60px;font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.6;
  white-space:pre-wrap;word-break:break-all;color:var(--muted);margin-top:12px;}
.pr.ok{color:var(--green);border-color:var(--gdim);}
.pr.er{color:var(--danger);border-color:#5a2a2a;}

.cb{background:var(--surf2);border:1px solid var(--border);border-radius:var(--rs);padding:14px;
  font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.7;white-space:pre-wrap;
  word-break:break-all;color:#aaa;margin-bottom:14px;position:relative;}
.cp{position:absolute;top:8px;right:8px;background:var(--surf);border:1px solid var(--border);
  color:var(--muted);font-size:11px;padding:3px 9px;border-radius:6px;cursor:pointer;font-family:inherit;}
.cp:hover{color:var(--text);}
.lt{display:flex;gap:4px;margin-bottom:10px;}
.ltb{padding:5px 12px;font-size:12px;font-weight:500;cursor:pointer;border-radius:6px 6px 0 0;
  background:var(--surf2);color:var(--muted);border:1px solid var(--border);border-bottom:none;}
.ltb.on{background:var(--surf);color:var(--text);}

.wi{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:10px 0;border-bottom:1px solid var(--surf2);}
.wi:last-child{border-bottom:none;}
.wu{font-family:'JetBrains Mono',monospace;font-size:12px;word-break:break-all;}
.wm{font-size:11px;color:var(--muted);margin-top:2px;}

.toast{position:fixed;bottom:20px;right:20px;background:#1a3a26;color:var(--green);border:1px solid var(--gdim);
  padding:10px 16px;border-radius:var(--rs);font-size:13px;font-weight:500;opacity:0;transition:opacity .2s;pointer-events:none;z-index:9999;}
.toast.on{opacity:1;}

.loading{text-align:center;padding:40px;color:var(--muted);font-size:13px;}
</style>
</head>
<body>
<div class="bar">
  <div class="bar-logo"><div class="bar-icon">💬</div>WPSent</div>
  <div class="bar-right">
    <div class="live-pill" id="live-pill"><div class="live-dot"></div>LIVE</div>
    <div class="pill"><div class="dot" id="wa-dot"></div><span id="bar-phone">${String(user.phone).replace(/[^0-9+]/g,'')}</span></div>
    <button class="out-btn" id="rescan-btn" onclick="openRescan()">Rescan</button>
    <a class="out-btn" href="/logout">Logout</a>
  </div>
</div>
<main>
  <div class="banner" id="wa-banner">
    <span id="wa-banner-text">WhatsApp session lost.</span>
    <button onclick="openRescan()">Rescan QR</button>
  </div>
  <div class="stats" id="stats"><div class="loading">Loading...</div></div>
  <div class="cred-grid" id="creds"><div class="loading">Loading...</div></div>
  <div class="tabs">
    <div class="tab on"  id="t-logs"       onclick="sw('logs')">Logs</div>
    <div class="tab"     id="t-playground" onclick="sw('playground')">Playground</div>
    <div class="tab"     id="t-webhooks"   onclick="sw('webhooks')">Webhooks</div>
    <div class="tab"     id="t-examples"   onclick="sw('examples')">Examples</div>
  </div>
  <div class="panel on" id="p-logs"><div class="loading">Loading...</div></div>
  <div class="panel"    id="p-playground"></div>
  <div class="panel"    id="p-webhooks"></div>
  <div class="panel"    id="p-examples"></div>
</main>
<div class="toast" id="toast"></div>

<div class="modal-bg" id="rescan-modal">
  <div class="modal">
    <h3>Rescan WhatsApp</h3>
    <p id="rescan-msg">This clears the saved WhatsApp session and links your number again. Your Client ID and Secret Key stay the same.</p>
    <img id="rescan-qr" alt="QR code"/>
    <div class="mrow">
      <button class="mbtn go" id="rescan-go" onclick="startRescan()">Start rescan</button>
      <button class="mbtn" onclick="closeRescan()">Close</button>
    </div>
  </div>
</div>

<script>
var KEY = '', CID = '', LOGS = [], HOOKS = [], WA = 'unknown', rqES = null;

async function boot() {
  try {
    var res  = await fetch('/api/me', { credentials: 'same-origin' });
    if (res.redirected || !res.ok) { window.location.href = '/'; return; }
    var data = await res.json();
    KEY   = data.apiKey;
    CID   = data.clientId;
    LOGS  = data.logs  || [];
    HOOKS = data.webhooks || [];
    WA    = data.status || 'unknown';
    renderWA();
    renderAll();
    startSSE();
    setInterval(pollStatus, 8000);
  } catch(e) {
    document.getElementById('stats').innerHTML = '<div class="loading">Failed to load. Refresh the page.</div>';
  }
}

var WA_TEXT = {
  qr_ready: 'WhatsApp is not linked. Scan the QR code to reconnect.',
  disconnected: 'WhatsApp disconnected. It will try to reconnect; if it stays like this, rescan.',
  auth_failure: 'WhatsApp session lost. Rescan to link your number again.',
  error: 'WhatsApp session failed to start. Contact the administrator.',
  recovering: 'WhatsApp initialization stalled. Retrying automatically without deleting your session.',
  initialization_failed: 'WhatsApp initialization failed. Your authentication is retained. Contact the administrator for a controlled restart.' ,
  not_started: 'WhatsApp session is not running. Rescan to start it.',
  initializing: 'WhatsApp is starting...'
};

function renderWA() {
  var ok = WA === 'ready';
  var dot = document.getElementById('wa-dot');
  if (dot) dot.className = ok ? 'dot' : 'dot off';
  var banner = document.getElementById('wa-banner');
  if (banner) {
    banner.className = ok ? 'banner' : 'banner on';
    document.getElementById('wa-banner-text').textContent = WA_TEXT[WA] || 'WhatsApp is not connected.';
  }
}

async function pollStatus() {
  try {
    var r = await fetch('/api/status', { credentials: 'same-origin' });
    if (r.status === 401) { window.location.href = '/'; return; }
    var d = await r.json();
    if (d.status !== WA) { WA = d.status; renderWA(); }
  } catch(e) {}
}

function openRescan() {
  document.getElementById('rescan-msg').textContent = 'This clears the saved WhatsApp session and links your number again. Your Client ID and Secret Key stay the same.';
  document.getElementById('rescan-qr').style.display = 'none';
  var go = document.getElementById('rescan-go');
  go.style.display = ''; go.disabled = false; go.textContent = 'Start rescan';
  document.getElementById('rescan-modal').className = 'modal-bg on';
}

function closeRescan() {
  if (rqES) { rqES.close(); rqES = null; }
  document.getElementById('rescan-modal').className = 'modal-bg';
  pollStatus();
}

async function startRescan() {
  var go  = document.getElementById('rescan-go');
  var msg = document.getElementById('rescan-msg');
  go.disabled = true; go.textContent = 'Starting...';
  msg.textContent = 'Clearing the old session and starting WhatsApp. The QR code appears in a few seconds...';
  try {
    var r = await fetch('/api/rescan', { method: 'POST', credentials: 'same-origin' });
    if (r.status === 401) { window.location.href = '/'; return; }
    if (!r.ok) { var e = await r.json(); msg.textContent = e.error || 'Rescan failed.'; go.disabled = false; go.textContent = 'Try again'; return; }
  } catch(e) { msg.textContent = 'Network error.'; go.disabled = false; go.textContent = 'Try again'; return; }
  go.style.display = 'none';
  WA = 'initializing'; renderWA();
  if (rqES) rqES.close();
  var es = rqES = new EventSource('/api/qr-stream');
  es.addEventListener('qr', function(ev) {
    var img = document.getElementById('rescan-qr');
    img.src = JSON.parse(ev.data).dataUrl;
    img.style.display = 'block';
    msg.textContent = 'Open WhatsApp > Linked devices > Link a device, then scan this code.';
    WA = 'qr_ready'; renderWA();
  });
  es.addEventListener('ready', function() {
    es.close(); rqES = null;
    WA = 'ready'; renderWA();
    toast('&#10003; WhatsApp connected');
    document.getElementById('rescan-modal').className = 'modal-bg';
  });
  es.onerror = function() {
    if (es.readyState === 2) { msg.textContent = 'Connection lost. Close this and try again.'; }
  };
}

function renderAll() {
  renderStats();
  renderCreds();
  renderLogs();
  renderPlayground();
  renderWebhooks();
  renderExamples();
}

function renderStats() {
  var sent = LOGS.filter(function(l){ return l.status==='sent'; }).length;
  var recv = LOGS.filter(function(l){ return l.status==='received'; }).length;
  var fail = LOGS.filter(function(l){ return l.status==='failed'; }).length;
  document.getElementById('stats').innerHTML =
    stat(LOGS.length,'Total') + stat(sent,'Sent') + stat(recv,'Received') + stat(fail,'Failed');
}
function stat(n,l){ return '<div class="stat"><div class="stat-n">'+n+'</div><div class="stat-l">'+l+'</div></div>'; }

var keyVis = false;
function renderCreds() {
  document.getElementById('creds').innerHTML =
    '<div class="card">' +
      '<div class="ct">Your Credentials</div>' +
      '<div class="ci"><div class="cl">Client ID <span style="color:var(--blue);font-size:10px">(public)</span></div>' +
        '<div class="cv" onclick="cp(CID,\'Client ID\')"><span id="d-cid">'+esc(CID)+'</span><span class="cc">copy</span></div></div>' +
      '<div class="ci"><div class="cl">Secret Key <span style="color:var(--danger);font-size:10px">(keep private &mdash; also your login password)</span></div>' +
        '<div class="cv" onclick="cp(KEY,\'Secret Key\')"><span id="d-key">'+mask(KEY)+'</span>' +
        '<span class="cc" onclick="event.stopPropagation();toggleKey()">reveal</span></div></div>' +
      '<p style="font-size:11px;color:var(--muted);margin-top:8px;line-height:1.5">Your Secret Key is your login password. Keep it private.</p>' +
    '</div>' +
    '<div class="card">' +
      '<div class="ct">Quick Send</div>' +
      '<div style="font-family:\'JetBrains Mono\',monospace;font-size:11px;background:var(--surf2);border:1px solid var(--border);border-radius:var(--rs);padding:11px;color:#aaa;line-height:1.7;word-break:break-all">' +
        'POST /send?clientid=<span style="color:var(--blue)">'+esc(CID)+'</span>&amp;key=<span style="color:var(--danger)">YOUR_KEY</span>&amp;to=<span style="color:var(--green)">880132...</span><br>{"message": "Hello!"}' +
      '</div>' +
      '<p style="font-size:11px;color:var(--muted);margin-top:8px"><a href="/docs" style="color:var(--green);text-decoration:none">Full API docs &rarr;</a></p>' +
    '</div>';
}
function mask(k){ return k ? k.slice(0,8)+'****************************' : ''; }
function toggleKey(){
  keyVis=!keyVis;
  var el=document.getElementById('d-key');
  if(el) el.textContent = keyVis ? KEY : mask(KEY);
}

function renderLogs() {
  if (!LOGS.length) {
    document.getElementById('p-logs').innerHTML = '<div class="card"><div class="empty">No messages yet.</div></div>';
    return;
  }
  var rows = LOGS.map(function(l){ return logRow(l, false); }).join('');
  document.getElementById('p-logs').innerHTML =
    '<div class="card"><div class="twrap"><table>' +
    '<thead><tr><th>Time</th><th>Dir</th><th>Number</th><th>Type</th><th>Message</th><th>Status</th></tr></thead>' +
    '<tbody id="log-body">' + rows + '</tbody></table></div></div>';
}

function logRow(l, isNew) {
  var d   = new Date(l.timestamp);
  var ts  = d.toLocaleString('en-GB',{hour12:false,year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
  var num = String((l.direction==='outbound' ? l.to : (l.fromPhone || l.from)) || '').replace('@c.us','');
  var identity = l.direction==='inbound' && l.fromLid && l.fromPhone ? ' title="'+esc(l.fromLid)+'"' : '';
  var author = l.authorPhone || l.authorId;
  var participant = author ? '<div style="color:var(--muted);font-size:11px">'+esc(author)+'</div>' : '';
  var dir = l.direction==='outbound' ? '<span class="b bo">&#8593; Out</span>' : '<span class="b br">&#8595; In</span>';
  var typ = (l.type && l.type!=='text') ? '<span class="b bx">'+esc(l.type)+'</span>' : '<span style="color:var(--muted);font-size:11px">text</span>';
  var st  = l.status==='sent' ? '<span class="b bs">&#10003; Sent</span>' :
            l.status==='received' ? '<span class="b br">&#10003; Recv</span>' :
            '<span class="b bf">&#10007; Failed</span>';
  var media = l.mediaStatus === 'available' && l.mediaId && Date.parse(l.mediaExpiresAt)>Date.now()
    ? '<div><a href="/api/media/'+encodeURIComponent(l.mediaId)+'" download>Download '+esc(l.mediaFilename||'media')+'</a></div>'
    : l.mediaStatus ? '<div style="color:var(--muted);font-size:11px">Media: '+esc(l.mediaStatus==='available'?'expired':l.mediaStatus)+'</div>' : '';
  var err = l.error ? '<div style="color:var(--danger);font-size:11px;margin-top:2px">'+esc(l.error)+'</div>' : '';
  return '<tr'+(isNew?' class="nr"':'')+'>' +
    '<td class="mono" style="white-space:nowrap;color:var(--muted)">'+ts+'</td>' +
    '<td>'+dir+'</td><td class="mono"'+identity+'>'+esc(num)+participant+'</td><td>'+typ+'</td>' +
    '<td>'+esc(l.body)+media+err+'</td><td>'+st+'</td></tr>';
}

var sse = null;
function startSSE() {
  if (sse) { sse.close(); sse = null; }
  var es = sse = new EventSource('/api/logs-stream');
  var pill = document.getElementById('live-pill');
  es.onmessage = function(e) {
    var log = JSON.parse(e.data);
    LOGS.unshift(log);
    if (LOGS.length > 100) LOGS.pop();
    renderStats();
    var body = document.getElementById('log-body');
    if (body) {
      body.insertAdjacentHTML('afterbegin', logRow(log, true));
      if (body.rows.length > 100) body.deleteRow(body.rows.length-1);
    } else {
      renderLogs();
    }
    toast(log.direction==='inbound' ? '&#128232; New message' : (log.status==='failed' ? '&#10007; Message failed' : '&#10003; Message sent'));
  };
  es.onerror   = function(){ if(pill) pill.style.opacity='.4'; es.close(); if (sse === es) { sse = null; setTimeout(startSSE, 3000); } };
  es.onopen    = function(){ if(pill) pill.style.opacity='1'; };
}

function renderPlayground() {
  document.getElementById('p-playground').innerHTML =
    '<div class="card">' +
      '<div class="ct">Send a Test Message</div>' +
      '<label>To (phone number)</label>' +
      '<input class="fi" id="pg-to" type="tel" placeholder="8801711000000 or 8937@lid"/>' +
      '<label>Message</label>' +
      '<textarea class="fi" id="pg-msg" placeholder="Type your message..."></textarea>' +
      '<div class="row"><button class="btn" onclick="pgsend()">Send &#8599;</button>' +
      '<button class="btn btn-g btn-s" onclick="document.getElementById(\'pg-r\').className=\'pr\';document.getElementById(\'pg-r\').textContent=\'Ready.\'">Clear</button></div>' +
      '<div class="pr" id="pg-r">Results will appear here...</div>' +
    '</div>';
}

async function pgsend() {
  var to  = document.getElementById('pg-to').value.trim();
  var msg = document.getElementById('pg-msg').value.trim();
  var el  = document.getElementById('pg-r');
  if (!to||!msg){ el.textContent='Fill in both fields.'; el.className='pr er'; return; }
  el.className='pr'; el.textContent='Sending...';
  try {
    var r = await fetch('/send?clientid='+encodeURIComponent(CID)+'&key='+encodeURIComponent(KEY)+'&to='+encodeURIComponent(to),
      {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg})});
    var d = await r.json();
    if(r.ok){ el.className='pr ok'; el.textContent='Sent!\n\n'+JSON.stringify(d,null,2); }
    else    { el.className='pr er'; el.textContent='Failed:\n\n'+JSON.stringify(d,null,2); }
  } catch(e){ el.className='pr er'; el.textContent='Error: '+e.message; }
}

function renderWebhooks() {
  var h = '<div class="card" style="margin-bottom:16px">' +
    '<div class="ct">Add Webhook</div>' +
    '<p style="font-size:13px;color:var(--muted);margin-bottom:14px;line-height:1.6">Choose inbound messages or a separate alert when WhatsApp needs to be linked again. Works with query params like <code style="color:var(--green)">?key=abc</code> too.</p>' +
    '<label>Event</label><select class="fi" id="wh-event"><option value="message_received">Inbound message</option><option value="auth_rescan_required">Authentication — rescan required</option><option value="poll_vote_updated">Poll vote updated</option></select>' +
    '<label>URL</label><input class="fi" id="wh-url" type="url" placeholder="https://yoursite.com/webhook"/>' +
    '<div class="row" style="margin-bottom:12px">' +
      '<div style="flex:1"><label>Method</label><select class="fi" id="wh-m" style="margin-bottom:0"><option>POST</option><option>GET</option></select></div>' +
      '<div style="flex:2"><label>Label</label><input class="fi" id="wh-l" placeholder="My CRM" style="margin-bottom:0"/></div>' +
    '</div>' +
    '<button class="btn" onclick="addWH()">Add Webhook</button>' +
  '</div>' +
  '<div class="card"><div class="ct">Active Webhooks</div><div id="wh-list">';

  if (!HOOKS.length) {
    h += '<div class="empty">No webhooks yet.</div>';
  } else {
    HOOKS.forEach(function(w) {
      h += '<div class="wi">' +
        '<div><div class="wu">'+esc(w.url)+'</div><div class="wm">'+esc(w.method)+' &middot; '+(w.event==='auth_rescan_required'?'Rescan required':w.event==='poll_vote_updated'?'Poll vote updated':'Inbound message')+' &middot; '+esc(w.label||'No label')+' &middot; '+(w.active?'Active':'Paused')+'</div></div>' +
        '<button class="btn btn-g btn-s" onclick="toggleWH(\''+w._id+'\','+(!w.active)+')">'+(w.active?'Pause':'Resume')+'</button>' +
        '<button class="btn btn-d btn-s" onclick="delWH(\''+w._id+'\')">Delete</button>' +
      '</div>';
    });
  }
  h += '</div></div>';
  document.getElementById('p-webhooks').innerHTML = h;
}

async function addWH() {
  var url = document.getElementById('wh-url').value.trim();
  var m   = document.getElementById('wh-m').value;
  var l   = document.getElementById('wh-l').value.trim();
  var event = document.getElementById('wh-event').value;
  if (!url) return toast('URL required');
  var r = await fetch('/webhooks',{method:'POST',headers:{'Content-Type':'application/json','x-client-id':CID,'x-api-key':KEY},body:JSON.stringify({url:url,method:m,label:l,event:event})});
  var d = await r.json();
  if (r.ok) { HOOKS = d.webhooks; renderWebhooks(); toast('Webhook added!'); } else { toast(esc(d.error||'Webhook registration failed')); }
}
async function delWH(id) {
  var r = await fetch('/webhooks/'+id,{method:'DELETE',headers:{'x-client-id':CID,'x-api-key':KEY}});
  var d = await r.json();
  if (r.ok) { HOOKS = d.webhooks; renderWebhooks(); toast('Removed'); }
}
async function toggleWH(id, active) {
  await fetch('/webhooks/'+id,{method:'PATCH',headers:{'Content-Type':'application/json','x-client-id':CID,'x-api-key':KEY},body:JSON.stringify({active:active})});
  var r = await fetch('/api/me'); var d = await r.json(); HOOKS = d.webhooks; renderWebhooks();
  toast(active ? 'Resumed' : 'Paused');
}

var exampleIndex = 0, exampleLanguage = 'curl';
var EXAMPLE_CATALOG = ${JSON.stringify(EXAMPLES).replace(/</g,"\\u003c")};
var buildExample = ${buildExample.toString()};

function renderExamples() {
  var panel=document.getElementById('p-examples');
  panel.innerHTML =
    '<div class="card">' +
      '<div class="ct">Code Examples</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:12px">' +
        '<div><label for="ex-operation">API operation</label><select class="fi" id="ex-operation"></select></div>' +
        '<div><label for="ex-language">Language</label><select class="fi" id="ex-language"><option value="curl">cURL (Bash)</option><option value="node">Node.js</option><option value="py">Python</option></select></div>' +
      '</div>' +
      '<div class="cl">Base URL</div><div class="cv" id="ex-origin" style="cursor:default;margin-bottom:12px"></div>' +
      '<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:10px"><span class="mono" id="ex-endpoint"></span><button type="button" class="btn btn-g btn-s" id="ex-copy">Copy code</button></div>' +
      '<pre class="cb" id="ex-code" style="overflow-x:auto;word-break:normal;white-space:pre"></pre>' +
      '<p style="font-size:12px;color:var(--muted);line-height:1.6">Replace YOUR_CLIENT_ID, YOUR_API_KEY and other YOUR_ placeholders before running. Examples are not executed from this page. Media requires actual Base64 data. Group, vote and webhook mutations affect the linked account; use authorized test data.</p>' +
      '<p style="font-size:12px;margin-top:14px"><a href="/docs" style="color:var(--green)">Full API docs &rarr;</a> &nbsp; <a href="/docs/postman.json" download style="color:var(--green)">Download Postman collection</a></p>' +
    '</div>';
  var select=document.getElementById('ex-operation'), lastGroup=null, optgroup;
  EXAMPLE_CATALOG.forEach(function(example,index){
    if(example.group!==lastGroup){optgroup=document.createElement('optgroup');optgroup.label=example.group;select.appendChild(optgroup);lastGroup=example.group;}
    var option=document.createElement('option');option.value=String(index);option.textContent=example.name;optgroup.appendChild(option);
  });
  select.value=String(exampleIndex);
  var lang=document.getElementById('ex-language');lang.value=exampleLanguage;
  select.addEventListener('change',function(){exampleIndex=Number(select.value);updateExample();});
  lang.addEventListener('change',function(){exampleLanguage=lang.value;updateExample();});
  document.getElementById('ex-copy').addEventListener('click',function(){cp(document.getElementById('ex-code').textContent,'Code');});
  updateExample();
}
function updateExample(){
  var example=EXAMPLE_CATALOG[exampleIndex];
  var origin=window.location.origin;
  document.getElementById('ex-origin').textContent=origin;
  document.getElementById('ex-endpoint').textContent=example.method+' '+example.path;
  document.getElementById('ex-code').textContent=buildExample(example,origin,exampleLanguage);
}

function sw(name) {
  ['logs','playground','webhooks','examples'].forEach(function(n) {
    document.getElementById('t-'+n).classList.toggle('on', n===name);
    document.getElementById('p-'+n).classList.toggle('on', n===name);
  });
}

function sl(el, panel) {
  el.closest('.card').querySelectorAll('.ltb').forEach(function(b){ b.classList.remove('on'); });
  el.classList.add('on');
  el.closest('.card').querySelectorAll('[id^="lp-"]').forEach(function(p){ p.style.display='none'; });
  document.getElementById(panel).style.display = 'block';
}

function cpc(id) {
  var el = document.getElementById(id);
  var clone = el.cloneNode(true);
  var b = clone.querySelector('.cp'); if (b) b.remove();
  var text = clone.textContent.trim();
  cp(text, 'Code');
}

function cp(text, label) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function(){ toast(label+' copied!'); }, function(){ toast('Copy failed'); });
  } else {
    var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); toast(label+' copied!'); } catch(e) { toast('Copy failed'); }
    t.remove();
  }
}

function toast(msg) {
  var t = document.getElementById('toast');
  t.innerHTML = msg; t.classList.add('on');
  setTimeout(function(){ t.classList.remove('on'); }, 2500);
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

boot();
</script>
</body>
</html>`;
}

module.exports = dashboardHTML;
