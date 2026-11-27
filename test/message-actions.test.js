'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseSeen,parseReply,messageIdOf,createMessageActions}=require('../utils/messageActions');
const originalId='false_919000000001@c.us_EXAMPLE123';
const sentId='true_919000000001@c.us_EXAMPLE456';
function fixture(client,options={}){
  const session={status:'ready',client};let blocked=false;
  return {actions:createMessageActions({getSession:p=>p==='a'?session:null,isBlocked:()=>blocked,...options}),session,block:()=>{blocked=true;}};
}
test('seen validates international numbers and supported conversation IDs',()=>{
  assert.equal(parseSeen({chatId:'+91 90000-00001'}),'919000000001@c.us');
  assert.equal(parseSeen({chatId:'123@lid'}),'123@lid');assert.equal(parseSeen({chatId:'123-456@g.us'}),'123-456@g.us');
  for(const chatId of [null,[],42,'status@broadcast','123@newsletter','abc','123@c.us'])assert.throws(()=>parseSeen({chatId}),{code:'INVALID_MESSAGE_ACTION'});
});
test('reply validates serialized ID text and disallows destination override',()=>{
  assert.deepEqual(parseReply({messageId:originalId,message:'hello'}),{messageId:originalId,message:'hello',markSeen:false});
  for(const body of [{messageId:'123',message:'hi'},{messageId:originalId,message:' '},{messageId:originalId,message:'hi',to:'other'},{messageId:originalId,message:'hi',markSeen:'true'},{messageId:originalId,message:'hi',document:{}}])assert.throws(()=>parseReply(body),{code:'INVALID_MESSAGE_ACTION'});
  assert.equal(messageIdOf({id:{$1:originalId}}),originalId);
});
test('seen uses owning ready session and checks WhatsApp confirmation',async()=>{
  const id='919000000001@c.us';
  const {actions,session,block}=fixture({getChatById:async x=>{assert.equal(x,id);return {id:{_serialized:id}};},sendSeen:async x=>{assert.equal(x,id);return true;}});
  assert.deepEqual(await actions.markSeen('a',id),{ok:true,chatId:id,seen:true});
  session.client.sendSeen=async()=>false;
  await assert.rejects(actions.markSeen('a',id),{code:'WA_ACTION_FAILED'});
  block();await assert.rejects(actions.markSeen('a',id),{code:'WA_NOT_READY'});
});
test('quoted reply uses original group conversation and explicit options',async()=>{
  const gid='123-456@g.us',mid='false_'+gid+'_EXAMPLE123_919000000001@c.us',sid='true_'+gid+'_EXAMPLE456';
  const {actions}=fixture({getMessageById:async x=>({id:{_serialized:x},from:gid,author:'919000000001@c.us'}),sendMessage:async(chat,text,opts)=>{
    assert.equal(chat,gid);assert.equal(text,'hello');assert.equal(opts.quotedMessageId,mid);assert.equal(opts.ignoreQuoteErrors,false);assert.equal(opts.sendSeen,false);assert.equal(opts.parseVCards,false);
    return {id:{_serialized:sid},hasQuotedMsg:true};
  }});
  assert.deepEqual(await actions.reply('a',parseReply({messageId:mid,message:'hello'})),{chatId:gid,messageId:sid,replyToMessageId:mid});
});
test('reply to own message uses destination and optional markSeen',async()=>{
  const mid='true_919000000001@c.us_EXAMPLE123';
  const {actions}=fixture({getMessageById:async()=>({id:{_serialized:mid},fromMe:true,from:'919000000002@c.us',to:'919000000001@c.us'}),sendMessage:async(chat,text,opts)=>{
    assert.equal(chat,'919000000001@c.us');assert.equal(opts.sendSeen,true);return {id:{_serialized:sentId},hasQuotedMsg:true};
  }});
  await actions.reply('a',parseReply({messageId:mid,message:'hi',markSeen:true}));
});
test('missing original or wrong message ID is rejected without sending',async()=>{
  const {actions,session}=fixture({getMessageById:async()=>null,sendMessage:()=>assert.fail('must not send')});
  const q=parseReply({messageId:originalId,message:'hello'});
  await assert.rejects(actions.reply('a',q),{code:'WA_ACTION_NOT_FOUND'});
  session.client.getMessageById=async()=>({id:{_serialized:sentId},from:'919000000001@c.us'});
  await assert.rejects(actions.reply('a',q),{code:'WA_ACTION_NOT_FOUND'});
});
test('unquoted fallback is never reported as successful reply',async()=>{
  const {actions}=fixture({getMessageById:async()=>({id:{_serialized:originalId},from:'919000000001@c.us'}),sendMessage:async()=>({id:{_serialized:sentId},hasQuotedMsg:false})});
  await assert.rejects(actions.reply('a',parseReply({messageId:originalId,message:'hi'})),{code:'WA_ACTION_FAILED'});
});
test('timeout blocks late dispatch and keeps the outstanding action slot',async()=>{
  let release;
  const {actions}=fixture({getMessageById:()=>new Promise(r=>release=r),sendMessage:()=>assert.fail('late send must not dispatch')},{timeoutMs:15});
  const q=parseReply({messageId:originalId,message:'hi'});
  const p=actions.reply('a',q);
  await assert.rejects(p,{code:'WA_ACTION_TIMEOUT'});
  await assert.rejects(actions.reply('a',q),{code:'WA_ACTION_BUSY'});
  release({id:{_serialized:originalId},from:'919000000001@c.us'});
  await new Promise(r=>setImmediate(r));
});
