'use strict';
const {phoneFromId}=require('./lidResolver');
const {deadline}=require('./readiness');
const fail=(message,code='INVALID_DIRECTORY_QUERY')=>{throw Object.assign(new Error(message),{code});};
function number(query,key,fallback,min,max){
  const raw=query[key];
  if(raw===undefined)return fallback;
  if(typeof raw!=='string'||!/^\d+$/.test(raw))fail(key+' must be an integer');
  const n=Number(raw);
  if(!Number.isSafeInteger(n)||n<min||n>max)fail(key+' must be between '+min+' and '+max);
  return n;
}
function flag(query,key){
  const v=query[key];if(v===undefined)return undefined;
  if(v==='true')return true;if(v==='false')return false;
  fail(key+' must be true or false');
}
function parseDirectoryQuery(query={},kind){
  const limit=number(query,'limit',50,1,200),offset=number(query,'offset',0,0,1000000);
  const search=query.search===undefined?'':query.search;
  if(typeof search!=='string'||search.length>200)fail('search must be a string of at most 200 characters');
  const result={limit,offset,search:search.trim().toLowerCase(),resolveLid:flag(query,'resolveLid')===true};
  if(kind==='chats'){
    const type=query.type===undefined?'all':query.type;
    if(!['all','individual','group'].includes(type))fail('type must be all, individual or group');
    Object.assign(result,{type,unreadOnly:flag(query,'unreadOnly'),archived:flag(query,'archived')});
  }else{
    Object.assign(result,{savedOnly:flag(query,'savedOnly'),businessOnly:flag(query,'businessOnly')});
  }
  return result;
}
const str=v=>typeof v==='string'?v:null;
const bool=v=>typeof v==='boolean'?v:null;
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
function identity(row){
  const id=str(row?.id?._serialized)||str(row?.id);
  if(!id)return null;
  // Exclude broadcasts, status, newsletters and other unsupported IDs.
  if(!/^[^@\s]+@(c\.us|s\.whatsapp\.net|lid|g\.us)$/.test(id))return null;
  return {id,phone:phoneFromId(id),lid:/^\d+@lid$/.test(id)?id:null};
}
function chatRow(row){
  const ident=identity(row);if(!ident)return null;
  return {...ident,name:str(row.name),isGroup:ident.id.endsWith('@g.us'),
    unreadCount:num(row.unreadCount),timestamp:num(row.timestamp),
    archived:bool(row.archived),pinned:bool(row.pinned),isMuted:bool(row.isMuted)};
}
function contactRow(row){
  const ident=identity(row);if(!ident||ident.id.endsWith('@g.us'))return null;
  return {...ident,name:str(row.name),pushname:str(row.pushname),shortName:str(row.shortName),
    isMyContact:bool(row.isMyContact),isBusiness:bool(row.isBusiness),
    isWAContact:bool(row.isWAContact),isMe:bool(row.isMe),isBlocked:bool(row.isBlocked)};
}
function matchesSearch(row,search){
  if(!search)return true;
  const digits=/^[+\d ()-]+$/.test(search)?search.replace(/\D/g,''):'';
  return [row.id,row.name,row.pushname,row.shortName,row.phone].some(v=>typeof v==='string'&&v.toLowerCase().includes(search))
    || (!!digits&&!!row.phone&&row.phone.includes(digits));
}
function pageRows(raw,kind,query){
  if(!Array.isArray(raw))fail('WhatsApp returned an invalid directory','WA_DIRECTORY_UNAVAILABLE');
  const map=new Map();
  for(const item of raw){
    const row=kind==='chats'?chatRow(item):contactRow(item);
    if(!row||map.has(row.id)||!matchesSearch(row,query.search))continue;
    if(kind==='chats'){
      if(query.type==='group'&&!row.isGroup||query.type==='individual'&&row.isGroup)continue;
      if(query.unreadOnly===true&&!(row.unreadCount>0)||query.archived!==undefined&&row.archived!==query.archived)continue;
    }else{
      if(query.savedOnly===true&&row.isMyContact!==true||query.businessOnly===true&&row.isBusiness!==true)continue;
    }
    map.set(row.id,row);
  }
  const rows=[...map.values()];
  rows.sort((a,b)=>kind==='chats'?(b.timestamp||0)-(a.timestamp||0)||a.id.localeCompare(b.id):
    (a.name||a.pushname||a.shortName||a.id).localeCompare(b.name||b.pushname||b.shortName||b.id)||a.id.localeCompare(b.id));
  const items=rows.slice(query.offset,query.offset+query.limit);
  return {ok:true,total:rows.length,limit:query.limit,offset:query.offset,hasMore:query.offset+items.length<rows.length,items};
}
// Single-flight per account/type; keep an unresolved browser call occupied
// even after the caller times out. No cache of private directory records.
function createDirectoryReader({getSession,isBlocked,timeoutMs=20000,maxActive=4}){
  const pending=new WeakMap();let active=0;
  function allowed(phone,session){return !isBlocked(phone)&&session&&getSession(phone)===session&&!session.destroyed&&!session.initFailed&&session.status==='ready';}
  function check(phone,session){if(!allowed(phone,session))fail('WhatsApp session not ready','WA_NOT_READY');}
  async function list(phone,kind,query){
    const session=getSession(phone);check(phone,session);
    const method=kind==='chats'?'getChats':'getContacts';
    if(typeof session.client[method]!=='function')fail('WhatsApp directory unavailable','WA_DIRECTORY_UNAVAILABLE');
    let slots=pending.get(session);if(!slots){slots=new Map();pending.set(session,slots);}
    let task=slots.get(kind);
    if(!task){
      if(active>=maxActive)fail('WhatsApp directory busy','WA_DIRECTORY_BUSY');
      active++;
      task=Promise.resolve().then(()=>session.client[method]()).finally(()=>{slots.delete(kind);active--;});
      slots.set(kind,task);
    }
    let raw;
    try{raw=await deadline(()=>task,timeoutMs,'WhatsApp directory');}
    catch(e){check(phone,session);if(e.code==='WA_READY_TIMEOUT')fail('WhatsApp directory timed out','WA_DIRECTORY_TIMEOUT');fail('WhatsApp directory unavailable','WA_DIRECTORY_UNAVAILABLE');}
    check(phone,session);
    const result=pageRows(raw,kind,query);
    // Resolve only visible page LIDs, with a small cap and shared session cache.
    // Searching never performs a full directory LID scan.
    if(query.resolveLid&&typeof session.resolveSender==='function'){
      const candidates=result.items.filter(row=>row.lid).slice(0,20);
      await Promise.all(candidates.map(async row=>{
        try{const mapped=await session.resolveSender(row.id);
          if(mapped.fromId===row.id&&typeof mapped.fromPhone==='string'&&/^[1-9]\d{1,14}$/.test(mapped.fromPhone))row.phone=mapped.fromPhone;
        }catch(_){}
      }));
    }
    check(phone,session);
    return result;
  }
  return list;
}
module.exports={parseDirectoryQuery,pageRows,createDirectoryReader};
