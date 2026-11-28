'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { registerRequestBodyParsers, sendLimitMb } = require('../services/requestBody');

async function withServer(run) {
  const app = express();
  const auth = (req,res,next) => {
    if (req.get('x-api-key') !== 'test-key') return res.status(401).json({ error:'Missing or invalid key' });
    // No large body should be parsed before this guard.
    if (req.body !== undefined) return res.status(500).json({ error:'Parsed before auth' });
    next();
  };
  registerRequestBodyParsers(app, auth, '1');
  const echo = (req,res) => res.json({ size: req.body?.document?.data?.length || 0, message: req.body?.message || null });
  app.post('/send', echo);
  app.post('/broadcasts/:id/send', echo);
  app.post('/admin/api/example', echo);
  app.use((err,req,res,next) => res.status(err.status || 500).json({error:err.message}));
  const server = await new Promise(resolve => {
    const s = app.listen(0,'127.0.0.1',()=>resolve(s));
  });
  const request = (path,body,{key='test-key',contentType='application/json'}={}) => new Promise((resolve,reject) => {
    const data=typeof body==='string'?body:JSON.stringify(body);
    const headers={'Content-Type':contentType,'Content-Length':Buffer.byteLength(data)};
    if(key) headers['x-api-key']=key;
    const req=http.request({host:'127.0.0.1',port:server.address().port,path,method:'POST',headers},res=>{
      let out='';
      res.setEncoding('utf8');
      res.on('data',chunk=>out+=chunk);
      res.on('end',()=>{try{resolve({status:res.statusCode,body:JSON.parse(out)});}catch(e){reject(e);}});
      res.on('error',reject);
    });
    req.on('error',reject);req.end(data);
  });
  try { await run(request); }
  finally { await new Promise(resolve=>server.close(resolve)); }
}
const media = bytes => ({to:'919000000001',document:{filename:'image.png',mimetype:'image/png',data:Buffer.alloc(bytes).toString('base64')}});
test('JSON send limit defaults to 20 MiB and caps configuration range',()=>{
  for(const raw of [undefined,'','0','51','1.5','Infinity','abc','-1']) assert.equal(sendLimitMb(raw),20);
  assert.equal(sendLimitMb('1'),1);
  assert.equal(sendLimitMb('50'),50);
});
test('authenticated send accepts JSON above old 100 KiB and retains small text',async()=>{
  await withServer(async request=>{
    const payload=media(192*1024);
    const res=await request('/send',payload);
    assert.equal(res.status,200);
    assert.equal(res.body.size,payload.document.data.length);
    const small=await request('/send',{message:'hello'});
    assert.equal(small.status,200);assert.equal(small.body.message,'hello');
  });
});
test('oversized send, other APIs, and URL-encoded forms retain bounded limits',async()=>{
  await withServer(async request=>{
    const tooBig=await request('/send',media(900*1024));
    assert.equal(tooBig.status,413);
    const admin=await request('/admin/api/example',media(192*1024));
    assert.equal(admin.status,413);
    const form=await request('/send','message='+ 'a'.repeat(110*1024),{contentType:'application/x-www-form-urlencoded'});
    assert.equal(form.status,413);
  });
});
test('unauthenticated large send is rejected before body parsing',async()=>{
  await withServer(async request=>{
    const res=await request('/send',media(192*1024),{key:null});
    assert.equal(res.status,401);
  });
});

test('broadcast uploads authenticate before buffering and retain configured JSON cap',async()=>{
 await withServer(async request=>{
   const path='/broadcasts/example/send';
   assert.equal((await request(path,media(192*1024))).status,200);
   assert.equal((await request(path,media(192*1024),{key:null})).status,401);
   assert.equal((await request(path,media(900*1024))).status,413);
 });
});
