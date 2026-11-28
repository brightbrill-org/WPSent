'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {EXAMPLES,buildExample}=require('../utils/dashboardExamples');
const dashboard=require('../views/dashboard');
const collection=require('../docs/WPSent.postman_collection.json');
test('dashboard examples cover every public API Postman request and exclude admin operations',()=>{
  const expected=collection.item.filter(x=>x.name==='WhatsApp API'||x.name.startsWith('Group management')).flatMap(x=>x.item);
  for(const item of expected){
    const example=EXAMPLES.find(x=>x.name===item.name);
    assert.ok(example,item.name);
    assert.equal(example.method,item.request.method);
    assert.equal(example.path,item.request.url.replace('{{baseUrl}}',''));
    assert.deepEqual(example.body,item.request.body?.raw?JSON.parse(item.request.body.raw):undefined);
  }
  assert.ok(EXAMPLES.every(x=>!x.path.startsWith('/admin')));
});
test('all languages use actual origin and header placeholders, never query credentials',()=>{
  for(const origin of ['https://custom.example:8443','http://localhost:3000'])for(const example of EXAMPLES)for(const lang of ['curl','node','py']){
    const code=buildExample(example,origin,lang);
    assert.ok(code.includes(origin+example.path.split('{{')[0]));
    assert.ok(code.includes('YOUR_CLIENT_ID')&&code.includes('YOUR_API_KEY'));
    assert.ok(code.includes('x-client-id')&&code.includes('x-api-key'));
    assert.ok(!code.includes('wpsent.xyz')&&!code.includes('{{'));
    if(lang==='node')assert.doesNotThrow(()=>new Function(code));
  }
});
test('binary downloads write files in every language',()=>{
  const example=EXAMPLES.find(x=>x.name==='Download inbound media');
  assert.match(buildExample(example,'http://localhost:3000','curl'),/--output received-media/);
  assert.match(buildExample(example,'http://localhost:3000','node'),/arrayBuffer/);
  assert.match(buildExample(example,'http://localhost:3000','py'),/r\.content/);
});
test('dashboard embeds valid browser script with operation and language controls and dynamic origin',()=>{
  const html=dashboard({phone:'1234567890'});
  assert.ok(html.includes('id="ex-operation"')&&html.includes('id="ex-language"'));
  assert.ok(html.includes('window.location.origin'));
  assert.ok(!html.includes('https://wpsent.xyz'));
  const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(()=>new Function(script));
});
test('Python examples preserve JSON booleans and shell examples quote apostrophes',()=>{
  const example={method:'POST',path:'/send',body:{message:"It's ready",markSeen:false}};
  assert.match(buildExample(example,'http://localhost:3000','py'),/json\.loads/);
  assert.ok(buildExample(example,'http://localhost:3000','curl').includes("'\"'\"'"));
});
