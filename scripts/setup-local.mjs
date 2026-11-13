import { randomBytes } from 'node:crypto';
import { access, writeFile } from 'node:fs/promises';
async function create(path,contents){try{await access(path);console.log(`${path} 已存在，保留原配置。`);}catch{await writeFile(path,contents,{flag:'wx',mode:0o600});console.log(`已创建 ${path}`);}}
await create('.dev.vars',`ADMIN_TOKEN=${randomBytes(32).toString('hex')}\nIP_HASH_SECRET=${randomBytes(32).toString('hex')}\nALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173\n`);
await create('.env.local','VITE_API_URL=http://127.0.0.1:8787\nVITE_BASE_PATH=/\n');
console.log('下一步：npm run db:local，然后分别启动 npm run api:dev 和 npm run dev。不会连接或修改线上账号。');
