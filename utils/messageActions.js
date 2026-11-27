'use strict';
const {deadline}=require('./readiness');
function fail(message,code='INVALID_MESSAGE_ACTION'){throw Object.assign(new Error(message),{code});}
function normalizeChatId(value){
  if(typeof value!=='string'||value.length>128)fail('chatId must be a phone number or WhatsApp chat ID');
  const raw=value.trim();
  if(/^(?:[1-9]\d{6,14}@(c\.us|s\.whatsapp\.net)|\d{1,32}@lid|\d{1,32}(?:-\d{1,32})?@g\.us)$/.test(raw))return raw;
  if(/^\+?[0-9][0-9 ()-]*$/.test(raw)){
    const digits=raw.replace(/\D/g,'');
    if(/^[1-9]\d{6,14}$/.test(digits))return digits+'@c.us';
  }
  fail('chatId must be a phone number or WhatsApp chat ID');
}
function validMessageId(value){
  // Treat the full serialized identifier as opaque except for its required
  // shape. Never infer a phone number or reply destination from its contents.
  return typeof value==='string'&&value.length<=512&&/^(?:true|false)_[^_\s@]+@(?:c\.us|s\.whatsapp\.net|lid|g\.us)_[^\s]+$/.test(value);
}
function messageIdOf(message){
  const id=message?.id?._serialized||message?.id?.$1;
  return validMessageId(id)?id:null;
}
function parseSeen(body){
  return normalizeChatId(body?.chatId);
}
function parseReply(body){
  if(!validMessageId(body?.messageId))fail('messageId must be the full WhatsApp message ID from the webhook or log');
  if(typeof body?.message!=='string'||!body.message.trim()||body.message.length>16000)fail('message must be non-empty text of at most 16000 characters');
  if(['to','chatId','document','contact','location','poll','question','options'].some(k=>Object.prototype.hasOwnProperty.call(body,k)))fail('reply destination is taken from the original message; only text replies are supported');
  if(body.markSeen!==undefined&&typeof body.markSeen!=='boolean')fail('markSeen must be a boolean');
  return {messageId:body.messageId,message:body.message,markSeen:body.markSeen===true};
}
function createMessageActions({getSession,isBlocked,timeoutMs=20000,maxActive=4}){
  let active=0;
  const busy=new WeakSet();
  function check(phone,session){
    if(isBlocked(phone)||!session||getSession(phone)!==session||session.destroyed||session.initFailed||session.status!=='ready')fail('WhatsApp session not ready','WA_NOT_READY');
  }
  async function run(phone,action){
    const session=getSession(phone);check(phone,session);
    if(active>=maxActive||busy.has(session))fail('Another message action is in progress','WA_ACTION_BUSY');
    active++;busy.add(session);
    let expired=false;
    const guard=()=>{if(expired)fail('Message action timed out','WA_ACTION_TIMEOUT');check(phone,session);};
    const work=Promise.resolve().then(()=>action(session.client,guard)).finally(()=>{active--;busy.delete(session);});
    try{return await deadline(()=>work,timeoutMs,'WhatsApp message action');}
    catch(e){
      if(e.code==='WA_READY_TIMEOUT'){expired=true;fail('WhatsApp action timed out; verify its result before retrying','WA_ACTION_TIMEOUT');}
      throw e;
    }
  }
  function markSeen(phone,chatId){
    return run(phone,async(client,guard)=>{
      guard();
      const chat=await client.getChatById(chatId);
      if(!chat||!chat.id?._serialized)fail('Chat not found','WA_ACTION_NOT_FOUND');
      guard();
      const seen=await client.sendSeen(chat.id._serialized);
      if(seen!==true)fail('WhatsApp did not confirm marking the chat as seen','WA_ACTION_FAILED');
      return {ok:true,chatId:chat.id._serialized,seen:true};
    });
  }
  function reply(phone,request){
    return run(phone,async(client,guard)=>{
      guard();
      const original=await client.getMessageById(request.messageId);
      if(!original||messageIdOf(original)!==request.messageId)fail('Original message not found or no longer available','WA_ACTION_NOT_FOUND');
      // Derive the conversation from the original message, never the caller.
      const chatId=normalizeChatId(original.fromMe?original.to:original.from);
      guard();
      const sent=await client.sendMessage(chatId,request.message,{
        quotedMessageId:request.messageId,ignoreQuoteErrors:false,
        sendSeen:request.markSeen,parseVCards:false,waitUntilMsgSent:true
      });
      const messageId=messageIdOf(sent);
      if(!messageId||sent.hasQuotedMsg!==true)fail('WhatsApp did not confirm a quoted reply; check delivery before retrying','WA_ACTION_FAILED');
      return {chatId,messageId,replyToMessageId:request.messageId};
    });
  }
  return {markSeen,reply};
}
module.exports={normalizeChatId,validMessageId,messageIdOf,parseSeen,parseReply,createMessageActions};
