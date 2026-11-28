'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parsePayload,materialize,logFields}=require('../utils/broadcastPayload');
const {job}=require('../utils/broadcastValidation');
const png=Buffer.from([137,80,78,71,13,10,26,10]).toString('base64');
const mp4=Buffer.from('00000018667479706d703432','hex').toString('base64');
const ogg=Buffer.concat([Buffer.from('OggS'),Buffer.alloc(24),Buffer.from('OpusHead')]).toString('base64');
const examples=[
 [{message:'Hello'},'text','chat'],
 [{image:{mimetype:'image/png',data:png}},'image','image'],
 [{video:{mimetype:'video/mp4',data:mp4}},'video','video'],
 [{voiceNote:{mimetype:'audio/ogg',data:ogg}},'voice_note','ptt'],
 [{document:{mimetype:'application/pdf',filename:'file.pdf',data:Buffer.from('%PDF-1.4').toString('base64'),caption:'File'}},'document','document'],
 [{contact:{name:'Support',phone:'+919000000001'}},'contact','vcard'],
 [{location:{latitude:10,longitude:78}},'location','location'],
 [{poll:{question:'Choose',options:['A','B'],allowMultipleAnswers:false}},'poll','poll_creation'],
 [{question:'Choose',options:['A','B'],allowMultipleAnswers:true},'poll','poll_creation']
];
class Media{constructor(mimetype,data,filename,size){Object.assign(this,{mimetype,data,filename,size});}}
class Poll{constructor(question,options,config){Object.assign(this,{question,options,config});}}
class Location{constructor(latitude,longitude,options){Object.assign(this,{latitude,longitude,options});}}
test('all supported broadcast types validate and materialize native payloads',()=>{
 for(const [input,type,expected] of examples){
   const p=job({...input,requestId:'request-123',confirmConsent:true}).payload;
   assert.equal(p.type,type);assert.equal(p.expected,expected);
   const prepared=materialize(p,{MessageMedia:Media,Poll,Location});
   assert.equal(prepared.options.waitUntilMsgSent,true);
   assert.equal(prepared.options.sendSeen,false);
   if(type==='document')assert.equal(prepared.options.sendMediaAsDocument,true);
   if(type==='voice_note')assert.equal(prepared.options.sendAudioAsVoice,true);
   if(type==='contact')assert.equal(prepared.options.parseVCards,true);
   if(type==='poll')assert.equal(prepared.payload.config.allowMultipleAnswers,input.allowMultipleAnswers??input.poll.allowMultipleAnswers);
   const log=logFields(p);assert.equal(log.type,type);assert.ok(!JSON.stringify(log).includes(p.native?.data||p.document?.data||'__no_binary__'));
 }
});
test('each poll materialization creates a separate native poll instance',()=>{
 const p=parsePayload(examples[7][0]),lib={Poll};assert.notEqual(materialize(p,lib).payload,materialize(p,lib).payload);
});
test('broadcast rejects mixed payloads, recipient overrides and invalid formats',()=>{
 for(const b of [{message:'x',image:{}},{contact:{},location:{}},{poll:{},question:'x'},{image:{mimetype:'image/jpeg',data:png}},{document:{mimetype:'application/pdf',filename:'../file.pdf',data:png}},{document:{mimetype:'application/pdf',filename:'file.pdf',data:'invalid'}}])assert.throws(()=>parsePayload(b),{status:400});
 assert.throws(()=>job({message:'x',to:'919000000001',requestId:'request-123',confirmConsent:true}),{status:400});
});
