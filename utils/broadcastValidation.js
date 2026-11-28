'use strict';
const {parsePayload}=require('./broadcastPayload');
const fail=message=>{throw Object.assign(new Error(message),{status:400});};
function phone(raw){
  if(typeof raw!=='string'||!/^\+?[1-9]\d{6,14}$/.test(raw.trim()))fail('Use international phone numbers with country code, digits only');
  return raw.trim().replace(/^\+/,'');
}
function recipients(raw,max=25){
  if(!Array.isArray(raw)||raw.length>max)fail('recipients must be an array of at most '+max+' entries');
  const seen=new Set();
  return raw.map(x=>{
    const p=phone(x?.phone);
    if(seen.has(p))fail('Duplicate recipient');seen.add(p);
    if(x.consent!==true||typeof x.consentSource!=='string'||!x.consentSource.trim()||x.consentSource.length>200)fail('Every recipient requires consent:true and consentSource (max 200 characters)');
    return {phone:p,consentSource:x.consentSource.trim(),recordedAt:new Date()};
  });
}
function name(raw){if(typeof raw!=='string'||!raw.trim()||raw.length>100)fail('List name must be non-empty, max 100 characters');return raw.trim();}
function ids(raw){if(!Array.isArray(raw)||!raw.length||raw.length>25)fail('phones must be an array of 1–25 international numbers');return [...new Set(raw.map(phone))];}
function job(body){
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['message','document','contact','location','image','video','voiceNote','poll','question','options','allowMultipleAnswers','requestId','confirmConsent'].includes(k)))fail('Invalid broadcast fields; destination comes from the saved list');
  if(body.confirmConsent!==true)fail('confirmConsent:true is required');
  if(typeof body.requestId!=='string'||!/^[a-zA-Z0-9_-]{8,80}$/.test(body.requestId))fail('requestId must be a unique 8–80 character identifier');
  return {payload:parsePayload(body),requestId:body.requestId};
}
function uuid(raw){if(typeof raw!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw))fail('Invalid ID');return raw;}
module.exports={phone,recipients,name,ids,job,uuid};
