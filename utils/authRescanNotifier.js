'use strict';
const {randomUUID}=require('node:crypto');
const {AUTH_RESCAN_REQUIRED}=require('./webhookEvents');
const REASONS=new Set(['qr_required','auth_failure','logged_out','unpaired']);

// Serialize claims and ready resets per phone. The DB claim itself provides
// durable duplicate suppression across process restarts and refreshed QR codes.
function createAuthRescanNotifier({claim,clear,deliver,now=()=>new Date(),onError=()=>{}}){
  const queues=new Map();
  function enqueue(phone,work){
    const task=(queues.get(phone)||Promise.resolve()).then(work).catch(e=>{onError(e);});
    queues.set(phone,task);
    task.finally(()=>{if(queues.get(phone)===task)queues.delete(phone);});
    return task;
  }
  function notify(phone,reason,isAllowed=()=>true){
    if(!REASONS.has(reason))return Promise.resolve();
    return enqueue(phone,async()=>{
      if(!isAllowed())return;
      const timestamp=now();
      const user=await claim(phone,timestamp);
      if(!user||!isAllowed())return;
      await deliver(user._id,{event:AUTH_RESCAN_REQUIRED,eventId:randomUUID(),phone,reason,status:'rescan_required',timestamp:timestamp.toISOString()});
    });
  }
  function ready(phone,isAllowed=()=>true){
    return enqueue(phone,async()=>{if(isAllowed())await clear(phone);});
  }
  return {notify,ready};
}
module.exports={createAuthRescanNotifier};
