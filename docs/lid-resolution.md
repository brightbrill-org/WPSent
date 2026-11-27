# Inbound WhatsApp LID resolution

WhatsApp may deliver an opaque @lid rather than a phone-based @c.us ID.
WPSent uses the public whatsapp-web.js 1.34.8 Client.getContactLidAndPhone API
on the authenticated session. It does not guess numbers from LID digits.
If no mapping is returned or the lookup fails/times out, the message still
gets logged and forwarded with the original ID. Successful mappings are
cached in memory per client for one hour (up to 2,000 entries); concurrent
lookups share a request and browser lookups are bounded. Each lookup waits
at most three seconds. No new dependencies or database migration required.

## Inbound contract

- from: existing phone JID format in logs (plain number in webhooks), or
  original unresolved ID. Group IDs remain group IDs.
- fromId: original WhatsApp sender/chat ID.
- fromLid: original LID or null.
- fromPhone: international digits, no plus sign, or null.
- authorId, authorLid, authorPhone: participant identity for group messages.
- GET webhooks omit null fields; POST webhooks retain null values.

Existing stored messages are not rewritten. The dashboard displays resolved
phone numbers for new messages. The /send endpoint already accepts raw
WhatsApp IDs including @lid, allowing replies even when lookup fails.

Run node --test test/lid-resolver.test.js test/routes.test.js test/hybrid-auth.test.js.
Verify direct inbound messages, reactions, group participants, POST/GET
webhooks and replies on a paired test account. Phone mappings depend on
WhatsApp availability and are not guaranteed.
