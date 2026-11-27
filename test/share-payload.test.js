'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseShare,materializeShare}=require('../utils/sharePayload');
test('legacy text polls and documents remain outside share parser',()=>{
  for(const body of [{message:'hello'},{question:'q',options:['a','b']},{document:{data:'x'}},undefined])assert.equal(parseShare(body),null);
});
test('contact builds escaped native vCard and normalizes phone',()=>{
  const s=parseShare({contact:{name:'Example, Support; A\\B',phone:'+91 90000-00002',organization:'Example',email:'support@example.com'}});
  assert.equal(s.type,'contact');assert.equal(materializeShare(s),s.payload);
  assert.ok(s.payload.startsWith('BEGIN:VCARD\nVERSION:3.0\n'));
  assert.ok(s.payload.includes('FN:Example\\, Support\\; A\\\\B'));
  assert.ok(s.payload.includes('TEL;TYPE=CELL:+919000000002'));
  assert.ok(s.payload.includes('EMAIL;TYPE=INTERNET:support@example.com'));
  assert.ok(s.payload.endsWith('END:VCARD'));assert.ok(!s.logBody.includes('919000000002'));
});
test('contact rejects invalid fields and vCard injection',()=>{
  for(const contact of [null,[],{}, {name:'a',phone:'123'}, {name:'a',phone:'1234567@lid'}, {name:'a\nTEL:123',phone:'919000000002'}, {name:'a',phone:919000000002}, {name:'a',phone:'919000000002',email:'bad'}, {name:'a',phone:'919000000002',organization:'x\r\nFN:bad'}])assert.throws(()=>parseShare({contact}),{code:'INVALID_SHARE_PAYLOAD'});
});
test('location creates native Location and accepts zero and boundaries',()=>{
  class Location{constructor(lat,lng,options){Object.assign(this,{lat,lng,options});}}
  const result=materializeShare(parseShare({location:{latitude:0,longitude:0,name:'Origin',address:'Example',url:'https://example.com'}}),Location);
  assert.deepEqual({...result},{lat:0,lng:0,options:{name:'Origin',address:'Example',url:'https://example.com'}});
  assert.doesNotThrow(()=>parseShare({location:{latitude:-90,longitude:180}}));
});
test('location rejects invalid coordinates and URLs',()=>{
  for(const location of [null,[],{}, {latitude:91,longitude:0},{latitude:0,longitude:-181},{latitude:'0',longitude:0},{latitude:null,longitude:0},{latitude:NaN,longitude:0},{latitude:0,longitude:Infinity},{latitude:0,longitude:0,url:'javascript:alert(1)'},{latitude:0,longitude:0,url:'https://a:b@example.com'}])assert.throws(()=>parseShare({location}),{code:'INVALID_SHARE_PAYLOAD'});
});
test('new share payload cannot be combined with another type',()=>{
  const contact={name:'Example',phone:'919000000002'};
  for(const extra of [{location:null},{message:'hi'},{body:'hi'},{poll:{}},{question:'q'},{options:[]},{document:{}}])assert.throws(()=>parseShare({contact,...extra}),{code:'INVALID_SHARE_PAYLOAD'});
  assert.throws(()=>parseShare({contact},{message:'hi'}),{code:'INVALID_SHARE_PAYLOAD'});
});
