'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {summarizeSessions,filterSessions}=require('../utils/adminSessions');
const adminHTML=require('../views/admin');
const rows=Array.from({length:57},(_,i)=>({phone:'91900000'+String(i).padStart(3,'0'),createdAt:new Date(2026,0,i+1).toISOString(),lastSeen:new Date(2026,1,57-i).toISOString(),status:i%3===0?'ready':i%3===1?'initializing':'revoked',revokedAt:i%3===2?'2026-02-01':null,policySource:i%2?'custom':'inherited'}));
test('session summary separates connected, attention and revoked',()=>assert.deepEqual(summarizeSessions(rows),{total:57,registered:38,ready:19,attention:19,revoked:19}));
test('pagination clamps page after filtering and bounds displayed rows',()=>{
 const a=filterSessions(rows,{page:3,pageSize:25});assert.equal(a.items.length,7);assert.equal(a.pages,3);
 const b=filterSessions(rows,{status:'ready',page:3,pageSize:25});assert.equal(b.page,1);assert.equal(b.total,19);assert.ok(b.items.every(x=>x.status==='ready'));
});
test('phone search, policy and status filters combine without mutating input',()=>{
 const before=rows.map(x=>x.phone);
 const result=filterSessions(rows,{search:'+91 900000',status:'attention',policy:'custom',sort:'phone'});
 assert.ok(result.total>0);assert.ok(result.items.every(x=>x.status==='initializing'&&x.policySource==='custom'));assert.deepEqual(rows.map(x=>x.phone),before);
});
test('admin console contains responsive controls and valid browser script',()=>{
 const html=adminHTML();for(const id of ['view-overview','view-sessions','view-policy','view-admins','phoneSearch','statusFilter','policyFilter','pageSize','prevPage','nextPage','policySearch','policyPhone','globalPolicyForm','sessionPolicyForm','limitForm','resetDialog'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.doesNotThrow(()=>new Function(html.match(/<script>([\s\S]*?)<\/script>/)[1]));
});
