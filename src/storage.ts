import { colors, shapes, getMaxScore, MAX_SCORE, LEGACY_MAX_SCORE, type Decoration } from './model';
export const STORAGE_KEY='my-christmas-tree:v1';
export interface AnswerSubmission { answers:number[]; quizVersion:string }
export interface DecorationRepository { list():Promise<Decoration[]>; add(item:Decoration,submission?:AnswerSubmission):Promise<Decoration> }
export function valid(value:unknown): value is Decoration {
  if(!value||typeof value!=='object') return false;
  const d=value as Decoration;
  return typeof d.id==='string'&&typeof d.nickname==='string'&&d.nickname.trim().length>0&&Array.from(d.nickname).length<=12&&typeof d.message==='string'&&Array.from(d.message).length<=80&&(d.maxScore===undefined||d.maxScore===LEGACY_MAX_SCORE||d.maxScore===MAX_SCORE)&&Number.isInteger(d.score)&&d.score>=0&&d.score<=getMaxScore(d)&&typeof d.createdAt==='string'&&d.design?.kind==='preset'&&d.design.version===1&&shapes.includes(d.design.shape)&&colors.some(c=>c.id===d.design.color);
}
export const localDecorationRepository:DecorationRepository={
  async list(){
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw) return [];
    try {const data=JSON.parse(raw); if(!Array.isArray(data)||!data.every(valid)) throw new Error(); return data.map(d=>({...d,maxScore:getMaxScore(d)}));}
    catch {throw new Error('本地存档暂时无法读取，原始数据仍然保留。请备份后检查浏览器存储。');}
  },
  async add(item){
    if(!valid(item)) throw new Error('挂件成绩或内容无效，请重新答题后再试。');
    const all=await this.list();
    if(!all.some(d=>d.id===item.id)) {
      try {localStorage.setItem(STORAGE_KEY,JSON.stringify([...all,item]));}
      catch {throw new Error('保存没有成功，请检查浏览器是否允许本地存储，或是否还有空间。你的设计仍在这里。');}
    }
    return item;
  }
};

let temporaryClientId:string|undefined;
function clientId() {
  const key='my-christmas-tree:client-id';
  try {const saved=localStorage.getItem(key);if(saved&&/^[a-f0-9-]{36}$/i.test(saved))return saved;const id=crypto.randomUUID();localStorage.setItem(key,id);return id;}
  catch {return temporaryClientId??=crypto.randomUUID();}
}
export function createCloudRepository(baseUrl:string):DecorationRepository {
  const base=baseUrl.replace(/\/$/,'');
  async function request(path:string,init:RequestInit={}) {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try {
      const response=await fetch(`${base}${path}`,{...init,credentials:'omit',cache:'no-store',signal:controller.signal});
      const body=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(typeof body?.error==='string'?body.error:'共享服务暂时不可用，请稍后重试。');
      return body;
    }catch(error){if(error instanceof TypeError||(error instanceof Error&&error.name==='AbortError'))throw new Error('暂时连不上共享圣诞树，请检查网络后重试。你的设计仍在这里。');throw error;}
    finally {clearTimeout(timer);}
  }
  return {
    async list(){const body=await request('/api/decorations');if(!Array.isArray(body?.decorations)||!body.decorations.every(valid))throw new Error('共享挂件数据暂时无法读取，请稍后重试。');return body.decorations;},
    async add(item,submission){
      if(!submission)throw new Error('请完成十道题后再挂上去。');
      const body=await request('/api/decorations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,clientId:clientId(),nickname:item.nickname,message:item.message,design:item.design,answers:submission.answers,quizVersion:submission.quizVersion})});
      if(!valid(body?.decoration))throw new Error('没有收到完整的保存确认，请重试。');
      return body.decoration;
    },
  };
}
const offlineDev=import.meta.env?.DEV&&import.meta.env?.VITE_STORAGE_MODE==='local';
const apiUrl=offlineDev?undefined:import.meta.env?.VITE_API_URL?.trim();
export const usesCloudStorage=Boolean(apiUrl);
export const decorationRepository:DecorationRepository=apiUrl?createCloudRepository(apiUrl):
  (offlineDev?localDecorationRepository:{async list(){throw new Error('尚未配置共享圣诞树服务，请先运行 npm run setup:local。');},async add(){throw new Error('尚未配置共享圣诞树服务。');}});
