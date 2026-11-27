'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const rows = [];
const blocked = new Set();
let limit = 1, cleanupFails = false, cleanupCalls = 0;
function matches(row, q) {
  return Object.entries(q).every(([key,value]) => value === null ? row[key] == null : row[key] === value);
}
const WpUser = {
  async findOne(q) { return rows.find(r => matches(r,q)) || null; },
  async countDocuments(q) { return rows.filter(r => matches(r,q)).length; },
  async exists(q) { return rows.some(r => matches(r,q)); },
  async create(row) { rows.push({...row}); },
  async updateOne(q, update) {
    const row = rows.find(r => matches(r,q));
    if(row) Object.assign(row,update.$set || update);
    return {matchedCount:row?1:0};
  }
};
function stub(path, exports) {
  const id=require.resolve(path);
  require.cache[id]={id,filename:id,loaded:true,exports};
}
stub('../routes/modelAccess',{WpUser,MessageLog:{}});
stub('../services/adminStore',{
  getPhoneLimit:async()=>limit,
  assertActor:async(email,token)=>{assert.equal(email,'admin@example.test');assert.equal(token,'admin-token');}
});
stub('../waManager',{
  sanitizePhone:raw=>String(raw).replace(/\D/g,''),
  isPhoneBlocked:phone=>blocked.has(phone),
  blockPhone:phone=>blocked.add(phone),
  createSession:phone=>assert.equal(blocked.has(phone),false),
  async destroySession(phone, opts){
    assert.equal(blocked.has(phone),true);
    assert.ok(rows.find(r=>r.phone===phone).revokedAt);
    assert.equal(opts.wipe,true);
    cleanupCalls++;
    if(cleanupFails)throw Error('test cleanup failure');
  }
});
const auth = require('../routes/auth');
const admin = require('../routes/admin');
const handlers = new Map();
const router = {};
for(const method of ['get','post','put']) router[method]=(path,...chain)=>handlers.set(method+' '+path,chain);
auth(router);admin(router);
function response(){
  return {code:200,set(){return this;},status(code){this.code=code;return this;},json(body){this.body=body;return this;},cookie(){},end(){},headersSent:false};
}
async function call(route, req){
  const res=response();
  await handlers.get(route).at(-1)(req,res,()=>{});
  return res;
}
test('registration capacity is serialized and revoked phones cannot self-register', async()=>{
  const start=phone=>call('post /auth/start',{body:{phone},secure:false,method:'POST',path:'/auth/start'});
  const [a,b]=await Promise.all([start('919000000001'),start('919000000002')]);
  assert.deepEqual([a.code,b.code].sort(),[200,503]);
  assert.equal(rows.length,1);
  const phone=rows[0].phone;
  assert.equal((await start(phone)).body.existing,true);
  const revoke=()=>call('post /admin/api/phones/:phone/revoke',{params:{phone},admin:{email:'admin@example.test'},signedCookies:{wpsent_admin:'admin-token'}});
  cleanupFails=true;
  assert.equal((await revoke()).code,409);
  assert.ok(rows[0].revokedAt);
  assert.equal(rows[0].revocationCompleteAt,undefined);
  assert.equal((await start(phone)).code,403);
  cleanupFails=false;
  assert.equal((await revoke()).code,200);
  assert.ok(rows[0].revocationCompleteAt);
  assert.equal(cleanupCalls,2);
  assert.equal((await start('919000000003')).code,200);
  limit=0;
  assert.equal((await start('919000000004')).code,503);
  assert.equal((await start('919000000003')).body.existing,true);
});
