'use strict';

const { CONFIG } = require('../routes/config');

function landingHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>WPSent - WhatsApp API Gateway</title>
<meta name="description" content="Self-hosted WhatsApp API gateway. Send messages, receive webhooks, no fees ever."/>
<meta name="robots" content="index, follow"/>
<meta name="keywords" content="WhatsApp API, WhatsApp gateway, self-hosted WhatsApp, WhatsApp webhook, WPSent"/>
<meta name="theme-color" content="#25d366"/>
<meta property="og:title" content="WPSent - WhatsApp API Gateway"/>
<meta property="og:description" content="Send WhatsApp messages via REST API. Free, self-hosted, open source."/>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='%2325d366'/><polygon points='14,30 50,18 42,46 28,32' fill='%230d0d0d'/></svg>"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
:root{--bg:#0d0d0d;--surf:#161616;--surf2:#1f1f1f;--border:#2a2a2a;
  --green:#25d366;--text:#e8e8e8;--muted:#666;--danger:#e74c3c;--warn:#f39c12;--blue:#3498db;
  --r:12px;--rs:8px;}
body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;min-height:100vh;display:flex;flex-direction:column;}

.nav{display:flex;align-items:center;justify-content:space-between;padding:14px 28px;
  border-bottom:1px solid var(--border);background:rgba(13,13,13,.95);backdrop-filter:blur(10px);
  position:sticky;top:0;z-index:100;}
.nav-logo{display:flex;align-items:center;gap:10px;font-weight:700;font-size:16px;text-decoration:none;color:var(--text);}
.nav-icon{width:30px;height:30px;background:var(--green);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;}
.nav-links{display:flex;align-items:center;gap:6px;}
.nav-link{font-size:12px;color:var(--muted);text-decoration:none;padding:6px 12px;border-radius:20px;border:1px solid transparent;transition:all .15s;}
.nav-link:hover{color:var(--text);border-color:var(--border);}
.nav-link.gh{background:var(--surf2);border-color:var(--border);color:var(--text);display:flex;align-items:center;gap:6px;}

.hero{flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:60px 24px 40px;}
.hero-icon{width:72px;height:72px;background:var(--green);border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:36px;margin-bottom:20px;box-shadow:0 0 40px rgba(37,211,102,.25);}
.hero h1{font-size:36px;font-weight:700;margin-bottom:10px;letter-spacing:-.5px;}
.hero h1 span{color:var(--green);}
.hero p{font-size:15px;color:var(--muted);text-align:center;max-width:420px;line-height:1.7;margin-bottom:32px;}
.features{display:flex;gap:12px;margin-bottom:40px;flex-wrap:wrap;justify-content:center;}
.feat{background:var(--surf);border:1px solid var(--border);border-radius:var(--rs);padding:8px 14px;font-size:12px;color:var(--muted);}

.card{background:var(--surf);border:1px solid var(--border);border-radius:var(--r);padding:28px;width:100%;max-width:420px;}
.step{display:none;}.step.active{display:block;}
h2{font-size:17px;font-weight:600;margin-bottom:6px;}
p.hint{font-size:13px;color:var(--muted);margin-bottom:20px;line-height:1.6;}
label{font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.8px;text-transform:uppercase;display:block;margin-bottom:7px;}
input{width:100%;background:var(--surf2);border:1px solid var(--border);border-radius:var(--rs);
  padding:12px 14px;color:var(--text);font-size:14px;font-family:'JetBrains Mono',monospace;outline:none;transition:border-color .15s;}
input:focus{border-color:var(--green);}
.btn{width:100%;background:var(--green);color:#000;font-weight:600;font-size:14px;border:none;
  border-radius:var(--rs);padding:12px;cursor:pointer;margin-top:12px;transition:opacity .15s;}
.btn:hover{opacity:.88;}.btn:disabled{opacity:.4;cursor:not-allowed;}
.btn-ghost{background:transparent;color:var(--muted);border:1px solid var(--border);margin-top:8px;}
.btn-red{background:#2a0a0a;color:var(--danger);border:1px solid #5a1a1a;margin-top:8px;}
.err{font-size:12px;color:var(--danger);background:#1a0505;border:1px solid #3a1010;
  padding:8px 12px;border-radius:var(--rs);margin-top:10px;display:none;line-height:1.5;}
.warn-box{font-size:12px;color:var(--warn);background:#1a1205;border:1px solid #3a2a10;
  padding:10px 12px;border-radius:var(--rs);margin-bottom:14px;line-height:1.6;}
.note{font-size:11px;color:var(--muted);margin-top:7px;line-height:1.5;}
hr.div{border:none;border-top:1px solid var(--border);margin:16px 0;}
.back{font-size:12px;color:var(--muted);cursor:pointer;text-align:center;margin-top:14px;
  display:block;text-decoration:underline;}
.back:hover{color:var(--text);}

.qr-wrap{background:#fff;border-radius:var(--r);padding:14px;display:none;margin:14px auto;width:fit-content;}
.qr-wrap img{display:block;width:220px;height:220px;}
.status-row{display:flex;align-items:center;gap:8px;justify-content:center;font-size:13px;color:var(--muted);margin:10px 0;}
.dot{width:8px;height:8px;border-radius:50%;background:var(--green);animation:pulse 1.2s ease-in-out infinite;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}

.sf-icon{font-size:48px;text-align:center;margin-bottom:12px;}
.sf-links{display:flex;flex-direction:column;gap:8px;margin-top:16px;}
.sf-link{display:flex;align-items:center;gap:10px;background:var(--surf2);border:1px solid var(--border);
  border-radius:var(--rs);padding:12px 14px;text-decoration:none;color:var(--text);font-size:13px;transition:border-color .15s;}
.sf-link:hover{border-color:var(--green);}
.sf-link-icon{font-size:18px;flex-shrink:0;}

.lock-num{font-size:24px;font-weight:700;color:var(--warn);text-align:center;margin:12px 0;}

footer{text-align:center;padding:24px;font-size:11px;color:var(--muted);}
footer a{color:var(--muted);text-decoration:none;margin:0 6px;}
footer a:hover{color:var(--text);}
</style>
</head>
<body>
<nav class="nav">
  <a class="nav-logo" href="/"><div class="nav-icon">💬</div>WPSent</a>
  <div class="nav-links">
    <a class="nav-link" href="/docs">Docs</a>
    <a class="nav-link gh" href="${CONFIG.GITHUB_URL}" target="_blank">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
      GitHub
    </a>
  </div>
</nav>

<div class="hero">
  <div class="hero-icon">💬</div>
  <h1>WP<span>Sent</span></h1>
  <p>Self-hosted WhatsApp API gateway. Send messages, receive webhooks, manage everything via REST API — no fees, ever.</p>
  <div class="features">
    <div class="feat">REST API</div>
    <div class="feat">Webhooks</div>
    <div class="feat">Live Dashboard</div>
    <div class="feat">Multi-format support</div>
    <div class="feat">MongoDB sessions</div>
    <div class="feat">Open Source</div>
  </div>

  <div class="card">

    <div class="step active" id="s-phone">
      <h2>Get started</h2>
      <p class="hint">Enter your WhatsApp number to sign in or create an account.</p>
      <label>Phone number</label>
      <input id="inp-phone" type="tel" placeholder="+880 1XXX XXX XXX" autocomplete="tel"/>
      <p class="note">+, spaces, dashes are all fine.</p>
      <button class="btn" id="btn-phone" onclick="submitPhone()">Continue &rarr;</button>
      <div class="err" id="err-phone"></div>
    </div>

    <div class="step" id="s-key">
      <h2>Enter your Secret Key</h2>
      <p class="hint">Your account exists. Paste your Secret Key to sign in.</p>
      <label>Secret Key</label>
      <input id="inp-key" type="password" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"/>
      <p class="note">Your Secret Key is shown on the dashboard after your first login.</p>
      <button class="btn" id="btn-key" onclick="submitKey()">Sign In &rarr;</button>
      <div class="err" id="err-key"></div>
      <hr class="div"/>
      <p style="font-size:12px;color:var(--muted);margin-bottom:8px">Forgot your key?</p>
      <button class="btn btn-red" onclick="showReset()">Reset Secret Key</button>
      <span class="back" onclick="goBack()">&larr; Different number</span>
    </div>

    <div class="step" id="s-locked">
      <h2>Account locked</h2>
      <p class="hint">Too many failed attempts.</p>
      <div class="lock-num" id="lock-countdown">--:--</div>
      <p style="text-align:center;font-size:12px;color:var(--muted)">Try again when the timer reaches 0.</p>
      <span class="back" onclick="goBack()">&larr; Different number</span>
    </div>

    <div class="step" id="s-qr">
      <h2>Scan QR Code</h2>
      <p class="hint">Open WhatsApp &rarr; Linked Devices &rarr; Link a Device &rarr; scan.</p>
      <div class="status-row" id="qr-status"><div class="dot"></div> Starting engine&hellip;</div>
      <div class="qr-wrap" id="qr-box"><img id="qr-img" src="" alt="QR"/></div>
      <p class="note">After scanning you will go straight to your dashboard. Your Secret Key will be shown there.</p>
      <span class="back" onclick="goBack()">&larr; Different number</span>
    </div>

    <div class="step" id="s-reset">
      <h2>Reset account?</h2>
      <div class="warn-box">This creates a <b>new Client ID and Secret Key</b> (the old ones stop working) and removes your webhooks. To prove the number is yours, we will send a 6-digit code to your own WhatsApp chat &mdash; or, if WhatsApp is not connected, ask you to scan a QR code.</div>
      <button class="btn btn-red" id="btn-reset" onclick="confirmReset()">Yes, reset my key</button>
      <button class="btn btn-ghost" onclick="showStep('s-key')">Cancel</button>
    </div>

    <div class="step" id="s-code">
      <h2>Check your WhatsApp</h2>
      <p class="hint">We sent a 6-digit code to your own WhatsApp chat (&ldquo;Message yourself&rdquo;). Enter it to get a new Secret Key.</p>
      <label>Code</label>
      <input id="inp-code" type="text" inputmode="numeric" maxlength="6" placeholder="123456" autocomplete="one-time-code"/>
      <button class="btn" id="btn-code" onclick="submitCode()">Verify &rarr;</button>
      <div class="err" id="err-code"></div>
      <span class="back" onclick="goBack()">&larr; Different number</span>
    </div>

    <div class="step" id="s-full">
      <div class="sf-icon">&#128274;</div>
      <h2>Server at capacity</h2>
      <p class="hint">This hosted instance is personal. Please self-host your own free instance &mdash; it only takes a few minutes.</p>
      <div class="sf-links">
        <a class="sf-link" href="${CONFIG.GITHUB_URL}" target="_blank">
          <span class="sf-link-icon">&#128196;</span>
          <div><strong>Self-host on GitHub</strong><br><small style="color:var(--muted)">Free, open source, deploy to Railway in 2 min</small></div>
        </a>
        <a class="sf-link" href="${CONFIG.INSTAGRAM_URL}" target="_blank">
          <span class="sf-link-icon">&#128247;</span>
          <div><strong>Contact on Instagram</strong><br><small style="color:var(--muted)">Need help setting it up?</small></div>
        </a>
        <a class="sf-link" href="mailto:${CONFIG.EMAIL}">
          <span class="sf-link-icon">&#128140;</span>
          <div><strong>Email us</strong><br><small style="color:var(--muted)">${CONFIG.EMAIL}</small></div>
        </a>
      </div>
      <span class="back" onclick="goBack()">&larr; Try a different number</span>
    </div>

  </div>
</div>

<footer>
  <a href="/docs">API Docs</a>
  <a href="${CONFIG.GITHUB_URL}" target="_blank">GitHub</a>
  <a href="${CONFIG.INSTAGRAM_URL}" target="_blank">Instagram</a>
  <a href="mailto:${CONFIG.EMAIL}">Contact</a>
</footer>

<script>
var phone = '';
var lockTimer = null;
var qrES = null;

function showStep(id) {
  document.querySelectorAll('.step').forEach(function(s){ s.classList.remove('active'); });
  document.getElementById(id).classList.add('active');
}

function showErr(id, msg) {
  var el = document.getElementById(id);
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(function(){ el.style.display = 'none'; }, 5000);
}

function goBack() {
  phone = '';
  if (qrES) { qrES.close(); qrES = null; }
  if (lockTimer) { clearInterval(lockTimer); lockTimer = null; }
  showStep('s-phone');
}

function showReset() { showStep('s-reset'); }

function startLockTimer(seconds) {
  if (lockTimer) clearInterval(lockTimer);
  var s = seconds;
  var el = document.getElementById('lock-countdown');
  function tick() {
    var m = Math.floor(s/60), sec = s % 60;
    el.textContent = m + ':' + (sec < 10 ? '0' : '') + sec;
    if (s <= 0) { clearInterval(lockTimer); showStep('s-key'); }
    s--;
  }
  tick();
  lockTimer = setInterval(tick, 1000);
  showStep('s-locked');
}

async function submitPhone() {
  var raw = document.getElementById('inp-phone').value.trim();
  if (!raw) return;
  var btn = document.getElementById('btn-phone');
  btn.disabled = true; btn.textContent = 'Checking...';
  try {
    var res  = await fetch('/auth/start', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ phone: raw }) });
    var data = await res.json();
    if (data.error === 'server_full') { showStep('s-full'); return; }
    if (!res.ok) { showErr('err-phone', data.error || 'Error'); return; }
    phone = data.phone;
    if (data.existing) { showStep('s-key'); setTimeout(function(){ document.getElementById('inp-key').focus(); }, 80); }
    else { showStep('s-qr'); startQR(); }
  } catch(e) { showErr('err-phone', 'Network error'); }
  finally { btn.disabled = false; btn.textContent = 'Continue \u2192'; }
}

async function submitKey() {
  var key = document.getElementById('inp-key').value.trim();
  if (!key) return;
  var btn = document.getElementById('btn-key');
  btn.disabled = true; btn.textContent = 'Verifying...';
  try {
    var res  = await fetch('/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ phone: phone, key: key }) });
    var data = await res.json();
    if (!res.ok) {
      if (data.locked) { startLockTimer(data.remaining * 60); return; }
      document.getElementById('inp-key').style.borderColor = '#e74c3c';
      setTimeout(function(){ document.getElementById('inp-key').style.borderColor = ''; }, 1500);
      showErr('err-key', data.error || 'Wrong key');
      return;
    }
    window.location.href = '/dashboard';
  } catch(e) { showErr('err-key', 'Network error'); }
  finally { btn.disabled = false; btn.textContent = 'Sign In \u2192'; }
}

function startQR() {
  if (qrES) qrES.close();
  var es = qrES = new EventSource('/auth/qr-stream');
  es.addEventListener('qr', function(e) {
    var d = JSON.parse(e.data);
    document.getElementById('qr-img').src = d.dataUrl;
    document.getElementById('qr-box').style.display = 'block';
    document.getElementById('qr-status').innerHTML = '<div class="dot"></div> Scan with WhatsApp';
  });
  es.addEventListener('ready', function() {
    es.close();
    document.getElementById('qr-status').textContent = 'Connected! Going to dashboard...';
    document.getElementById('qr-box').style.display = 'none';
    setTimeout(function(){ window.location.href = '/auth/claim'; }, 600);
  });
  es.addEventListener('blocked', function() {
    es.close();
    document.getElementById('qr-box').style.display = 'none';
    document.getElementById('qr-status').textContent = 'This number is already connected. Go back, choose Reset Secret Key and use the code we send to your WhatsApp.';
  });
  es.onerror = function() {
    if (es.readyState === 2) document.getElementById('qr-status').textContent = 'Session expired. Go back and start again.';
  };
}

async function confirmReset() {
  var btn = document.getElementById('btn-reset');
  btn.disabled = true; btn.textContent = 'Working...';
  try {
    var res  = await fetch('/auth/reset', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ phone: phone }) });
    var data = await res.json();
    if (!res.ok) { showStep('s-key'); showErr('err-key', data.error || 'Reset failed'); return; }
    if (data.mode === 'code') { showStep('s-code'); setTimeout(function(){ document.getElementById('inp-code').focus(); }, 80); }
    else { showStep('s-qr'); startQR(); }
  } catch(e) { showStep('s-key'); showErr('err-key', 'Network error'); }
  finally { btn.disabled = false; btn.textContent = 'Yes, reset my key'; }
}

async function submitCode() {
  var code = document.getElementById('inp-code').value.trim();
  if (!code) return;
  var btn = document.getElementById('btn-code');
  btn.disabled = true; btn.textContent = 'Verifying...';
  try {
    var res  = await fetch('/auth/reset/confirm', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ phone: phone, code: code }) });
    var data = await res.json();
    if (!res.ok) { showErr('err-code', data.error || 'Wrong code'); return; }
    window.location.href = '/dashboard';
  } catch(e) { showErr('err-code', 'Network error'); }
  finally { btn.disabled = false; btn.textContent = 'Verify \u2192'; }
}

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('inp-phone').addEventListener('keydown', function(e){ if(e.key==='Enter') submitPhone(); });
  document.getElementById('inp-key').addEventListener('keydown',   function(e){ if(e.key==='Enter') submitKey(); });
  document.getElementById('inp-code').addEventListener('keydown',  function(e){ if(e.key==='Enter') submitCode(); });
});
</script>
</body>
</html>`;
}

module.exports = landingHTML;
