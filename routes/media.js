'use strict';
const { requireKey,requireDashboard }=require('./authMiddleware');
const { ah }=require('./helpers');
const { findOwned }=require('../services/inboundMediaStore');
const wa=require('../waManager');

function downloadHandler(find=findOwned){
  return ah(async(req,res)=>{
    res.set('Cache-Control','private, no-store');
    res.set('X-Content-Type-Options','nosniff');
    const id=req.params.id;
    if(typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id))return res.status(404).json({error:'Media not found or expired'});
    const row=await find(id,req.wpUser._id);
    if(!row||wa.isPhoneBlocked(req.wpUser.phone))return res.status(404).json({error:'Media not found or expired'});
    const bytes=Buffer.isBuffer(row.data)?row.data:Buffer.from(row.data.value());
    // Force attachment; never serve untrusted inbound HTML/SVG inline.
    res.attachment(row.filename);
    res.type('application/octet-stream');
    res.send(bytes);
  });
}
module.exports=function registerMedia(router){
  router.get('/media/:id',requireKey,downloadHandler());
  router.get('/api/media/:id',requireDashboard,downloadHandler());
};
module.exports.downloadHandler=downloadHandler;
