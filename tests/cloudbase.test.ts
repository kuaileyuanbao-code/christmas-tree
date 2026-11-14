import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApi } from '../cloudbase/api/core.mjs';
import { createCloudBaseStore, COLLECTIONS } from '../cloudbase/api/store.mjs';
import { questions,QUIZ_VERSION } from '../src/config.ts';
import { makeDemo } from '../src/model.ts';

// SDK-shaped in-memory substitute: verifies our HTTP and document adapter logic.
// It does not emulate Tencent network credentials or prove real cloud transactions work.
function fixture(){
  let tables=new Map<string,Map<string,any>>(Object.values(COLLECTIONS).map(name=>[name,new Map()]));
  let tail=Promise.resolve();let failWrites=false;
  const command={gt:(value:string)=>({greaterThan:value})};
  const collection=(name:string,state:()=>typeof tables,inTx=false,options:any={}):any=>({
    doc(id:string){return {
      async get(){const table=state().get(name);if(!table)return {code:'DATABASE_COLLECTION_NOT_EXIST'};const row=table.get(id);return {data:inTx?(row?structuredClone(row):null):(row?[structuredClone(row)]:[])};},
      async set(value:any){assert.ok(!('_id' in value),'CloudBase set cannot update _id');if(failWrites&&name===COLLECTIONS.submissions)throw new Error('Simulated write failure');const table=state().get(name);if(!table)throw new Error('Collection absent');table.set(id,{...structuredClone(value),_id:id});return {updated:1};},
    };},
    where(filter:any){return collection(name,state,inTx,{...options,filter});},
    orderBy(field:string,direction:string){assert.equal(field,'_id');assert.equal(direction,'asc');return collection(name,state,inTx,options);},
    limit(limit:number){return collection(name,state,inTx,{...options,limit});},
    async get(){const table=state().get(name);if(!table)return {code:'DATABASE_COLLECTION_NOT_EXIST'};let rows=[...table.values()].sort((a,b)=>a._id.localeCompare(b._id));if(options.filter)rows=rows.filter(row=>row._id>options.filter._id.greaterThan);return {data:structuredClone(rows.slice(0,options.limit??100))};},
  });
  const db={command,collection:(name:string)=>collection(name,()=>tables),async runTransaction(callback:any){const previous=tail;let release!:()=>void;tail=new Promise(resolve=>{release=resolve;});await previous;const snapshot=structuredClone(tables);try{const result=await callback({collection:(name:string)=>collection(name,()=>snapshot,true)});tables=snapshot;return result;}finally{release();}}};
  const ADMIN='cloudbase-admin-test-fixture-'.padEnd(64,'a'),HASH='cloudbase-hmac-test-fixture-'.padEnd(64,'h'),origin='https://tree.example';
  const handle=createApi(createCloudBaseStore(db),{ADMIN_TOKEN:ADMIN,IP_HASH_SECRET:HASH,ALLOWED_ORIGINS:origin});
  const request=(path:string,init:RequestInit={},ip='192.0.2.9')=>handle(new Request('https://api.example'+path,{...init,headers:{Origin:origin,...init.headers}}),ip);
  const post=(body:any,ip?:string)=>request('/api/decorations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},ip);
  return {ADMIN,HASH,origin,request,post,db,table:(name:string)=>tables.get(name)!,failWrites:()=>{failWrites=true;}};
}
function input(score=10){return {id:randomUUID(),clientId:randomUUID(),nickname:'云端朋友',message:'圣诞快乐！',design:{kind:'preset',shape:'bell',color:'gold',version:1},answers:questions.map((q,i)=>i<score?q.correct:(q.correct+1)%4),quizVersion:QUIZ_VERSION};}
test('腾讯接口按完整答卷重算0/3/5/7/10分，隐藏内部身份及答卷',async()=>{
  const f=fixture();
  for(const score of [0,3,5,7,10]){const r=await f.post({...input(score),score:999,maxScore:7,createdAt:'2000-01-01T00:00:00.000Z'});assert.equal(r.status,201);const body=await r.json();assert.equal(body.decoration.score,score);assert.equal(body.decoration.maxScore,10);assert.equal(body.decoration.clientHash,undefined);assert.equal(body.decoration.answers,undefined);}
  const items=(await(await f.request('/api/decorations')).json()).decorations;assert.equal(items.length,5);assert.ok(items.every((item:any)=>item.createdAt!=='2000-01-01T00:00:00.000Z'));assert.equal(JSON.stringify(items).includes(f.HASH),false);
});
test('腾讯提交校验题库、字数、造型、Unicode、请求大小；不写入无效挂件',async()=>{
  const f=fixture(),good=input();
  for(const body of [{...good,quizVersion:'outdated'},{...good,answers:[0]},{...good,nickname:'太'.repeat(13)},{...good,message:'字'.repeat(81)},{...good,design:{...good.design,shape:'unknown'}},{...good,nickname:'a\u0000'}])assert.ok((await f.post(body)).status>=400);
  assert.equal((await f.post({...good,message:'😀'.repeat(80)})).status,201);
  assert.equal((await f.request('/api/decorations',{method:'POST',headers:{'Content-Type':'application/json'},body:' '.repeat(4097)})).status,413);
  assert.equal(f.table(COLLECTIONS.decorations).size,1);
});
test('腾讯事务保护同ID/同内容并发重试，不重复挂件或多扣成功额度',async()=>{
  const f=fixture(),body=input(7);
  const responses=await Promise.all(Array.from({length:8},(_,i)=>f.post({...body,id:i%2?randomUUID():body.id})));
  assert.equal(responses.filter(r=>r.status===201).length,1);assert.equal(responses.filter(r=>r.status===200).length,7);assert.equal(f.table(COLLECTIONS.decorations).size,1);
  assert.equal((await f.post({...body,message:'改了内容'})).status,409);
  assert.equal((await f.post({...body,id:randomUUID(),message:'第二枚'})).status,201);
  assert.equal((await f.post({...body,id:randomUUID(),message:'第三枚'})).status,201);
  const limited=await f.post({...body,id:randomUUID(),message:'第四枚'});assert.equal(limited.status,429);assert.ok(Number(limited.headers.get('Retry-After'))>0);
  assert.equal((await f.post(body)).status,200);
});
test('腾讯事务中途写入失败会回滚挂件、重复索引和成功限流计数',async()=>{
  const f=fixture();f.failWrites();assert.equal((await f.post(input())).status,503);assert.equal(f.table(COLLECTIONS.decorations).size,0);assert.equal(f.table(COLLECTIONS.submissions).size,0);
  assert.equal(f.table(COLLECTIONS.limits).size,1,'only the separate invalid-attempt budget persists');
});
test('腾讯管理员鉴权、导出、软删除和重复提交墓碑保护',async()=>{
  const f=fixture(),body=input();await f.post(body);
  const path='/api/admin/decorations/'+body.id;
  assert.equal((await f.request(path,{method:'DELETE'})).status,401);
  assert.equal((await f.request('/api/admin/export?token='+f.ADMIN)).status,401);
  const headers={Authorization:'Bearer '+f.ADMIN};
  assert.equal((await f.request(path,{method:'DELETE',headers})).status,204);
  assert.equal((await f.request(path,{method:'DELETE',headers})).status,204);
  assert.equal((await f.post(body)).status,410);assert.equal((await f.post({...body,id:randomUUID()})).status,410);
  assert.equal((await(await f.request('/api/decorations')).json()).decorations.length,0);
  const backup=await(await f.request('/api/admin/export',{headers})).json();assert.equal(backup.format,'christmas-tree-backup');assert.equal(backup.decorations[0].answers.length,10);assert.ok(backup.decorations[0].deletedAt);assert.equal(backup.decorations[0].clientHash,undefined);
});
test('腾讯管理员导入兼容原备份与旧7分制，不覆盖、复活或部分导入',async()=>{
  const f=fixture(),headers={'Content-Type':'application/json',Authorization:'Bearer '+f.ADMIN};
  const legacy={...makeDemo(1)[0],id:'legacy-seven',score:7,maxScore:undefined},modern={...makeDemo(1)[0],id:'modern-seven',score:7,maxScore:10};
  const run=(decorations:any[])=>f.request('/api/admin/import',{method:'POST',headers,body:JSON.stringify({decorations})});
  assert.equal((await run([legacy,{...modern,nickname:''}])).status,400);assert.equal(f.table(COLLECTIONS.decorations).size,0);
  assert.equal((await(await run([legacy,modern])).json()).imported,2);assert.equal((await(await run([legacy,modern])).json()).imported,0);
  const items=(await(await f.request('/api/decorations')).json()).decorations;assert.deepEqual(items.map((d:any)=>d.maxScore),[7,10]);
  await f.request('/api/admin/decorations/legacy-seven',{method:'DELETE',headers});await run([legacy]);assert.ok(f.table(COLLECTIONS.decorations).get('legacy-seven').deletedAt);
});
test('腾讯列表完整分页超过100条，保留稳定顺序与已移除记录的备份',async()=>{
  const f=fixture();for(const item of makeDemo(123)){const id=item.id;f.table(COLLECTIONS.decorations).set(id,{...item,_id:id,deletedAt:item.id.endsWith('-122')?'2026-11-14T00:00:00Z':null,answers:[],quizVersion:'fixture'});}
  const items=(await(await f.request('/api/decorations')).json()).decorations;assert.equal(items.length,122);assert.equal(new Set(items.map((d:any)=>d.id)).size,122);
  const backup=await(await f.request('/api/admin/export',{headers:{Authorization:'Bearer '+f.ADMIN}})).json();assert.equal(backup.decorations.length,123);
});
test('腾讯来源校验、预检和数据库故障不伪装为空树',async()=>{
  const f=fixture();const preflight=await f.request('/api/decorations',{method:'OPTIONS'});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),f.origin);
  const blocked=await f.request('/api/decorations',{headers:{Origin:'https://evil.example'}});assert.equal(blocked.status,403);assert.equal(blocked.headers.get('Access-Control-Allow-Origin'),null);
  assert.equal((await f.request('/api/health')).status,200);
  // A permissions/missing-collection error must surface as a service error, not zero ornaments.
  f.table(COLLECTIONS.decorations).clear();const broken={...f.db,collection:()=>({limit:()=>({get:async()=>({code:'PERMISSION_DENIED'})})})};
  const api=createApi(createCloudBaseStore(broken),{ALLOWED_ORIGINS:f.origin});assert.equal((await api(new Request('https://api.example/api/health'))).status,503);
});
