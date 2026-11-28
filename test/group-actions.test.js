'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseGroupRequest,createGroupActions}=require('../utils/groupActions');
const phone='919000000001',own=phone+'@c.us',other='919000000002@c.us',groupId='123-456@g.us';
const member=(id,admin=false,owner=false)=>({id:{_serialized:id},isAdmin:admin,isSuperAdmin:owner});
function fixture(overrides={},clientOverrides={},opts={}){
  const group={id:{_serialized:groupId},isGroup:true,participants:[member(own,true),member(other)],...overrides};
  const client={info:{wid:{_serialized:own}},getChatById:async()=>group,...clientOverrides};
  const session={status:'ready',client};let blocked=false;
  const run=createGroupActions({getSession:p=>p===phone?session:null,isBlocked:()=>blocked,...opts});
  return {group,client,run,session,block:()=>{blocked=true;}};
}
const req=(action,body)=>parseGroupRequest(action,groupId,body);
test('group request validates IDs, bounded inputs and description clearing',()=>{
  assert.deepEqual(req('add',{participants:['+91 90000 00002',other]}).participants,[other]);
  assert.equal(req('description',{description:''}).description,'');
  for(const body of [{participants:[]},{participants:['123@g.us']},{participants:Array(21).fill(other)}])assert.throws(()=>req('add',body),{code:'INVALID_GROUP_REQUEST'});
  assert.throws(()=>parseGroupRequest('invite','status@broadcast'),{code:'INVALID_GROUP_REQUEST'});
  assert.throws(()=>req('subject',{subject:'x'.repeat(101)}),{code:'INVALID_GROUP_REQUEST'});
});
test('group creation returns partial results and disables unsolicited private invitations',async()=>{
  const {run}=fixture({}, {createGroup:async(subject,ids,options)=>{
    assert.equal(subject,'Test');assert.deepEqual(ids,[other]);assert.equal(options.autoSendInviteV4,false);
    return {gid:{_serialized:groupId},participants:{[other]:{statusCode:403,isInviteV4Sent:false}}};
  }});
  const result=await run(phone,'create',parseGroupRequest('create',null,{subject:'Test',participants:[own,other]}));
  assert.equal(result.groupId,groupId);assert.equal(result.allAdded,false);assert.equal(result.participants[0].inviteRequired,true);
});
test('non-admin and wrong group cannot dispatch mutations',async()=>{
  const {run,group}=fixture({participants:[member(own),member(other)],setSubject:()=>assert.fail('no permission')});
  await assert.rejects(run(phone,'subject',req('subject',{subject:'Test'})),{code:'WA_GROUP_FORBIDDEN'});
  group.isGroup=false;await assert.rejects(run(phone,'subject',req('subject',{subject:'Test'})),{code:'WA_GROUP_NOT_FOUND'});
});
test('admin identity accepts verified LID mapping and adds only requested participants',async()=>{
  const lid='123456789@lid';
  const {run}=fixture({participants:[member(lid,true)],addParticipants:async(ids,opts)=>{assert.deepEqual(ids,[other]);assert.equal(opts.autoSendInviteV4,false);return {[other]:{code:200}};}},{
    getContactLidAndPhone:async(ids)=>ids.includes(own)?[{pn:own,lid}]:[]
  });
  assert.equal((await run(phone,'add',req('add',{participants:[other]}))).allAdded,true);
});
test('remove validates membership, protects self and checks observed absence',async()=>{
  const {run,group}=fixture();
  group.removeParticipants=async ids=>{assert.deepEqual(ids,[other]);group.participants=[member(own,true)];return {status:200};};
  await assert.rejects(run(phone,'remove',req('remove',{participants:[own]})),{code:'INVALID_GROUP_REQUEST'});
  const result=await run(phone,'remove',req('remove',{participants:[other,'919000000003']}));
  assert.equal(result.allRemoved,false);assert.ok(result.participants.some(r=>r.id===other&&r.removed));
  assert.ok(result.participants.some(r=>r.status==='not_found'));
});
test('aggregate removal status alone is not participant confirmation',async()=>{
  const {run}=fixture({removeParticipants:async()=>({status:200})});
  const result=await run(phone,'remove',req('remove',{participants:[other]}));
  assert.equal(result.allRemoved,false);assert.equal(result.participants[0].status,'unconfirmed');
});
test('subject description and invite use native operations and confirmation',async()=>{
  const {run,group}=fixture({setSubject:async s=>s==='New',setDescription:async s=>s==='',getInviteCode:async()=>'EXAMPLE_CODE123'});
  assert.equal((await run(phone,'subject',req('subject',{subject:'New'}))).subject,'New');
  assert.equal((await run(phone,'description',req('description',{description:''}))).description,'');
  assert.equal((await run(phone,'invite',req('invite'))).inviteLink,'https://chat.whatsapp.com/EXAMPLE_CODE123');
  group.setSubject=async()=>false;await assert.rejects(run(phone,'subject',req('subject',{subject:'No'})),{code:'WA_GROUP_FAILED'});
});
test('blocked and unrelated accounts cannot act',async()=>{
  const {run,block}=fixture({getInviteCode:()=>assert.fail('must not dispatch')});
  await assert.rejects(run('other','invite',req('invite')),{code:'WA_NOT_READY'});
  block();await assert.rejects(run(phone,'invite',req('invite')),{code:'WA_NOT_READY'});
});
test('timeout prevents a late mutation and retains busy slot',async()=>{
  let release;
  const {run,group,client}=fixture({setSubject:()=>assert.fail('late mutation')},{},{timeoutMs:15});
  client.getChatById=()=>new Promise(r=>release=r);
  const p=run(phone,'subject',req('subject',{subject:'New'}));
  await assert.rejects(p,{code:'WA_GROUP_TIMEOUT'});
  await assert.rejects(run(phone,'invite',req('invite')),{code:'WA_GROUP_BUSY'});
  release(group);await new Promise(r=>setImmediate(r));
});

test('creation loads lazy WhatsApp group module before native mutation',async()=>{
  const sequence=[];
  const {run}=fixture({},{
    pupPage:{evaluate:async fn=>{sequence.push('prepare');assert.match(fn.toString(),/WAWebNewGroupFlowLoadable/);return 'ready';}},
    createGroup:async()=>{sequence.push('create');return {gid:{user:'123-456',server:'g.us'},participants:{[other]:{statusCode:200}}};}
  });
  const result=await run(phone,'create',parseGroupRequest('create',null,{subject:'Test',participants:[other]}));
  assert.equal(result.groupId,groupId);assert.deepEqual(sequence,['prepare','create']);
});
test('missing lazy module stops creation before any mutation',async()=>{
  const {run}=fixture({},{
    pupPage:{evaluate:async()=> 'loader_unavailable'},
    createGroup:()=>assert.fail('must not create')
  });
  await assert.rejects(run(phone,'create',parseGroupRequest('create',null,{subject:'Test'})),{code:'WA_GROUP_UNAVAILABLE'});
});
test('native string creation errors are exposed without retrying',async()=>{
  let calls=0;
  const {run}=fixture({},{
    createGroup:async()=>{calls++;return 'CreateGroupError: An unknown error occupied while creating a group';}
  });
  await assert.rejects(run(phone,'create',parseGroupRequest('create',null,{subject:'Test'})),e=>e.code==='WA_GROUP_FAILED'&&e.message.includes('CreateGroupError:'));
  assert.equal(calls,1);
});
test('lazy preparation runs its known bundle loader only when job is absent',async()=>{
  let loaded=false,loads=0;
  const {run}=fixture({},{
    pupPage:{evaluate:async fn=>{
      const previous=global.window;
      global.window={require:name=>name==='WAWebGroupCreateJob'?(loaded?{createGroup(){}}:undefined):name==='WAWebNewGroupFlowLoadable'?{requireBundle:async()=>{loads++;loaded=true;}}:undefined};
      try{return await fn();}finally{if(previous===undefined)delete global.window;else global.window=previous;}
    }},
    createGroup:async()=>({gid:{_serialized:groupId},participants:{}})
  });
  const request=parseGroupRequest('create',null,{subject:'Test'});
  await run(phone,'create',request);await run(phone,'create',request);
  assert.equal(loads,1);
});

test('description preflight checks required modules before mutation',async()=>{
  const sequence=[];
  const {run}=fixture({setDescription:async value=>{sequence.push(value);return true;}},{
    pupPage:{evaluate:async(fn,id,desc)=>{assert.equal(id,groupId);assert.match(fn.toString(),/WAWebMsgKey/);assert.match(fn.toString(),/WAWebGroupModifyInfoJob/);if(desc===undefined){sequence.push('preflight');return 'ready';}sequence.push(desc);return 'updated';}}
  });
  assert.equal((await run(phone,'description',req('description',{description:'New'}))).description,'New');
  assert.deepEqual(sequence,['preflight','New']);
});
test('missing description dependency fails before mutation',async()=>{
  const {run}=fixture({setDescription:()=>assert.fail('must not mutate')},{
    pupPage:{evaluate:async()=> 'message_key_generator_unavailable'}
  });
  await assert.rejects(run(phone,'description',req('description',{description:'New'})),e=>e.code==='WA_GROUP_UNAVAILABLE'&&e.message.includes('message_key_generator_unavailable'));
});
test('native description errors become explicit group errors with no automatic retry',async()=>{
  let calls=0;
  const {run,group}=fixture({setDescription:async()=>{calls++;throw new TypeError('synthetic native failure');}});
  await assert.rejects(run(phone,'description',req('description',{description:'New'})),{code:'WA_GROUP_FAILED'});
  assert.equal(calls,1);
  group.setDescription=async()=>{throw Error('Protocol error: Target closed');};
  await assert.rejects(run(phone,'description',req('description',{description:'New'})),{code:'WA_GROUP_UNAVAILABLE'});
});
test('description preflight accepts a group without an existing description ID',async()=>{
  const {run}=fixture({setDescription:async()=>true},{
    pupPage:{evaluate:async(fn,id,desc)=>{
      const previous=global.window;
      global.window={require:name=>({
        WAWebWidFactory:{createWid:()=>({id})},WAWebMsgKey:{newId:async()=> 'new-key'},WAWebGroupModifyInfoJob:{setGroupDescription:async args=>{assert.equal(args.desc,'');assert.equal(args.prevDescId,undefined);}}
      })[name],WWebJS:{getChat:async()=>({groupMetadata:{}})}};
      try{return await fn(id,desc);}finally{if(previous===undefined)delete global.window;else global.window=previous;}
    }}
  });
  assert.equal((await run(phone,'description',req('description',{description:''}))).description,'');
});

test('description adapter passes a single named object to WhatsApp and never calls outdated native method',async()=>{
  const groupWid={id:groupId};let calls=0;
  const {run}=fixture({setDescription:()=>assert.fail('outdated method must not run')},{
    pupPage:{evaluate:async(fn,id,desc)=>{
      const previous=global.window;
      global.window={require:name=>({
        WAWebWidFactory:{createWid:x=>{assert.equal(x,groupId);return groupWid;}},
        WAWebMsgKey:{newId:async()=> 'new-key'},
        WAWebGroupModifyInfoJob:{setGroupDescription:async(...args)=>{calls++;assert.deepEqual(args,[{groupWid,desc:'Updated',newDescId:'new-key',prevDescId:'old-key'}]);}}
      })[name],WWebJS:{getChat:async()=>({groupMetadata:{descId:'old-key'}})}};
      try{return await fn(id,desc);}finally{if(previous===undefined)delete global.window;else global.window=previous;}
    }}
  });
  assert.equal((await run(phone,'description',req('description',{description:'Updated'}))).description,'Updated');
  assert.equal(calls,1);
});
test('description adapter does not retry an explicitly rejected update',async()=>{
  let calls=0;
  const {run}=fixture({setDescription:()=>assert.fail('no fallback')},{
    pupPage:{evaluate:async(fn,id,desc)=>{if(desc===undefined)return 'ready';calls++;return 'rejected';}}
  });
  await assert.rejects(run(phone,'description',req('description',{description:'New'})),{code:'WA_GROUP_FAILED'});
  assert.equal(calls,1);
});
