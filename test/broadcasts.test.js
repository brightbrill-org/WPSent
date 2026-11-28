'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const v=require('../utils/broadcastValidation');
const {createPacer,config}=require('../utils/outboundPacer');
test('broadcast recipients require consent source, unique international phone and limit',()=>{
  assert.equal(v.recipients([{phone:'+919000000001',consent:true,consentSource:'record 1'}])[0].phone,'919000000001');
  assert.throws(()=>v.recipients([{phone:'919000000001',consent:false}]),{status:400});
  assert.throws(()=>v.recipients(Array(26).fill({})),{status:400});
  const x={phone:'919000000001',consent:true,consentSource:'record'};
  assert.throws(()=>v.recipients([x,x]),{status:400});
  assert.throws(()=>v.phone('123@g.us'),{status:400});
});
test('broadcast send requires consent confirmation and request id, rejects mixed types',()=>{
  const b={message:'Update',requestId:'request-123',confirmConsent:true};
  assert.equal(v.job(b).payload.message,'Update');assert.equal(v.job(b).requestId,'request-123');
  for(const x of [{...b,confirmConsent:false},{...b,image:{}},{...b,requestId:''}])assert.throws(()=>v.job(x),{status:400});
});
test('pacer serializes dispatch and waits after completion',async()=>{
  const p=createPacer({intervalMs:15,maxPending:4,waitMs:1000});let active=0,max=0,finish=0;
  const a=p.submit(async()=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,5));active--;finish=Date.now();});
  const b=p.submit(async()=>{active++;max=Math.max(max,active);assert.ok(Date.now()-finish>=10);active--;});
  await Promise.all([a,b]);assert.equal(max,1);p.close();
});
test('pacer rejects overflow and expired queued work without dispatch',async()=>{
  const p=createPacer({intervalMs:0,maxPending:1,waitMs:20});let release,ran=false;
  const a=p.submit(()=>new Promise(r=>{release=r;}));const b=p.submit(()=>{ran=true;});
  await assert.rejects(p.submit(()=>{}),{code:'WA_SEND_BUSY'});
  await assert.rejects(b,{code:'WA_SEND_QUEUE_TIMEOUT'});assert.equal(ran,false);release();await a;p.close();
});
test('shutdown drops pending sends without releasing active operation',async()=>{
  const p=createPacer({intervalMs:0,maxPending:2,waitMs:1000});let release;
  const a=p.submit(()=>new Promise(r=>{release=r;}));const b=p.submit(()=>assert.fail('must not dispatch'));
  p.close();await assert.rejects(b,{code:'WA_SEND_STOPPED'});await assert.rejects(p.submit(()=>{}),{code:'WA_SEND_STOPPED'});
  release();await a;
});
test('pacing config defaults and rejects out-of-range values',()=>{
  assert.deepEqual(config({}),{intervalMs:1000,maxPending:4,waitMs:5000});
  assert.equal(config({WA_SEND_INTERVAL_MS:'0'}).intervalMs,0);
  assert.equal(config({WA_SEND_QUEUE_MAX:'999'}).maxPending,4);
});
