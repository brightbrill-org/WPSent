'use strict';
const { randomUUID } = require('node:crypto');

function integer(raw,fallback,min,max){
  if(typeof raw!=='string'||!/^\d+$/.test(raw))return fallback;
  const n=Number(raw);return Number.isSafeInteger(n)&&n>=min&&n<=max?n:fallback;
}
function mediaSettings(env=process.env){
  return {maxBytes:integer(env.WA_INBOUND_MEDIA_MAX_MB,8,1,10)*1024*1024,
    retentionMs:integer(env.WA_INBOUND_MEDIA_TTL_HOURS,24,1,168)*3600000,
    timeoutMs:integer(env.WA_INBOUND_MEDIA_TIMEOUT_MS,20000,1000,60000), concurrency:2};
}
function restricted(msg){
  const d=msg._data||{};
  return [msg,d].some(x=>x.isViewOnce||x.isViewOnceV2||x.isViewOnceV2Extension||x.viewOnce||x.isEphemeral||x.ephemeralDuration>0||x.ephemeralExpiration>0)
    || /view_once|ephemeral/i.test(String(msg.type||''));
}
function filename(raw,id){
  const name=typeof raw==='string'?raw.split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._ -]/g,'_').slice(0,120).trim():'';
  return name&&name!=='.'&&name!=='..'?name:'media-'+id;
}
function mimetype(raw){
  return typeof raw==='string'&&/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(raw)&&raw.length<=120?raw.toLowerCase():'application/octet-stream';
}
function decodeMedia(data,maxBytes){
  if(typeof data!=='string'||!data.length||data.length%4!==0)return {status:'unavailable'};
  if(data.length>Math.ceil(maxBytes/3)*4)return {status:'too_large'};
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(data))return {status:'unavailable'};
  const bytes=Buffer.from(data,'base64');
  if(bytes.length>maxBytes)return {status:'too_large'};
  if(!bytes.length||bytes.toString('base64')!==data)return {status:'unavailable'};
  return {bytes};
}
function createInboundCapture({store,settings=mediaSettings(),now=Date.now}){
  let active=0;
  return async function capture(msg,userId,isAllowed=()=>true){
    if(!msg.hasMedia)return null;
    if(restricted(msg))return {mediaStatus:'skipped'};
    const size=Number(msg._data?.size||0);
    if(size>settings.maxBytes)return {mediaStatus:'too_large'};
    if(active>=settings.concurrency)return {mediaStatus:'busy'};
    if(!isAllowed())return {mediaStatus:'skipped'};
    active++;
    let timer,expired=false;
    // Keep the slot until the actual browser/storage operation settles, even if
    // the webhook has already timed out. Never publish a late download link.
    const work=Promise.resolve().then(async()=>{
      const media=await msg.downloadMedia();
      if(expired||!isAllowed())return {mediaStatus:'skipped'};
      const decoded=decodeMedia(media?.data,settings.maxBytes);
      if(!decoded.bytes)return {mediaStatus:decoded.status};
      const id=randomUUID(),expiresAt=new Date(now()+settings.retentionMs);
      const row={_id:id,userId,filename:filename(media.filename,id),mimetype:mimetype(media.mimetype),size:decoded.bytes.length,expiresAt,data:decoded.bytes};
      await store(row);
      if(expired||!isAllowed())return {mediaStatus:'skipped'};
      return {mediaStatus:'available',mediaId:id,mediaFilename:row.filename,mediaMimetype:row.mimetype,mediaSize:row.size,mediaExpiresAt:expiresAt.toISOString(),mediaDownloadPath:'/media/'+id};
    }).catch(()=>({mediaStatus:'unavailable'})).finally(()=>{active--;});
    try{return await Promise.race([work,new Promise(resolve=>{timer=setTimeout(()=>{expired=true;resolve({mediaStatus:'timeout'});},settings.timeoutMs);})]);}
    finally{clearTimeout(timer);}
  };
}
module.exports={createInboundCapture,mediaSettings,decodeMedia,restricted,filename,mimetype};
