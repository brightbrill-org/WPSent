'use strict';
const mongoose=require('mongoose');
const {defaults,validate,effective,fields,sessionKeys}=require('../utils/sendingPolicy');
let globalPolicy=defaults();
let overrides=new Map();
let listeners=new Set();
const col=()=>mongoose.connection.db.collection('wpsent_settings');
const publish=()=>{for(const listener of listeners)listener();};
async function initialize(){
 const initial=defaults();
 await col().updateOne({_id:'sendingPolicyGlobal'},{$setOnInsert:{value:initial}}, {upsert:true});
 const row=await col().findOne({_id:'sendingPolicyGlobal'});
 globalPolicy={...initial,...validate(row.value)};
 const rows=await col().find({_id:{$regex:'^sendingPolicyPhone:'}}).toArray();
 overrides=new Map(rows.map(x=>[x._id.slice('sendingPolicyPhone:'.length),validate(x.value,true)]));
 publish();
}
function global(){return {...globalPolicy};}
function session(phone){const override=overrides.get(String(phone))||{};return {override:{...override},effective:effective(globalPolicy,override)};}
async function setGlobal(patch,actor){
 const value={...globalPolicy,...validate(patch)};
 await col().updateOne({_id:'sendingPolicyGlobal'},{$set:{value,updatedAt:new Date(),updatedBy:actor}},{upsert:true});
 globalPolicy=value;publish();return global();
}
async function setSession(phone,raw,actor){
 const key=String(phone),id='sendingPolicyPhone:'+key;
 if(raw===null){await col().deleteOne({_id:id});overrides.delete(key);}
 else{const value=validate(raw,true);await col().updateOne({_id:id},{$set:{value,updatedAt:new Date(),updatedBy:actor}},{upsert:true});overrides.set(key,value);}
 publish();return session(key);
}
function hasOverride(phone){return Object.keys(overrides.get(String(phone))||{}).length>0;}
function subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);}
module.exports={initialize,global,session,setGlobal,setSession,subscribe,hasOverride,fields,sessionKeys};
