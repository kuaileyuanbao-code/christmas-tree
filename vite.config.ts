import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode,command})=>{
  const env=loadEnv(mode,process.cwd(),'');
  if(command==='build'&&env.VITE_STORAGE_MODE==='local')throw new Error('离线验收模式不能发布，请配置共享API后构建。');
  if(command==='build'&&!env.VITE_API_URL)throw new Error('生产构建必须设置 VITE_API_URL，避免误发布成单机试玩版。');
  if(env.VITE_API_URL){const url=new URL(env.VITE_API_URL);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('VITE_API_URL 应为 Worker 的完整源地址，例如 https://your-api.workers.dev（不带/api或密钥）。');}
  return {plugins:[react()],base:env.VITE_BASE_PATH||'/',server:{host:'127.0.0.1'},build:{sourcemap:false}};
});
