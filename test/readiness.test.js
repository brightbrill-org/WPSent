'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { deadline, positiveInt, createWatchdog, retryDelay, instrumentAttachment } = require('../utils/readiness');

test('readiness deadline rejects a stalled operation and propagates errors', async () => {
  assert.equal(await deadline(()=>42,100,'test'),42);
  await assert.rejects(deadline(()=>new Promise(()=>{}),10,'callback'), {code:'WA_READY_TIMEOUT'});
  await assert.rejects(deadline(()=>{throw Error('original');},100,'test'), /original/);
});
test('watchdog starts only once, cancels and can be restarted', () => {
  let scheduled=0, fired=0;
  const timers=new Map();
  const w=createWatchdog({timeoutMs:120,onTimeout:()=>fired++,setTimer(fn,ms){assert.equal(ms,120);timers.set(++scheduled,fn);return scheduled;},clearTimer(id){timers.delete(id);}});
  w.start();w.start();assert.equal(scheduled,1);
  w.stop();assert.equal(timers.size,0);
  w.start();timers.get(2)();assert.equal(fired,1);
  w.start();assert.equal(scheduled,3);
  w.stop();
});
test('retry delay grows exponentially and is capped; explicit zero retries accepted',()=>{
  assert.deepEqual([1,2,3,20].map(n=>retryDelay(n,5000)),[5000,10000,20000,300000]);
  assert.equal(positiveInt('0',3,0,20),0);
  assert.equal(positiveInt('',3,0,20),3);
  assert.equal(positiveInt('bad',3,0,20),3);
});
test('attachment traces actual callbacks, restores page methods and preserves result', async()=>{
  const logs=[], failures=[];
  const page={async evaluate(fn,...args){return fn(...args);},async exposeFunction(){return 'ok';}};
  const originalEvaluate=page.evaluate, originalExpose=page.exposeFunction;
  const client={pupPage:page,async attachEventListeners(){await page.evaluate(()=>false,'onArchiveChatEvent');await page.exposeFunction('onArchiveChatEvent',()=>{});await page.evaluate(()=>true);return 'attached';}};
  instrumentAttachment(client,{timeoutMs:100,log:x=>logs.push(x),onFailure:e=>failures.push(e)});
  assert.equal(await client.attachEventListeners(),'attached');
  assert.ok(logs.some(x=>x.startsWith('complete expose onArchiveChatEvent')));
  assert.equal(failures.length,0);
  assert.equal(page.evaluate,originalEvaluate);assert.equal(page.exposeFunction,originalExpose);
});
test('stalled callback identifies exact binding and fails attachment rather than skipping it',async()=>{
  const logs=[],failures=[];
  let final=false;
  const page={async evaluate(){return false;},exposeFunction(){return new Promise(()=>{});}};
  const originalExpose=page.exposeFunction;
  const client={pupPage:page,async attachEventListeners(){await page.evaluate(()=>false,'onArchiveChatEvent');await page.exposeFunction('onArchiveChatEvent',()=>{});final=true;}};
  instrumentAttachment(client,{timeoutMs:10,log:x=>logs.push(x),onFailure:e=>failures.push(e)});
  await assert.rejects(client.attachEventListeners(), /expose onArchiveChatEvent timed out/);
  assert.equal(final,false);assert.equal(failures.length,1);
  assert.ok(logs.some(x=>x.startsWith('failed expose onArchiveChatEvent')));
  assert.equal(page.exposeFunction,originalExpose);
});
test('concurrent attachment calls share the same operation',async()=>{
  let count=0,release;
  const page={async evaluate(){},async exposeFunction(){}};
  const client={pupPage:page,async attachEventListeners(){count++;await new Promise(r=>release=r);}};
  instrumentAttachment(client,{timeoutMs:100,log:()=>{},onFailure:()=>{}});
  const a=client.attachEventListeners(),b=client.attachEventListeners();
  assert.equal(a,b);await Promise.resolve();release();await a;assert.equal(count,1);
});
