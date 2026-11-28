'use strict';
const mongoose=require('mongoose');
const {randomUUID,createHash}=require('crypto');
const {withControlLock}=require('./controlLock');
const v=require('../utils/broadcastValidation');
const {logFields}=require('../utils/broadcastPayload');
const wa=require('../waManager');
const {WpUser,MessageLog}=require('../routes/modelAccess');
const db=name=>mongoose.connection.db.collection('wpsent_'+name);
const lists=()=>db('broadcast_lists'),jobs=()=>db('broadcast_jobs'),optouts=()=>db('broadcast_optouts');
const active=new Map();
let stopping=false;
const policy=require('./sendingPolicy');
const effective=user=>policy.session(user.phone).effective;
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const owner=user=>String(user._id);
const scope=(user,id)=>({owner:owner(user),_id:v.uuid(id)});
const date=()=>new Date();
function publicJob(row){if(!row)return row;const {owner,messageHash,...safe}=row;return safe;}
async function initialize(){
  await lists().createIndex({owner:1});
  await jobs().createIndex({owner:1,requestId:1},{unique:true});
  await jobs().createIndex({owner:1,createdAt:-1});
  await jobs().createIndex({expiresAt:1},{expireAfterSeconds:0});
  await optouts().createIndex({owner:1,phone:1},{unique:true});
  // A crash may have occurred after dispatch but before recording a result.
  // Never replay an interrupted job or infer delivery.
  await jobs().updateMany({status:{$in:['queued','running']}},{$set:{status:'interrupted',finishedAt:date(),'results.$[sending].status':'unknown','results.$[pending].status':'not_sent'}},{arrayFilters:[{'sending.status':'sending'},{'pending.status':'pending'}]});
}
async function getList(user,id){const row=await lists().findOne(scope(user,id));if(!row)fail(404,'Broadcast list not found');return row;}
async function getJob(user,id){const row=await jobs().findOne(scope(user,id));if(!row)fail(404,'Broadcast job not found');return row;}
async function checkOptouts(user,rows){if(rows.length&&await optouts().findOne({owner:owner(user),phone:{$in:rows.map(x=>x.phone)}}))fail(409,'A recipient has opted out; remove them from this request');}
async function edit(user,id,action,body){return withControlLock(async()=>{
  if(stopping)fail(503,'Broadcast service stopping');
  if(action==='create'){
    if(await lists().countDocuments({owner:owner(user)})>=effective(user).maxLists)fail(409,'Broadcast list limit reached');
    const recipients=v.recipients(body?.recipients||[],effective(user).maxRecipients);await checkOptouts(user,recipients);
    const row={_id:randomUUID(),owner:owner(user),name:v.name(body?.name),recipients,createdAt:date(),updatedAt:date()};
    await lists().insertOne(row);return row;
  }
  const row=await getList(user,id);
  if(action==='delete'){await lists().deleteOne(scope(user,id));return {ok:true};}
  let recipients=row.recipients,name=row.name;
  if(action==='patch'){if(body?.name!==undefined)name=v.name(body.name);if(body?.recipients!==undefined)recipients=v.recipients(body.recipients,effective(user).maxRecipients);}
  if(action==='add'){const added=v.recipients(body?.recipients,effective(user).maxRecipients);if(!added.length)fail(400,'No recipients');const map=new Map(recipients.map(x=>[x.phone,x]));for(const x of added)map.set(x.phone,x);recipients=[...map.values()];}
  if(action==='remove'){const removed=v.ids(body?.phones);recipients=recipients.filter(x=>!removed.includes(x.phone));}
  if(action!=='remove'&&recipients.length>effective(user).maxRecipients)fail(400,'Broadcast recipient limit reached');
  // Removing recipients must remain possible even if another member opted out.
  if(action!=='remove'&&(action==='add'||body?.recipients!==undefined))await checkOptouts(user,recipients);
  const updatedAt=date();await lists().updateOne(scope(user,id),{$set:{name,recipients,updatedAt}});return {...row,name,recipients,updatedAt};
});}
async function optout(user,raw){
  const phone=v.phone(raw);
  return withControlLock(async()=>{
    await optouts().updateOne({owner:owner(user),phone},{$setOnInsert:{owner:owner(user),phone,createdAt:date()}},{upsert:true});
    await lists().updateMany({owner:owner(user)},{$pull:{recipients:{phone}},$set:{updatedAt:date()}});
    return {ok:true,phone,optedOut:true};
  });
}
async function record(jobId,index,status,extra={}){
  const set={['results.'+index+'.status']:status,['results.'+index+'.updatedAt']:date()};
  for(const [k,val] of Object.entries(extra))set['results.'+index+'.'+k]=val;
  await jobs().updateOne({_id:jobId},{$set:set});
}
async function allowed(user,row,phone){
  if(stopping||wa.isPhoneBlocked(user.phone)||wa.getStatus(user.phone)!=='ready')return false;
  const fresh=await WpUser.findOne({_id:user._id,revokedAt:null}).select('_id').lean();
  if(!fresh)return false;
  const current=await jobs().findOne({_id:row._id,owner:owner(user),cancelRequested:{$ne:true},status:'running'},{projection:{_id:1}});
  if(!current)return false;
  if(row.results.length>effective(user).maxRecipients||row.results.length>effective(user).dailyRecipients)return false;
  if(await optouts().findOne({owner:owner(user),phone}))return false;
  const list=await lists().findOne({_id:row.listId,owner:owner(user),'recipients.phone':phone},{projection:{_id:1}});
  return !!list&&!stopping&&!wa.isPhoneBlocked(user.phone);
}
async function run(user,row,payload){
  let final='completed';
  try{
    await jobs().updateOne({_id:row._id},{$set:{status:'running',startedAt:date()}});
    for(let i=0;i<row.results.length;i++){
      const phone=row.results[i].phone;
      if(i){const started=Date.now();while(!stopping&&Date.now()-started<effective(user).broadcastIntervalMs)await new Promise(resolve=>setTimeout(resolve,Math.min(1000,Math.max(1,effective(user).broadcastIntervalMs-(Date.now()-started)))));}
      if(!await allowed(user,row,phone)){final='stopped';break;}
      await record(row._id,i,'sending');
      let sent;
      try{
        sent=await wa.sendBroadcastPayload(user.phone,phone,payload,async()=>{if(!await allowed(user,row,phone))throw Object.assign(new Error('Broadcast consent or session no longer valid'),{code:'WA_BROADCAST_STOPPED'});});
      }catch(e){
        const before=['WA_SEND_BUSY','WA_SEND_QUEUE_TIMEOUT','WA_SEND_STOPPED','WA_NOT_READY','WA_BROADCAST_STOPPED'].includes(e.code);
        await record(row._id,i,before?'not_sent':'unknown',{reason:before?'not_dispatched':'send_not_confirmed'});
        final='stopped';break;
      }
      // A returned native message ID confirms submission, not delivery/read.
      await record(row._id,i,'submitted',{messageId:sent.messageId});
      try{const log=await MessageLog.create({userId:user._id,direction:'outbound',to:phone+'@c.us',chatId:phone+'@c.us',messageId:sent.messageId,...logFields(payload),status:'sent'});await wa.pruneOldLogs(user._id);wa.emitLog(owner(user),log.toObject());}catch(e){console.warn('[Broadcast] Message log unavailable');}
    }
  }catch(e){final='interrupted';console.warn('[Broadcast] Job interrupted');}
  finally{
    try{await jobs().updateOne({_id:row._id},{$set:{status:final,finishedAt:date(),'results.$[pending].status':'not_sent','results.$[sending].status':'unknown'}},{arrayFilters:[{'pending.status':'pending'},{'sending.status':'sending'}]});}
    finally{active.delete(owner(user));}
  }
}
async function start(user,id,body){
  const request=v.job(body);
  return withControlLock(async()=>{
    const hash=createHash('sha256').update(request.payload.type==='text'?request.payload.message:JSON.stringify(request.payload)).digest('hex');
    const previous=await jobs().findOne({owner:owner(user),requestId:request.requestId});
    if(previous){if(previous.listId!==id||previous.messageHash!==hash)fail(409,'requestId already used for a different broadcast');return publicJob(previous);}
    if(stopping||wa.isPhoneBlocked(user.phone)||wa.getStatus(user.phone)!=='ready')fail(503,'WhatsApp session not ready');
    if(active.has(owner(user))||active.size>=policy.global().activeJobs)fail(409,'Another broadcast is running');
    const row=await getList(user,id);if(!row.recipients.length)fail(400,'Broadcast list is empty');
    if(row.recipients.length>effective(user).maxRecipients)fail(409,'List exceeds current recipient policy');
    await checkOptouts(user,row.recipients);
    const since=new Date(Date.now()-86400000);
    const usage=await jobs().aggregate([{$match:{owner:owner(user),createdAt:{$gte:since}}},{$group:{_id:null,total:{$sum:{$size:'$results'}}}}]).toArray();
    if((usage[0]?.total||0)+row.recipients.length>effective(user).dailyRecipients)fail(429,'Broadcast daily recipient limit reached');
    const record={_id:randomUUID(),owner:owner(user),listId:id,listName:row.name,requestId:request.requestId,messageHash:hash,type:request.payload.type,status:'queued',cancelRequested:false,createdAt:date(),expiresAt:new Date(Date.now()+effective(user).historyDays*86400000),results:row.recipients.map(x=>({phone:x.phone,status:'pending'}))};
    await jobs().insertOne(record);
    active.set(owner(user),record._id);
    void run(user,record,request.payload).catch(()=>console.warn('[Broadcast] Job finalization unavailable'));
    return publicJob(record);
  });
}
async function cancel(user,id){const row=await getJob(user,id);await jobs().updateOne(scope(user,id),{$set:{cancelRequested:true}});return {ok:true,jobId:row._id,cancelRequested:true};}
function stop(){stopping=true;}
module.exports={initialize,edit,optout,start,cancel,stop,publicJob,getList,getJob,list:user=>lists().find({owner:owner(user)}).sort({createdAt:-1}).limit(20).toArray(),history:async user=>(await jobs().find({owner:owner(user)}).sort({createdAt:-1}).limit(50).toArray()).map(publicJob)};
