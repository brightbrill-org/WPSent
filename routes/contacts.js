'use strict';

const { ah } = require('./helpers');
const { requireKey } = require('./authMiddleware');
const wa = require('../waManager');

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
};
