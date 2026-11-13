import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const parsed=ts.parseConfigFileTextToJson('wrangler.jsonc',await readFile('wrangler.jsonc','utf8'));
if(parsed.error)throw new Error('wrangler.jsonc格式无效，请先检查JSON配置。');
const config=parsed.config;
const database=config.d1_databases?.find(d=>d.binding==='DB');
if(!database||database.database_id==='00000000-0000-0000-0000-000000000000')throw new Error('先在Cloudflare创建D1，并将真实database_id写入wrangler.jsonc。');
const origins=(config.vars?.ALLOWED_ORIGINS??'').split(',').map(s=>s.trim());
if(!origins.some(s=>s.startsWith('https://')))throw new Error('先配置GitHub Pages的HTTPS来源地址 ALLOWED_ORIGINS（不含仓库子路径）。');
for(const origin of origins){const url=new URL(origin);if(url.origin!==origin||url.username||url.password)throw new Error('ALLOWED_ORIGINS只能填写源地址，例如 https://username.github.io。');}
console.log('部署前配置检查通过。此命令本身不会登录或部署。');
