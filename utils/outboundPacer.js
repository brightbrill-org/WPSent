'use strict';
function config(env=process.env){
  function number(key,fallback,min,max){const n=Number(env[key]);return env[key]!==undefined&&Number.isInteger(n)&&n>=min&&n<=max?n:fallback;}
  return {intervalMs:number('WA_SEND_INTERVAL_MS',1000,0,5000),maxPending:number('WA_SEND_QUEUE_MAX',4,1,8),waitMs:number('WA_SEND_QUEUE_WAIT_MS',5000,1000,10000)};
}
function error(code,message){return Object.assign(new Error(message),{code});}
// Single process, one active native send globally. Never release the active
// slot on an HTTP timeout: the underlying browser operation may still run.
function createPacer({intervalMs=1000,maxPending=4,waitMs=5000,now=Date.now}={}){
  let active=false,closed=false,nextAt=0,timer=null;
  const queue=[];
  function drain(){
    if(closed||active||!queue.length)return;
    if(timer){clearTimeout(timer);timer=null;}
    const delay=Math.max(0,nextAt-now());
    if(delay){timer=setTimeout(()=>{timer=null;drain();},delay);return;}
    const item=queue.shift();clearTimeout(item.timer);active=true;
    Promise.resolve().then(item.run).then(item.resolve,item.reject).finally(()=>{active=false;nextAt=now()+intervalMs;drain();});
  }
  function submit(run){
    if(closed)return Promise.reject(error('WA_SEND_STOPPED','Outbound sending stopped'));
    if(queue.length>=maxPending)return Promise.reject(error('WA_SEND_BUSY','Outbound queue full; request was not dispatched'));
    return new Promise((resolve,reject)=>{
      const item={run,resolve,reject,timer:null};
      item.timer=setTimeout(()=>{const i=queue.indexOf(item);if(i>=0){queue.splice(i,1);reject(error('WA_SEND_QUEUE_TIMEOUT','Outbound queue wait expired; request was not dispatched'));drain();}},waitMs);
      queue.push(item);drain();
    });
  }
  function close(){closed=true;clearTimeout(timer);for(const item of queue.splice(0)){clearTimeout(item.timer);item.reject(error('WA_SEND_STOPPED','Outbound sending stopped before dispatch'));}}
  return {submit,close,state:()=>({active,pending:queue.length,closed,intervalMs,maxPending,waitMs})};
}
module.exports={config,createPacer};
