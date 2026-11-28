'use strict';
const {summarizeSessions,filterSessions}=require('../utils/adminSessions');
module.exports = function adminHTML() {
  return String.raw`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>WPSent Administration</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#0d1117;color:#e6edf3;font:15px system-ui,sans-serif}main{max-width:1150px;margin:auto;padding:24px}header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}a{color:#66df96}h1,h2{margin:12px 0}section{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:20px;margin:20px 0}label{display:block;margin:12px 0 4px}input,button{font:inherit;border-radius:7px;padding:10px;border:1px solid #484f58}input{background:#0d1117;color:#e6edf3;width:100%;max-width:420px}button{background:#238636;color:white;cursor:pointer;margin:4px}button.danger{background:#a1262d}button.secondary{background:#30363d}button:disabled{opacity:.5;cursor:not-allowed}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:10px;border-bottom:1px solid #30363d;overflow-wrap:anywhere}th{color:#aab5c2}small,.muted{color:#aab5c2}#notice{min-height:24px;color:#f0ca78;white-space:pre-wrap}.scroll{overflow:auto}form{margin:0} [hidden]{display:none!important}dialog{background:#161b22;color:#e6edf3;border:1px solid #484f58;border-radius:12px;max-width:95vw}dialog::backdrop{background:#000a}

:root{color-scheme:dark;--accent:#35d399;--muted:#98a7b7;--panel:#141b25;--border:#2a3543}
body{background:#0b1018;font-size:14px;line-height:1.5}
main{max-width:1440px;padding:24px 32px 48px}h1{font-size:24px;letter-spacing:-.6px;margin:0}h2{font-size:19px;letter-spacing:-.3px;margin:0 0 12px}h3{font-size:15px}section{background:var(--panel);border-color:var(--border);padding:22px;margin:16px 0;border-radius:14px}
a{text-decoration:none;color:#a3e8d0}a:hover{text-decoration:underline}
.topbar{padding:8px 0 20px;border-bottom:1px solid var(--border)}.brand{display:flex;align-items:center;gap:12px}.brandmark{width:43px;height:43px;border-radius:12px;background:#103b31;color:#55e2ad;display:grid;place-items:center;font-weight:800;font-size:17px}
nav{display:flex;align-items:center;gap:14px;flex-wrap:wrap}.muted,small{color:var(--muted)}#who{font-size:12px;color:var(--muted);margin:8px 0}
#notice{position:sticky;top:0;z-index:3;background:#0b1018;margin:0;padding:6px 0;min-height:18px}#notice:empty{padding:0;min-height:0}
button{background:#17784f;border-color:#289568;padding:8px 13px;font-weight:600;margin:0 4px 0 0}button:hover:not(:disabled){filter:brightness(1.18)}button.secondary{background:#202a37;border-color:#3a4758}button.danger{background:#39202a;color:#ffb5bc;border-color:#69333f}button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
input,select{background:#0b111b;color:#e6edf3;font:inherit;border:1px solid #394858;border-radius:8px;padding:9px 11px;width:100%;max-width:none}label{font-size:13px;font-weight:500;color:#c6d0dd}
#auth{max-width:820px;margin:32px auto;display:grid;grid-template-columns:1fr 1fr;gap:28px}#auth hr{display:none}#auth .auth-secondary{border-left:1px solid var(--border);padding-left:28px}
.console-nav{display:flex;gap:8px;flex-wrap:wrap;padding:14px 0 4px}.console-nav button{background:transparent;border-color:transparent;color:var(--muted);padding:9px 15px}.console-nav button[aria-current="page"]{color:#80e8be;border-color:#2b6552;background:#163328}
.panel-title{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.panel-title h2{margin:0}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:18px 0}.metric{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:18px}.metric span{font-size:12px;color:var(--muted)}.metric strong{display:block;font-size:32px;line-height:1.3;margin-top:6px;letter-spacing:-1px}.metric.ready strong{color:#52dca6}.metric.attention strong{color:#f3c86b}.metric.revoked strong{color:#f3a0a7}
.capacity-track{height:9px;border-radius:10px;background:#293542;overflow:hidden;margin:12px 0}.capacity-fill{height:100%;background:#35d399;width:0;transition:width .15s}.capacity-fill.over{background:#e9b45d}
.tools{display:grid;grid-template-columns:minmax(180px,2fr) repeat(3,minmax(120px,1fr)) minmax(85px,.65fr);gap:12px;margin:18px 0}.tools label{margin:0}.tools input,.tools select{margin-top:5px}.scroll{border:1px solid var(--border);border-radius:10px}table{min-width:740px}th{background:#1b2531;font-size:11px;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap}td,th{padding:13px 12px;border-color:var(--border)}tbody tr:last-child td{border:0}tbody tr:hover{background:#192330}td:first-child{font-variant-numeric:tabular-nums;font-weight:600}.actions{display:flex;gap:6px;flex-wrap:wrap}.actions button{font-size:12px;padding:6px 10px}
.status{display:inline-flex;align-items:center;gap:7px;border-radius:20px;padding:4px 9px;background:#26313f;color:#c3cfdf;font-size:12px;white-space:nowrap}.status:before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor}.status.ready{background:#123d30;color:#73e3b5}.status.attention{background:#3b3020;color:#f2ca77}.status.revoked{background:#3c2530;color:#f5a7af}.policy-tag{font-size:12px;color:var(--muted)}.policy-tag.custom{color:#92c7ff;font-weight:600}.pagination{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:14px}.empty{text-align:center;color:var(--muted);padding:30px}
.policy-layout{display:grid;grid-template-columns:1fr;gap:16px}.policy-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.policy-fields h4{grid-column:1/-1;color:#8eb2c9;margin:12px 0 0;border-bottom:1px solid var(--border);padding-bottom:7px;font-size:12px;text-transform:uppercase;letter-spacing:.5px}.policy-fields label{margin:0;background:#101721;border:1px solid var(--border);padding:12px;border-radius:9px}.policy-fields input{margin-top:7px}.form-actions{margin-top:18px;display:flex;gap:8px;flex-wrap:wrap}.policy-picker{display:grid;grid-template-columns:1fr 1fr;gap:12px}.effective-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:14px 0}.effective-grid div{padding:10px;background:#0e1721;border-radius:8px}.effective-grid span{display:block;font-size:11px;color:var(--muted)}.effective-grid strong{font-size:15px}
#limitForm{display:flex;align-items:end;gap:12px;flex-wrap:wrap}#limitForm label{flex-basis:100%;margin-bottom:0}#limitForm input{max-width:240px}.section-note{max-width:840px;color:var(--muted)}.last-refresh{font-size:12px;color:var(--muted)}
@media(max-width:980px){.metrics{grid-template-columns:repeat(2,1fr)}.tools{grid-template-columns:repeat(2,minmax(0,1fr))}.policy-fields{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){main{padding:12px}section{padding:15px}h1{font-size:20px}.metrics{gap:8px}.metric{padding:13px}.metric strong{font-size:26px}.tools,.policy-picker{grid-template-columns:1fr}.effective-grid,.policy-fields{grid-template-columns:1fr 1fr}#auth{grid-template-columns:1fr;padding:18px}#auth .auth-secondary{border-left:0;padding:18px 0 0;border-top:1px solid var(--border)}nav{gap:8px}.console-nav{gap:3px}.console-nav button{padding:8px;font-size:12px}}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style></head><body><main>
<header class="topbar"><div class="brand"><div class="brandmark" aria-hidden="true">WP</div><div><h1>WPSent Administration</h1><span class="muted">Session &amp; server management</span></div></div><nav aria-label="Site links"><a href="/dashboard">Dashboard</a><a href="/docs">API docs</a><a href="https://github.com/brightbrill-org/WPSent" target="_blank" rel="noopener noreferrer">GitHub</a><button id="logout" class="secondary" hidden>Sign out</button></nav></header>
<p id="notice" role="status" aria-live="polite"></p>
<section id="auth"><div><h2>Administrator sign-in</h2><p class="muted">Manage registered phones and server policies securely.</p><form id="login"><label for="email">Email</label><input id="email" type="email" autocomplete="username" required><label for="password">Password</label><input id="password" type="password" autocomplete="current-password" required><p><button>Sign in</button></p></form>
</div><div class="auth-secondary"><h2>Create administrator account</h2><p class="muted">The first account is activated using the server bootstrap token. Later registrations require approval.</p><form id="signup"><label for="newEmail">Email</label><input id="newEmail" type="email" required><label for="newPassword">Password (at least 12 characters)</label><input id="newPassword" type="password" minlength="12" autocomplete="new-password" required><label for="bootstrap">Initial setup token (first account only)</label><input id="bootstrap" type="password" autocomplete="off"><p><button>Create account</button></p></form></div></section>
<div id="console" hidden><header><p id="who"></p><span id="lastRefresh" class="last-refresh"></span></header>
<nav class="console-nav" aria-label="Administration sections"><button type="button" data-view="overview" aria-current="page">Overview</button><button type="button" data-view="sessions">Sessions</button><button type="button" data-view="policy">Sending policy</button><button type="button" data-view="admins">Administrators</button><button id="refresh" type="button" class="secondary">Refresh data</button></nav>
<div id="view-overview"><div class="metrics"><div class="metric"><span>Total registered sessions</span><strong id="statTotal">—</strong></div><div class="metric ready"><span>Connected / ready</span><strong id="statReady">—</strong></div><div class="metric attention"><span>Not ready / attention</span><strong id="statAttention">—</strong></div><div class="metric revoked"><span>Revoked</span><strong id="statRevoked">—</strong></div></div>
<section><h2>Registration capacity</h2><p id="count"></p><div id="capacityTrack" class="capacity-track" role="progressbar" aria-label="Registration capacity" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div id="capacityFill" class="capacity-fill"></div></div><form id="limitForm"><label for="limit">Maximum active registered phones (blank = unlimited; 0 = stop new registrations)</label><input id="limit" type="number" min="0" max="100000" step="1"><button>Save limit</button></form><small>Lowering the limit does not disconnect existing phones. Revoked phones do not consume a slot.</small></section>
<section><h2>Quick access</h2><p class="section-note">Review session health or update sending policies without restarting the server.</p><button type="button" id="quickSessions">Manage sessions</button><button type="button" id="quickPolicy" class="secondary">Sending policy</button></section></div>
<div id="view-sessions" hidden><section><header class="panel-title"><div><h2>Registered sessions</h2><span class="muted">Search, filter and manage connected and inactive phones.</span></div><span id="sessionTotal" class="muted"></span></header>
<div class="tools"><label>Search phone<input id="phoneSearch" type="search" placeholder="Phone number or country code"></label><label>Status<select id="statusFilter"><option value="all">All statuses</option><option value="ready">Ready</option><option value="attention">Not ready</option><option value="revoked">Revoked</option></select></label><label>Policy<select id="policyFilter"><option value="all">All policies</option><option value="inherited">Inherited</option><option value="custom">Custom</option></select></label><label>Sort<select id="phoneSort"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="lastSeen">Last seen</option><option value="phone">Phone number</option></select></label><label>Rows<select id="pageSize"><option>10</option><option selected>25</option><option>50</option><option>100</option></select></label></div>
<div class="scroll"><table><thead><tr><th>Phone</th><th>Session status</th><th>Policy</th><th>Registered</th><th>Last seen</th><th>Actions</th></tr></thead><tbody id="phones"></tbody></table></div>
<div class="pagination"><span id="pageSummary" class="muted" aria-live="polite"></span><div><button type="button" id="prevPage" class="secondary">Previous</button><button type="button" id="nextPage" class="secondary">Next</button></div></div></section></div>
<div id="view-policy" hidden><section><h2>Sending policy</h2><p class="muted">Global defaults apply to all phones. Session overrides can be more restrictive than global settings. Changes persist and apply without restart. One native send globally and one broadcast job per phone are fixed safeguards.</p>
<div class="policy-layout"><div><h3>Global policy</h3><form id="globalPolicyForm"><div id="globalPolicyFields" class="policy-fields"></div><div class="form-actions"><button>Save global policy</button></div></form></div></div></section>
<section><h2>Session overrides</h2><p class="section-note">Blank values inherit the global policy. A session cannot weaken global resource protection.</p><div class="policy-picker"><label>Find registered phone<input id="policySearch" type="search" placeholder="Search phone number"></label><label for="policyPhone">Registered phone<select id="policyPhone"></select></label></div><p id="effectivePolicy" class="muted" aria-live="polite"></p><div id="effectiveGrid" class="effective-grid"></div>
<form id="sessionPolicyForm"><div id="sessionPolicyFields" class="policy-fields"></div><div class="form-actions"><button>Save session overrides</button><button type="button" id="inheritPolicy" class="secondary">Reset to global</button></div></form></section></div>
<div id="view-admins" hidden><section><h2>Administrators</h2><p class="muted">Approve pending accounts, reset passwords or revoke access. The last active administrator cannot be revoked.</p><div class="scroll"><table><thead><tr><th>Email</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody id="admins"></tbody></table></div></section></div></div>
<dialog id="resetDialog"><form id="resetForm"><h2>Reset administrator password</h2><p id="resetTarget"></p><label for="resetPassword">New password (minimum 12 characters)</label><input id="resetPassword" type="password" minlength="12" autocomplete="new-password" required><p><button>Reset password</button><button type="button" id="cancelReset" class="secondary">Cancel</button></p></form></dialog>
<script>
const $ = id => document.getElementById(id);
let current = null, resetEmail = null;
const summarizeSessions = ${summarizeSessions.toString()};
const filterSessions = ${filterSessions.toString()};
let phoneRows=[],page=1,refreshEpoch=0,view='overview';
const tell = msg => { $('notice').textContent = msg; };
async function api(path, method='GET', body) {
  const opt = {method, credentials:'same-origin', cache:'no-store'};
  if(method!=='GET'){opt.headers={'Content-Type':'application/json','X-WPSent-Admin':'1'};opt.body=JSON.stringify(body||{});}
  const res=await fetch('/admin/api'+path,opt);
  const data=await res.json();
  if(!res.ok){const e=new Error(data.error||'Request failed');e.status=res.status;throw e;}
  return data;
}
function authMode(){refreshEpoch++;policyVersion++;phoneRows=[];current=null;$('auth').hidden=false;$('console').hidden=true;$('logout').hidden=true;$('phones').replaceChildren();$('admins').replaceChildren();}
async function refresh(){
  const epoch=++refreshEpoch;
  try {
    const me=await api('/me');if(epoch!==refreshEpoch)return;current=me.admin.email;
    const [p,adminList,policy]=await Promise.all([api('/phones'),api('/admins'),api('/sending-policy')]);
    if(epoch!==refreshEpoch)return;
    $('auth').hidden=true;$('console').hidden=false;$('logout').hidden=false;$('who').textContent='Signed in as '+current;
    $('count').textContent=p.activeCount+' active registered phone(s) / '+(p.limit===null?'unlimited':p.limit);
    $('limit').value=p.limit===null?'':p.limit;
    phoneRows=p.phones;
    const stats=summarizeSessions(phoneRows);
    $('statTotal').textContent=stats.total;$('statReady').textContent=stats.ready;$('statAttention').textContent=stats.attention;$('statRevoked').textContent=stats.revoked;
    const ratio=p.limit===null?0:p.limit===0?(p.activeCount?100:0):Math.min(100,100*p.activeCount/p.limit);
    $('capacityTrack').hidden=p.limit===null;$('capacityTrack').setAttribute('aria-valuenow',String(Math.round(ratio)));$('capacityFill').style.width=ratio+'%';$('capacityFill').classList.toggle('over',p.limit!==null&&p.activeCount>p.limit);
    $('lastRefresh').textContent='Updated '+new Date().toLocaleTimeString();
    renderPhones();
    await renderPolicy(policy,p.phones);
    if(epoch!==refreshEpoch)return;
    $('admins').replaceChildren();
    for(const a of adminList.admins){
      const row=document.createElement('tr');cell(row,a.email+(a.email===current?' (you)':''));cell(row,a.status);cell(row,date(a.createdAt));const actions=cell(row,'');
      if(a.status==='pending')button(actions,'Approve',async()=>{await api('/admins/approve','POST',{email:a.email});tell('Administrator approved');await refresh();});
      if(a.status!=='revoked'){
        button(actions,'Reset password',()=>{resetEmail=a.email;$('resetTarget').textContent=a.email;$('resetPassword').value='';$('resetDialog').showModal();});
        button(actions,'Revoke',async()=>{if(!confirm('Revoke administrator '+a.email+'?'))return;await api('/admins/revoke','POST',{email:a.email});tell('Administrator revoked');await refresh();},true);
      }
      $('admins').append(row);
    }
  }catch(e){if(epoch!==refreshEpoch)return;if(e.status===401){authMode();}else tell(e.message);}
}
const statusLabel={ready:'Ready',qr_ready:'QR required',initializing:'Initializing',disconnected:'Disconnected',auth_failure:'Authentication failed',initialization_failed:'Initialization failed',not_started:'Not started',error:'Error',revoked:'Revoked'};
function showView(name){view=name;for(const n of ['overview','sessions','policy','admins'])$('view-'+n).hidden=n!==name;for(const b of document.querySelectorAll('[data-view]')){if(b.dataset.view===name)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}}
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>showView(b.dataset.view);
$('quickSessions').onclick=()=>showView('sessions');$('quickPolicy').onclick=()=>showView('policy');
function renderPhones(){
 const result=filterSessions(phoneRows,{search:$('phoneSearch').value,status:$('statusFilter').value,policy:$('policyFilter').value,sort:$('phoneSort').value,page,pageSize:Number($('pageSize').value)});
 page=result.page;const body=$('phones');body.replaceChildren();$('sessionTotal').textContent=result.total+' matching / '+phoneRows.length+' total';
 for(const phone of result.items){
   const row=document.createElement('tr');cell(row,phone.phone);
   const status=cell(row,''),pill=document.createElement('span');pill.className='status '+(phone.revokedAt?'revoked':phone.status==='ready'?'ready':'attention');pill.textContent=(statusLabel[phone.status]||String(phone.status||'Unknown').replace(/_/g,' '))+(phone.revokedAt&&!phone.revocationComplete?' (cleanup pending)':'');status.append(pill);
   const policyCell=cell(row,phone.revokedAt?'—':phone.policySource==='custom'?'Custom':'Inherited');policyCell.className='policy-tag '+(phone.policySource==='custom'?'custom':'');
   cell(row,date(phone.createdAt));cell(row,date(phone.lastSeen));const actions=cell(row,''),group=document.createElement('div');group.className='actions';actions.append(group);
   if(!phone.revokedAt)button(group,'Edit policy',async()=>{showView('policy');$('policySearch').value='';populatePolicyPhones(phone.phone);await loadSessionPolicy();});
   if(!phone.revokedAt||!phone.revocationComplete)button(group,phone.revokedAt?'Retry cleanup':'Revoke',async()=>{
     if(!confirm('Revoke '+phone.phone+'? This blocks future login and removes stored WhatsApp authentication.'))return;
     try{await api('/phones/'+encodeURIComponent(phone.phone)+'/revoke','POST');tell('Phone revoked');}finally{await refresh();}
   },true);
   body.append(row);
 }
 if(!result.items.length){const row=document.createElement('tr'),td=cell(row,'No sessions match your filters.');td.colSpan=6;td.className='empty';body.append(row);}
 $('pageSummary').textContent=result.total?'Showing '+((page-1)*result.pageSize+1)+'–'+Math.min(page*result.pageSize,result.total)+' of '+result.total+' · Page '+page+' of '+result.pages:'No matching sessions';
 $('prevPage').disabled=page<=1;$('nextPage').disabled=page>=result.pages;
}
for(const id of ['statusFilter','policyFilter','phoneSort','pageSize'])$(id).onchange=()=>{page=1;renderPhones();};
$('phoneSearch').oninput=()=>{page=1;renderPhones();};
$('prevPage').onclick=()=>{page--;renderPhones();};$('nextPage').onclick=()=>{page++;renderPhones();};
let policyMeta=null,policyVersion=0;
const labels={intervalMs:'Send gap (ms)',maxPending:'Pending queue maximum',waitMs:'Queue wait (ms)',broadcastIntervalMs:'Broadcast gap (ms)',maxLists:'Lists per phone',maxRecipients:'Recipients per list',dailyRecipients:'Reserved recipients per rolling 24 hours',activeJobs:'Active broadcast jobs globally',submissionTimeoutMs:'Broadcast submission timeout (ms)',historyDays:'Job retention (days)'};
function fields(container,keys,values,optional){
 const el=$(container);el.replaceChildren();
 const groups=[['Message scheduling',['intervalMs','maxPending','waitMs']],['Broadcast limits',['broadcastIntervalMs','maxLists','maxRecipients','dailyRecipients','activeJobs']],['Timeout & retention',['submissionTimeoutMs','historyDays']]];
 for(const [title,group] of groups){const selected=group.filter(k=>keys.includes(k));if(!selected.length)continue;const heading=document.createElement('h4');heading.textContent=title;el.append(heading);
 for(const key of selected){const [env,def,min,max]=policyMeta.fields[key];const label=document.createElement('label');label.textContent=(labels[key]||key)+' ('+min+'–'+max+')';const input=document.createElement('input');input.type='number';input.min=min;input.max=max;input.step='1';input.dataset.key=key;input.required=!optional;input.value=values[key]??'';if(optional)input.placeholder='Inherit global';label.append(input);el.append(label);}}
}
function readPolicy(container){const value={};for(const input of $(container).querySelectorAll('input[data-key]'))if(input.value!=='')value[input.dataset.key]=Number(input.value);return value;}
async function loadSessionPolicy(){
 const phone=$('policyPhone').value,version=++policyVersion;
 $('sessionPolicyFields').replaceChildren();$('effectiveGrid').replaceChildren();$('sessionPolicyForm').querySelector('button').disabled=true;$('inheritPolicy').disabled=true;
 if(!phone){$('effectivePolicy').textContent='No active phone selected';return;}
 $('effectivePolicy').textContent='Loading session policy…';
 const data=await api('/phones/'+encodeURIComponent(phone)+'/sending-policy');
 if(version!==policyVersion||$('policyPhone').value!==phone)return;
 fields('sessionPolicyFields',policyMeta.sessionKeys,data.override,true);
 $('effectivePolicy').textContent=Object.keys(data.override).length?'Custom policy · effective values below':'Inherits global policy · effective values below';
 for(const [k,v] of Object.entries(data.effective)){const card=document.createElement('div'),label=document.createElement('span'),value=document.createElement('strong');label.textContent=labels[k]||k;value.textContent=String(v);card.append(label,value);$('effectiveGrid').append(card);}
 $('sessionPolicyForm').querySelector('button').disabled=false;$('inheritPolicy').disabled=false;
}
async function renderPolicy(meta,phones){
 policyMeta=meta;fields('globalPolicyFields',Object.keys(meta.fields),meta.global,false);
 populatePolicyPhones($('policyPhone').value);
 await loadSessionPolicy();
}
function populatePolicyPhones(selected){
 const select=$('policyPhone'),needle=$('policySearch').value.trim().replace(/[\s()+-]/g,'');select.replaceChildren();
 const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Select a session';select.append(placeholder);
 for(const row of phoneRows.filter(x=>!x.revokedAt&&String(x.phone).includes(needle))){const opt=document.createElement('option');opt.value=row.phone;opt.textContent=row.phone+(row.policySource==='custom'?' · Custom':' · Inherited');select.append(opt);}
 if([...select.options].some(x=>x.value===selected))select.value=selected;
}
$('policySearch').oninput=()=>{const old=$('policyPhone').value;populatePolicyPhones(old);if($('policyPhone').value!==old)loadSessionPolicy().catch(e=>tell(e.message));};
$('policyPhone').onchange=()=>loadSessionPolicy().catch(e=>tell(e.message));
submit('globalPolicyForm',async()=>{await api('/sending-policy','PUT',{policy:readPolicy('globalPolicyFields')});tell('Global policy saved');await refresh();});
submit('sessionPolicyForm',async()=>{const phone=$('policyPhone').value;if(!phone)throw new Error('Select an active phone');await api('/phones/'+encodeURIComponent(phone)+'/sending-policy','PUT',{override:readPolicy('sessionPolicyFields')});tell('Session policy saved');await refresh();});
$('inheritPolicy').onclick=async()=>{try{const phone=$('policyPhone').value;if(!phone)return;await api('/phones/'+encodeURIComponent(phone)+'/sending-policy','PUT',{override:null});await refresh();tell('Session inherits global policy');}catch(e){tell(e.message);}};
function date(v){return v?new Date(v).toLocaleString():'—';}
function cell(row,text){const td=document.createElement('td');td.textContent=text;row.append(td);return td;}
function button(parent,label,action,danger){const b=document.createElement('button');b.type='button';b.textContent=label;b.className=danger?'danger':'secondary';b.onclick=async()=>{b.disabled=true;try{await action();}catch(e){tell(e.message);if(e.status===401)authMode();}finally{b.disabled=false;}};parent.append(b);}
function submit(id,action){$(id).onsubmit=async e=>{e.preventDefault();const b=e.currentTarget.querySelector('button');b.disabled=true;try{await action();}catch(err){tell(err.message);if(err.status===401)authMode();}finally{b.disabled=false;}};}
submit('login',async()=>{await api('/login','POST',{email:$('email').value,password:$('password').value});$('password').value='';tell('Signed in');await refresh();});
submit('signup',async()=>{const result=await api('/signup','POST',{email:$('newEmail').value,password:$('newPassword').value,bootstrapToken:$('bootstrap').value});$('signup').reset();tell(result.admin.status==='active'?'First administrator created':'Account created; awaiting approval');await refresh();});
submit('limitForm',async()=>{await api('/phone-limit','PUT',{limit:$('limit').value===''?null:Number($('limit').value)});tell('Limit saved');await refresh();});
submit('resetForm',async()=>{await api('/admins/password','POST',{email:resetEmail,password:$('resetPassword').value});$('resetPassword').value='';$('resetDialog').close();tell('Password reset; previous sessions invalidated');await refresh();});
$('cancelReset').onclick=()=>{$('resetPassword').value='';$('resetDialog').close();};
$('logout').onclick=async()=>{try{await api('/logout','POST');authMode();tell('Signed out');}catch(e){tell(e.message);}};
$('refresh').onclick=refresh;
refresh();
</script></main></body></html>`;
};
