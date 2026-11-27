'use strict';
const mongoose=require('mongoose');
const COLLECTION='wpsent_inbound_media';
let indexTask;
function collection(){return mongoose.connection.db.collection(COLLECTION);}
async function store(row){
  if(!indexTask)indexTask=collection().createIndex({expiresAt:1},{expireAfterSeconds:0}).catch(e=>{indexTask=null;throw e;});
  await indexTask;
  await collection().insertOne(row);
}
async function findOwned(id,userId){
  return collection().findOne({_id:id,userId,expiresAt:{$gt:new Date()}},{promoteBuffers:true});
}
module.exports={store,findOwned};
