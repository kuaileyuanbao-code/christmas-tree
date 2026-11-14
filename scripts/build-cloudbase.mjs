import { build } from 'esbuild';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
const output='cloudbase/api/dist';await mkdir(output,{recursive:true});
await build({entryPoints:['cloudbase/api/server.mjs'],bundle:true,platform:'node',target:'node20',format:'cjs',outfile:output+'/index.js',legalComments:'eof'});
await writeFile(output+'/package.json',JSON.stringify({name:'christmas-tree-api',private:true,version:'1.0.0',type:'commonjs',main:'index.js'},null,2)+'\n');
await writeFile(output+'/scf_bootstrap',await readFile('cloudbase/api/scf_bootstrap','utf8'),{mode:0o755});
console.log('CloudBase Node.js 20 HTTP API bundle generated with pinned server SDK included. No runtime npm install or embedded credentials.');
