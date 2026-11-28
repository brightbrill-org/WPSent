'use strict';
const {parseNativeMedia,nativeOptions}=require('./nativeMedia');
const {parseShare,materializeShare}=require('./sharePayload');
const {parsePoll}=require('./pollActions');
const {decodeMedia,filename}=require('./inboundMedia');
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const MAX_BYTES=10*1024*1024;
function parsePayload(body){
 const kinds=['message','document','contact','location','image','video','voiceNote','poll'];
 const present=kinds.filter(k=>own(body,k));
 const legacy=['question','options','allowMultipleAnswers'].some(k=>own(body,k));
 if(legacy&&present.length||!legacy&&present.length!==1)fail('Provide exactly one message type');
 try{
   const native=parseNativeMedia(body);
   if(native)return {type:native.type,expected:native.kind==='voiceNote'?'ptt':native.kind,native,logBody:native.logBody};
   const share=parseShare(body);
   if(share)return {type:share.type,expected:share.type==='contact'?'vcard':'location',share,logBody:share.logBody};
   const poll=parsePoll(body);
   if(poll)return {type:'poll',expected:'poll_creation',poll,logBody:poll.question};
 }catch(e){if(e.code==='NATIVE_MEDIA_TOO_LARGE')fail(e.message,413);if(['INVALID_NATIVE_MEDIA','INVALID_SHARE_PAYLOAD','INVALID_POLL'].includes(e.code))fail(e.message);throw e;}
 if(present[0]==='message'){
   if(typeof body.message!=='string'||!body.message.trim()||body.message.length>4000)fail('message must be non-empty text, max 4000 characters');
   return {type:'text',expected:'chat',message:body.message,logBody:body.message};
 }
 const d=body.document;
 if(!d||typeof d!=='object'||Array.isArray(d)||typeof d.mimetype!=='string'||d.mimetype.length>120||!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(d.mimetype))fail('document.mimetype must be a valid MIME type');
 if(typeof d.filename!=='string'||!d.filename.trim()||d.filename.length>120||/[\x00-\x1f\x7f\\/]/.test(d.filename)||['.','..'].includes(d.filename.trim()))fail('document.filename must be a safe file name');
 if(typeof d.data!=='string')fail('document.data must be base64');
 let data=d.data;
 if(data.startsWith('data:')){
   const match=/^data:([^,]+);base64,/.exec(data);
   if(!match||match[1].toLowerCase()!==d.mimetype.toLowerCase())fail('Document data URL MIME mismatch');
   data=data.slice(match[0].length);
 }
 const decoded=decodeMedia(data,MAX_BYTES);
 if(decoded.status==='too_large')fail('Document exceeds 10 MiB decoded limit',413);
 if(!decoded.bytes)fail('Invalid document base64');
 if(own(d,'caption')&&(typeof d.caption!=='string'||d.caption.length>1024||/\x00/.test(d.caption)))fail('document.caption must be text of at most 1024 characters');
 const doc={data,mimetype:d.mimetype.toLowerCase(),filename:filename(d.filename,'document'),size:decoded.bytes.length,caption:d.caption||''};
 return {type:'document',expected:'document',document:doc,logBody:'[Document: '+doc.filename+']'+(doc.caption?' '+doc.caption:'')};
}
function materialize(p,{MessageMedia,Poll,Location}){
 const base={waitUntilMsgSent:true,parseVCards:false,sendSeen:false};
 if(p.native){const m=p.native;return {payload:new MessageMedia(m.mimetype,m.data,m.filename,m.size),options:{...base,...nativeOptions(m)}};}
 if(p.document){const m=p.document;return {payload:new MessageMedia(m.mimetype,m.data,m.filename,m.size),options:{...base,sendMediaAsDocument:true,...(m.caption?{caption:m.caption}:{})}};}
 if(p.poll)return {payload:new Poll(p.poll.question,p.poll.options,{allowMultipleAnswers:p.poll.allowMultipleAnswers}),options:base};
 if(p.share)return {payload:materializeShare(p.share,Location),options:{...base,parseVCards:p.type==='contact'}};
 return {payload:p.message,options:base};
}
function logFields(p){
 const m=p.native||p.document;
 return {type:p.type,body:p.logBody,...(p.poll?{poll:p.poll}:{}),...(m?{mediaKind:p.type,isVoiceNote:p.type==='voice_note',mediaCaption:m.caption,mediaMimetype:m.mimetype,mediaFilename:m.filename,mediaSize:m.size}:{})};
}
module.exports={parsePayload,materialize,logFields,MAX_BYTES};
