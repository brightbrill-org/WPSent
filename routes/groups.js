'use strict';
const {requireKey}=require('./authMiddleware');
const {ah}=require('./helpers');
const wa=require('../waManager');
const {parseGroupRequest}=require('../utils/groupActions');

module.exports=function registerGroups(router){
  const operations=[
    ['post','/groups','create'],
    ['post','/groups/:groupId/participants','add'],
    ['delete','/groups/:groupId/participants','remove'],
    ['patch','/groups/:groupId/subject','subject'],
    ['patch','/groups/:groupId/description','description'],
    ['get','/groups/:groupId/invite','invite']
  ];
  for(const [method,path,action] of operations){
    router[method](path,requireKey,ah(async(req,res)=>{
      res.set('Cache-Control','private, no-store');
      try{
        const request=parseGroupRequest(action,req.params?.groupId,req.body);
        const result=await wa.groupAction(req.wpUser.phone,action,request);
        return res.status(action==='create'?201:200).json(result);
      }catch(e){
        const status={INVALID_GROUP_REQUEST:400,WA_GROUP_FORBIDDEN:403,WA_GROUP_NOT_FOUND:404,
          WA_NOT_READY:503,WA_GROUP_BUSY:503,WA_GROUP_UNAVAILABLE:503,WA_GROUP_TIMEOUT:504,WA_GROUP_FAILED:502}[e?.code];
        if(status)return res.status(status).json({error:e.message});
        throw e;
      }
    }));
  }
};
