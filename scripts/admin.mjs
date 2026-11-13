import { writeFile,readFile } from 'node:fs/promises';

const [command,...args]=process.argv.slice(2);
const option=name=>{const index=args.indexOf(name);return index>=0?args[index+1]:undefined;};
const api=option('--url'),token=process.env.TREE_ADMIN_TOKEN;
if(!api||!token){console.error('需要 --url API地址，并在当前终端设置 TREE_ADMIN_TOKEN。密钥不会写进前端、URL或日志。');process.exit(1);}
const base=new URL(api);
if((base.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(base.hostname))||base.username||base.password||base.search||base.hash||base.pathname!=='/')throw new Error('请提供 HTTPS API 源地址（本地开发可用 http://127.0.0.1:8787）。');
const headers={Authorization:`Bearer ${token}`};
if(command==='export'){
  const output=option('--out');if(!output)throw new Error('请用 --out 指定备份JSON保存路径。');
  const response=await fetch(`${base.origin}/api/admin/export`,{headers});if(!response.ok)throw new Error(`导出失败：HTTP ${response.status}`);
  const data=await response.json();if(data.format!=='christmas-tree-backup')throw new Error('返回的数据不是圣诞树备份。');
  await writeFile(output,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});console.log(`已保存备份，共 ${data.decorations.length} 条（含已移除记录）。`);
}else if(command==='delete'){
  const id=option('--id');if(!id||!/^[a-z0-9_-]{1,80}$/i.test(id))throw new Error('请用 --id 指定备份中的挂件ID。');
  if(!args.includes('--confirm'))throw new Error('核对昵称和挂件ID后，追加 --confirm 执行移除。');
  const response=await fetch(`${base.origin}/api/admin/decorations/${id}`,{method:'DELETE',headers});if(response.status!==204)throw new Error(`移除失败：HTTP ${response.status}`);console.log('挂件已从共享树移除。');
}else if(command==='import'){
  const filename=option('--file');if(!filename||!args.includes('--confirm'))throw new Error('核对旧存档或备份文件后，用 --file 路径 --confirm 导入。');
  const data=JSON.parse((await readFile(filename,'utf8')).replace(/^\uFEFF/,''));
  const decorations=Array.isArray(data)?data:data?.decorations;if(!Array.isArray(decorations))throw new Error('文件应为旧版挂件数组或JSON备份。');
  let imported=0;
  for(let i=0;i<decorations.length;i+=20){
    const response=await fetch(`${base.origin}/api/admin/import`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({decorations:decorations.slice(i,i+20)})});
    if(!response.ok)throw new Error(`第 ${Math.floor(i/20)+1} 批导入失败（HTTP ${response.status}）。已完成的批次保留，修复后可重试，不会重复导入。`);
    imported+=(await response.json()).imported;
  }
  console.log(`导入完成：新增 ${imported} 条，重复ID保留原记录。`);
}else throw new Error('仅支持 export、delete 或 import 命令。');
