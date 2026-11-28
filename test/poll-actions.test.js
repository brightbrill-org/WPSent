'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parsePoll,pollInfo,projectVote,aggregate,parseVote,createPollActions}=require('../utils/pollActions');
const {selectWebhooks}=require('../utils/webhookEvents');
const id='false_919000000001@c.us_EXAMPLE',msg={id:{_serialized:id},type:'poll_creation',from:'919000000001@c.us',pollName:'Choose',pollOptions:[{name:'A',localId:0},{name:'B',localId:1}],allowMultipleAnswers:true};
const row=(voter,ids,ts)=>({voter,selectedOptions:ids.map(localId=>({localId})),interractedAtTs:ts});
test('poll validates legacy and nested formats, multiple choice and invalid inputs',()=>{
 assert.equal(parsePoll({question:'Q',options:['A','B']}).allowMultipleAnswers,false);
 assert.equal(parsePoll({poll:{question:'Q',options:['A','B'],allowMultipleAnswers:true}}).allowMultipleAnswers,true);
 for(const b of [{poll:null},{question:'Q',options:['A','A']},{question:'Q',options:['A','B'],message:'mixed'},{question:'Q',options:['A','B'],allowMultipleAnswers:'true'}])assert.throws(()=>parsePoll(b),{code:'INVALID_POLL'});
});
test('poll metadata and vote projection preserve local option zero and withdrawal',()=>{
 assert.deepEqual(pollInfo(msg).options,['A','B']);
 assert.deepEqual(projectVote(row('123@lid',[0],1),msg).selectedOptions,['A']);
 assert.equal(projectVote(row('123@lid',[],2),msg).withdrawn,true);
 assert.equal(projectVote(row('123@lid',[9],2),msg).selectionComplete,false);
});
test('poll aggregate uses latest vote, handles multiple choice and withdrawn votes',()=>{
 const rows=[row('123@lid',[0],1),row('123@lid',[],2),row('456@lid',[0,1],3)];
 const result=aggregate(msg,rows);assert.equal(result.totalVoters,1);assert.deepEqual(result.options,[{name:'A',votes:1},{name:'B',votes:1}]);
 assert.throws(()=>aggregate(msg,[row('123@lid',[9],2)]),{code:'WA_POLL_FAILED'});
});
test('vote webhook is isolated from existing message and auth subscriptions',()=>{
 const hooks=[{active:true},{active:true,event:'auth_rescan_required'},{active:true,event:'poll_vote_updated'}];
 assert.deepEqual(selectWebhooks(hooks,'poll_vote_updated'),[hooks[2]]);
 assert.deepEqual(selectWebhooks(hooks,'message_received'),[hooks[0]]);
});
test('poll actions scope session and validate selected options before dispatch',async()=>{
 let votes=0;const client={getMessageById:async()=>({...msg,vote:async()=>{votes++;}}),getPollVotes:async()=>[]};
 const session={client,status:'ready'},actions=createPollActions({getSession:p=>p==='owner'?session:null,isBlocked:()=>false});
 await assert.rejects(actions.results('other',id),{code:'WA_NOT_READY'});
 await assert.rejects(actions.vote('owner',id,['C']),{code:'INVALID_POLL'});
 assert.equal(votes,0);const result=await actions.vote('owner',id,parseVote({selectedOptions:[]}));
 assert.equal(result.confirmed,false);assert.equal(votes,1);assert.equal((await actions.results('owner',id)).totalVoters,0);
});
