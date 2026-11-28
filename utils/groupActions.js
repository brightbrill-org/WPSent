'use strict';
const {deadline}=require('./readiness');
const {normalizeChatId}=require('./messageActions');
const fail=(message,code='INVALID_GROUP_REQUEST')=>{throw Object.assign(new Error(message),{code});};
const groupPattern=/^\d{1,32}(?:-\d{1,32})?@g\.us$/;
const memberPattern=/^(?:[1-9]\d{6,14}@c\.us|\d{1,32}@lid)$/;
const wid=v=>typeof v==='string'?v:(v?._serialized||v?.$1);
function groupId(v){if(typeof v!=='string'||!groupPattern.test(v))fail('groupId must be a WhatsApp group ID ending in @g.us');return v;}
function memberId(v){
  let id;
  try{id=normalizeChatId(v).replace(/@s\.whatsapp\.net$/,'@c.us');}catch(_){fail('participants must contain international phone numbers or individual WhatsApp IDs');}
  if(!memberPattern.test(id))fail('participants must contain individual WhatsApp IDs, not group IDs');
  return id;
}
function participants(v,allowEmpty=false){
  if(!Array.isArray(v)||v.length>20||(!allowEmpty&&!v.length))fail('participants must be an array of '+(allowEmpty?'0':'1')+' to 20 individual IDs');
  return [...new Set(v.map(memberId))];
}
function content(v,key,max,allowEmpty=false){
  if(typeof v!=='string'||v.length>max||(!allowEmpty&&!v.trim())||/\x00/.test(v))fail(key+' must be '+(allowEmpty?'a string':'non-empty text')+' of at most '+max+' characters');
  return v.trim();
}
function parseGroupRequest(action,id,body){
  if(action==='create')return {subject:content(body?.subject,'subject',100),participants:participants(body?.participants??[],true)};
  const request={groupId:groupId(id)};
  if(action==='add'||action==='remove')request.participants=participants(body?.participants);
  if(action==='subject')request.subject=content(body?.subject,'subject',100);
  if(action==='description')request.description=content(body?.description,'description',2048,true);
  return request;
}
function aliases(id){return typeof id==='string'&&memberPattern.test(id.replace(/@s\.whatsapp\.net$/,'@c.us'))?id.replace(/@s\.whatsapp\.net$/,'@c.us'):null;}
async function identitySet(client,id,guard){
  const canonical=aliases(id);
  if(!canonical)return new Set();
  const set=new Set([canonical]);
  if(typeof client.getContactLidAndPhone==='function'){
    guard();
    let rows;
    try{rows=await client.getContactLidAndPhone([canonical]);}catch(_){}
    guard();
    for(const row of Array.isArray(rows)?rows:[]){
      const pn=aliases(row?.pn),lid=aliases(row?.lid);
      if(pn?.endsWith('@c.us')&&lid?.endsWith('@lid')&&(pn===canonical||lid===canonical)){set.add(pn);set.add(lid);}
    }
  }
  return set;
}
function memberRows(group){
  const rows=group.participants;
  if(!Array.isArray(rows))fail('Group membership information is unavailable','WA_GROUP_UNAVAILABLE');
  return rows;
}
function matches(row,ids){return ids.has(aliases(wid(row.id)));}
async function ownIds(client,phone,guard){
  const own=aliases(wid(client.info?.wid));
  const expected=aliases(String(phone)+'@c.us');
  if(!own||!expected)fail('Linked account identity unavailable','WA_GROUP_UNAVAILABLE');
  const ids=await identitySet(client,own,guard);
  if(!ids.has(expected)){
    const other=await identitySet(client,expected,guard);
    if(!other.has(own))fail('Linked account identity could not be verified','WA_GROUP_FORBIDDEN');
    for(const id of other)ids.add(id);
  }
  return ids;
}
async function adminGroup(client,phone,id,guard){
  guard();
  const group=await client.getChatById(id);
  guard();
  if(!group||group.isGroup!==true||wid(group.id)!==id)fail('Group not found','WA_GROUP_NOT_FOUND');
  const ids=await ownIds(client,phone,guard);
  if(!memberRows(group).some(p=>matches(p,ids)&&(p.isAdmin===true||p.isSuperAdmin===true)))fail('Linked WhatsApp account must be a group administrator','WA_GROUP_FORBIDDEN');
  return {group,ids};
}
function participantResults(raw,requested){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('WhatsApp did not return participant results; verify group before retrying','WA_GROUP_FAILED');
  const results=[];
  for(const [id,row] of Object.entries(raw)){
    if(!aliases(id)||!row||typeof row!=='object')continue;
    const code=Number.isInteger(row.code)?row.code:Number.isInteger(row.statusCode)?row.statusCode:null;
    results.push({id,code,added:code===200&&row.isGroupCreator!==true,alreadyMember:code===409,
      inviteRequired:code===403,inviteSent:row.isInviteV4Sent===true,isGroupCreator:row.isGroupCreator===true});
  }
  // Creation can report canonical phone IDs rather than requested LIDs.
  // Do not guess equivalence or falsely claim an unmatched participant.
  const reported=new Set(results.map(r=>aliases(r.id)));
  for(const id of requested)if(!reported.has(id))results.push({id,code:null,added:false,alreadyMember:false,inviteRequired:false,inviteSent:false,isGroupCreator:false});
  return results;
}
// WhatsApp Web can lazy-load the group creation job only when the New
// Group UI opens. Prepare that module without creating a group or sending
// invitations. Internal modules are version-dependent; fail before mutation
// if the known loader exists but cannot make the job available.
async function prepareGroupCreation(client,guard){
  if(!client.pupPage||typeof client.pupPage.evaluate!=='function')return;
  guard();
  let result;
  try{
    result=await client.pupPage.evaluate(async()=>{
      const get=name=>{try{return window.require(name);}catch(_){return null;}};
      if(typeof get('WAWebGroupCreateJob')?.createGroup==='function')return 'ready';
      const loader=get('WAWebNewGroupFlowLoadable');
      if(typeof loader?.requireBundle!=='function')return 'loader_unavailable';
      try{await loader.requireBundle();}catch(_){return 'load_failed';}
      return typeof get('WAWebGroupCreateJob')?.createGroup==='function'?'ready':'job_unavailable';
    });
  }catch(_){fail('WhatsApp group creation preparation failed; check session readiness','WA_GROUP_UNAVAILABLE');}
  guard();
  if(result!=='ready')fail('WhatsApp group creation module unavailable ('+result+'); check WhatsApp Web compatibility','WA_GROUP_UNAVAILABLE');
}
// Check the exact dependencies used by GroupChat.setDescription in
// whatsapp-web.js 1.34.8. This is read-only and does not generate IDs or
// submit a mutation. No speculative internal API fallback is attempted.
async function prepareDescription(client,id,guard){
  if(!client.pupPage||typeof client.pupPage.evaluate!=='function')return;
  guard();
  let stage;
  try{
    stage=await client.pupPage.evaluate(async groupId=>{
      const get=name=>{try{return window.require(name);}catch(_){return null;}};
      if(typeof get('WAWebWidFactory')?.createWid!=='function')return 'wid_factory_unavailable';
      if(typeof window.WWebJS?.getChat!=='function')return 'chat_lookup_unavailable';
      if(typeof get('WAWebMsgKey')?.newId!=='function')return 'message_key_generator_unavailable';
      if(typeof get('WAWebGroupModifyInfoJob')?.setGroupDescription!=='function')return 'description_job_unavailable';
      let chat;
      try{chat=await window.WWebJS.getChat(groupId,{getAsModel:false});}catch(_){return 'chat_lookup_failed';}
      if(!chat?.groupMetadata)return 'group_metadata_unavailable';
      // descId may legitimately be absent for a group without a description.
      return 'ready';
    },id);
  }catch(e){
    console.warn('[WA] Group description preparation error:',e?.message||String(e));
    fail('WhatsApp group description preparation failed; check server logs','WA_GROUP_UNAVAILABLE');
  }
  guard();
  const known=['wid_factory_unavailable','chat_lookup_unavailable','message_key_generator_unavailable','description_job_unavailable','chat_lookup_failed','group_metadata_unavailable'];
  if(stage!=='ready'){
    const reason=known.includes(stage)?stage:'unexpected_preparation_result';
    console.warn('[WA] Group description preflight:',reason);
    fail('WhatsApp group description unavailable ('+reason+'); check WhatsApp Web compatibility','WA_GROUP_UNAVAILABLE');
  }
}
function createdGroupId(raw){
  const gid=raw?.gid;
  const serialized=wid(gid);
  if(groupPattern.test(serialized||''))return serialized;
  if(gid?.server==='g.us'&&typeof gid.user==='string'&&groupPattern.test(gid.user+'@g.us'))return gid.user+'@g.us';
  return null;
}
function createGroupActions({getSession,isBlocked,timeoutMs=45000,maxActive=4}){
  let active=0;const busy=new WeakSet();
  async function run(phone,action,request){
    const session=getSession(phone);
    const check=()=>{if(isBlocked(phone)||!session||getSession(phone)!==session||session.destroyed||session.initFailed||session.status!=='ready')fail('WhatsApp session not ready','WA_NOT_READY');};
    check();
    if(active>=maxActive||busy.has(session))fail('Another group operation is in progress','WA_GROUP_BUSY');
    active++;busy.add(session);let expired=false;
    const guard=()=>{if(expired)fail('Group operation timed out','WA_GROUP_TIMEOUT');check();};
    const work=Promise.resolve().then(async()=>{
      const client=session.client;
      guard();
      if(action==='create'){
        const ids=await ownIds(client,phone,guard);
        // The linked account is already the creator.
        const requested=request.participants.filter(id=>!ids.has(id));
        guard();
        await prepareGroupCreation(client,guard);
        guard();
        const raw=await client.createGroup(request.subject,requested,{autoSendInviteV4:false});
        // Upstream documents string errors. Do not treat them as malformed
        // success results or retry a possibly completed mutation automatically.
        if(typeof raw==='string'){
          const reason=/^CreateGroupError:/i.test(raw)?raw.replace(/[\x00-\x1f\x7f]/g,' ').slice(0,240):'Unexpected library error response';
          fail('WhatsApp group creation failed: '+reason+'; verify group before retrying','WA_GROUP_FAILED');
        }
        const id=createdGroupId(raw);
        if(!id){
          const shape=raw&&typeof raw==='object'?'object without valid gid':'empty or unexpected response';
          console.warn('[WA] Group creation unconfirmed:',shape);
          fail('WhatsApp did not confirm group creation ('+shape+'); verify before retrying','WA_GROUP_FAILED');
        }
        const results=participantResults(raw.participants||{},requested);
        return {ok:true,groupId:id,subject:request.subject,participants:results,allAdded:results.filter(r=>!r.isGroupCreator).every(r=>r.added||r.alreadyMember)};
      }
      const {group,ids}=await adminGroup(client,phone,request.groupId,guard);
      const result={ok:true,groupId:request.groupId};
      if(action==='add'){
        guard();
        const raw=await group.addParticipants(request.participants,{autoSendInviteV4:false});
        if(typeof raw==='string'&&/admin/i.test(raw))fail('Group administrator permission required','WA_GROUP_FORBIDDEN');
        const results=participantResults(raw,request.participants);
        return {...result,participants:results,allAdded:results.every(r=>r.added||r.alreadyMember)};
      }
      if(action==='remove'){
        // Resolve requested identities against actual membership. Never remove
        // the linked account itself; leaving a group is a separate operation.
        const rows=memberRows(group);
        const targets=[],results=[];
        for(const id of request.participants){
          const set=await identitySet(client,id,guard);
          if([...set].some(x=>ids.has(x)))fail('Removing the linked account is not supported');
          const matchesRows=rows.filter(p=>matches(p,set));
          if(matchesRows.length!==1){results.push({id,removed:false,status:matchesRows.length?'ambiguous':'not_found'});continue;}
          const actual=aliases(wid(matchesRows[0].id));
          if(ids.has(actual))fail('Removing the linked account is not supported');
          if(matchesRows[0].isSuperAdmin===true){results.push({id,removed:false,status:'owner_protected'});continue;}
          targets.push({id,actual});
        }
        if(targets.length){
          guard();
          const raw=await group.removeParticipants([...new Set(targets.map(t=>t.actual))]);
          // Upstream reports only aggregate status; do not invent per-member
          // confirmation. Re-read the group before claiming removal.
          if(raw?.status!==200)fail('WhatsApp did not confirm removal; verify before retrying','WA_GROUP_FAILED');
          guard();
          let after;
          try{const fresh=await client.getChatById(request.groupId);if(fresh?.isGroup&&wid(fresh.id)===request.groupId)after=memberRows(fresh);}catch(_){}
          guard();
          for(const t of targets){
            const absent=Array.isArray(after)&&!after.some(p=>aliases(wid(p.id))===t.actual);
            results.push({id:t.id,removed:absent,status:absent?'removed':'unconfirmed'});
          }
        }
        return {...result,participants:results,allRemoved:results.every(r=>r.removed)};
      }
      guard();
      if(action==='subject'||action==='description'){
        const key=action,method=action==='subject'?'setSubject':'setDescription';
        if(typeof group[method]!=='function')fail('WhatsApp group '+key+' method unavailable','WA_GROUP_UNAVAILABLE');
        if(action==='description')await prepareDescription(client,request.groupId,guard);
        guard();
        let updated;
        try{updated=await group[method](request[key]);}
        catch(e){
          // Keep technical details in server logs. Never expose arbitrary
          // browser errors, group text or internal stack traces to API users.
          console.error('[WA] Group '+key+' update failed:',e?.stack||e?.message||String(e));
          const detail=String(e?.message||'');
          if(/Target closed|Session closed|detached Frame|Execution context was destroyed|Protocol error/i.test(detail)){
            fail('WhatsApp connection interrupted during group '+key+' update; verify actual group state before retrying','WA_GROUP_UNAVAILABLE');
          }
          fail('WhatsApp group '+key+' update failed; check server logs and verify group state before retrying','WA_GROUP_FAILED');
        }
        if(updated!==true)fail('WhatsApp did not confirm the group '+key+' update','WA_GROUP_FAILED');
        return {...result,[key]:request[key]};
      }
      if(action==='invite'){
        const code=await group.getInviteCode();
        if(typeof code!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(code))fail('WhatsApp did not return an invite code','WA_GROUP_FAILED');
        guard();
        return {...result,inviteCode:code,inviteLink:'https://chat.whatsapp.com/'+code};
      }
      fail('Unknown group action');
    }).finally(()=>{active--;busy.delete(session);});
    try{return await deadline(()=>work,timeoutMs,'WhatsApp group operation');}
    catch(e){if(e.code==='WA_READY_TIMEOUT'){expired=true;fail('Group operation timed out; verify actual group state before retrying','WA_GROUP_TIMEOUT');}throw e;}
  }
  return run;
}
module.exports={parseGroupRequest,createGroupActions,participantResults};
