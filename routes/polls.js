'use strict';
const {requireKey}=require('./authMiddleware');
const {ah}=require('./helpers');
const {parsePollId,parseVote}=require('../utils/pollActions');
const wa=require('../waManager');
module.exports=function(router){
  for(const [method,path,action] of [['get','/polls/:messageId/results','results'],['post','/polls/:messageId/vote','vote']]){
    router[method](path,requireKey,ah(async(req,res)=>{
      res.set('Cache-Control','private, no-store');
      try{
        const id=parsePollId(req.params.messageId);
        const result=action==='results'?await wa.pollActions.results(req.wpUser.phone,id):await wa.pollActions.vote(req.wpUser.phone,id,parseVote(req.body));
        return res.json(result);
      }catch(e){
        const status={INVALID_POLL:400,WA_POLL_NOT_FOUND:404,WA_POLL_FAILED:502,WA_NOT_READY:503,WA_POLL_BUSY:503,WA_POLL_TIMEOUT:504}[e.code];
        if(status)return res.status(status).json({error:e.message});
        throw e;
      }
    }));
  }
};
