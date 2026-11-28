'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Loading the router must not launch a browser or connect to MongoDB.
const waPath = require.resolve('../waManager');
require.cache[waPath] = {
  id: waPath,
  filename: waPath,
  loaded: true,
  exports: {}
};

const router = require('../routes');
const { requireKey, requireDashboard } = require('../routes/authMiddleware');
const { requireAdmin, requireMutation } = require('../routes/admin');
const { setSession, startPairing, getPairing, pending } = require('../routes/authState');
const landingHTML = require('../views/landing');
const dashboardHTML = require('../views/dashboard');
const docsHTML = require('../views/docs');

const expected = [
  ['get', '/', null],
  ['get', '/docs/postman.json', null],
  ['get', '/docs', null],
  ['post', '/auth/start', null],
  ['post', '/auth/login', null],
  ['post', '/auth/reset', null],
  ['post', '/auth/reset/confirm', null],
  ['get', '/auth/claim', null],
  ['get', '/auth/qr-stream', null],
  ['get', '/dashboard', requireDashboard],
  ['get', '/logout', null],
  ['get', '/api/me', requireDashboard],
  ['get', '/api/status', requireDashboard],
  ['post', '/api/rescan', requireDashboard],
  ['get', '/api/qr-stream', requireDashboard],
  ['get', '/api/logs-stream', requireDashboard],
  ['post', '/send', requireKey],
  ['post', '/seen', requireKey],
  ['post', '/reply', requireKey],
  ['get', '/logs', requireKey],
  ['get', '/status', requireKey],
  ['post', '/webhooks', requireKey],
  ['delete', '/webhooks/:id', requireKey],
  ['patch', '/webhooks/:id', requireKey],
  ['get', '/lid/resolve', requireKey],
  ['get', '/chats', requireKey],
  ['get', '/contacts', requireKey],
  ['get', '/admin', null],
  ['post', '/admin/api/signup', requireMutation],
  ['post', '/admin/api/login', requireMutation],
  ['post', '/admin/api/logout', requireMutation],
  ['get', '/admin/api/me', requireAdmin],
  ['get', '/admin/api/phones', requireAdmin],
  ['put', '/admin/api/phone-limit', requireAdmin],
  ['post', '/admin/api/phones/:phone/revoke', requireAdmin],
  ['get', '/admin/api/admins', requireAdmin],
  ['post', '/admin/api/admins/approve', requireAdmin],
  ['post', '/admin/api/admins/revoke', requireAdmin],
  ['post', '/admin/api/admins/password', requireAdmin],
  ['get', '/media/:id', requireKey],
  ['get', '/api/media/:id', requireDashboard],
  ['post', '/groups', requireKey],
  ['post', '/groups/:groupId/participants', requireKey],
  ['delete', '/groups/:groupId/participants', requireKey],
  ['patch', '/groups/:groupId/subject', requireKey],
  ['patch', '/groups/:groupId/description', requireKey],
  ['get', '/groups/:groupId/invite', requireKey],
  ['get', '/polls/:messageId/results', requireKey],
  ['post', '/polls/:messageId/vote', requireKey],
  ['get', '/sending/settings', requireKey],
  ['get', '/broadcasts', requireKey],
  ['post', '/broadcasts', requireKey],
  ['get', '/broadcasts/jobs', requireKey],
  ['get', '/broadcasts/jobs/:jobId', requireKey],
  ['post', '/broadcasts/jobs/:jobId/cancel', requireKey],
  ['post', '/broadcasts/opt-out', requireKey],
  ['get', '/broadcasts/:id', requireKey],
  ['patch', '/broadcasts/:id', requireKey],
  ['delete', '/broadcasts/:id', requireKey],
  ['post', '/broadcasts/:id/recipients', requireKey],
  ['delete', '/broadcasts/:id/recipients', requireKey],
  ['post', '/broadcasts/:id/send', requireKey]
];

test('all existing routes retain method, path, registration order and auth guard', () => {
  const actual = router.stack.map(layer => {
    const r = layer.route;
    assert.ok(r, 'expected a direct route registration');
    const guard = r.stack.length > 1 ? r.stack[0].handle : null;
    return [Object.keys(r.methods)[0], r.path, guard];
  });
  assert.deepEqual(actual, expected);
});

test('protected dashboard API rejects missing signed cookie', async () => {
  const response = {
    statusCode: 200,
    clearCookie() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; }
  };
  await requireDashboard({ path: '/api/me', signedCookies: {} }, response, () => assert.fail('unauthenticated'));
  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: 'Not signed in' });
});

test('public messaging API rejects missing credentials', async () => {
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; }
  };
  await requireKey({ query: {}, headers: {} }, response, () => assert.fail('unauthenticated'));
  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: 'Missing clientid' });
});

test('pairing state remains shared and signed cookies retain security options', () => {
  const phone = '1234567890';
  const cookies = {};
  const req = { secure: true, signedCookies: {} };
  const res = { cookie(name, value, options) { cookies[name] = { value, options }; } };
  try {
    startPairing(req, res, phone, true);
    req.signedCookies.wpsent_pair = cookies.wpsent_pair.value;
    assert.equal(getPairing(req).phone, phone);
    assert.equal(getPairing(req).rotate, true);
    assert.equal(getPairing({ signedCookies: { wpsent_pair: phone + ':wrong' } }), null);
    setSession(req, res, { phone, apiKey: 'test-key' });
    for (const { options } of Object.values(cookies)) {
      assert.equal(options.httpOnly, true);
      assert.equal(options.signed, true);
      assert.equal(options.secure, true);
      assert.equal(options.sameSite, 'lax');
    }
  } finally { pending.delete(phone); }
});

test('page renderers retain existing titles and dynamic values', () => {
  assert.match(landingHTML(), /<title>WPSent - WhatsApp API Gateway<\/title>/);
  const dashboard = dashboardHTML({ phone: '1234567890' });
  assert.match(dashboard, /<title>WPSent Dashboard<\/title>/);
  assert.ok(dashboard.includes('1234567890'));
  const docs = docsHTML('https://example.test');
  assert.match(docs, /<title>WPSent API Docs<\/title>/);
  assert.ok(docs.includes('https://example.test'));
});

const wa = require('../waManager');
const lidRoute = router.stack.find(layer => layer.route?.path === '/lid/resolve').route;
const lidHandler = lidRoute.stack[1].handle;
function lidResponse() {
  return {
    statusCode: 200, headers: {},
    set(key, value) { this.headers[key] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('LID lookup rejects missing or malformed IDs and duplicate parameters', async () => {
  for (const lid of [undefined, '1234', '919876543210@c.us', '123@g.us', ['123@lid', '456@lid']]) {
    const res = lidResponse();
    await lidHandler({ query: { lid }, wpUser: { phone: 'account-a' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.headers['Cache-Control'], 'no-store');
  }
});

test('LID lookup uses only authenticated account, returns resolved and unresolved results', async () => {
  const lid = '123456789012345@lid';
  for (const phone of ['919876543210', null]) {
    wa.resolveLid = async (account, id) => {
      assert.equal(account, 'account-a');
      assert.equal(id, lid);
      return { lid, phone, phoneId: phone ? phone + '@c.us' : null, resolved: !!phone };
    };
    const res = lidResponse();
    await lidHandler({ query: { lid, phone: 'other-account' }, wpUser: { phone: 'account-a' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true, lid, phone, phoneId: phone ? phone + '@c.us' : null, resolved: !!phone });
  }
});

test('LID lookup returns 503 for a session that is not ready', async () => {
  wa.resolveLid = async () => { throw Object.assign(new Error('not ready'), { code: 'WA_NOT_READY' }); };
  const res = lidResponse();
  await lidHandler({ query: { lid: '123@lid' }, wpUser: { phone: 'account-a' } }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, 'WhatsApp session not ready');
});

test('API documentation includes the authenticated LID endpoint', () => {
  const docs = docsHTML('https://example.test');
  assert.ok(docs.includes('/lid/resolve'));
  assert.ok(docs.includes('resolved'));
});

test('administrator guard rejects anonymous requests', async () => {
  const res = { set(){}, status(code){this.code=code;return this;},json(body){this.body=body;} };
  await requireAdmin({signedCookies:{}},res,()=>assert.fail('anonymous'));
  assert.equal(res.code,401);
});
test('administrator mutations reject missing CSRF header and foreign origins', () => {
  const res = {status(code){this.code=code;return this;},json(body){this.body=body;}};
  requireMutation({get:()=>undefined,is:()=>true},res,()=>assert.fail('missing header'));
  assert.equal(res.code,403);
  const headers={'x-wpsent-admin':'1','origin':'https://other.test','host':'wpsent.xyz'};
  requireMutation({get:k=>headers[k],is:()=>true,protocol:'https'},res,()=>assert.fail('foreign origin'));
  assert.equal(res.code,403);
  headers.origin='https://wpsent.xyz';
  let accepted=false;
  requireMutation({get:k=>headers[k],is:()=>true,protocol:'https'},res,()=>{accepted=true;});
  assert.equal(accepted,true);
});

const sendHandler=router.stack.find(layer=>layer.route?.path==='/send').route.stack[1].handle;
test('send rejects malformed or mixed share payload before dispatch',async()=>{
  wa.sanitizePhone=x=>x.replace(/\D/g,'');
  wa.sendMessage=async()=>assert.fail('invalid share must not send');
  for(const body of [{location:{latitude:91,longitude:0}},{contact:null},{contact:{name:'A',phone:'919000000002'},message:'hi'}]){
    const res=lidResponse();
    await sendHandler({query:{to:'919000000001'},body,wpUser:{phone:'account-a'}},res);
    assert.equal(res.statusCode,400);
  }
});
test('documentation and Postman expose both native share requests',()=>{
  const docs=docsHTML('https://example.test');
  assert.ok(docs.includes('Contact card'));assert.ok(docs.includes('Location pin'));
  const items=require('../docs/WPSent.postman_collection.json').item.find(x=>x.name==='WhatsApp API').item;
  for(const name of ['Send contact card','Send location pin']){
    const request=items.find(x=>x.name===name).request;
    assert.equal(request.method,'POST');assert.equal(request.url,'{{baseUrl}}/send');
    assert.doesNotThrow(()=>JSON.parse(request.body.raw));
  }
});

test('webhook registration rejects unsupported event names before database access',async()=>{
  const handler=router.stack.find(layer=>layer.route?.path==='/webhooks'&&layer.route.methods.post).route.stack[1].handle;
  for(const event of ['other',null,[],{}]){
    const res=lidResponse();
    await handler({body:{url:'https://example.test/hook',event},wpUser:{_id:'owner-a'}},res);
    assert.equal(res.statusCode,400);
  }
});
test('rescan webhook is independently selectable in dashboard docs and Postman',()=>{
  const docs=docsHTML('https://example.test');
  assert.ok(docs.includes('auth_rescan_required'));
  assert.ok(dashboardHTML({phone:'1234567890'}).includes('id="wh-event"'));
  const items=require('../docs/WPSent.postman_collection.json').item.find(x=>x.name==='WhatsApp API').item;
  const body=JSON.parse(items.find(x=>x.name==='Add authentication rescan webhook').request.body.raw);
  assert.equal(body.event,'auth_rescan_required');
});

test('inbound media download scopes lookup to current owner and forces attachment',async()=>{
  const {downloadHandler}=require('../routes/media');
  const id='12345678-1234-4234-8234-123456789012';
  wa.isPhoneBlocked=()=>false;
  const request={params:{id},wpUser:{_id:'owner-a',phone:'account-a'}};
  const res={...lidResponse(),attachment(name){this.filename=name;return this;},type(type){this.mime=type;return this;},send(bytes){this.bytes=bytes;return this;}};
  await downloadHandler(async(key,owner)=>{assert.equal(key,id);assert.equal(owner,'owner-a');return {filename:'file.html',data:Buffer.from('test')};})(request,res);
  assert.equal(res.filename,'file.html');assert.equal(res.mime,'application/octet-stream');assert.equal(res.bytes.toString(),'test');
  assert.equal(res.headers['Cache-Control'],'private, no-store');
  const missing=lidResponse();await downloadHandler(async()=>null)(request,missing);assert.equal(missing.statusCode,404);
  const invalid=lidResponse();await downloadHandler(()=>assert.fail('invalid id'))({...request,params:{id:'bad'}},invalid);assert.equal(invalid.statusCode,404);
});

test('directory endpoints validate query, use authenticated account and no-store',async()=>{
  for(const kind of ['chats','contacts']){
    const handler=router.stack.find(layer=>layer.route?.path==='/'+kind).route.stack[1].handle;
    wa.listDirectory=async(phone,k,q)=>{assert.equal(phone,'owner-a');assert.equal(k,kind);assert.equal(q.limit,10);return {ok:true,items:[]};};
    const res=lidResponse();
    await handler({query:{limit:'10',phone:'other-account'},wpUser:{phone:'owner-a'}},res);
    assert.equal(res.statusCode,200);assert.equal(res.headers['Cache-Control'],'private, no-store');
    const bad=lidResponse();await handler({query:{limit:['10','20']},wpUser:{phone:'owner-a'}},bad);assert.equal(bad.statusCode,400);
  }
});
test('directory unavailable and timeout are explicit HTTP errors',async()=>{
  const handler=router.stack.find(layer=>layer.route?.path==='/chats').route.stack[1].handle;
  for(const [code,status] of [['WA_NOT_READY',503],['WA_DIRECTORY_BUSY',503],['WA_DIRECTORY_UNAVAILABLE',503],['WA_DIRECTORY_TIMEOUT',504]]){
    wa.listDirectory=async()=>{throw Object.assign(new Error('test'),{code});};
    const res=lidResponse();await handler({query:{},wpUser:{phone:'owner-a'}},res);assert.equal(res.statusCode,status);
  }
});

test('seen and reply routes reject invalid inputs before dispatch',async()=>{
  for(const [path,body,method] of [['/seen',{chatId:'status@broadcast'},'markSeen'],['/reply',{messageId:'123',message:'test'},'replyMessage']]){
    wa[method]=()=>assert.fail('invalid request must not dispatch');
    const handler=router.stack.find(layer=>layer.route?.path===path).route.stack[1].handle;
    const res=lidResponse();await handler({body,wpUser:{phone:'a'}},res);
    assert.equal(res.statusCode,400);
  }
});
test('seen route uses owning account and reports success or unavailable session',async()=>{
  const handler=router.stack.find(layer=>layer.route?.path==='/seen').route.stack[1].handle;
  wa.markSeen=async(phone,chatId)=>{assert.equal(phone,'a');return {ok:true,chatId,seen:true};};
  const req={body:{chatId:'919000000001',phone:'other'},wpUser:{phone:'a'}};
  const res=lidResponse();await handler(req,res);assert.equal(res.body.chatId,'919000000001@c.us');assert.equal(res.body.seen,true);
  wa.markSeen=async()=>{throw Object.assign(new Error('not ready'),{code:'WA_NOT_READY'});};
  const bad=lidResponse();await handler(req,bad);assert.equal(bad.statusCode,503);
});
test('action docs and Postman contain both authenticated requests',()=>{
  const docs=docsHTML('https://example.test');
  assert.ok(docs.includes('/seen'));assert.ok(docs.includes('/reply'));
  const items=require('../docs/WPSent.postman_collection.json').item.find(x=>x.name==='WhatsApp API').item;
  for(const [name,path] of [['Mark chat as seen','seen'],['Reply to message','reply']]){
    const req=items.find(x=>x.name===name).request;
    assert.equal(req.url,'{{baseUrl}}/'+path);assert.equal(req.method,'POST');assert.doesNotThrow(()=>JSON.parse(req.body.raw));
  }
});

test('group routes validate input and dispatch only for owning account',async()=>{
  const handler=router.stack.find(layer=>layer.route?.path==='/groups').route.stack[1].handle;
  wa.groupAction=async(phone,action,request)=>{assert.equal(phone,'owner-a');assert.equal(action,'create');assert.equal(request.subject,'Test');return {ok:true,groupId:'123@g.us'};};
  const res=lidResponse();await handler({body:{subject:'Test',participants:['919000000001'],phone:'other'},wpUser:{phone:'owner-a'}},res);assert.equal(res.statusCode,201);
  const bad=lidResponse();await handler({body:{subject:''},wpUser:{phone:'owner-a'}},bad);assert.equal(bad.statusCode,400);
});
test('group permissions and timeout failures map to explicit HTTP status',async()=>{
  const handler=router.stack.find(layer=>layer.route?.path==='/groups/:groupId/invite').route.stack[1].handle;
  for(const [code,status] of [['WA_GROUP_FORBIDDEN',403],['WA_GROUP_NOT_FOUND',404],['WA_GROUP_TIMEOUT',504],['WA_NOT_READY',503]]){
    wa.groupAction=async()=>{throw Object.assign(new Error('test'),{code});};
    const res=lidResponse();await handler({params:{groupId:'123@g.us'},wpUser:{phone:'owner-a'}},res);assert.equal(res.statusCode,status);
  }
});
test('group management docs and all six Postman requests are present',()=>{
  assert.ok(docsHTML('https://example.test').includes('id="groups"'));
  const folder=require('../docs/WPSent.postman_collection.json').item.find(x=>x.name.startsWith('Group management'));
  assert.equal(folder.item.length,6);
  for(const item of folder.item)if(item.request.body)assert.doesNotThrow(()=>JSON.parse(item.request.body.raw));
});

test('native media rejects invalid formats and mixed payload before dispatch',async()=>{
  wa.sanitizePhone=x=>x.replace(/\D/g,'');
  wa.sendNativeMedia=()=>assert.fail('invalid media must not dispatch');
  for(const body of [{image:null},{video:{mimetype:'video/avi',data:'AAAA'}},{voiceNote:{mimetype:'audio/mpeg',data:'AAAA'}},{image:{},message:'hello'}]){
    const res=lidResponse();
    await sendHandler({query:{to:'919000000001'},body,wpUser:{phone:'owner-a'}},res);
    assert.equal(res.statusCode,400);
  }
});
test('native media documentation and all three Postman send requests are present',()=>{
  assert.ok(docsHTML('https://example.test').includes('id="native-media"'));
  const items=require('../docs/WPSent.postman_collection.json').item.find(x=>x.name==='WhatsApp API').item;
  for(const [name,kind] of [['Send native image','image'],['Send native video','video'],['Send voice note','voiceNote']]){
    const request=items.find(x=>x.name===name).request;
    assert.equal(request.url,'{{baseUrl}}/send');assert.ok(JSON.parse(request.body.raw)[kind]);
  }
});

test('documentation sidebar links cover every main section exactly once and in content order',()=>{
  const html=docsHTML('https://example.test');
  const sidebar=html.split('<div class="sb">')[1].split('</div>')[0];
  const doc=html.split('<div class="doc">')[1];
  const links=Array.from(sidebar.matchAll(/href="#([^"]+)"/g),m=>m[1]);
  const headings=Array.from(doc.matchAll(/<h[12]\s+id="([^"]+)"/g),m=>m[1]);
  assert.equal(new Set(links).size,links.length);
  assert.deepEqual(links,headings);
});

test('poll routes validate message ID and scope results to authenticated account',async()=>{
  const handler=router.stack.find(x=>x.route?.path==='/polls/:messageId/results').route.stack[1].handle;
  wa.pollActions={results:async(phone,id)=>{assert.equal(phone,'owner');return {ok:true,messageId:id};}};
  const res=lidResponse();await handler({params:{messageId:'false_919000000001@c.us_EXAMPLE'},wpUser:{phone:'owner'}},res);assert.equal(res.body.ok,true);
  const bad=lidResponse();await handler({params:{messageId:'bad'},wpUser:{phone:'owner'}},bad);assert.equal(bad.statusCode,400);
});
