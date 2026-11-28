'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseNativeMedia,nativeOptions,confirmNativeMedia,inboundMediaIdentity}=require('../utils/nativeMedia');
const {createInboundCapture}=require('../utils/inboundMedia');
const jpeg=Buffer.from([255,216,255,224,0,0,255,217]).toString('base64');
const png=Buffer.from([137,80,78,71,13,10,26,10]).toString('base64');
const mp4=Buffer.from('00000018667479706d703432','hex').toString('base64');
const ogg=Buffer.concat([Buffer.from('OggS'),Buffer.alloc(24),Buffer.from('OpusHead'),Buffer.alloc(12)]).toString('base64');
test('image and video native media accept supported headers and captions',()=>{
  for(const [kind,mimetype,data] of [['image','image/jpeg',jpeg],['image','image/png',png],['video','video/mp4',mp4]]){
    const media=parseNativeMedia({[kind]:{mimetype,data,caption:'Photo'}});
    assert.equal(media.type,kind);assert.equal(nativeOptions(media).caption,'Photo');
    assert.equal(nativeOptions(media).sendMediaAsDocument,false);
  }
});
test('voice note uses native PTT option with Ogg Opus',()=>{
  const media=parseNativeMedia({voiceNote:{mimetype:'audio/ogg; codecs=opus',data:ogg}});
  assert.equal(media.type,'voice_note');assert.equal(nativeOptions(media).sendAudioAsVoice,true);
  assert.equal(confirmNativeMedia({type:'ptt'},media).type,'ptt');
  assert.throws(()=>confirmNativeMedia({type:'audio'},media),{code:'WA_NATIVE_MEDIA_FAILED'});
});
test('reject mixed, invalid base64, MIME mismatch, invalid filename and unsupported voice formats',()=>{
  for(const body of [{image:{mimetype:'image/jpeg',data:jpeg},contact:{}},{image:{mimetype:'image/jpeg',data:'!bad'}},{image:{mimetype:'image/png',data:jpeg}},{image:{mimetype:'image/jpeg',data:jpeg,filename:'../x'}},{voiceNote:{mimetype:'audio/ogg',data:ogg,caption:'bad'}},{voiceNote:{mimetype:'audio/mpeg',data:ogg}},{video:{mimetype:'video/mp4',data:jpeg}}])assert.throws(()=>parseNativeMedia(body),{code:'INVALID_NATIVE_MEDIA'});
});
test('matching data URL accepted, oversized decoded payload rejected',()=>{
  assert.equal(parseNativeMedia({image:{mimetype:'image/jpeg',data:'data:image/jpeg;base64,'+jpeg}}).data,jpeg);
  assert.throws(()=>parseNativeMedia({image:{mimetype:'image/jpeg',data:'data:image/png;base64,'+jpeg}}),{code:'INVALID_NATIVE_MEDIA'});
  assert.throws(()=>parseNativeMedia({video:{mimetype:'video/mp4',data:Buffer.alloc(10*1024*1024+1).toString('base64')}}),{code:'NATIVE_MEDIA_TOO_LARGE'});
});
test('inbound media identity distinguishes PTT and preserves captions',()=>{
  assert.deepEqual(inboundMediaIdentity({type:'ptt'}),{mediaKind:'voice_note',isVoiceNote:true});
  assert.deepEqual(inboundMediaIdentity({type:'audio'}),{mediaKind:'audio',isVoiceNote:false});
  assert.equal(inboundMediaIdentity({type:'video',body:'demo'}).mediaCaption,'demo');
  assert.deepEqual(inboundMediaIdentity({type:'chat'}),{});
});
test('inbound voice note MIME parameters normalized and generated filename has extension',async()=>{
  const rows=[];
  const capture=createInboundCapture({store:async row=>rows.push(row)});
  const result=await capture({type:'ptt',hasMedia:true,downloadMedia:async()=>({mimetype:'audio/ogg; codecs=opus',data:ogg})},'owner');
  assert.equal(result.mediaStatus,'available');assert.equal(result.mediaMimetype,'audio/ogg');
  assert.match(result.mediaFilename,/\.ogg$/);assert.equal(rows[0].userId,'owner');
});

test('media header errors identify declared and detected formats with type-specific guidance',()=>{
  assert.throws(()=>parseNativeMedia({image:{mimetype:'image/jpeg',data:png}}),e=>e.code==='INVALID_NATIVE_MEDIA'&&e.message.includes('declared image/jpeg, detected image/png')&&!e.message.includes('Ogg'));
  assert.throws(()=>parseNativeMedia({video:{mimetype:'video/mp4',data:jpeg}}),e=>e.message.includes('declared video/mp4, detected image/jpeg')&&!e.message.includes('Ogg'));
  assert.throws(()=>parseNativeMedia({voiceNote:{mimetype:'audio/ogg',data:jpeg}}),e=>e.message.includes('declared audio/ogg, detected image/jpeg')&&e.message.includes('Ogg Opus'));
  assert.throws(()=>parseNativeMedia({image:{mimetype:'image/jpeg',data:'AAAA'}}),e=>e.message.includes('unrecognized or unsupported file header'));
});
