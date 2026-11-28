'use strict';

const { MessageLog } = require('./modelAccess');
const { str, ah } = require('./helpers');
const { requireKey } = require('./authMiddleware');
const wa = require('../waManager');
const { parseShare, materializeShare } = require('../utils/sharePayload');
const {parseSeen,parseReply,normalizeChatId}=require('../utils/messageActions');
const {parseNativeMedia}=require('../utils/nativeMedia');
const {parsePoll}=require('../utils/pollActions');

function actionError(res,e){
  const status={INVALID_MESSAGE_ACTION:400,WA_NOT_READY:503,WA_ACTION_BUSY:503,WA_ACTION_NOT_FOUND:404,WA_ACTION_TIMEOUT:504,WA_ACTION_FAILED:502,WA_SEND_BUSY:503,WA_SEND_QUEUE_TIMEOUT:503,WA_SEND_STOPPED:503}[e.code];
  if(status)return res.status(status).json({error:e.message});
  throw e;
}

module.exports = function registerMessages(router) {
  router.post('/send', requireKey, ah(async (req, res) => {
    const rawTo = str(req.query.to || req.body?.to);
    const to    = rawTo.includes('@') ? rawTo : wa.sanitizePhone(rawTo);
    if (!to) return res.status(400).json({ error: 'to is required' });

    let payload, logBody, logType;

    let native,share,poll;
    try { native=parseNativeMedia(req.body,req.query);share = parseShare(req.body, req.query);poll=parsePoll(req.body,req.query); }
    catch (e) {
      if (e.code === 'INVALID_SHARE_PAYLOAD'||e.code==='INVALID_NATIVE_MEDIA'||e.code==='INVALID_POLL') return res.status(400).json({ error: e.message });
      if (e.code === 'NATIVE_MEDIA_TOO_LARGE') return res.status(413).json({error:e.message});
      throw e;
    }
    const doc = req.body?.document;
    if(poll){
      let chatId;
      try{chatId=normalizeChatId(rawTo);}catch(e){return res.status(400).json({error:e.message});}
      const {Poll}=require('whatsapp-web.js');
      let result;
      try{result=await wa.pollActions.send(req.wpUser.phone,chatId,poll,new Poll(poll.question,poll.options,{allowMultipleAnswers:poll.allowMultipleAnswers}));}
      catch(e){return res.status({WA_NOT_READY:503,WA_POLL_BUSY:503,WA_POLL_TIMEOUT:504,WA_POLL_FAILED:502,WA_SEND_BUSY:503,WA_SEND_QUEUE_TIMEOUT:503,WA_SEND_STOPPED:503}[e.code]||502).json({error:e.message});}
      let log;
      try{log=await MessageLog.create({userId:req.wpUser._id,direction:'outbound',to:chatId,chatId,messageId:result.messageId,type:'poll',body:poll.question,poll,status:'sent'});}
      catch(e){return res.json({...result,logId:null,warning:'Poll sent; message log could not be saved'});}
      try{await wa.pruneOldLogs(req.wpUser._id);wa.emitLog(req.wpUser._id.toString(),log.toObject());}catch(e){console.error('[WA] Poll log housekeeping failed');}
      return res.json({...result,logId:log._id});
    }
    if(native){
      let chatId;
      try{chatId=normalizeChatId(rawTo);}catch(e){return res.status(400).json({error:e.message});}
      const {MessageMedia}=require('whatsapp-web.js');
      payload=new MessageMedia(native.mimetype,native.data,native.filename,native.size);
      let sent;
      try{sent=await wa.sendNativeMedia(req.wpUser.phone,chatId,payload,native);}
      catch(e){const status={WA_NOT_READY:503,WA_NATIVE_MEDIA_BUSY:503,WA_NATIVE_MEDIA_TIMEOUT:504,WA_NATIVE_MEDIA_FAILED:502,WA_SEND_BUSY:503,WA_SEND_QUEUE_TIMEOUT:503,WA_SEND_STOPPED:503}[e.code]||502;return res.status(status).json({error:status===502?'Native media send not confirmed; verify recipient before retrying':e.message});}
      const result={ok:true,chatId,messageId:sent.messageId,type:native.type};
      let log;
      try{log=await MessageLog.create({userId:req.wpUser._id,direction:'outbound',to:chatId,chatId,messageId:sent.messageId,body:native.logBody,type:native.type,status:'sent',mediaKind:native.type,isVoiceNote:native.kind==='voiceNote',mediaCaption:native.caption,mediaMimetype:native.mimetype,mediaFilename:native.filename,mediaSize:native.size});}
      catch(e){console.error('[WA] Native media sent but logging failed');return res.json({...result,logId:null,warning:'Media sent; message log could not be saved'});}
      try{await wa.pruneOldLogs(req.wpUser._id);wa.emitLog(req.wpUser._id.toString(),log.toObject());}catch(e){console.error('[WA] Native media log housekeeping failed');}
      return res.json({...result,logId:log._id});
    } else if (share) {
      const Location = share.type === 'location' ? require('whatsapp-web.js').Location : undefined;
      payload = materializeShare(share, Location);
      logBody = share.logBody;
      logType = share.type;
    } else if (doc && typeof doc === 'object' && doc.data && doc.mimetype && doc.filename) {
      const { MessageMedia } = require('whatsapp-web.js');
      const data = String(doc.data).replace(/^data:[^;]+;base64,/, '');
      if (!data) return res.status(400).json({ error: 'document.data is required (base64)' });
      payload = new MessageMedia(doc.mimetype, data, doc.filename);
      logBody = `[Document: ${doc.filename}]${doc.caption ? ' ' + str(doc.caption) : ''}`;
      logType = 'document';
    } else {
        const message = str(req.body?.message || req.body?.body || req.query.message);
        if (!message) return res.status(400).json({ error: 'message is required (or provide contact / location / document / question + options for a poll)' });
        payload = message;
        logBody = message;
        logType = 'text';
    }

    let status = 'sent', error = null;
    try { await wa.sendMessage(req.wpUser.phone, to, payload, share?.type); }
    catch (e) { if(['WA_SEND_BUSY','WA_SEND_QUEUE_TIMEOUT','WA_SEND_STOPPED'].includes(e.code))return res.status(503).json({error:e.message});status = 'failed'; error = e.message; }

    const log = await MessageLog.create({ userId: req.wpUser._id, direction: 'outbound', to, body: logBody, type: logType, status, error });
    await wa.pruneOldLogs(req.wpUser._id);
    wa.emitLog(req.wpUser._id.toString(), log.toObject());

    if (status === 'failed') return res.status(500).json({ error, logId: log._id });
    res.json({ ok: true, logId: log._id });
  }));

  router.post('/seen', requireKey, ah(async(req,res)=>{
    res.set('Cache-Control','private, no-store');
    try{
      const chatId=parseSeen(req.body);
      return res.json(await wa.markSeen(req.wpUser.phone,chatId));
    }catch(e){return actionError(res,e);}
  }));

  router.post('/reply', requireKey, ah(async(req,res)=>{
    res.set('Cache-Control','private, no-store');
    let request,result;
    try{
      request=parseReply(req.body);
      result=await wa.replyMessage(req.wpUser.phone,request);
    }catch(e){return actionError(res,e);}
    // The send is already complete. Never encourage automatic retry if
    // persistence fails after WhatsApp has accepted the reply.
    let log;
    try{
      log=await MessageLog.create({userId:req.wpUser._id,direction:'outbound',
        to:result.chatId,chatId:result.chatId,messageId:result.messageId,
        replyToMessageId:request.messageId,body:request.message,type:'text',status:'sent'});
    }catch(e){
      console.error('[WA] Reply sent but log creation failed:',e.message);
      return res.json({ok:true,...result,logId:null,warning:'Reply sent; message log could not be saved'});
    }
    try{await wa.pruneOldLogs(req.wpUser._id);wa.emitLog(req.wpUser._id.toString(),log.toObject());}
    catch(e){console.error('[WA] Reply log housekeeping failed:',e.message);}
    return res.json({ok:true,...result,logId:log._id});
  }));

  router.get('/logs', requireKey, ah(async (req, res) => {
    const logs = await MessageLog.find({ userId: req.wpUser._id }).sort({ timestamp: -1 }).limit(100);
    res.json(logs);
  }));

  router.get('/status', requireKey, (req, res) => {
    res.json({ phone: req.wpUser.phone, status: wa.getStatus(req.wpUser.phone) });
  });
};
