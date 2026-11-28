'use strict';
const MESSAGE_RECEIVED='message_received';
const AUTH_RESCAN_REQUIRED='auth_rescan_required';
function normalizeWebhookEvent(raw){
  if(raw===undefined)return MESSAGE_RECEIVED;
  if(raw===MESSAGE_RECEIVED||raw===AUTH_RESCAN_REQUIRED||raw==='poll_vote_updated')return raw;
  return null;
}
function selectWebhooks(hooks,event){
  if(!normalizeWebhookEvent(event)||event===undefined)return [];
  return (hooks||[]).filter(h=>h.active&&normalizeWebhookEvent(h.event)===event);
}
function rescanReason(reason){
  switch(String(reason||'').toUpperCase()){
    case 'LOGOUT':return 'logged_out';
    case 'UNPAIRED':
    case 'UNPAIRED_IDLE':return 'unpaired';
    default:return null;
  }
}
module.exports={MESSAGE_RECEIVED,AUTH_RESCAN_REQUIRED,normalizeWebhookEvent,selectWebhooks,rescanReason};
