import { valid } from './storage';
import type { Decoration } from './model';

export class AdminAuthorizationError extends Error {}
export interface AdminRepository {
  list():Promise<Decoration[]>;
  remove(id:string):Promise<void>;
  exportBackup():Promise<Blob>;
}
export function createAdminRepository(baseUrl:string,token:string):AdminRepository {
  const base=new URL(baseUrl);
  if((base.protocol!=='https:'&&!(base.protocol==='http:'&&['localhost','127.0.0.1'].includes(base.hostname)))||base.pathname!=='/'||base.username||base.password||base.search||base.hash)throw new Error('管理服务地址无效。');
  if(token.length<32||token.length>512||/[^\x21-\x7e]/.test(token))throw new AdminAuthorizationError('请输入完整的管理密钥。');
  async function request(path:string,method='GET') {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try {
      const response=await fetch(base.origin+path,{method,headers:{Authorization:`Bearer ${token}`},credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal});
      if(!response.ok){
        const body=await response.json().catch(()=>null);
        if(response.status===401)throw new AdminAuthorizationError('管理密钥无效，请重新输入。');
        throw new Error(typeof body?.error==='string'?body.error:'操作没有完成，请稍后重试。');
      }
      return response;
    }catch(error){
      if(error instanceof TypeError||(error instanceof Error&&error.name==='AbortError'))throw new Error('暂时连不上管理服务，请检查网络后重试。');
      throw error;
    }finally {clearTimeout(timer);}
  }
  async function backup(){
    const data=await (await request('/api/admin/export')).json();
    if(data?.format!=='christmas-tree-backup'||data.version!==1||!Array.isArray(data.decorations)||!data.decorations.every((item:unknown)=>valid(item)&&((item as {deletedAt?:unknown}).deletedAt===null||typeof (item as {deletedAt?:unknown}).deletedAt==='string')))throw new Error('管理数据暂时无法读取，请稍后重试。');
    return data;
  }
  return {
    async list(){
      const data=await backup();
      return data.decorations.filter((item:Decoration&{deletedAt:string|null})=>item.deletedAt===null).map((item:Decoration)=>({id:item.id,nickname:item.nickname,message:item.message,score:item.score,maxScore:item.maxScore,createdAt:item.createdAt,design:item.design}));
    },
    async remove(id){
      if(!/^[a-z0-9_-]{1,80}$/i.test(id))throw new Error('挂件标识无效，未执行移除。');
      const response=await request(`/api/admin/decorations/${encodeURIComponent(id)}`,'DELETE');
      if(response.status!==204)throw new Error('未收到移除确认，请刷新列表后检查。');
    },
    async exportBackup(){return new Blob([JSON.stringify(await backup(),null,2)+'\n'],{type:'application/json;charset=utf-8'});},
  };
}
