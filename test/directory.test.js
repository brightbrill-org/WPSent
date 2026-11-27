'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseDirectoryQuery,pageRows,createDirectoryReader}=require('../utils/directory');
const id=s=>({_serialized:s});
test('directory validates bounded pagination filters and duplicate inputs',()=>{
  assert.equal(parseDirectoryQuery({},'chats').limit,50);
  for(const q of [{limit:'0'},{limit:'201'},{offset:'-1'},{limit:['1','2']},{search:{}},{resolveLid:'yes'},{type:'bad'},{archived:'1'}])assert.throws(()=>parseDirectoryQuery(q,'chats'),{code:'INVALID_DIRECTORY_QUERY'});
});
test('chats project safe fields, filter, deduplicate and order before pagination',()=>{
  const rows=[{id:id('1@g.us'),name:'Group',timestamp:10,unreadCount:2,archived:false,secret:'not exposed'},{id:id('919000000001@c.us'),name:'Person',timestamp:20,unreadCount:0},{id:id('1@g.us'),timestamp:99},{id:id('status@broadcast')},{id:id('123@lid'),name:'Other',timestamp:15}];
  const result=pageRows(rows,'chats',parseDirectoryQuery({limit:'1'},'chats'));
  assert.equal(result.total,3);assert.equal(result.items[0].phone,'919000000001');assert.equal(result.hasMore,true);
  const groups=pageRows(rows,'chats',parseDirectoryQuery({type:'group',unreadOnly:'true',archived:'false'},'chats'));
  assert.equal(groups.total,1);assert.equal(groups.items[0].id,'1@g.us');assert.equal(groups.items[0].secret,undefined);
});
test('contacts search by saved name or phone and never infer LID digits',()=>{
  const rows=[{id:id('123@lid'),name:'Alice',number:'123',isMyContact:true,isBusiness:true},{id:id('919000000001@c.us'),name:'Bob',isMyContact:false},{id:id('5@g.us'),name:'Group'}];
  const p=pageRows(rows,'contacts',parseDirectoryQuery({search:'alice',savedOnly:'true',businessOnly:'true'},'contacts'));
  assert.equal(p.total,1);assert.equal(p.items[0].phone,null);assert.equal(p.items[0].lid,'123@lid');
  assert.equal(pageRows(rows,'contacts',parseDirectoryQuery({search:'+91 90000 00001'},'contacts')).total,1);
});
test('reader scopes account and rejects revoked or replaced session',async()=>{
  const a={status:'ready',client:{getContacts:async()=>[{id:id('1@c.us')}]}};
  const b={status:'ready',client:{getContacts:async()=>[{id:id('2@c.us')}]}};
  const sessions=new Map([['a',a],['b',b]]),blocked=new Set();
  const list=createDirectoryReader({getSession:p=>sessions.get(p),isBlocked:p=>blocked.has(p)});
  const q=parseDirectoryQuery({},'contacts');
  assert.equal((await list('a','contacts',q)).items[0].id,'1@c.us');
  assert.equal((await list('b','contacts',q)).items[0].id,'2@c.us');
  blocked.add('a');await assert.rejects(list('a','contacts',q),{code:'WA_NOT_READY'});
  b.client.getContacts=async()=>{sessions.delete('b');return [];};
  await assert.rejects(list('b','contacts',q),{code:'WA_NOT_READY'});
});
test('reader coalesces browser calls and times out without opening duplicate calls',async()=>{
  let release,calls=0;
  const session={status:'ready',client:{getChats:()=>{calls++;return new Promise(r=>release=r);}}};
  const list=createDirectoryReader({getSession:()=>session,isBlocked:()=>false,timeoutMs:15,maxActive:1});
  const q=parseDirectoryQuery({},'chats');
  const results=await Promise.allSettled([list('a','chats',q),list('a','chats',q)]);
  assert.equal(calls,1);assert.ok(results.every(r=>r.reason.code==='WA_DIRECTORY_TIMEOUT'));
  await assert.rejects(list('a','chats',q),{code:'WA_DIRECTORY_TIMEOUT'});assert.equal(calls,1);
  release([]);await new Promise(r=>setImmediate(r));
  session.client.getChats=async()=>[];assert.equal((await list('a','chats',q)).total,0);
});
test('optional LID resolution only applies to at most 20 returned entries',async()=>{
  let calls=0;
  const session={status:'ready',client:{getContacts:async()=>Array.from({length:30},(_,i)=>({id:id((i+1)+'@lid')}))},resolveSender:async fromId=>{calls++;return {fromId,fromPhone:'919000000001'};}};
  const list=createDirectoryReader({getSession:()=>session,isBlocked:()=>false});
  const p=await list('a','contacts',parseDirectoryQuery({resolveLid:'true',limit:'25'},'contacts'));
  assert.equal(calls,20);assert.equal(p.items.filter(r=>r.phone).length,20);
});
