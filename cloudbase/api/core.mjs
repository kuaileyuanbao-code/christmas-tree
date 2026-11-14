import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { questions, QUIZ_VERSION } from '../../src/config.ts';
import { calculateScore, colors, shapes, MAX_SCORE, LEGACY_MAX_SCORE } from '../../src/model.ts';

export class ApiError extends Error {
  constructor(status,message,retryAfter){super(message);this.status=status;this.retryAfter=retryAfter;}
}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const RECORD_ID=/^[a-z0-9_-]{1,80}$/i;
export const hash=value=>createHash('sha256').update(value).digest('hex');
const identity=(value,key)=>createHmac('sha256',key).update(value).digest('hex');
const goodSecret=value=>typeof value==='string'&&value.length>=32&&!value.startsWith('replace-with-');
export function publicItem(row){return {id:row.id,nickname:row.nickname,message:row.message,score:row.score,maxScore:row.maxScore,createdAt:row.createdAt,design:{kind:'preset',shape:row.design.shape,color:row.design.color,version:1}};}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function readJson(request,limit=4096){
  if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))throw new ApiError(415,'请使用 JSON 提交。');
  if(Number(request.headers.get('Content-Length'))>limit)throw new ApiError(413,'提交内容太长。');
  const reader=request.body?.getReader();if(!reader)throw new ApiError(400,'缺少提交内容。');
  const chunks=[];let size=0;
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>limit){await reader.cancel();throw new ApiError(413,'提交内容太长。');}chunks.push(part.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try{const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();return body;}
  catch{throw new ApiError(400,'提交内容不是有效的 JSON。');}
}
function textFields(item){
  return typeof item.nickname==='string'&&item.nickname.trim()&&Array.from(item.nickname).length<=12&&!/[\u0000-\u001f\u007f]/.test(item.nickname)&&typeof item.message==='string'&&Array.from(item.message).length<=80&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(item.message);
}
function goodDesign(design){return design?.kind==='preset'&&design.version===1&&shapes.includes(design.shape)&&colors.some(c=>c.id===design.color);}
function submission(body){
  if(typeof body.id!=='string'||!UUID.test(body.id)||typeof body.clientId!=='string'||!UUID.test(body.clientId))throw new ApiError(400,'提交标识无效，请刷新后再试。');
  if(body.quizVersion!==QUIZ_VERSION)throw new ApiError(409,'题目已更新，请刷新网页重新答题。');
  if(!textFields(body))throw new ApiError(400,'昵称需要 1～12 个字，留言最多 80 个字。');
  if(!goodDesign(body.design))throw new ApiError(400,'请选择有效的挂件和颜色。');
  if(!Array.isArray(body.answers)||body.answers.length!==questions.length||!body.answers.every(a=>Number.isInteger(a)&&a>=0&&a<4))throw new ApiError(400,'请完整回答十道题。');
  return {id:body.id.toLowerCase(),clientId:body.clientId.toLowerCase(),nickname:body.nickname.trim(),message:body.message.trim(),design:{kind:'preset',shape:body.design.shape,color:body.design.color,version:1},answers:body.answers,quizVersion:QUIZ_VERSION};
}
function requireAdmin(request,env){
  if(!goodSecret(env.ADMIN_TOKEN))throw new ApiError(503,'管理员服务尚未配置。');
  const header=request.headers.get('Authorization')??'';
  if(!header.startsWith('Bearer ')||header.length>512)throw new ApiError(401,'需要管理员凭据。');
  const expected=Buffer.from(hash(env.ADMIN_TOKEN),'hex'),actual=Buffer.from(hash(header.slice(7)),'hex');
  if(!timingSafeEqual(expected,actual))throw new ApiError(401,'管理员凭据无效。');
}
function importRows(items){
  if(!Array.isArray(items)||items.length===0||items.length>20)throw new ApiError(400,'每批导入 1～20 个挂件。');
  return items.map(item=>{
    const max=item?.maxScore??LEGACY_MAX_SCORE;
    if(!item||typeof item.id!=='string'||!RECORD_ID.test(item.id)||!textFields(item)||!goodDesign(item.design)||![LEGACY_MAX_SCORE,MAX_SCORE].includes(max)||!Number.isInteger(item.score)||item.score<0||item.score>max||typeof item.createdAt!=='string'||!Number.isFinite(Date.parse(item.createdAt)))throw new ApiError(400,'备份含有无效挂件，整批未导入。');
    if(item.deletedAt!=null&&(typeof item.deletedAt!=='string'||!Number.isFinite(Date.parse(item.deletedAt))))throw new ApiError(400,'备份中的移除时间无效。');
    return {...publicItem({...item,maxScore:max}),deletedAt:item.deletedAt??null,
      answers:Array.isArray(item.answers)&&[0,7,10].includes(item.answers.length)&&item.answers.every(a=>Number.isInteger(a)&&a>=0&&a<4)?item.answers:[],
      quizVersion:typeof item.quizVersion==='string'&&RECORD_ID.test(item.quizVersion)?item.quizVersion:'legacy-import',
      clientHash:'admin-import',payloadHash:hash('import:'+item.id)};
  });
}
export function createApi(store,env){
  const allowed=(env.ALLOWED_ORIGINS??'').split(',').map(x=>x.trim()).filter(Boolean);
  async function route(request,clientAddress){
    const path=new URL(request.url).pathname.replace(/\/$/,'');
    if(request.method==='GET'&&path==='/api/health'){await store.ready();return json({ok:true,storage:'cloudbase',quizVersion:QUIZ_VERSION});}
    if(path==='/api/decorations'){
      if(request.method==='GET')return json({decorations:(await store.list()).filter(row=>!row.deletedAt).map(publicItem)});
      if(request.method!=='POST')throw new ApiError(405,'不支持这个操作。');
      if(!goodSecret(env.IP_HASH_SECRET))throw new ApiError(503,'共享服务尚未配置完成。');
      const now=Math.floor(Date.now()/1000),ipHash=identity('ip:'+clientAddress,env.IP_HASH_SECRET);
      await store.consume('attempt:'+ipHash,180,600,now);
      const input=submission(await readJson(request));
      const clientHash=identity('client:'+input.clientId,env.IP_HASH_SECRET);
      const payloadHash=hash(JSON.stringify([input.nickname,input.message,input.design.shape,input.design.color,input.answers,input.quizVersion]));
      const indexKey=hash(clientHash+':'+payloadHash);
      const row={...input,clientHash,payloadHash,score:calculateScore(input.answers,questions.map(q=>q.correct)),maxScore:MAX_SCORE,createdAt:new Date().toISOString(),deletedAt:null};
      delete row.clientId;
      const budgets=[['client-short:'+clientHash,3,600],['client-day:'+clientHash,10,86400],['ip-short:'+ipHash,120,600],['ip-day:'+ipHash,400,86400]];
      const result=await store.add(row,indexKey,budgets,now);
      return json({decoration:publicItem(result.row),...(result.replayed?{replayed:true}:{})},result.replayed?200:201);
    }
    if(path.startsWith('/api/admin/')){
      requireAdmin(request,env);
      if(request.method==='GET'&&path==='/api/admin/export'){
        const rows=await store.list();
        const response=json({format:'christmas-tree-backup',version:1,exportedAt:new Date().toISOString(),quizVersion:QUIZ_VERSION,decorations:rows.map(row=>({...publicItem(row),deletedAt:row.deletedAt??null,answers:row.answers,quizVersion:row.quizVersion}))});
        response.headers.set('Content-Disposition','attachment; filename="christmas-tree-backup.json"');return response;
      }
      if(request.method==='POST'&&path==='/api/admin/import'){
        const rows=importRows((await readJson(request,65536)).decorations);
        return json({imported:await store.import(rows),received:rows.length});
      }
      const match=path.match(/^\/api\/admin\/decorations\/([a-z0-9_-]{1,80})$/i);
      if(request.method==='DELETE'&&match){if(!await store.remove(match[1],new Date().toISOString()))throw new ApiError(404,'找不到这枚挂件。');return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});}
    }
    throw new ApiError(404,'接口不存在。');
  }
  return async function handle(request,clientAddress='unknown'){
    const origin=request.headers.get('Origin');
    if(origin&&!allowed.includes(origin))return json({error:'这个网页地址尚未获准连接圣诞树。'},403);
    let response;
    try{response=request.method==='OPTIONS'?new Response(null,{status:204}):await route(request,clientAddress);}
    catch(error){
      if(error instanceof ApiError){response=json({error:error.message},error.status);if(error.retryAfter)response.headers.set('Retry-After',String(error.retryAfter));}
      else{console.error('Christmas API failed',error instanceof Error?error.name:'unknown');response=json({error:'共享服务暂时不可用，请稍后重试。'},503);}
    }
    response.headers.set('Vary','Origin');
    if(origin){response.headers.set('Access-Control-Allow-Origin',origin);response.headers.set('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');response.headers.set('Access-Control-Allow-Headers','Content-Type, Authorization');response.headers.set('Access-Control-Expose-Headers','Retry-After');response.headers.set('Access-Control-Max-Age','600');}
    return response;
  };
}
