'use strict';

const { WpUser } = require('./modelAccess');
const { str, ah } = require('./helpers');
const { requireKey } = require('./authMiddleware');
const { normalizeWebhookEvent } = require('../utils/webhookEvents');

module.exports = function registerWebhooks(router) {
  router.post('/webhooks', requireKey, ah(async (req, res) => {
    const url    = str(req.body?.url);
    const method = str(req.body?.method).toUpperCase() === 'GET' ? 'GET' : 'POST';
    const label  = str(req.body?.label);
    const event = normalizeWebhookEvent(req.body?.event);
    if (!event) return res.status(400).json({ error: 'event must be message_received or auth_rescan_required' });
    if (!url) return res.status(400).json({ error: 'url required' });
    if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'url must start with http:// or https://' });
    const user = await WpUser.findByIdAndUpdate(req.wpUser._id, { $push: { webhooks: { url, method, label, event } } }, { new: true });
    res.json({ ok: true, webhooks: user.webhooks });
  }));
  router.delete('/webhooks/:id', requireKey, ah(async (req, res) => {
    const user = await WpUser.findByIdAndUpdate(req.wpUser._id, { $pull: { webhooks: { _id: req.params.id } } }, { new: true });
    res.json({ ok: true, webhooks: user.webhooks });
  }));
  router.patch('/webhooks/:id', requireKey, ah(async (req, res) => {
    await WpUser.updateOne(
      { _id: req.wpUser._id, 'webhooks._id': req.params.id },
      { $set: { 'webhooks.$.active': req.body?.active === true || req.body?.active === 'true' } }
    );
    res.json({ ok: true });
  }));
};
