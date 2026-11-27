'use strict';

const { MessageLog } = require('./modelAccess');
const { str, ah } = require('./helpers');
const { requireKey } = require('./authMiddleware');
const wa = require('../waManager');

module.exports = function registerMessages(router) {
  router.post('/send', requireKey, ah(async (req, res) => {
    const rawTo = str(req.query.to || req.body?.to);
    const to    = rawTo.includes('@') ? rawTo : wa.sanitizePhone(rawTo);
    if (!to) return res.status(400).json({ error: 'to is required' });

    let payload, logBody, logType;

    const doc = req.body?.document;
    if (doc && typeof doc === 'object' && doc.data && doc.mimetype && doc.filename) {
      const { MessageMedia } = require('whatsapp-web.js');
      const data = String(doc.data).replace(/^data:[^;]+;base64,/, '');
      if (!data) return res.status(400).json({ error: 'document.data is required (base64)' });
      payload = new MessageMedia(doc.mimetype, data, doc.filename);
      logBody = `[Document: ${doc.filename}]${doc.caption ? ' ' + str(doc.caption) : ''}`;
      logType = 'document';
    } else {
      const pollQuestion = str(req.body?.question || req.body?.poll?.question);
      const pollOptions  = req.body?.options || req.body?.poll?.options;
      if (pollQuestion && Array.isArray(pollOptions) && pollOptions.length >= 2) {
        const { Poll } = require('whatsapp-web.js');
        const options = pollOptions.map(o => str(o)).filter(Boolean);
        if (options.length < 2) return res.status(400).json({ error: 'poll requires at least 2 non-empty options' });
        payload = new Poll(pollQuestion, options);
        logBody = `Poll: ${pollQuestion} (${options.join(', ')})`;
        logType = 'poll';
      } else {
        const message = str(req.body?.message || req.body?.body || req.query.message);
        if (!message) return res.status(400).json({ error: 'message is required (or provide document / question + options for a poll)' });
        payload = message;
        logBody = message;
        logType = 'text';
      }
    }

    let status = 'sent', error = null;
    try { await wa.sendMessage(req.wpUser.phone, to, payload); }
    catch (e) { status = 'failed'; error = e.message; }

    const log = await MessageLog.create({ userId: req.wpUser._id, direction: 'outbound', to, body: logBody, type: logType, status, error });
    await wa.pruneOldLogs(req.wpUser._id);
    wa.emitLog(req.wpUser._id.toString(), log.toObject());

    if (status === 'failed') return res.status(500).json({ error, logId: log._id });
    res.json({ ok: true, logId: log._id });
  }));

  router.get('/logs', requireKey, ah(async (req, res) => {
    const logs = await MessageLog.find({ userId: req.wpUser._id }).sort({ timestamp: -1 }).limit(100);
    res.json(logs);
  }));

  router.get('/status', requireKey, (req, res) => {
    res.json({ phone: req.wpUser.phone, status: wa.getStatus(req.wpUser.phone) });
  });
};
