'use strict';
module.exports = function adminHTML() {
  return String.raw`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>WPSent Administration</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#0d1117;color:#e6edf3;font:15px system-ui,sans-serif}main{max-width:1150px;margin:auto;padding:24px}header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}a{color:#66df96}h1,h2{margin:12px 0}section{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:20px;margin:20px 0}label{display:block;margin:12px 0 4px}input,button{font:inherit;border-radius:7px;padding:10px;border:1px solid #484f58}input{background:#0d1117;color:#e6edf3;width:100%;max-width:420px}button{background:#238636;color:white;cursor:pointer;margin:4px}button.danger{background:#a1262d}button.secondary{background:#30363d}button:disabled{opacity:.5;cursor:not-allowed}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:10px;border-bottom:1px solid #30363d;overflow-wrap:anywhere}th{color:#aab5c2}small,.muted{color:#aab5c2}#notice{min-height:24px;color:#f0ca78;white-space:pre-wrap}.scroll{overflow:auto}form{margin:0} [hidden]{display:none!important}dialog{background:#161b22;color:#e6edf3;border:1px solid #484f58;border-radius:12px;max-width:95vw}dialog::backdrop{background:#000a}
</style></head><body><main>
<header><div><h1>WPSent Administration</h1><span class="muted">Phone sessions · Registration policy · Administrators</span></div><nav><a href="/">WhatsApp sign-in</a> · <a href="/docs">API docs</a> <button id="logout" class="secondary" hidden>Sign out</button></nav></header>
<p id="notice" role="status" aria-live="polite"></p>
<section id="auth"><h2>Administrator sign-in</h2><form id="login"><label for="email">Email</label><input id="email" type="email" autocomplete="username" required><label for="password">Password</label><input id="password" type="password" autocomplete="current-password" required><p><button>Sign in</button></p></form>
<hr><h2>Create administrator account</h2><p class="muted">The first account is activated using the server bootstrap token. Later registrations require approval.</p><form id="signup"><label for="newEmail">Email</label><input id="newEmail" type="email" required><label for="newPassword">Password (at least 12 characters)</label><input id="newPassword" type="password" minlength="12" autocomplete="new-password" required><label for="bootstrap">Initial setup token (first account only)</label><input id="bootstrap" type="password" autocomplete="off"><p><button>Create account</button></p></form></section>
<div id="console" hidden><p id="who"></p>
<section><h2>Phone registration limit</h2><p id="count"></p><form id="limitForm"><label for="limit">Maximum active registered phones (blank = unlimited; 0 = stop new registrations)</label><input id="limit" type="number" min="0" max="100000" step="1"><button>Save limit</button></form><small>Lowering the limit does not disconnect existing phones. Revoked phones do not consume a slot.</small></section>
<section><header><h2>Registered phones</h2><button id="refresh" class="secondary">Refresh</button></header><div class="scroll"><table><thead><tr><th>Phone</th><th>Session status</th><th>Registered</th><th>Last seen</th><th>Action</th></tr></thead><tbody id="phones"></tbody></table></div></section>
<section><h2>Sending policy</h2><p class="muted">Global defaults apply to all phones. Session overrides can be more restrictive than global settings. Changes persist and apply without restart. One native send globally and one broadcast job per phone are fixed safeguards.</p>
<form id="globalPolicyForm"><div id="globalPolicyFields"></div><button>Save global policy</button></form>
<hr><h3>Session policy</h3><label for="policyPhone">Registered phone</label><select id="policyPhone"></select><p id="effectivePolicy" class="muted"></p>
<form id="sessionPolicyForm"><div id="sessionPolicyFields"></div><button>Save session overrides</button><button type="button" id="inheritPolicy" class="secondary">Reset to global</button></form></section>
<section><h2>Administrators</h2><p class="muted">Approve pending accounts, reset passwords or revoke access. The last active administrator cannot be revoked.</p><div class="scroll"><table><thead><tr><th>Email</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody id="admins"></tbody></table></div></section></div>
<dialog id="resetDialog"><form id="resetForm"><h2>Reset administrator password</h2><p id="resetTarget"></p><label for="resetPassword">New password (minimum 12 characters)</label><input id="resetPassword" type="password" minlength="12" autocomplete="new-password" required><p><button>Reset password</button><button type="button" id="cancelReset" class="secondary">Cancel</button></p></form></dialog>
<script>
const $ = id => document.getElementById(id);
let current = null, resetEmail = null;
const tell = msg => { $('notice').textContent = msg; };
async function api(path, method='GET', body) {
  const opt = {method, credentials:'same-origin', cache:'no-store'};
  if(method!=='GET'){opt.headers={'Content-Type':'application/json','X-WPSent-Admin':'1'};opt.body=JSON.stringify(body||{});}
  const res=await fetch('/admin/api'+path,opt);
  const data=await res.json();
  if(!res.ok){const e=new Error(data.error||'Request failed');e.status=res.status;throw e;}
  return data;
}
function authMode(){current=null;$('auth').hidden=false;$('console').hidden=true;$('logout').hidden=true;$('phones').replaceChildren();$('admins').replaceChildren();}
async function refresh(){
  try {
    const me=await api('/me');current=me.admin.email;
    const [p,adminList,policy]=await Promise.all([api('/phones'),api('/admins'),api('/sending-policy')]);
    $('auth').hidden=true;$('console').hidden=false;$('logout').hidden=false;$('who').textContent='Signed in as '+current;
    $('count').textContent=p.activeCount+' active registered phone(s) / '+(p.limit===null?'unlimited':p.limit);
    $('limit').value=p.limit===null?'':p.limit;
    $('phones').replaceChildren();
    for(const phone of p.phones){
      const row=document.createElement('tr');cell(row,phone.phone);cell(row,phone.status+(phone.revokedAt&&!phone.revocationComplete?' (cleanup pending)':''));cell(row,date(phone.createdAt));cell(row,date(phone.lastSeen));
      const actions=cell(row,'');
      if(!phone.revokedAt||!phone.revocationComplete) button(actions,phone.revokedAt?'Retry cleanup':'Revoke',async()=>{
        if(!confirm('Revoke '+phone.phone+'? This blocks future login and removes stored WhatsApp authentication.'))return;
        try { await api('/phones/'+encodeURIComponent(phone.phone)+'/revoke','POST');tell('Phone revoked'); }
        finally { await refresh(); }
      },true);
      $('phones').append(row);
    }
    await renderPolicy(policy,p.phones);
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
  }catch(e){if(e.status===401){authMode();}else tell(e.message);}
}
let policyMeta=null,policyVersion=0;
const labels={intervalMs:'Send gap (ms)',maxPending:'Pending queue maximum',waitMs:'Queue wait (ms)',broadcastIntervalMs:'Broadcast gap (ms)',maxLists:'Lists per phone',maxRecipients:'Recipients per list',dailyRecipients:'Reserved recipients per rolling 24 hours',activeJobs:'Active broadcast jobs globally',submissionTimeoutMs:'Broadcast submission timeout (ms)',historyDays:'Job retention (days)'};
function fields(container,keys,values,optional){
 const el=$(container);el.replaceChildren();
 for(const key of keys){const [env,def,min,max]=policyMeta.fields[key];const label=document.createElement('label');label.textContent=(labels[key]||key)+' ('+min+'–'+max+')';const input=document.createElement('input');input.type='number';input.min=min;input.max=max;input.step='1';input.dataset.key=key;input.required=!optional;input.value=values[key]??'';if(optional)input.placeholder='Inherit global';label.append(input);el.append(label);}
}
function readPolicy(container){const value={};for(const input of $(container).querySelectorAll('input[data-key]'))if(input.value!=='')value[input.dataset.key]=Number(input.value);return value;}
async function loadSessionPolicy(){
 const phone=$('policyPhone').value,version=++policyVersion;
 if(!phone){$('sessionPolicyFields').replaceChildren();$('effectivePolicy').textContent='No active phone selected';return;}
 const data=await api('/phones/'+encodeURIComponent(phone)+'/sending-policy');
 if(version!==policyVersion||$('policyPhone').value!==phone)return;
 fields('sessionPolicyFields',policyMeta.sessionKeys,data.override,true);
 $('effectivePolicy').textContent='Effective: '+Object.entries(data.effective).map(([k,v])=>(labels[k]||k)+': '+v).join(' | ');
}
async function renderPolicy(meta,phones){
 policyMeta=meta;fields('globalPolicyFields',Object.keys(meta.fields),meta.global,false);
 const select=$('policyPhone'),selected=select.value;select.replaceChildren();
 for(const row of phones.filter(x=>!x.revokedAt)){const opt=document.createElement('option');opt.value=row.phone;opt.textContent=row.phone;select.append(opt);}
 if([...select.options].some(x=>x.value===selected))select.value=selected;
 await loadSessionPolicy();
}
$('policyPhone').onchange=()=>loadSessionPolicy().catch(e=>tell(e.message));
submit('globalPolicyForm',async()=>{await api('/sending-policy','PUT',{policy:readPolicy('globalPolicyFields')});tell('Global policy saved');await refresh();});
submit('sessionPolicyForm',async()=>{const phone=$('policyPhone').value;if(!phone)throw new Error('Select an active phone');await api('/phones/'+encodeURIComponent(phone)+'/sending-policy','PUT',{override:readPolicy('sessionPolicyFields')});tell('Session policy saved');await loadSessionPolicy();});
$('inheritPolicy').onclick=async()=>{try{const phone=$('policyPhone').value;if(!phone)return;await api('/phones/'+encodeURIComponent(phone)+'/sending-policy','PUT',{override:null});await loadSessionPolicy();tell('Session inherits global policy');}catch(e){tell(e.message);}};
function date(v){return v?new Date(v).toLocaleString():'—';}
function cell(row,text){const td=document.createElement('td');td.textContent=text;row.append(td);return td;}
function button(parent,label,action,danger){const b=document.createElement('button');b.type='button';b.textContent=label;if(danger)b.className='danger';b.onclick=async()=>{b.disabled=true;try{await action();}catch(e){tell(e.message);if(e.status===401)authMode();}finally{b.disabled=false;}};parent.append(b);}
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
