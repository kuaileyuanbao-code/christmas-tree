import cloudbase from '@cloudbase/node-sdk';
import { createServer } from 'node:http';
import { isIP } from 'node:net';
import { createApi } from './core.mjs';
import { createCloudBaseStore } from './store.mjs';

let store;
function databaseStore(){
  if(!store){
    const env=process.env.CLOUDBASE_ENV_ID,accessKey=process.env.CLOUDBASE_APIKEY;
    if(!env||!accessKey)throw new Error('CloudBase server credentials are not configured');
    const app=cloudbase.init({env,accessKey,timeout:5000});store=createCloudBaseStore(app.database());
  }
  return store;
}
const lazyStore=new Proxy({},{get(_object,name){return (...args)=>databaseStore()[name](...args);}});
const api=createApi(lazyStore,process.env);
// CloudBase网关将可信源地址附加在X-Forwarded-For末尾，忽略客户端可伪造的前缀。
export function clientAddress(req){const last=String(req.headers['x-forwarded-for']??'').split(',').at(-1)?.trim();return last&&isIP(last)?last:(req.socket.remoteAddress??'unknown');}
export function startServer(port=Number(process.env.PORT||9000),host='0.0.0.0'){
  const server=createServer(async(req,res)=>{
    try{
      const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(','):value);
      const url=new URL(req.url??'/','http://christmas.internal');
      const limit=url.pathname==='/api/admin/import'?65536:4096;
      const method=req.method??'GET';let body;
      if(!['GET','HEAD'].includes(method)){
        body=await new Promise((resolve,reject)=>{const chunks=[];let bytes=0;req.on('data',chunk=>{bytes+=chunk.length;if(bytes<=limit)chunks.push(chunk);});req.on('end',()=>resolve(bytes>limit?null:Buffer.concat(chunks)));req.on('error',reject);});
        if(body===null){body=Buffer.alloc(0);headers.set('Content-Length',String(limit+1));}else headers.set('Content-Length',String(body.length));
      }
      const request=new Request(url,{method,headers,...(body===undefined?{}:{body})});
      const response=await api(request,clientAddress(req));
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
    }catch{if(!res.headersSent)res.writeHead(503,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({error:'共享服务暂时不可用，请稍后重试。'}));}
  });
  server.listen(port,host,()=>console.log('Christmas API ready on port '+server.address().port));return server;
}
if(process.env.TREE_DISABLE_AUTOSTART!=='true')startServer();
