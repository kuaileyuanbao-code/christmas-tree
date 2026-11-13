import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, mkdir, mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { questions, QUIZ_VERSION } from '../src/config.ts';

const ADMIN='test-admin-only-'.padEnd(64,'a'),HASH='test-hash-only-'.padEnd(64,'h');
const origin='http://127.0.0.1:5173';
let mf:Miniflare,db:Awaited<ReturnType<Miniflare['getD1Database']>>,persist:string,scriptPath:string;
const options=()=>({modules:true,scriptPath,compatibilityDate:'2026-11-13',d1Databases:{DB:'test-db'},resourcePersistencePath:persist,bindings:{ADMIN_TOKEN:ADMIN,IP_HASH_SECRET:HASH,ALLOWED_ORIGINS:origin}});
before(async()=>{
  await mkdir('.test-artifacts',{recursive:true});persist=await mkdtemp(resolve('.test-artifacts/api-db-'));scriptPath=resolve('.test-artifacts/api-worker.mjs');
  await build({entryPoints:['worker/index.ts'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:scriptPath});
  mf=new Miniflare(convertV4MiniflareOptions(options()));db=await mf.getD1Database('DB');
  const sql=await readFile('worker/migrations/0001_initial.sql','utf8');
  for(const statement of sql.split(';').filter(s=>s.trim()))await db.prepare(statement).run();
});
after(async()=>{await mf?.dispose();});
function input(score=10){return {id:randomUUID(),clientId:randomUUID(),nickname:'共享朋友',message:'愿你圣诞快乐。',design:{kind:'preset',shape:'heart',color:'white',version:1},answers:questions.map((q,i)=>i<score?q.correct:(q.correct+1)%4),quizVersion:QUIZ_VERSION};}
function request(path:string,init:RequestInit={}){return mf.dispatchFetch(`http://localhost${path}`,{...init,headers:{Origin:origin,...init.headers}});}
function post(body:unknown,headers:Record<string,string>={}){return request('/api/decorations',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});}

test('允许的来源可预检，其他来源被拒绝；管理接口不接受URL密钥',async()=>{
  const preflight=await request('/api/decorations',{method:'OPTIONS'});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);
  assert.equal((await request('/api/decorations',{headers:{Origin:'https://evil.example'}})).status,403);
  assert.equal((await request(`/api/admin/export?token=${ADMIN}`)).status,401);
  assert.equal((await request('/api/admin/export',{headers:{Authorization:'Bearer wrong'}})).status,401);
});
test('服务端按实际十个答案计算0～10分，忽略伪造分数、满分和时间',async()=>{
  for(let score=0;score<=10;score++){
    const response=await post({...input(score),score:999,maxScore:7,createdAt:'2000-01-01T00:00:00.000Z'});assert.equal(response.status,201);
    const {decoration}=await response.json() as any;assert.equal(decoration.score,score);assert.equal(decoration.maxScore,10);assert.ok(decoration.createdAt.startsWith('2026-')||new Date(decoration.createdAt).getTime()>Date.parse('2025-01-01'));assert.notEqual(decoration.createdAt,'2000-01-01T00:00:00.000Z');
    assert.equal(decoration.answers,undefined);assert.equal(decoration.client_hash,undefined);
  }
});
test('单题位置和全部正确答案在后端保持一致',async()=>{
  for(let correctIndex=0;correctIndex<10;correctIndex++){
    const body=input(0);body.answers[correctIndex]=questions[correctIndex].correct;
    const response=await post(body);assert.equal(response.status,201);assert.equal(((await response.json()) as any).decoration.score,1);
  }
});
test('校验昵称、留言、挂件、颜色、题目版本与完整答卷',async()=>{
  const cases=[
    [{nickname:' '},400],[{nickname:'字'.repeat(13)},400],[{message:'字'.repeat(81)},400],
    [{nickname:'坏\n名字'},400],[{design:{kind:'drawing'}},400],[{design:{kind:'preset',shape:'ball',color:'invalid',version:1}},400],
    [{answers:[0]},400],[{answers:Array(10).fill(4)},400],[{answers:Array(10).fill(0.5)},400],[{quizVersion:'old-order'},409],[{clientId:'invalid'},400],
  ] as const;
  for(const [changes,status] of cases)assert.equal((await post({...input(),...changes})).status,status);
  const accepted=await post({...input(),nickname:'🎄'.repeat(12),message:'🎁'.repeat(80)});assert.equal(accepted.status,201);
  assert.equal((await request('/api/decorations',{method:'POST',headers:{'Content-Type':'text/plain'},body:'{}'})).status,415);
  assert.equal((await request('/api/decorations',{method:'POST',headers:{'Content-Type':'application/json'},body:'{broken'})).status,400);
  assert.equal((await request('/api/decorations',{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(4097)})).status,413);
});
test('重复点击、网络重试和相同内容的新ID不会生成重复挂件；同ID改内容被拒绝',async()=>{
  const body=input(5);const first=await post(body);assert.equal(first.status,201);
  const retry=await post(body);assert.equal(retry.status,200);assert.equal(((await retry.json()) as any).decoration.id,body.id);
  const another=await post({...body,id:randomUUID()});assert.equal(another.status,200);assert.equal(((await another.json()) as any).decoration.id,body.id);
  assert.equal((await post({...body,message:'改了内容'})).status,409);
  assert.equal((await post({...body,clientId:randomUUID()})).status,409);
  const count=await db.prepare('SELECT COUNT(*) AS n FROM decorations WHERE client_hash=(SELECT client_hash FROM decorations WHERE id=?)').bind(body.id).first<{n:number}>();assert.equal(count?.n,1);
});
test('并发重复请求最多只写一条，D1唯一约束保护一致性',async()=>{
  const body=input(3);const responses=await Promise.all([post(body),post(body),post(body)]);
  for(const response of responses)assert.ok([200,201].includes(response.status));
  const count=await db.prepare('SELECT COUNT(*) AS n FROM decorations WHERE id=?').bind(body.id).first<{n:number}>();assert.equal(count?.n,1);
});
test('同浏览器短时间第四份不同提交受限，已有提交重试不再消耗成功额度',async()=>{
  const body=input(7);for(let i=0;i<3;i++)assert.equal((await post({...body,id:randomUUID(),message:`祝福${i}`})).status,201);
  const limited=await post({...body,id:randomUUID(),message:'第四份'});assert.equal(limited.status,429);assert.ok(Number(limited.headers.get('Retry-After'))>0);
  const replay=await post({...body,id:randomUUID(),message:'祝福0'});assert.equal(replay.status,200);
});
test('管理员导出完整JSON，删除后所有访问者看不到；重试不会复活已删挂件',async()=>{
  const body=input(9);assert.equal((await post(body)).status,201);
  const auth={Authorization:`Bearer ${ADMIN}`};
  const backup=await request('/api/admin/export',{headers:auth});assert.equal(backup.status,200);
  const data=await backup.json() as any;assert.equal(data.format,'christmas-tree-backup');assert.equal(data.decorations.find((d:any)=>d.id===body.id).answers.length,10);
  assert.ok(!JSON.stringify(data).includes(HASH));assert.ok(!JSON.stringify(data).includes(ADMIN));assert.equal(data.decorations[0].client_hash,undefined);
  assert.equal((await request(`/api/admin/decorations/${body.id}`,{method:'DELETE'})).status,401);
  assert.equal((await request(`/api/admin/decorations/${body.id}`,{method:'DELETE',headers:auth})).status,204);
  assert.equal((await request(`/api/admin/decorations/${body.id}`,{method:'DELETE',headers:auth})).status,204);
  const list=await (await request('/api/decorations')).json() as any;assert.ok(!list.decorations.some((d:any)=>d.id===body.id));assert.ok(list.decorations.every((d:any)=>d.answers===undefined&&d.client_hash===undefined));
  assert.equal((await post(body)).status,410);
  const all=await (await request('/api/admin/export',{headers:auth})).json() as any;assert.ok(all.decorations.find((d:any)=>d.id===body.id).deletedAt);
});
test('只有管理员可迁移旧本地存档；保留原分数，重复导入不覆盖或复活记录',async()=>{
  const auth={Authorization:`Bearer ${ADMIN}`,'Content-Type':'application/json'};
  const legacy={id:'legacy-import-7',nickname:'旧朋友',message:'旧留言',score:7,design:{kind:'preset',shape:'star',color:'gold',version:1},createdAt:'2026-11-01T00:00:00.000Z'};
  const modern={...legacy,id:randomUUID(),maxScore:10,score:7};
  const importing=(records:unknown[],headers=auth)=>request('/api/admin/import',{method:'POST',headers,body:JSON.stringify({decorations:records})});
  assert.equal((await importing([legacy],{'Content-Type':'application/json'} as typeof auth)).status,401);
  assert.equal((await importing([legacy,{...modern,nickname:'太长'.repeat(7)}])).status,400);
  assert.equal(await db.prepare('SELECT id FROM decorations WHERE id=?').bind(legacy.id).first(),null);
  const result=await importing([legacy,modern]);assert.equal(result.status,200);assert.equal(((await result.json()) as any).imported,2);
  const list=await (await request('/api/decorations')).json() as any;
  assert.equal(list.decorations.find((d:any)=>d.id===legacy.id).maxScore,7);assert.equal(list.decorations.find((d:any)=>d.id===legacy.id).score,7);
  assert.equal(list.decorations.find((d:any)=>d.id===modern.id).maxScore,10);
  assert.equal(((await (await importing([legacy,modern])).json()) as any).imported,0);
  assert.equal((await request(`/api/admin/decorations/${legacy.id}`,{method:'DELETE',headers:auth})).status,204);
  await importing([legacy]);assert.ok((await db.prepare('SELECT deleted_at FROM decorations WHERE id=?').bind(legacy.id).first<{deleted_at:string}>())?.deleted_at);
});
test('Worker重启后D1仍然保留已提交挂件与限流计数',async()=>{
  const body=input(10);assert.equal((await post(body)).status,201);
  const client=input(0);for(let i=0;i<3;i++)assert.equal((await post({...client,id:randomUUID(),message:`持久限流${i}`})).status,201);
  await mf.dispose();mf=new Miniflare(convertV4MiniflareOptions(options()));db=await mf.getD1Database('DB');
  const list=await (await request('/api/decorations')).json() as any;assert.ok(list.decorations.some((d:any)=>d.id===body.id));
  assert.equal((await post({...client,id:randomUUID(),message:'重启后第四次'})).status,429);
});
