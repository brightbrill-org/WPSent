'use strict';
const {decodeMedia,filename}=require('./inboundMedia');
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
const formats={image:{'image/jpeg':'jpg','image/png':'png'},video:{'video/mp4':'mp4'},voiceNote:{'audio/ogg':'ogg','audio/opus':'opus'}};
const fail=(message,code='INVALID_NATIVE_MEDIA')=>{throw Object.assign(new Error(message),{code});};
function signature(bytes,mime){
  if(mime==='image/jpeg')return bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(mime==='image/png')return bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(mime==='video/mp4')return bytes.length>=12&&bytes.toString('ascii',4,8)==='ftyp';
  if(mime==='audio/ogg'||mime==='audio/opus'){
    const head=bytes.indexOf(Buffer.from('OpusHead'));
    return bytes.length>=36&&bytes.toString('ascii',0,4)==='OggS'&&head>=0&&head<512;
  }
  return false;
}
const baseMime=s=>s.toLowerCase().trim().replace(/^audio\/ogg;\s*codecs=opus$/,'audio/ogg');
function parseNativeMedia(body,query={}){
  const kinds=Object.keys(formats).filter(k=>own(body,k));
  if(!kinds.length)return null;
  if(kinds.length!==1||['message','body','document','contact','location','poll','question','options'].some(k=>own(body,k))||own(query,'message'))fail('provide only one message type per request');
  const kind=kinds[0],input=body[kind];
  if(!input||typeof input!=='object'||Array.isArray(input))fail(kind+' must be an object');
  if(typeof input.mimetype!=='string')fail(kind+'.mimetype is required');
  const mime=baseMime(input.mimetype);
  if(!own(formats[kind],mime))fail('Unsupported '+kind+' MIME type; use '+Object.keys(formats[kind]).join(', '));
  if(typeof input.data!=='string'||!input.data.length)fail(kind+'.data must be base64');
  let data=input.data;
  if(data.startsWith('data:')){
    const match=/^data:([^,]+);base64,/.exec(data);
    if(!match||baseMime(match[1])!==mime)fail('data URL MIME type must match mimetype');
    data=data.slice(match[0].length);
  }
  const decoded=decodeMedia(data,10*1024*1024);
  if(decoded.status==='too_large')fail('Media exceeds the 10 MiB decoded limit','NATIVE_MEDIA_TOO_LARGE');
  if(!decoded.bytes)fail('Invalid base64 media');
  if(!signature(decoded.bytes,mime)){
    const bytes=decoded.bytes;
    const detected=['image/jpeg','image/png','video/mp4','audio/ogg'].find(format=>signature(bytes,format))
      || (bytes.toString('ascii',0,6)==='GIF87a'||bytes.toString('ascii',0,6)==='GIF89a'?'image/gif':null)
      || (bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':null);
    const label=kind==='voiceNote'?'Voice note':kind==='image'?'Image':'Video';
    const reason=detected?'detected '+detected:'unrecognized or unsupported file header';
    const supported=kind==='voiceNote'?'Voice notes require Ogg Opus encoded audio.':kind==='image'?'Supported image formats: image/jpeg, image/png.':'Supported video format: video/mp4.';
    fail(label+' format mismatch: declared '+mime+', '+reason+'. '+supported);
  }
  if(own(input,'filename')&&(typeof input.filename!=='string'||!input.filename.trim()||input.filename.length>120||/[\x00-\x1f\x7f\\/]/.test(input.filename)||['.','..'].includes(input.filename.trim())))fail('filename must be a safe file name of at most 120 characters');
  const ext=formats[kind][mime],file=own(input,'filename')?filename(input.filename,kind+'.'+ext):kind+'.'+ext;
  let caption='';
  if(own(input,'caption')){
    if(kind==='voiceNote')fail('Voice notes do not support captions');
    if(typeof input.caption!=='string'||input.caption.length>1024||/\x00/.test(input.caption))fail('caption must be text of at most 1024 characters');
    caption=input.caption;
  }
  return {kind,type:kind==='voiceNote'?'voice_note':kind,mimetype:kind==='voiceNote'?'audio/ogg; codecs=opus':mime,data,filename:file,size:decoded.bytes.length,caption,logBody:kind==='voiceNote'?'[Voice note]':caption||('['+(kind==='image'?'Image':'Video')+']')};
}
function nativeOptions(media){return {waitUntilMsgSent:true,sendMediaAsDocument:false,sendAudioAsVoice:media.kind==='voiceNote',...(media.caption?{caption:media.caption}:{})};}
function confirmNativeMedia(sent,media){
  if(!sent||sent.type!==(media.kind==='voiceNote'?'ptt':media.kind))fail('WhatsApp did not confirm native '+media.type+' message; verify delivery before retrying','WA_NATIVE_MEDIA_FAILED');
  return sent;
}
function inboundMediaIdentity(msg){
  if(msg.type==='ptt')return {mediaKind:'voice_note',isVoiceNote:true};
  if(['audio','image','video'].includes(msg.type))return {mediaKind:msg.type,isVoiceNote:false,...(['image','video'].includes(msg.type)?{mediaCaption:typeof msg.body==='string'?msg.body:''}:{})};
  return {};
}
module.exports={parseNativeMedia,nativeOptions,confirmNativeMedia,inboundMediaIdentity};
