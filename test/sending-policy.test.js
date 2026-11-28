'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {defaults,validate,effective}=require('../utils/sendingPolicy');
const {createPacer}=require('../utils/outboundPacer');
test('environment seeds all editable policies with validated bounds',()=>{
 const p=defaults({WA_BROADCAST_MAX_LISTS:'10',WA_SEND_INTERVAL_MS:'2000',WA_BROADCAST_DAILY_RECIPIENTS:'999'});
 assert.equal(p.maxLists,10);assert.equal(p.intervalMs,2000);assert.equal(p.dailyRecipients,100);assert.equal(p.activeJobs,2);
 assert.throws(()=>validate({maxRecipients:26}),{status:400});
 assert.throws(()=>validate({activeJobs:1},true),{status:400});
});
test('session inherits global and cannot weaken resource policy',()=>{
 const g=defaults({WA_SEND_INTERVAL_MS:'2000',WA_BROADCAST_MAX_RECIPIENTS:'10'});
 assert.deepEqual(effective(g),g);
 const p=effective(g,{intervalMs:1000,maxRecipients:25,maxPending:2,broadcastIntervalMs:5000});
 assert.equal(p.intervalMs,2000);assert.equal(p.maxRecipients,10);assert.equal(p.maxPending,2);assert.equal(p.broadcastIntervalMs,5000);
});
test('global and per-session gaps allow eligible other session while preserving serialization',async()=>{
 let g={intervalMs:0,maxPending:4,waitMs:1000};
 const p=createPacer({getGlobal:()=>g,getSession:key=>({...g,intervalMs:key==='a'?50:0})});
 const order=[];await p.submit('a',()=>order.push('a1'));
 await Promise.all([p.submit('a',()=>order.push('a2')),p.submit('b',()=>order.push('b1'))]);
 assert.deepEqual(order,['a1','b1','a2']);p.close();
});
test('live global queue reduction rejects pending work at dispatch',async()=>{
 let g={intervalMs:0,maxPending:4,waitMs:1000},release;
 const p=createPacer({getGlobal:()=>g,getSession:()=>g});
 const active=p.submit('a',()=>new Promise(r=>release=r));
 const one=p.submit('b',()=>1),two=p.submit('c',()=>2);
 const rejected=assert.rejects(two,{code:'WA_SEND_BUSY'});
 g={...g,maxPending:1};p.refresh();await Promise.resolve();release();await active;await one;await rejected;p.close();
});
