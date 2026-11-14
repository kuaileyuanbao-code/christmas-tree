import { useRef, useState, type FormEvent } from 'react';
import { AdminAuthorizationError, createAdminRepository, type AdminRepository } from './adminStorage';
import { getMaxScore, type Decoration } from './model';
import { Ornament } from './components/Ornament';
import './admin.css';

export default function Admin(){
  const [repository,setRepository]=useState<AdminRepository|null>(null);
  const [items,setItems]=useState<Decoration[]>([]),[pending,setPending]=useState<Decoration|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const credential=useRef<HTMLInputElement>(null);
  function signOut(){setRepository(null);setItems([]);setPending(null);setNotice('');if(credential.current)credential.current.value='';}
  function fail(reason:unknown){if(reason instanceof AdminAuthorizationError)signOut();setError(reason instanceof Error?reason.message:'操作没有完成，请稍后重试。');}
  async function signIn(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;
    const token=credential.current?.value.trim()??'';if(credential.current)credential.current.value='';
    setBusy(true);setError('');setNotice('');
    try {
      const api=import.meta.env.VITE_API_URL?.trim();if(!api)throw new Error('尚未配置管理服务。');
      const client=createAdminRepository(api,token),next=await client.list();setItems(next);setRepository(client);
    }catch(reason){fail(reason);}finally{setBusy(false);}
  }
  async function refresh(){if(!repository||busy)return;setBusy(true);setError('');setNotice('');try{setItems(await repository.list());}catch(reason){fail(reason);}finally{setBusy(false);}}
  async function remove(){
    if(!repository||!pending||busy)return;const item=pending;setBusy(true);setError('');setNotice('');
    try{await repository.remove(item.id);setItems(current=>current.filter(entry=>entry.id!==item.id));setPending(null);setNotice(`已移除「${item.nickname}」的挂件。`);}
    catch(reason){fail(reason);}finally{setBusy(false);}
  }
  async function exportBackup(){
    if(!repository||busy)return;setBusy(true);setError('');setNotice('');
    try{
      const file=await repository.exportBackup(),url=URL.createObjectURL(file),link=document.createElement('a');
      link.href=url;link.download=`christmas-tree-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
      setNotice('已准备 JSON 备份，请在浏览器中保存。');
    }catch(reason){fail(reason);}finally{setBusy(false);}
  }
  return <main className="admin-page">
    <header className="admin-header"><a href={import.meta.env.BASE_URL}>返回圣诞树</a>{repository&&<button type="button" disabled={busy} onClick={()=>{signOut();setError('');}}>退出管理</button>}</header>
    <h1>树主小屋</h1>
    {!repository?<section className="admin-login">
      <p>只为树主人保留的小入口。</p>
      <form onSubmit={signIn}>
        <label htmlFor="admin-key">管理密钥</label>
        <input ref={credential} id="admin-key" type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} required minLength={32} maxLength={512} disabled={busy} aria-describedby="admin-key-help"/>
        <p id="admin-key-help" className="admin-muted">密钥仅在本次页面中使用，刷新后需要重新输入。</p>
        <button className="primary" disabled={busy}>{busy?'正在验证…':'进入管理'}</button>
      </form>
    </section>:<>
      <div className="admin-toolbar"><span>{items.length} 枚挂件</span><div><button type="button" disabled={busy} onClick={refresh}>刷新</button><button type="button" disabled={busy} onClick={exportBackup}>导出备份</button></div></div>
      {items.length===0?<p className="admin-empty">树上还没有朋友的挂件。</p>:<ul className="admin-list">{items.map(item=><li key={item.id}>
        <Ornament design={item.design} hanging={false}/>
        <div className="admin-item-content"><div className="admin-item-heading"><h2>{item.nickname}</h2><span>{item.score} / {getMaxScore(item)} 分</span></div><p className="admin-message">{item.message||'没有留下留言'}</p><div className="admin-item-bottom"><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time><button type="button" className="admin-remove" disabled={busy} onClick={()=>{setPending(item);setError('');setNotice('');}} aria-label={`移除${item.nickname}的挂件`}>移除挂件</button></div></div>
      </li>)}</ul>}
    </>}
    {error&&!pending&&<p className="admin-error" role="alert">{error}</p>}
    {notice&&<p className="admin-notice" role="status">{notice}</p>}
    {pending&&<RemoveConfirmation item={pending} busy={busy} error={error} onCancel={()=>{setPending(null);setError('');}} onConfirm={remove}/>}
  </main>;
}
function RemoveConfirmation({item,busy,error,onCancel,onConfirm}:{item:Decoration;busy:boolean;error:string;onCancel:()=>void;onConfirm:()=>void}){
  const ref=useRef<HTMLDialogElement>(null);
  return <dialog ref={element=>{ref.current=element;if(element&&!element.open)element.showModal();}} className="modal admin-confirm" aria-labelledby="remove-title" onCancel={event=>{event.preventDefault();if(!busy)onCancel();}}>
    <div className="modal-content"><h2 id="remove-title">移除这枚挂件？</h2><p>「{item.nickname}」的挂件和留言会从大家的树上移除，备份中仍保留记录。</p><blockquote>{item.message||'没有留下留言'}</blockquote>{error&&<p className="admin-error" role="alert">{error}</p>}<div className="admin-confirm-actions"><button type="button" disabled={busy} onClick={onCancel}>先留着</button><button type="button" className="primary" disabled={busy} onClick={onConfirm}>{busy?'正在移除…':'确认移除'}</button></div></div>
  </dialog>;
}
