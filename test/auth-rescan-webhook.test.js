'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizeWebhookEvent,selectWebhooks,rescanReason}=require('../utils/webhookEvents');
const {createAuthRescanNotifier}=require('../utils/authRescanNotifier');
const message='message_received',auth='auth_rescan_required';
test('legacy and explicit message hooks remain separate from rescan hooks',()=>{
  const hooks=[{id:1,active:true},{id:2,active:true,event:message},{id:3,active:true,event:auth},{id:4,active:false,event:auth},{id:5,active:true,event:'other'}];
  assert.deepEqual(selectWebhooks(hooks,message).map(h=>h.id),[1,2]);
  assert.deepEqual(selectWebhooks(hooks,auth).map(h=>h.id),[3]);
  assert.deepEqual(selectWebhooks(hooks,'other'),[]);
  assert.equal(normalizeWebhookEvent(undefined),message);
  for(const invalid of [null,'',[],{}])assert.equal(normalizeWebhookEvent(invalid),null);
});
test('only explicit logout/unpaired disconnect reasons indicate auth loss',()=>{
  assert.equal(rescanReason('LOGOUT'),'logged_out');
  assert.equal(rescanReason('UNPAIRED'),'unpaired');
  assert.equal(rescanReason('UNPAIRED_IDLE'),'unpaired');
  for(const reason of ['TIMEOUT','CONFLICT','DISCONNECTED','Target closed',null])assert.equal(rescanReason(reason),null);
});
function fixture(){
  const claimed=new Map(),sent=[];
  const create=()=>createAuthRescanNotifier({
    claim:async(phone,date)=>{if(claimed.has(phone))return null;claimed.set(phone,date);return {_id:phone};},
    clear:async phone=>{claimed.delete(phone);},
    deliver:async(user,payload)=>sent.push({user,payload}),
    now:()=>new Date('2026-11-27T10:30:00Z')
  });
  return {create,claimed,sent};
}
test('duplicate alerts suppressed across concurrent QR refresh and process restart, reset on real ready',async()=>{
  const {create,sent}=fixture();let n=create();
  await Promise.all([n.notify('a','qr_required'),n.notify('a','qr_required'),n.notify('a','logged_out')]);
  assert.equal(sent.length,1);
  n=create();await n.notify('a','auth_failure');assert.equal(sent.length,1);
  await n.ready('a');await n.notify('a','auth_failure');assert.equal(sent.length,2);
  assert.equal(sent[1].payload.reason,'auth_failure');assert.notEqual(sent[0].payload.eventId,sent[1].payload.eventId);
});
test('accounts isolated and payload contains only safe authentication alert fields',async()=>{
  const {create,sent}=fixture();const n=create();
  await Promise.all([n.notify('a','logged_out'),n.notify('b','unpaired')]);
  assert.equal(sent.length,2);
  const a=sent.find(x=>x.user==='a').payload;
  assert.deepEqual(Object.keys(a).sort(),['event','eventId','phone','reason','status','timestamp'].sort());
  assert.equal(a.event,auth);assert.equal(a.phone,'a');assert.equal(a.status,'rescan_required');
});
test('blocked and ordinary recovery reasons do not claim notifications',async()=>{
  const {create,claimed,sent}=fixture();const n=create();
  await n.notify('a','qr_required',()=>false);
  await n.notify('a','target_closed');await n.notify('a','watchdog_timeout');
  assert.equal(claimed.size,0);assert.equal(sent.length,0);
});
test('queued ready reset and subsequent authentication loss preserve order',async()=>{
  const {create,sent}=fixture();const n=create();
  await Promise.all([n.notify('a','qr_required'),n.ready('a'),n.notify('a','logged_out')]);
  assert.deepEqual(sent.map(s=>s.payload.reason),['qr_required','logged_out']);
});
