'use strict';
function summarizeSessions(rows){
 const total=rows.length,revoked=rows.filter(x=>x.revokedAt||x.status==='revoked').length;
 const ready=rows.filter(x=>!x.revokedAt&&x.status==='ready').length;
 return {total,registered:total-revoked,ready,attention:total-revoked-ready,revoked};
}
function filterSessions(rows,{search='',status='all',policy='all',sort='newest',page=1,pageSize=25}={}){
 const needle=String(search).trim().replace(/[\s()+-]/g,'').toLowerCase();
 const result=rows.filter(x=>{
   const revoked=!!x.revokedAt||x.status==='revoked';
   const match=status==='all'||(status==='attention'?!revoked&&x.status!=='ready':status==='revoked'?revoked:!revoked&&x.status===status);
   return match&&(!needle||String(x.phone).toLowerCase().includes(needle))&&(policy==='all'||(!revoked&&x.policySource===policy));
 });
 const stamp=(x,k)=>Date.parse(x[k])||0;
 result.sort((a,b)=>sort==='phone'?String(a.phone).localeCompare(String(b.phone)):sort==='lastSeen'?stamp(b,'lastSeen')-stamp(a,'lastSeen'):sort==='oldest'?stamp(a,'createdAt')-stamp(b,'createdAt'):stamp(b,'createdAt')-stamp(a,'createdAt'));
 pageSize=[10,25,50,100].includes(Number(pageSize))?Number(pageSize):25;
 const pages=Math.max(1,Math.ceil(result.length/pageSize));page=Math.min(pages,Math.max(1,Math.floor(Number(page)||1)));
 return {items:result.slice((page-1)*pageSize,page*pageSize),total:result.length,page,pages,pageSize};
}
module.exports={summarizeSessions,filterSessions};
