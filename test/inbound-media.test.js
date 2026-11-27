'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createInboundCapture,decodeMedia,restricted,filename,mediaSettings}=require('../utils/inboundMedia');
const settings={maxBytes:8,retentionMs:3600000,timeoutMs:20,concurrency:1};
const message=(data=Buffer.from('hello').toString('base64'))=>({hasMedia:true,downloadMedia:async()=>({data,mimetype:'image/png',filename:'../../photo.png'})});
test('media capture stores owner-scoped bytes and returns only metadata',async()=>{
  const rows=[];const capture=createInboundCapture({settings,store:async r=>rows.push(r),now:()=>0});
  const result=await capture(message(),'owner-a');
  assert.equal(result.mediaStatus,'available');assert.equal(result.mediaFilename,'photo.png');
  assert.equal(result.mediaDownloadPath,'/media/'+result.mediaId);
  assert.equal(rows[0].userId,'owner-a');assert.equal(rows[0].data.toString(),'hello');
  assert.equal(rows[0].expiresAt.getTime(),3600000);assert.equal(result.data,undefined);
});
test('invalid, oversized and unavailable media are not stored',async()=>{
  const capture=createInboundCapture({settings,store:()=>assert.fail('must not store')});
  assert.equal((await capture(message('bad!'),'a')).mediaStatus,'unavailable');
  assert.equal((await capture(message(Buffer.alloc(9).toString('base64')),'a')).mediaStatus,'too_large');
  assert.equal((await capture({hasMedia:true,downloadMedia:async()=>undefined},'a')).mediaStatus,'unavailable');
  assert.equal(await capture({hasMedia:false},'a'),null);
});
test('view-once and disappearing media are not downloaded',async()=>{
  const capture=createInboundCapture({settings,store:()=>assert.fail('must not store')});
  for(const flags of [{isViewOnce:true},{_data:{isViewOnceV2:true}},{_data:{ephemeralDuration:60}}]){
    assert.equal((await capture({hasMedia:true,...flags,downloadMedia:()=>assert.fail('must not download')},'a')).mediaStatus,'skipped');
  }
});
test('timeout retains browser slot, discards late completion and releases when settled',async()=>{
  let release;const capture=createInboundCapture({settings,store:()=>assert.fail('must not store')});
  const first=capture({hasMedia:true,downloadMedia:()=>new Promise(r=>release=r)},'a');
  assert.equal((await capture(message(),'b')).mediaStatus,'busy');
  assert.equal((await first).mediaStatus,'timeout');
  assert.equal((await capture(message(),'b')).mediaStatus,'busy');
  release({data:'aGVsbG8='});await new Promise(r=>setImmediate(r));
  assert.equal((await capture({hasMedia:true,downloadMedia:async()=>null},'b')).mediaStatus,'unavailable');
});
test('capture stops when session or account becomes unavailable',async()=>{
  let allowed=true;const capture=createInboundCapture({settings,store:()=>assert.fail('must not store')});
  const msg={hasMedia:true,downloadMedia:async()=>{allowed=false;return {data:'aGVsbG8='};}};
  assert.equal((await capture(msg,'a',()=>allowed)).mediaStatus,'skipped');
});
test('settings and filename sanitization are bounded',()=>{
  assert.equal(mediaSettings({WA_INBOUND_MEDIA_MAX_MB:'99'}).maxBytes,8*1024*1024);
  assert.equal(mediaSettings({WA_INBOUND_MEDIA_MAX_MB:'10'}).maxBytes,10*1024*1024);
  assert.equal(filename('..','id'),'media-id');assert.equal(filename('a\\b.exe','id'),'b.exe');
  assert.equal(decodeMedia('aGVsbG8=',5).bytes.length,5);
});
