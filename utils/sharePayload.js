'use strict';
const { URL } = require('node:url');
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function fail(message){throw Object.assign(new Error(message),{code:'INVALID_SHARE_PAYLOAD'});}
function field(o,key,max,required=false){
  if(!own(o,key)&&!required)return undefined;
  const v=o[key];
  if(typeof v!=='string'||!v.trim()||v.length>max||/[\x00-\x1f\x7f]/.test(v))fail(key+' must be a non-empty string of at most '+max+' characters without control characters');
  return v.trim();
}
function escapeCard(s){return s.replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,');}
function coordinate(o,key,min,max){
  const v=o[key];
  if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail('location.'+key+' must be a JSON number between '+min+' and '+max);
  return v;
}
function parseShare(body,query={}){
  const c=own(body,'contact'),l=own(body,'location');
  if(!c&&!l)return null;
  if((c&&l)||['message','body','document','poll','question','options'].some(k=>own(body,k))||own(query,'message'))fail('provide only one message type per request');
  if(c){
    const o=body.contact;
    if(!object(o))fail('contact must be an object');
    const name=field(o,'name',200,true),raw=field(o,'phone',40,true);
    if(!/^\+?[0-9][0-9 ()-]*$/.test(raw))fail('contact.phone must be an international phone number');
    const digits=raw.replace(/[^0-9]/g,'');
    if(!/^[1-9]\d{6,14}$/.test(digits))fail('contact.phone must contain 7 to 15 digits including country code');
    const organization=field(o,'organization',200),email=field(o,'email',254);
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('contact.email must be a valid email address');
    const lines=['BEGIN:VCARD','VERSION:3.0','N:'+escapeCard(name)+';;;;','FN:'+escapeCard(name)];
    if(organization)lines.push('ORG:'+escapeCard(organization));
    lines.push('TEL;TYPE=CELL:+'+digits);
    if(email)lines.push('EMAIL;TYPE=INTERNET:'+escapeCard(email));
    lines.push('END:VCARD');
    return {type:'contact',payload:lines.join('\n'),logBody:'[Contact: '+name+']'};
  }
  const o=body.location;
  if(!object(o))fail('location must be an object');
  const latitude=coordinate(o,'latitude',-90,90),longitude=coordinate(o,'longitude',-180,180);
  const options={};
  for(const [key,max] of [['name',200],['address',500],['url',2048]]){
    const v=field(o,key,max);if(v!==undefined)options[key]=v;
  }
  if(options.url){
    let parsed;
    try{parsed=new URL(options.url);}catch(_){fail('location.url must be an HTTP or HTTPS URL');}
    if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)fail('location.url must be an HTTP or HTTPS URL without credentials');
  }
  return {type:'location',latitude,longitude,options,logBody:'[Location: '+latitude+','+longitude+']'+(options.name?' '+options.name:'')};
}
function materializeShare(share,Location){
  return share.type==='contact'?share.payload:new Location(share.latitude,share.longitude,share.options);
}
module.exports={parseShare,materializeShare};
