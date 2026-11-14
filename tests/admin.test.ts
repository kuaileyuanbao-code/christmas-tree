import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminRepository, AdminAuthorizationError } from '../src/adminStorage.ts';
import { makeDemo } from '../src/model.ts';

const token='admin-unit-test-fixture-'.padEnd(64,'x');
const active={...makeDemo(1)[0],id:'active',deletedAt:null,answers:[0,1],quizVersion:'fixture'},deleted={...makeDemo(1)[0],id:'removed',deletedAt:'2026-11-14T00:00:00.000Z'};
const data={format:'christmas-tree-backup',version:1,decorations:[active,deleted]};
test('管理员列表须鉴权，只展示未移除记录；备份保留已移除记录',async()=>{
  const original=globalThis.fetch;const requests:{url:string;init:RequestInit}[]=[];
  try{
    globalThis.fetch=async(url,init)=>{requests.push({url:String(url),init:init??{}});return new Response(JSON.stringify(data));};
    const repository=createAdminRepository('https://tree-api.example',token),items=await repository.list();
    assert.deepEqual(items.map(x=>x.id),['active']);assert.equal('answers' in items[0],false);
    const backup=JSON.parse(await(await repository.exportBackup()).text());assert.equal(backup.decorations.length,2);
    for(const request of requests){assert.equal(request.url,'https://tree-api.example/api/admin/export');assert.ok(!request.url.includes(token));assert.equal(new Headers(request.init.headers).get('Authorization'),'Bearer '+token);assert.equal(request.init.redirect,'error');assert.equal(request.init.credentials,'omit');assert.equal(request.init.cache,'no-store');}
  }finally{globalThis.fetch=original;}
});
test('移除只针对明确的挂件ID；拒绝路径注入，失败不假装成功',async()=>{
  const original=globalThis.fetch;let calls=0;
  try{
    globalThis.fetch=async(url,init)=>{calls++;assert.equal(String(url),'https://tree-api.example/api/admin/decorations/active');assert.equal(init?.method,'DELETE');return new Response(null,{status:204});};
    const repository=createAdminRepository('https://tree-api.example',token);
    await assert.rejects(repository.remove('../other'));assert.equal(calls,0);await repository.remove('active');assert.equal(calls,1);
    globalThis.fetch=async()=>new Response(JSON.stringify({error:'移除未完成'}),{status:503});await assert.rejects(repository.remove('active'),/移除未完成/);
  }finally{globalThis.fetch=original;}
});
test('无效管理凭据、错误数据、网络失败均明确报错；不把密钥放进错误信息',async()=>{
  const original=globalThis.fetch;
  try{
    assert.throws(()=>createAdminRepository('http://evil.example',token));assert.throws(()=>createAdminRepository('https://tree-api.example/?token=x',token));assert.throws(()=>createAdminRepository('https://tree-api.example','short'),AdminAuthorizationError);
    const repository=createAdminRepository('https://tree-api.example',token);
    globalThis.fetch=async()=>new Response('{}',{status:401});await assert.rejects(repository.list(),AdminAuthorizationError);
    globalThis.fetch=async()=>new Response(JSON.stringify({...data,decorations:[{...active,design:{shape:'unknown'}}]}));await assert.rejects(repository.list(),/管理数据/);
    globalThis.fetch=async()=>{throw new TypeError('offline');};await assert.rejects(repository.list(),error=>error instanceof Error&&/连不上/.test(error.message)&&!error.message.includes(token));
  }finally{globalThis.fetch=original;}
});
