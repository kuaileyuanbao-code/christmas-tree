import { execFileSync,spawn } from 'node:child_process';
import { createServer } from 'node:net';
const env={...process.env,WRANGLER_SEND_METRICS:'false',VITE_API_URL:'http://127.0.0.1:8787',VITE_BASE_PATH:'/'};
execFileSync(process.execPath,['scripts/setup-local.mjs'],{stdio:'inherit',env});
execFileSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--local'],{stdio:'inherit',env});
const children=[];
const stop=()=>{for(const child of children)child.kill();};
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stop();process.exit(0);});
async function free(port){return new Promise(resolve=>{const server=createServer();server.once('error',()=>resolve(false));server.listen(port,'127.0.0.1',()=>server.close(()=>resolve(true)));});}
if(await free(8787)){
  const api=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--local','--ip','127.0.0.1','--port','8787'],{stdio:'inherit',env});children.push(api);
  api.on('exit',code=>{if(code){stop();process.exit(code);}});
}
let ready=false;
for(let i=0;i<80;i++){try{const response=await fetch('http://127.0.0.1:8787/api/health');if(response.ok&&(await response.json()).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
if(!ready){stop();throw new Error('本地共享服务没有就绪，请检查8787端口。');}
if(await free(5173)){
  const frontend=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort',...process.argv.slice(2)],{stdio:'inherit',env});children.push(frontend);
  frontend.on('exit',code=>{stop();process.exit(code??0);});
}else console.log('本地网页已在 http://127.0.0.1:5173/ 运行，可直接打开。');
