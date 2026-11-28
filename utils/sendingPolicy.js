'use strict';
// Hard safety/resource bounds remain independent of editable policy.
const fields={
 intervalMs:['WA_SEND_INTERVAL_MS',1000,0,5000],
 maxPending:['WA_SEND_QUEUE_MAX',4,1,8],
 waitMs:['WA_SEND_QUEUE_WAIT_MS',5000,1000,10000],
 broadcastIntervalMs:['WA_BROADCAST_INTERVAL_MS',3000,3000,60000],
 maxLists:['WA_BROADCAST_MAX_LISTS',20,1,20],
 maxRecipients:['WA_BROADCAST_MAX_RECIPIENTS',25,1,25],
 dailyRecipients:['WA_BROADCAST_DAILY_RECIPIENTS',100,1,100],
 activeJobs:['WA_BROADCAST_ACTIVE_JOBS_GLOBAL',2,1,2],
 submissionTimeoutMs:['WA_BROADCAST_SUBMISSION_TIMEOUT_MS',90000,10000,90000],
 historyDays:['WA_BROADCAST_HISTORY_DAYS',30,1,30]
};
const sessionKeys=['intervalMs','maxPending','waitMs','broadcastIntervalMs','maxLists','maxRecipients','dailyRecipients','submissionTimeoutMs'];
function defaults(env=process.env){
 return Object.fromEntries(Object.entries(fields).map(([key,[name,fallback,min,max]])=>{
   const n=Number(env[name]);return [key,env[name]!==undefined&&String(env[name]).trim()!==''&&Number.isInteger(n)&&n>=min&&n<=max?n:fallback];
 }));
}
function validate(raw,session=false){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Object.assign(new Error('Policy must be an object'),{status:400});
 const out={};
 for(const [k,n] of Object.entries(raw)){
   const f=fields[k];
   if(!f||session&&!sessionKeys.includes(k)||!Number.isInteger(n)||n<f[2]||n>f[3])throw Object.assign(new Error('Invalid policy field: '+k),{status:400});
   out[k]=n;
 }
 return out;
}
function effective(global,override={}){
 const p={...global};
 // Global is a baseline AND a server-wide protection floor/ceiling.
 for(const k of sessionKeys)if(override[k]!==undefined)p[k]=['intervalMs','broadcastIntervalMs'].includes(k)?Math.max(global[k],override[k]):Math.min(global[k],override[k]);
 return p;
}
module.exports={fields,sessionKeys,defaults,validate,effective};
