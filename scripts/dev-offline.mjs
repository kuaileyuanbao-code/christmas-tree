import { spawn } from 'node:child_process';
// 明确的离线验收模式，只在开发服务器中允许；生产构建不能使用该模式。
const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5174','--strictPort'],{stdio:'inherit',env:{...process.env,VITE_STORAGE_MODE:'local'}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??0));
