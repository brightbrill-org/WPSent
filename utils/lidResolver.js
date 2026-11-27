'use strict';

// A LID is opaque: never infer a phone number from its digits.
function phoneFromId(id) {
  const match = typeof id === 'string' && id.match(/^([1-9]\d{1,14})@(c\.us|s\.whatsapp\.net)$/);
  return match ? match[1] : null;
}

function createLidResolver(client, { timeoutMs = 3000, cacheTtlMs = 3600000, maxEntries = 2000 } = {}) {
  // Each linked WhatsApp client owns its own cache; no cross-account lookups.
  const cache = new Map();
  const pending = new Map();
  let activeLookups = 0;

  async function lookup(id) {
    const cached = cache.get(id);
    if (cached && cached.expires > Date.now()) return cached.phone;
    cache.delete(id);
    if (pending.has(id)) return pending.get(id);
    if (typeof client.getContactLidAndPhone !== 'function') return null;
    // Bound both the wait and the number of unresolved browser calls.
    if (activeLookups >= 32) return null;
    activeLookups++;
    const task = Promise.resolve().then(async () => {
      let timer;
      try {
        const request = Promise.resolve().then(() => client.getContactLidAndPhone([id]))
          .finally(() => { activeLookups--; });
        const rows = await Promise.race([
          request,
          new Promise(resolve => { timer = setTimeout(() => resolve(null), timeoutMs); })
        ]);
        const row = Array.isArray(rows) && rows.find(item => item && item.lid === id);
        const phone = phoneFromId(row && row.pn);
        if (phone) {
          if (cache.size >= maxEntries) cache.delete(cache.keys().next().value);
          cache.set(id, { phone, expires: Date.now() + cacheTtlMs });
        }
        return phone;
      } catch (_) {
        return null;
      } finally {
        clearTimeout(timer);
      }
    });
    pending.set(id, task);
    try { return await task; } finally { pending.delete(id); }
  }

  return async function resolveSender(rawId) {
    const fromId = typeof rawId === 'string' && rawId ? rawId : 'unknown';
    const fromLid = /^\d+@lid$/.test(fromId) ? fromId : null;
    const fromPhone = fromLid ? await lookup(fromLid) : phoneFromId(fromId);
    return {
      // Preserve existing database format for ordinary WhatsApp IDs and
      // group chat IDs; normalize only successfully resolved LIDs.
      from: fromLid && fromPhone ? fromPhone + '@c.us' : fromId,
      fromId,
      fromLid,
      fromPhone
    };
  };
}

function webhookSender(sender) {
  return {
    from: sender.fromPhone || sender.from.replace(/@c\.us$/, ''),
    fromId: sender.fromId,
    fromLid: sender.fromLid,
    fromPhone: sender.fromPhone
  };
}

module.exports = { createLidResolver, phoneFromId, webhookSender };
