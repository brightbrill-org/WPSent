'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const store = require('../services/adminStore');
const { withControlLock } = require('../services/controlLock');
const adminHTML = require('../views/admin');
const docsHTML = require('../views/docs');
const collection = require('../docs/WPSent.postman_collection.json');

test('admin input validation normalizes email and rejects invalid credentials', () => {
  assert.equal(store.normalizeEmail(' Admin@Example.com '), 'admin@example.com');
  assert.throws(()=>store.normalizeEmail('bad'), {status:400});
  assert.throws(()=>store.validatePassword('short'), {status:400});
  assert.throws(()=>store.validatePassword('x'.repeat(73)), {status:400});
  assert.equal(store.validatePassword('a valid long password'), 'a valid long password');
});
test('registration limit permits unlimited, zero and integer limits only', () => {
  for(const v of [null,0,1,100000]) assert.equal(store.validateLimit(v),v);
  for(const v of [undefined,-1,1.5,'5',100001]) assert.throws(()=>store.validateLimit(v),{status:400});
});
test('control mutations serialize and recover after failures', async () => {
  const order=[];
  const a=withControlLock(async()=>{order.push(1);await new Promise(r=>setTimeout(r,5));order.push(2);throw Error('test');});
  const b=withControlLock(async()=>{order.push(3);});
  await assert.rejects(a);await b;assert.deepEqual(order,[1,2,3]);
});
test('missing and malformed admin tokens are rejected without DB access', async () => {
  assert.equal(await store.currentAdmin(undefined),null);
  assert.equal(await store.currentAdmin('bad'),null);
});
test('admin UI and downloadable documentation are present', () => {
  const html=adminHTML();
  assert.match(html,/Administrator sign-in/);
  assert.match(html,/Registered phones/);
  assert.match(html,/Create administrator account/);
  assert.match(docsHTML(),/\/docs\/postman.json/);
  assert.equal(collection.info.schema,'https://schema.getpostman.com/json/collection/v2.1.0/collection.json');
  assert.ok(collection.item.flatMap(x=>x.item).some(x=>x.request.url.endsWith('/admin/api/phones')));
  assert.equal(collection.variable.find(x=>x.key==='apiKey').value,'');
});

// Isolated in-memory Mongo collection double for service lifecycle tests.
// These tests do not connect to a production database.
function fakeDb(){
  const tables=new Map();
  const matches=(row,q)=>Object.entries(q).every(([k,v])=>{
    if(v&&typeof v==='object'&&!(v instanceof Date)){
      if('$ne' in v)return row[k]!==v.$ne;
      if('$gt' in v)return row[k]>v.$gt;
      if('$lte' in v)return row[k]<=v.$lte;
    }
    return row[k]===v;
  });
  return {collection(name){
    if(!tables.has(name))tables.set(name,[]);
    const rows=tables.get(name);
    return {
      async findOne(q){const row=rows.find(x=>matches(x,q));return row?{...row}:null;},
      async countDocuments(q={}){return rows.filter(x=>matches(x,q)).length;},
      async insertOne(row){if(rows.some(x=>x._id===row._id))throw Error('duplicate');rows.push({...row});},
      async updateOne(q,change,opt={}){
        let row=rows.find(x=>matches(x,q));
        if(!row&&opt.upsert){row={...q};rows.push(row);}
        if(!row)return {matchedCount:0};
        Object.assign(row,change.$set||{});
        for(const [k,v] of Object.entries(change.$inc||{}))row[k]=(row[k]||0)+v;
        return {matchedCount:1};
      },
      async deleteOne(q){const i=rows.findIndex(x=>matches(x,q));if(i>=0)rows.splice(i,1);},
      async deleteMany(q){for(let i=rows.length-1;i>=0;i--)if(matches(rows[i],q))rows.splice(i,1);},
      find(q){return {sort(){return this;},async toArray(){return rows.filter(x=>matches(x,q)).map(x=>({...x}));}};}
    };
  }};
}
test('bootstrap, pending approval, reset, revoke and last-admin protection', async () => {
  const oldDb=mongoose.connection.db;
  const oldToken=process.env.ADMIN_BOOTSTRAP_TOKEN;
  mongoose.connection.db=fakeDb();
  process.env.ADMIN_BOOTSTRAP_TOKEN='a'.repeat(64);
  const pw='Test-password-12345', replacement='New-password-67890';
  try{
    await assert.rejects(store.signup('first@example.com',pw,'wrong'),{status:403});
    const first=await store.signup('first@example.com',pw,'a'.repeat(64));
    assert.equal(first.status,'active');assert.equal(first.passwordHash,undefined);
    const firstSession=await store.login(first.email,pw);
    assert.equal((await store.currentAdmin(firstSession.token)).email,first.email);
    await assert.rejects(store.revoke(first.email,firstSession.token,first.email),{status:409});
    const second=await store.signup('second@example.com',pw);
    assert.equal(second.status,'pending');
    await assert.rejects(store.login(second.email,pw),{status:403});
    await store.approve(first.email,firstSession.token,second.email);
    const secondSession=await store.login(second.email,pw);
    await store.resetPassword(first.email,firstSession.token,second.email,replacement);
    assert.equal(await store.currentAdmin(secondSession.token),null);
    await assert.rejects(store.login(second.email,pw),{status:403});
    const newSession=await store.login(second.email,replacement);
    await store.revoke(first.email,firstSession.token,second.email);
    assert.equal(await store.currentAdmin(newSession.token),null);
    await assert.rejects(store.login(second.email,replacement),{status:403});
    await store.setPhoneLimit(3);assert.equal(await store.getPhoneLimit(),3);
    await store.setPhoneLimit(null);assert.equal(await store.getPhoneLimit(),null);
    await store.logout(firstSession.token);assert.equal(await store.currentAdmin(firstSession.token),null);
  } finally {
    mongoose.connection.db=oldDb;
    if(oldToken===undefined)delete process.env.ADMIN_BOOTSTRAP_TOKEN;else process.env.ADMIN_BOOTSTRAP_TOKEN=oldToken;
  }
});
