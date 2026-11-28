'use strict';
function config(env=process.env){
 const p=require('./sendingPolicy').defaults(env);
 return {intervalMs:p.intervalMs,maxPending:p.maxPending,waitMs:p.waitMs};
}
function error(code,message){return Object.assign(new Error(message),{code});}
function createPacer({intervalMs=1000,maxPending=4,waitMs=5000,now=Date.now,getGlobal,getSession}={}){
 const fallback={intervalMs,maxPending,waitMs};
 const global=()=>getGlobal?getGlobal():fallback;
 const policy=key=>getSession?getSession(key):global();
 let active=false,closed=false,lastFinish=null,timer=null;
 const queue=[],sessionFinish=new Map();
 function remove(item,code,message){const i=queue.indexOf(item);if(i>=0){queue.splice(i,1);clearTimeout(item.timer);item.reject(error(code,message));}}
 function drain(){
   clearTimeout(timer);timer=null;
   if(closed||active||!queue.length)return;
   const time=now(),g=global();
   for(const item of [...queue])if(time-item.queuedAt>=Math.min(g.waitMs,policy(item.key).waitMs))remove(item,'WA_SEND_QUEUE_TIMEOUT','Outbound queue wait expired; request was not dispatched');
   if(!queue.length)return;
   // Respect reduced queue caps for already queued work, retaining oldest.
   for(const item of queue.slice(g.maxPending))remove(item,'WA_SEND_BUSY','Global queue policy reduced; request was not dispatched');
   const counts=new Map();
   for(const item of [...queue]){const count=(counts.get(item.key)||0)+1;counts.set(item.key,count);if(count>policy(item.key).maxPending)remove(item,'WA_SEND_BUSY','Session queue policy reduced; request was not dispatched');}
   if(!queue.length)return;
   let best=null,earliest=Infinity;
   for(const item of queue){
     const due=Math.max(lastFinish===null?0:lastFinish+g.intervalMs,sessionFinish.has(item.key)?sessionFinish.get(item.key)+policy(item.key).intervalMs:0);
     if(due<=time){best=item;break;}earliest=Math.min(earliest,due);
   }
   if(!best){timer=setTimeout(drain,Math.max(1,earliest-time));return;}
   queue.splice(queue.indexOf(best),1);clearTimeout(best.timer);active=true;
   Promise.resolve().then(best.run).then(best.resolve,best.reject).finally(()=>{
     active=false;lastFinish=now();sessionFinish.set(best.key,lastFinish);
     // Expired entries are irrelevant after the maximum session gap.
     for(const [key,stamp] of sessionFinish)if(lastFinish-stamp>5000)sessionFinish.delete(key);
     drain();
   });
 }
 function submit(key,run){
   if(typeof key==='function'){run=key;key='default';}
   key=String(key);
   if(closed)return Promise.reject(error('WA_SEND_STOPPED','Outbound sending stopped'));
   const g=global(),p=policy(key);
   if(queue.length>=g.maxPending||queue.filter(x=>x.key===key).length>=p.maxPending)return Promise.reject(error('WA_SEND_BUSY','Outbound queue full; request was not dispatched'));
   return new Promise((resolve,reject)=>{
     const item={key,run,resolve,reject,queuedAt:now(),timer:null};
     item.timer=setTimeout(()=>{remove(item,'WA_SEND_QUEUE_TIMEOUT','Outbound queue wait expired; request was not dispatched');drain();},Math.min(g.waitMs,p.waitMs));
     queue.push(item);drain();
   });
 }
 function close(){closed=true;clearTimeout(timer);for(const item of [...queue])remove(item,'WA_SEND_STOPPED','Outbound sending stopped before dispatch');}
 return {submit,close,refresh:drain,state:key=>({active,pending:queue.length,sessionPending:queue.filter(x=>x.key===String(key)).length,closed,...global()})};
}
module.exports={config,createPacer};
