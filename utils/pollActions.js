'use strict';
const {deadline}=require('./readiness');
const {validMessageId,messageIdOf,normalizeChatId}=require('./messageActions');
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
function fail(message,code='INVALID_POLL'){throw Object.assign(new Error(message),{code});}
function parsePoll(body,query={}){
  if(!['poll','question','options','allowMultipleAnswers'].some(k=>own(body,k)))return null;
  if(['message','body','document','contact','location','image','video','voiceNote'].some(k=>own(body,k))||own(query,'message'))fail('provide only one message type per request');
  if(own(body,'poll')&&['question','options','allowMultipleAnswers'].some(k=>own(body,k)))fail('use either nested poll or top-level poll fields');
  const p=own(body,'poll')?body.poll:body;
  if(!p||typeof p.question!=='string'||!p.question.trim()||p.question.length>255)fail('poll question must be non-empty, max 255 characters');
  if(!Array.isArray(p.options)||p.options.length<2||p.options.length>12||p.options.some(x=>typeof x!=='string'||!x.trim()||x.length>100))fail('poll requires 2–12 non-empty options, max 100 characters each');
  const options=p.options.map(x=>x.trim());
  if(new Set(options).size!==options.length)fail('poll options must be unique');
  if(p.allowMultipleAnswers!==undefined&&typeof p.allowMultipleAnswers!=='boolean')fail('allowMultipleAnswers must be boolean');
  return {question:p.question.trim(),options,allowMultipleAnswers:p.allowMultipleAnswers===true};
}
function pollInfo(msg){
  if(msg?.type!=='poll_creation')return null;
  if(typeof msg.pollName!=='string'||!msg.pollName.trim()||!Array.isArray(msg.pollOptions)||msg.pollOptions.length<2||msg.pollOptions.length>12||msg.pollOptions.some(x=>typeof x?.name!=='string'||!x.name.trim()))return null;
  return {question:msg.pollName,options:msg.pollOptions.map(x=>x.name),allowMultipleAnswers:typeof msg.allowMultipleAnswers==='boolean'?msg.allowMultipleAnswers:null};
}
function voterId(v){const id=typeof v==='string'?v:v?._serialized||v?.$1;return typeof id==='string'&&/^\d{1,32}@(c\.us|s\.whatsapp\.net|lid)$/.test(id)?id:null;}
function projectVote(v,msg){
  const id=voterId(v?.voter);
  if(!id||!Array.isArray(v.selectedOptions))return null;
  const opts=msg?.pollOptions||[];
  const selected=v.selectedOptions.map(o=>opts.find(x=>x.localId!==undefined&&x.localId===o?.localId)?.name|| (typeof o?.name==='string'&&opts.some(x=>x.name===o.name)?o.name:null));
  const unresolved=selected.some(x=>x===null);
  const stamp=Number(v.interractedAtTs);
  return {voterId:id,selectedOptions:[...new Set(selected.filter(x=>x!==null))],selectionComplete:!unresolved,withdrawn:!v.selectedOptions.length,votedAt:Number.isFinite(stamp)&&stamp>0&&stamp<=8640000000000000?new Date(stamp).toISOString():null};
}
function aggregate(msg,rows){
  const poll=pollInfo(msg);
  if(!poll||!Array.isArray(rows))fail('Poll data unavailable','WA_POLL_FAILED');
  const latest=new Map();
  for(const v of rows){
    const p=projectVote(v,msg);if(!p)fail('Poll vote data incomplete','WA_POLL_FAILED');
    const old=latest.get(p.voterId);
    if(!old||(p.votedAt||'')>=(old.votedAt||''))latest.set(p.voterId,p);
  }
  const voters=[...latest.values()];
  const active=voters.filter(v=>!v.withdrawn);
  if(active.some(v=>!v.selectionComplete))fail('Poll selection data incomplete','WA_POLL_FAILED');
  return {...poll,totalVoters:active.length,options:poll.options.map(name=>({name,votes:active.filter(v=>v.selectedOptions.includes(name)).length})),voters};
}
function parsePollId(id){if(!validMessageId(id))fail('messageId must be the full WhatsApp poll message ID');return id;}
function parseVote(body){
  if(!Array.isArray(body?.selectedOptions)||body.selectedOptions.length>12||body.selectedOptions.some(x=>typeof x!=='string'||!x.trim()||x.length>100)||new Set(body.selectedOptions).size!==body.selectedOptions.length)fail('selectedOptions must contain unique option names (empty array withdraws vote)');
  return body.selectedOptions;
}
function createPollActions({getSession,isBlocked,timeoutMs=30000,maxActive=4}){
  let active=0;const busy=new WeakSet();
  function check(phone,s){if(isBlocked(phone)||!s||getSession(phone)!==s||s.destroyed||s.initFailed||s.status!=='ready')fail('WhatsApp session not ready','WA_NOT_READY');}
  async function run(phone,fn){
    const s=getSession(phone);check(phone,s);
    if(active>=maxActive||busy.has(s))fail('Another poll operation is in progress','WA_POLL_BUSY');
    active++;busy.add(s);let expired=false;
    const guard=()=>{if(expired)fail('Poll operation timed out','WA_POLL_TIMEOUT');check(phone,s);};
    const work=Promise.resolve().then(()=>{guard();return fn(s.client,guard,s);}).finally(()=>{active--;busy.delete(s);});
    try{return await deadline(()=>work,timeoutMs,'WhatsApp poll operation');}
    catch(e){if(e?.code==='WA_READY_TIMEOUT'){expired=true;fail('Poll operation timed out; verify state before retrying','WA_POLL_TIMEOUT');}if(['INVALID_POLL','WA_NOT_READY','WA_POLL_BUSY','WA_POLL_TIMEOUT','WA_POLL_NOT_FOUND','WA_POLL_FAILED'].includes(e?.code))throw e;fail('WhatsApp poll operation not confirmed; verify state before retrying','WA_POLL_FAILED');}
  }
  async function get(client,id,guard){
    const msg=await client.getMessageById(id);guard();
    if(!msg||messageIdOf(msg)!==id||msg.type!=='poll_creation')fail('Poll not found or no longer available','WA_POLL_NOT_FOUND');
    if(!pollInfo(msg))fail('Poll metadata unavailable','WA_POLL_FAILED');
    return msg;
  }
  return {
    send:(phone,chatId,poll,payload)=>run(phone,async(client,guard)=>{
      guard();const sent=await client.sendMessage(chatId,payload,{waitUntilMsgSent:true});const id=messageIdOf(sent);
      if(!id||sent.type!=='poll_creation')fail('WhatsApp did not confirm poll creation; verify recipient before retrying','WA_POLL_FAILED');
      return {ok:true,chatId,messageId:id,type:'poll',poll};
    }),
    results:(phone,id)=>run(phone,async(client,guard,s)=>{
      const msg=await get(client,id,guard);const rows=await client.getPollVotes(id);guard();
      const result=aggregate(msg,rows);
      // Resolve only a bounded number of LIDs; preserve all raw identities.
      let lookups=0;
      for(const v of result.voters){
        v.voterPhone=/^[1-9]\d{6,14}@(c\.us|s\.whatsapp\.net)$/.test(v.voterId)?v.voterId.split('@')[0]:null;
        if(v.voterId.endsWith('@lid')&&s.resolveSender&&lookups++<20){const sender=await s.resolveSender(v.voterId);guard();v.voterPhone=sender.fromPhone||null;}
      }
      return {ok:true,messageId:id,chatId:normalizeChatId(msg.fromMe?msg.to:msg.from),...result};
    }),
    vote:(phone,id,selected)=>run(phone,async(client,guard)=>{
      const msg=await get(client,id,guard),poll=pollInfo(msg);
      if(selected.some(x=>!poll.options.includes(x))||selected.length>1&&poll.allowMultipleAnswers!==true)fail('Selection does not match poll options or multiple-answer setting');
      guard();await msg.vote(selected);guard();
      // The native vote method returns void; dispatch is not delivery confirmation.
      return {ok:true,messageId:id,selectedOptions:selected,status:'submitted',confirmed:false};
    })
  };
}
module.exports={parsePoll,pollInfo,projectVote,aggregate,parsePollId,parseVote,createPollActions};
