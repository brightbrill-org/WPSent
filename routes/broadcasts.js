'use strict';
const {requireKey}=require('./authMiddleware');
const {ah}=require('./helpers');
const service=require('../services/broadcasts');
const wa=require('../waManager');
module.exports=router=>{
  const add=(method,path,fn,status=200)=>router[method](path,requireKey,ah(async(req,res)=>{
    res.set('Cache-Control','private, no-store');
    return res.status(status).json(await fn(req.wpUser,req.params,req.body));
  }));
  add('get','/sending/settings',()=>wa.outboundSettings());
  add('get','/broadcasts',async u=>({items:await service.list(u)}));
  add('post','/broadcasts',(u,p,b)=>service.edit(u,null,'create',b),201);
  add('get','/broadcasts/jobs',async u=>({items:await service.history(u)}));
  add('get','/broadcasts/jobs/:jobId',async(u,p)=>service.publicJob(await service.getJob(u,p.jobId)));
  add('post','/broadcasts/jobs/:jobId/cancel',(u,p)=>service.cancel(u,p.jobId));
  add('post','/broadcasts/opt-out',(u,p,b)=>service.optout(u,b?.phone));
  add('get','/broadcasts/:id',(u,p)=>service.getList(u,p.id));
  add('patch','/broadcasts/:id',(u,p,b)=>service.edit(u,p.id,'patch',b));
  add('delete','/broadcasts/:id',(u,p)=>service.edit(u,p.id,'delete'));
  add('post','/broadcasts/:id/recipients',(u,p,b)=>service.edit(u,p.id,'add',b));
  add('delete','/broadcasts/:id/recipients',(u,p,b)=>service.edit(u,p.id,'remove',b));
  add('post','/broadcasts/:id/send',(u,p,b)=>service.start(u,p.id,b),202);
};
