'use strict';

const { ah } = require('./helpers');
const { requireKey } = require('./authMiddleware');
const wa = require('../waManager');
const {parseDirectoryQuery}=require('../utils/directory');

module.exports = function registerContacts(router) {
  // Use only the authenticated account's WhatsApp client and its shared cache.
  router.get('/lid/resolve', requireKey, ah(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const raw = req.query.lid;
    if (typeof raw !== 'string' || !/^\d{1,32}@lid$/.test(raw.trim())) {
      return res.status(400).json({ error: 'lid must be a WhatsApp ID such as 123456789012345@lid' });
    }
    const lid = raw.trim();
    try {
      const result = await wa.resolveLid(req.wpUser.phone, lid);
      return res.json({ ok: true, ...result });
    } catch (e) {
      if (e.code === 'WA_NOT_READY') return res.status(503).json({ error: 'WhatsApp session not ready' });
      throw e;
    }
  }));
  for(const kind of ['chats','contacts']){
    router.get('/'+kind,requireKey,ah(async(req,res)=>{
      res.set('Cache-Control','private, no-store');
      try{
        const query=parseDirectoryQuery(req.query,kind);
        const result=await wa.listDirectory(req.wpUser.phone,kind,query);
        return res.json(result);
      }catch(e){
        if(e.code==='INVALID_DIRECTORY_QUERY')return res.status(400).json({error:e.message});
        if(e.code==='WA_NOT_READY'||e.code==='WA_DIRECTORY_BUSY'||e.code==='WA_DIRECTORY_UNAVAILABLE')return res.status(503).json({error:e.message});
        if(e.code==='WA_DIRECTORY_TIMEOUT')return res.status(504).json({error:e.message});
        throw e;
      }
    }));
  }
};
