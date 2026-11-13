import { questions, QUIZ_VERSION } from '../src/config';
import { calculateScore, colors, shapes, MAX_SCORE, LEGACY_MAX_SCORE, type Decoration, type OrnamentDesign } from '../src/model';

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS: string;
  ADMIN_TOKEN: string;
  IP_HASH_SECRET: string;
}
interface Row {
  id:string; nickname:string; message:string; shape:OrnamentDesign['shape']; color:OrnamentDesign['color'];
  score:number; max_score:7|10; created_at:string; answers_json:string; quiz_version:string;
  client_hash:string; payload_hash:string; deleted_at:string|null;
}
interface Submission { id:string; clientId:string; nickname:string; message:string; design:OrnamentDesign; answers:number[]; quizVersion:string }
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const RECORD_ID=/^[a-z0-9_-]{1,80}$/i;
const encoder=new TextEncoder();
class HttpError extends Error { constructor(public status:number,message:string,public retryAfter?:number){super(message);} }
function json(value:unknown,status=200) { return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}}); }
function publicItem(row:Row):Decoration { return {id:row.id,nickname:row.nickname,message:row.message,score:row.score,maxScore:row.max_score,createdAt:row.created_at,design:{kind:'preset',shape:row.shape,color:row.color,version:1}}; }
async function sha256(value:string) { const bytes=await crypto.subtle.digest('SHA-256',encoder.encode(value));return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join(''); }
async function identity(value:string,secret:string) {
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=await crypto.subtle.sign('HMAC',key,encoder.encode(value));return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
}
async function requireAdmin(request:Request,env:Env) {
  if(!env.ADMIN_TOKEN||env.ADMIN_TOKEN.length<32||env.ADMIN_TOKEN.startsWith('replace-with-'))throw new HttpError(503,'管理员服务尚未配置。');
  const header=request.headers.get('Authorization')??'';
  if(!header.startsWith('Bearer ')||header.length>512)throw new HttpError(401,'需要管理员凭据。');
  const [expected,actual]=await Promise.all([sha256(env.ADMIN_TOKEN),sha256(header.slice(7))]);
  let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^actual.charCodeAt(i);
  if(diff!==0)throw new HttpError(401,'管理员凭据无效。');
}
async function readJson(request:Request,maxBytes=4096):Promise<Record<string,unknown>> {
  if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))throw new HttpError(415,'请使用 JSON 提交。');
  if(Number(request.headers.get('Content-Length'))>maxBytes)throw new HttpError(413,'提交内容太长。');
  const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'缺少提交内容。');
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new HttpError(413,'提交内容太长。');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try {const data=JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:false}).decode(bytes));if(!data||typeof data!=='object'||Array.isArray(data))throw new Error();return data;}
  catch {throw new HttpError(400,'提交内容不是有效的 JSON。');}
}
function submission(data:Record<string,unknown>):Submission {
  if(typeof data.id!=='string'||!UUID.test(data.id)||typeof data.clientId!=='string'||!UUID.test(data.clientId))throw new HttpError(400,'提交标识无效，请刷新后再试。');
  if(data.quizVersion!==QUIZ_VERSION)throw new HttpError(409,'题目已更新，请刷新网页重新答题。');
  if(typeof data.nickname!=='string'||!data.nickname.trim()||Array.from(data.nickname.trim()).length>12||/[\u0000-\u001f\u007f]/.test(data.nickname))throw new HttpError(400,'昵称需要 1～12 个字。');
  if(typeof data.message!=='string'||Array.from(data.message.trim()).length>80||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(data.message))throw new HttpError(400,'留言最多 80 个字。');
  const design=data.design as OrnamentDesign|undefined;
  if(!design||design.kind!=='preset'||design.version!==1||!shapes.includes(design.shape)||!colors.some(c=>c.id===design.color))throw new HttpError(400,'请选择有效的挂件和颜色。');
  if(!Array.isArray(data.answers)||data.answers.length!==questions.length||!data.answers.every(a=>Number.isInteger(a)&&a>=0&&a<4))throw new HttpError(400,'请完整回答十道题。');
  return {id:data.id.toLowerCase(),clientId:data.clientId.toLowerCase(),nickname:data.nickname.trim(),message:data.message.trim(),design:{kind:'preset',shape:design.shape,color:design.color,version:1},answers:data.answers,quizVersion:QUIZ_VERSION};
}
async function budget(db:D1Database,key:string,limit:number,seconds:number) {
  const now=Math.floor(Date.now()/1000),bucket=Math.floor(now/seconds),expires=(bucket+1)*seconds;
  const result=await db.prepare('INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count').bind(`${key}:${bucket}`,expires,limit).first<{count:number}>();
  if(!result)throw new HttpError(429,'提交有点频繁，请稍后再来。',expires-now);
}
async function existing(db:D1Database,input:Submission,clientHash:string,payloadHash:string) {
  return db.prepare('SELECT * FROM decorations WHERE id=? OR (client_hash=? AND payload_hash=?) ORDER BY (id=?) DESC LIMIT 1').bind(input.id,clientHash,payloadHash,input.id).first<Row>();
}
function replay(row:Row,clientHash:string,payloadHash:string) {
  if(row.client_hash!==clientHash||row.payload_hash!==payloadHash)throw new HttpError(409,'这个提交标识已被使用，请重新开始。');
  if(row.deleted_at)throw new HttpError(410,'这枚挂件已由树主人移除。');
  return json({decoration:publicItem(row),replayed:true});
}
async function add(request:Request,env:Env,ctx:ExecutionContext) {
  if(!env.IP_HASH_SECRET||env.IP_HASH_SECRET.length<32||env.IP_HASH_SECRET.startsWith('replace-with-'))throw new HttpError(503,'共享服务尚未配置完成。');
  const ipHash=await identity(`ip:${request.headers.get('CF-Connecting-IP')??'local'}`,env.IP_HASH_SECRET);
  await budget(env.DB,`attempt:${ipHash}`,180,600);
  const input=submission(await readJson(request));
  const [clientHash,payloadHash]=await Promise.all([
    identity(`client:${input.clientId}`,env.IP_HASH_SECRET),
    sha256(JSON.stringify([input.nickname,input.message,input.design.shape,input.design.color,input.answers,input.quizVersion])),
  ]);
  const previous=await existing(env.DB,input,clientHash,payloadHash);if(previous)return replay(previous,clientHash,payloadHash);
  try {
    await budget(env.DB,`client-short:${clientHash}`,3,600);
    await budget(env.DB,`client-day:${clientHash}`,10,86400);
    await budget(env.DB,`ip-short:${ipHash}`,120,600);
    await budget(env.DB,`ip-day:${ipHash}`,400,86400);
  }catch(error){const row=await existing(env.DB,input,clientHash,payloadHash);if(row)return replay(row,clientHash,payloadHash);throw error;}
  // 不读取客户端 score/maxScore/createdAt；分数与时间均由服务端决定。
  const score=calculateScore(input.answers,questions.map(q=>q.correct)),createdAt=new Date().toISOString();
  const result=await env.DB.prepare('INSERT INTO decorations (id,nickname,message,shape,color,score,max_score,created_at,answers_json,quiz_version,client_hash,payload_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING')
    .bind(input.id,input.nickname,input.message,input.design.shape,input.design.color,score,MAX_SCORE,createdAt,JSON.stringify(input.answers),QUIZ_VERSION,clientHash,payloadHash).run();
  const saved=await existing(env.DB,input,clientHash,payloadHash);if(!saved)throw new HttpError(503,'暂时没有保存成功，请重试。');
  ctx.waitUntil(env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(Math.floor(Date.now()/1000)).run().catch(()=>{}));
  if(result.meta.changes===0)return replay(saved,clientHash,payloadHash);
  return json({decoration:publicItem(saved)},201);
}
async function importBackup(request:Request,env:Env) {
  // 仅管理员可以迁移可信的旧存档或恢复备份；公开POST始终只接受答卷并重算分。
  const body=await readJson(request,65536),items=body.decorations;
  if(!Array.isArray(items)||!items.length||items.length>20)throw new HttpError(400,'每批导入 1～20 个挂件。');
  const statements:D1PreparedStatement[]=[];
  for(const item of items){
    const d=item as Decoration&{deletedAt?:string|null;answers?:number[];quizVersion?:string};
    const max=d?.maxScore??LEGACY_MAX_SCORE,design=d?.design;
    if(!d||typeof d.id!=='string'||!RECORD_ID.test(d.id)||typeof d.nickname!=='string'||!d.nickname.trim()||Array.from(d.nickname).length>12||/[\u0000-\u001f\u007f]/.test(d.nickname)||typeof d.message!=='string'||Array.from(d.message).length>80||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(d.message)||![LEGACY_MAX_SCORE,MAX_SCORE].includes(max)||!Number.isInteger(d.score)||d.score<0||d.score>max||!design||design.kind!=='preset'||design.version!==1||!shapes.includes(design.shape)||!colors.some(c=>c.id===design.color)||typeof d.createdAt!=='string'||!Number.isFinite(Date.parse(d.createdAt)))throw new HttpError(400,'备份含有无效挂件，整批未导入。');
    if(d.deletedAt!=null&&(typeof d.deletedAt!=='string'||!Number.isFinite(Date.parse(d.deletedAt))))throw new HttpError(400,'备份中的移除时间无效。');
    const answers=Array.isArray(d.answers)&&[0,7,10].includes(d.answers.length)&&d.answers.every(a=>Number.isInteger(a)&&a>=0&&a<4)?d.answers:[];
    const version=typeof d.quizVersion==='string'&&/^[a-z0-9_-]{1,80}$/i.test(d.quizVersion)?d.quizVersion:'legacy-import';
    statements.push(env.DB.prepare('INSERT INTO decorations (id,nickname,message,shape,color,score,max_score,created_at,answers_json,quiz_version,client_hash,payload_hash,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING')
      .bind(d.id,d.nickname,d.message,design.shape,design.color,d.score,max,d.createdAt,JSON.stringify(answers),version,'admin-import',await sha256(`import:${d.id}`),d.deletedAt??null));
  }
  const results=await env.DB.batch(statements);
  return json({imported:results.reduce((count,result)=>count+result.meta.changes,0),received:items.length});
}
async function route(request:Request,env:Env,ctx:ExecutionContext) {
  const url=new URL(request.url),path=url.pathname.replace(/\/$/,'');
  if(request.method==='GET'&&path==='/api/health')return json({ok:true,quizVersion:QUIZ_VERSION});
  if(path==='/api/decorations'){
    if(request.method==='GET'){
      const result=await env.DB.prepare('SELECT * FROM decorations WHERE deleted_at IS NULL ORDER BY created_at,id').all<Row>();
      return json({decorations:result.results.map(publicItem)});
    }
    if(request.method==='POST')return add(request,env,ctx);
    throw new HttpError(405,'不支持这个操作。');
  }
  if(path.startsWith('/api/admin/')){
    await requireAdmin(request,env);
    if(request.method==='POST'&&path==='/api/admin/import')return importBackup(request,env);
    if(request.method==='GET'&&path==='/api/admin/export'){
      const result=await env.DB.prepare('SELECT * FROM decorations ORDER BY created_at,id').all<Row>();
      const response=json({format:'christmas-tree-backup',version:1,exportedAt:new Date().toISOString(),quizVersion:QUIZ_VERSION,decorations:result.results.map(row=>({...publicItem(row),deletedAt:row.deleted_at,answers:JSON.parse(row.answers_json),quizVersion:row.quiz_version}))});
      response.headers.set('Content-Disposition','attachment; filename="christmas-tree-backup.json"');return response;
    }
    const match=path.match(/^\/api\/admin\/decorations\/([a-z0-9_-]+)$/i);
    if(request.method==='DELETE'&&match&&RECORD_ID.test(match[1])){
      const row=await env.DB.prepare('SELECT id FROM decorations WHERE id=?').bind(match[1]).first();
      if(!row)throw new HttpError(404,'找不到这枚挂件。');
      await env.DB.prepare('UPDATE decorations SET deleted_at=COALESCE(deleted_at,?) WHERE id=?').bind(new Date().toISOString(),match[1]).run();
      return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
    }
  }
  throw new HttpError(404,'接口不存在。');
}
export default {
  async fetch(request:Request,env:Env,ctx:ExecutionContext):Promise<Response> {
    const origin=request.headers.get('Origin');
    const allowed=(env.ALLOWED_ORIGINS??'').split(',').map(value=>value.trim()).filter(Boolean);
    if(origin&&!allowed.includes(origin))return json({error:'这个网页地址尚未获准连接圣诞树。'},403);
    let response:Response;
    try {
      if(request.method==='OPTIONS')response=new Response(null,{status:204});
      else response=await route(request,env,ctx);
    }catch(error){
      if(error instanceof HttpError){response=json({error:error.message},error.status);if(error.retryAfter)response.headers.set('Retry-After',String(error.retryAfter));}
      else {console.error('Christmas API failed',error instanceof Error?error.name:'unknown');response=json({error:'共享服务暂时不可用，请稍后重试。'},503);}
    }
    response.headers.set('Vary','Origin');
    if(origin){response.headers.set('Access-Control-Allow-Origin',origin);response.headers.set('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');response.headers.set('Access-Control-Allow-Headers','Content-Type, Authorization');response.headers.set('Access-Control-Expose-Headers','Retry-After');response.headers.set('Access-Control-Max-Age','600');}
    return response;
  },
} satisfies ExportedHandler<Env>;
