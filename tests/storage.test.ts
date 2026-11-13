import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { localDecorationRepository as decorationRepository, createCloudRepository, STORAGE_KEY } from '../src/storage.ts';
import { QUIZ_VERSION } from '../src/config.ts';
import { makeDemo } from '../src/model.ts';

let data:Map<string,string>;
beforeEach(()=>{
  data=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}}});
});
test('读取旧版挂件不改原存档；新增后旧记录带满分7，新记录带满分10',async()=>{
  const legacy=makeDemo(8).map(({maxScore,...item},score)=>({...item,score}));
  const raw=JSON.stringify(legacy);data.set(STORAGE_KEY,raw);
  const read=await decorationRepository.list();
  assert.equal(data.get(STORAGE_KEY),raw);assert.deepEqual(read,legacy.map(item=>({...item,maxScore:7})));
  const modern={...makeDemo(1)[0],id:'new-ten',score:10};await decorationRepository.add(modern);
  const persisted=JSON.parse(data.get(STORAGE_KEY)!);assert.equal(persisted.length,9);
  assert.deepEqual(persisted.slice(0,8),read);assert.deepEqual(persisted[8],modern);
  assert.deepEqual(await decorationRepository.list(),persisted);
});
test('新7分存档不会被当成旧7分，旧模拟记录也保持原满分',async()=>{
  const modern={...makeDemo(1)[0],id:'formal-seven',score:7};
  const {maxScore,...oldDemo}=makeDemo(1)[0];
  data.set(STORAGE_KEY,JSON.stringify([{...oldDemo,id:'old-demo',score:7},modern]));
  assert.deepEqual((await decorationRepository.list()).map(d=>[d.id,d.score,d.maxScore,d.demo]),[['old-demo',7,7,true],['formal-seven',7,10,true]]);
});
test('非法新旧分数不覆盖存档；写入错误也不会抹去原记录',async()=>{
  for(const invalid of [{score:8,maxScore:undefined},{score:8,maxScore:7},{score:11,maxScore:10},{score:3,maxScore:8}]){
    const raw=JSON.stringify([{...makeDemo(1)[0],...invalid}]);data.set(STORAGE_KEY,raw);
    await assert.rejects(()=>decorationRepository.list());assert.equal(data.get(STORAGE_KEY),raw);
  }
  const raw=JSON.stringify(makeDemo(2));data.set(STORAGE_KEY,raw);
  await assert.rejects(()=>decorationRepository.add({...makeDemo(1)[0],id:'invalid',score:11}));assert.equal(data.get(STORAGE_KEY),raw);
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>data.get(key)??null,setItem:()=>{throw new Error('quota');}}});
  await assert.rejects(()=>decorationRepository.add({...makeDemo(1)[0],id:'quota'}),/保存没有成功/);assert.equal(data.get(STORAGE_KEY),raw);
});
test('云端接口只发送答卷，采用服务端成绩；断网不回退或修改localStorage',async()=>{
  const originalFetch=globalThis.fetch;
  const local=JSON.stringify(makeDemo(2));data.set(STORAGE_KEY,local);
  const sent=makeDemo(1)[0],canonical={...sent,score:3};let payload:any;
  const repository=createCloudRepository('https://tree-api.example');
  try {
    globalThis.fetch=async(_url,init)=>{payload=JSON.parse(init?.body as string);return new Response(JSON.stringify({decoration:canonical}),{status:201});};
    const saved=await repository.add(sent,{answers:Array(10).fill(0),quizVersion:QUIZ_VERSION});
    assert.deepEqual(saved,canonical);assert.equal(payload.score,undefined);assert.equal(payload.maxScore,undefined);assert.equal(payload.createdAt,undefined);assert.equal(payload.quizVersion,QUIZ_VERSION);assert.equal(payload.answers.length,10);
    globalThis.fetch=async()=>{throw new TypeError('offline');};
    await assert.rejects(()=>repository.list(),/连不上共享/);await assert.rejects(()=>repository.add(sent,{answers:Array(10).fill(0),quizVersion:QUIZ_VERSION}),/连不上共享/);
    assert.equal(data.get(STORAGE_KEY),local);
  }finally {globalThis.fetch=originalFetch;}
});
