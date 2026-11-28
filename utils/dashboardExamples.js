'use strict';
const EXAMPLES=[
  {
    "name": "Send text",
    "group": "Messaging",
    "method": "POST",
    "path": "/send",
    "body": {
      "to": "{{recipient}}",
      "message": "Hello from WPSent"
    }
  },
  {
    "name": "Send document",
    "group": "Messaging",
    "method": "POST",
    "path": "/send",
    "body": {
      "to": "{{recipient}}",
      "document": {
        "mimetype": "application/pdf",
        "filename": "sample.pdf",
        "data": "{{documentBase64}}"
      }
    }
  },
  {
    "name": "Send contact card",
    "group": "Messaging",
    "method": "POST",
    "path": "/send",
    "body": {
      "to": "{{recipient}}",
      "contact": {
        "name": "Example Support",
        "phone": "+919000000002",
        "organization": "Example Company",
        "email": "support@example.com"
      }
    }
  },
  {
    "name": "Send location pin",
    "group": "Messaging",
    "method": "POST",
    "path": "/send",
    "body": {
      "to": "{{recipient}}",
      "location": {
        "latitude": 10.0731,
        "longitude": 78.7802,
        "name": "Example Office",
        "address": "Karaikudi, Tamil Nadu"
      }
    }
  },
  {
    "name": "Mark chat as seen",
    "group": "Messaging",
    "method": "POST",
    "path": "/seen",
    "body": {
      "chatId": "{{chatId}}"
    }
  },
  {
    "name": "Reply to message",
    "group": "Messaging",
    "method": "POST",
    "path": "/reply",
    "body": {
      "messageId": "{{messageId}}",
      "message": "Thank you for your message!",
      "markSeen": false
    }
  },
  {
    "name": "Send native image",
    "group": "Messaging",
    "method": "POST",
    "path": "/send",
    "body": {
      "to": "{{recipient}}",
      "image": {
        "mimetype": "image/jpeg",
        "data": "{{imageBase64}}",
        "filename": "photo.jpg",
        "caption": "Example caption"
      }
    }
  },
  {
    "name": "Send native video",
    "group": "Messaging",
    "method": "POST",
    "path": "/send",
    "body": {
      "to": "{{recipient}}",
      "video": {
        "mimetype": "video/mp4",
        "data": "{{videoBase64}}",
        "filename": "demo.mp4",
        "caption": "Example caption"
      }
    }
  },
  {
    "name": "Send voice note",
    "group": "Messaging",
    "method": "POST",
    "path": "/send",
    "body": {
      "to": "{{recipient}}",
      "voiceNote": {
        "mimetype": "audio/ogg",
        "data": "{{voiceNoteBase64}}",
        "filename": "voice.ogg"
      }
    }
  },
  {
    "name": "Send poll",
    "group": "Polls",
    "method": "POST",
    "path": "/send",
    "body": {
      "to": "{{recipient}}",
      "question": "Choose an option",
      "options": [
        "A",
        "B"
      ],
      "allowMultipleAnswers": false
    }
  },
  {
    "name": "Poll results",
    "group": "Polls",
    "method": "GET",
    "path": "/polls/{{messageId}}/results"
  },
  {
    "name": "Vote on poll",
    "group": "Polls",
    "method": "POST",
    "path": "/polls/{{messageId}}/vote",
    "body": {
      "selectedOptions": [
        "E360"
      ]
    }
  },
  {
    "name": "Send multiple-choice poll",
    "group": "Polls",
    "method": "POST",
    "path": "/send",
    "body": {
      "to": "{{recipient}}",
      "poll": {
        "question": "Choose your products",
        "options": [
          "E360",
          "HireHub",
          "HostelOS"
        ],
        "allowMultipleAnswers": true
      }
    }
  },
  {
    "name": "Withdraw poll vote",
    "group": "Polls",
    "method": "POST",
    "path": "/polls/{{messageId}}/vote",
    "body": {
      "selectedOptions": []
    }
  },
  {
    "name": "Connection status",
    "group": "Account and directory",
    "method": "GET",
    "path": "/status"
  },
  {
    "name": "Message logs",
    "group": "Account and directory",
    "method": "GET",
    "path": "/logs"
  },
  {
    "name": "Download inbound media",
    "group": "Account and directory",
    "method": "GET",
    "path": "/media/{{mediaId}}"
  },
  {
    "name": "Resolve LID",
    "group": "Account and directory",
    "method": "GET",
    "path": "/lid/resolve?lid={{lid}}"
  },
  {
    "name": "List chats",
    "group": "Account and directory",
    "method": "GET",
    "path": "/chats?limit=50&offset=0"
  },
  {
    "name": "List contacts",
    "group": "Account and directory",
    "method": "GET",
    "path": "/contacts?limit=50&offset=0"
  },
  {
    "name": "Create group",
    "group": "Group management",
    "method": "POST",
    "path": "/groups",
    "body": {
      "subject": "Project team",
      "participants": [
        "{{participantPhone}}"
      ]
    }
  },
  {
    "name": "Add group participants",
    "group": "Group management",
    "method": "POST",
    "path": "/groups/{{groupId}}/participants",
    "body": {
      "participants": [
        "{{participantPhone}}"
      ]
    }
  },
  {
    "name": "Remove group participants",
    "group": "Group management",
    "method": "DELETE",
    "path": "/groups/{{groupId}}/participants",
    "body": {
      "participants": [
        "{{participantPhone}}"
      ]
    }
  },
  {
    "name": "Change group subject",
    "group": "Group management",
    "method": "PATCH",
    "path": "/groups/{{groupId}}/subject",
    "body": {
      "subject": "Updated project team"
    }
  },
  {
    "name": "Change group description",
    "group": "Group management",
    "method": "PATCH",
    "path": "/groups/{{groupId}}/description",
    "body": {
      "description": "Project coordination and updates"
    }
  },
  {
    "name": "Get group invite link",
    "group": "Group management",
    "method": "GET",
    "path": "/groups/{{groupId}}/invite"
  },
  {
    "name": "Add webhook",
    "group": "Webhooks",
    "method": "POST",
    "path": "/webhooks",
    "body": {
      "url": "{{webhookUrl}}",
      "method": "POST",
      "label": "Postman test"
    }
  },
  {
    "name": "Add authentication rescan webhook",
    "group": "Webhooks",
    "method": "POST",
    "path": "/webhooks",
    "body": {
      "url": "{{webhookUrl}}",
      "method": "POST",
      "label": "WhatsApp rescan alert",
      "event": "auth_rescan_required"
    }
  },
  {
    "name": "Toggle webhook",
    "group": "Webhooks",
    "method": "PATCH",
    "path": "/webhooks/{{webhookId}}",
    "body": {
      "active": false
    }
  },
  {
    "name": "Delete webhook",
    "group": "Webhooks",
    "method": "DELETE",
    "path": "/webhooks/{{webhookId}}"
  },
  {
    "name": "Add poll vote webhook",
    "group": "Webhooks",
    "method": "POST",
    "path": "/webhooks",
    "body": {
      "url": "{{webhookUrl}}",
      "method": "POST",
      "label": "Poll votes",
      "event": "poll_vote_updated"
    }
  }
];

// Serialized into browser script; origin comes from window.location.origin.
function buildExample(example,origin,language){
  if(!example||!['curl','node','py'].includes(language))throw new Error('Invalid example selection');
  if(!/^https?:\/\/[^\/?#\s@]+$/i.test(origin))throw new Error('Invalid API origin');
  const substitute=s=>s.replace(/\{\{(\w+)\}\}/g,(_,key)=>'YOUR_'+key.replace(/([a-z])([A-Z])/g,'$1_$2').toUpperCase());
  const url=origin+substitute(example.path);
  const replaceValues=value=>{
    if(typeof value==='string')return substitute(value);
    if(Array.isArray(value))return value.map(replaceValues);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,replaceValues(v)]));
    return value;
  };
  const body=example.body===undefined?undefined:replaceValues(example.body);
  const json=body===undefined?undefined:JSON.stringify(body,null,2);
  const download=example.path.startsWith('/media/');
  const headers={'x-client-id':'YOUR_CLIENT_ID','x-api-key':'YOUR_API_KEY',...(json?{'Content-Type':'application/json'}:{})};
  const quote=s=>"'"+String(s).replace(/'/g,"'\"'\"'")+"'";
  if(language==='curl'){
    const lines=['curl --fail-with-body -X '+example.method+' '+quote(url),...Object.entries(headers).map(([k,v])=>'  -H '+quote(k+': '+v))];
    if(json)lines.push('  --data '+quote(json));
    if(download)lines.push('  --output received-media');
    return lines.join(' \\\n');
  }
  if(language==='node'){
    const lines=["// Node.js 18+","async function main() {","  const res = await fetch("+JSON.stringify(url)+", {","    method: "+JSON.stringify(example.method)+",","    headers: "+JSON.stringify(headers)+(json?",":""),...(json?["    body: JSON.stringify("+json.split('\n').join('\n    ')+")"]:[]),"  });","  if (!res.ok) throw new Error(await res.text());"];
    if(download)lines.push("  const fs = require('node:fs/promises');","  await fs.writeFile('received-media', Buffer.from(await res.arrayBuffer()));");else lines.push("  console.log(await res.json());");
    lines.push("}","main().catch(console.error);");return lines.join('\n');
  }
  const lines=['import requests',...(json?['import json']:[]),'','r = requests.request(', '    '+JSON.stringify(example.method)+', '+JSON.stringify(url)+',','    headers='+JSON.stringify(headers)+',',...(json?['    json=json.loads('+JSON.stringify(JSON.stringify(body))+'),']:[]),'    timeout=120,',')','r.raise_for_status()'];
  if(download)lines.push("with open('received-media', 'wb') as f:","    f.write(r.content)");else lines.push('print(r.json())');
  return lines.join('\n');
}
module.exports={EXAMPLES,buildExample};
