import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir,mkdtemp,readFile,writeFile,readdir } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { Miniflare,convertV4MiniflareOptions } from 'miniflare';
import { chromium } from '@playwright/test';
import { questions } from '../src/config.ts';

await mkdir('.test-artifacts',{recursive:true});await mkdir('screenshots',{recursive:true});
const root=await mkdtemp(resolve('.test-artifacts/cloud-ui-')),output=resolve(root,'pages'),workerFile=resolve(root,'worker.mjs');
const base='/christmas-tree-test/';
const ADMIN='local-ui-admin-fixture-'.padEnd(64,'x');
const report=[];const note=message=>{report.push(message);console.log(message);};
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.ttf':'font/ttf'};
const server=createServer(async(req,res)=>{
  try {
    const path=new URL(req.url,'http://local').pathname;
    if(!path.startsWith(base)){res.writeHead(404);res.end();return;}
    const target=resolve(output,decodeURIComponent(path.slice(base.length))||'index.html');
    if(!target.startsWith(output+sep)){res.writeHead(403);res.end();return;}
    const contents=await readFile(target);res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream'});res.end(contents);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const frontend=`http://127.0.0.1:${server.address().port}`;
await build({entryPoints:['worker/index.ts'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:workerFile});
const options={host:'127.0.0.1',port:0,modules:true,scriptPath:workerFile,compatibilityDate:'2026-11-13',resourcePersistencePath:resolve(root,'d1'),d1Databases:{DB:'cloud-ui-db'},bindings:{ADMIN_TOKEN:ADMIN,IP_HASH_SECRET:'local-ui-hash-fixture-'.padEnd(64,'h'),ALLOWED_ORIGINS:frontend}};
let mf=new Miniflare(convertV4MiniflareOptions(options)),browser;
try {
  const api=new URL(await mf.ready).origin;
  const db=await mf.getD1Database('DB');
  for(const sql of (await readFile('worker/migrations/0001_initial.sql','utf8')).split(';').filter(s=>s.trim()))await db.prepare(sql).run();
  execFileSync(process.execPath,['node_modules/vite/bin/vite.js','build','--outDir',output],{env:{...process.env,VITE_API_URL:api,VITE_BASE_PATH:base},stdio:'pipe'});
  const pageUrl=frontend+base;
  browser=await chromium.launch({channel:'msedge',headless:true});
  const contextA=await browser.newContext({viewport:{width:390,height:844}}),contextB=await browser.newContext({viewport:{width:1440,height:1000}});
  const a=await contextA.newPage(),b=await contextB.newPage();const errors=[],bad=[];
  for(const page of [a,b]){page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)bad.push(`${r.status()} ${new URL(r.url()).pathname}`);});}
  await Promise.all([a.goto(pageUrl),b.goto(pageUrl)]);
  await a.waitForFunction(()=>document.querySelector('.tree-image')?.naturalWidth>0);
  assert.equal(await a.locator('.tree-image').getAttribute('src'),`${base}assets/tree-cozy-skirt.webp`);
  assert.equal(await a.locator('h1').innerText(),'快乐源宝的圣诞树');
  assert.equal(await a.evaluate(()=>localStorage.getItem('my-christmas-tree:v1')),null);
  assert.equal(await a.locator('.dev-panel').count(),0);await a.keyboard.press('Control+Shift+D');assert.equal(await a.locator('.dev-panel').count(),0);
  note('PASS 生产构建部署在 /christmas-tree-test/ 子路径：JS/CSS/树体正常，正式版无调试入口');

  async function play(page,name,score,shape,color){
    await page.bringToFront();await page.getByRole('button',{name:'我也来挂一个'}).click();
    await page.getByRole('button',{name:shape,exact:true}).click();await page.getByRole('button',{name:color,exact:true}).click();await page.locator('#nickname').fill(name);await page.getByRole('button',{name:'开始答题'}).click();
    for(let i=0;i<10;i++){
      await page.waitForFunction(index=>document.querySelector('.question-count')?.textContent?.replace(/\s/g,'')===`${index+1}/10`,i);
      const correct=i<score;await page.locator('.answer-options button').nth(correct?questions[i].correct:(questions[i].correct+1)%4).click();
      assert.equal(await page.locator('.chosen').getAttribute('data-feedback'),correct?'correct':'wrong');
    }
    await page.locator('[data-testid="final-score"]').waitFor();assert.equal(await page.locator('[data-testid="final-score"]').innerText(),String(score));
    await page.locator('#message').fill(`${name}留下的共享祝福`);await page.getByRole('button',{name:'把挂件挂上去'}).click();
    const item=page.getByRole('button',{name:new RegExp(`${name}的`)});await item.waitFor();assert.ok(await item.evaluate(el=>el.classList.contains('new-ornament')));await page.waitForTimeout(1450);
    return item.getAttribute('data-id');
  }
  const idA=await play(a,'本地联调甲',10,'爱心','奶油白');
  await b.bringToFront();await b.evaluate(()=>window.dispatchEvent(new Event('focus')));await b.locator(`[data-id="${idA}"]`).waitFor();assert.equal(await b.locator(`[data-id="${idA}"]`).getAttribute('data-layer'),'top');
  note('PASS 手机浏览器甲完成DIY→十题→留言→上树，电脑浏览器乙无需重开页面即可读到同一枚挂件');
  const idB=await play(b,'本地联调乙',3,'小铃铛','莓果红');
  await a.bringToFront();await a.evaluate(()=>window.dispatchEvent(new Event('focus')));await a.locator(`[data-id="${idB}"]`).waitFor();assert.equal(await a.locator(`[data-id="${idB}"]`).getAttribute('data-layer'),'middleLower');
  await a.locator(`[data-id="${idB}"]`).click();assert.equal(await a.locator('blockquote').innerText(),'本地联调乙留下的共享祝福');await a.getByRole('button',{name:'关闭',exact:true}).click();
  await a.waitForTimeout(300);await a.screenshot({path:'screenshots/shared-mobile.png',fullPage:true});
  await b.screenshot({path:'screenshots/shared-desktop.png',fullPage:true});
  assert.equal(await a.evaluate(()=>localStorage.getItem('my-christmas-tree:v1')),null);assert.equal(await b.evaluate(()=>localStorage.getItem('my-christmas-tree:v1')),null);
  assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);
  note('PASS 乙的3分挂件同步到甲且位于中下层，跨浏览器留言相同；双方均未把挂件写入localStorage');

  await browser.close();browser=await chromium.launch({channel:'msedge',headless:true});
  const c=await browser.newPage({viewport:{width:390,height:844}});await c.goto(pageUrl);await c.locator(`[data-id="${idA}"]`).waitFor();await c.locator(`[data-id="${idB}"]`).waitFor();await c.reload();await c.locator(`[data-id="${idB}"]`).waitFor();
  note('PASS 关闭所有浏览器后，新的浏览器和空白存储仍能读到全部共享挂件，刷新不丢失');
  const response=await fetch(`${api}/api/admin/export`,{headers:{Authorization:`Bearer ${ADMIN}`}});assert.equal(response.status,200);const backup=await response.json();assert.equal(backup.decorations.length,2);assert.equal(backup.decorations.find(d=>d.id===idA).score,10);
  assert.equal((await fetch(`${api}/api/admin/decorations/${idA}`,{method:'DELETE'})).status,401);
  assert.equal((await fetch(`${api}/api/admin/decorations/${idA}`,{method:'DELETE',headers:{Authorization:`Bearer ${ADMIN}`}})).status,204);
  await c.evaluate(()=>window.dispatchEvent(new Event('focus')));await c.locator(`[data-id="${idA}"]`).waitFor({state:'detached'});assert.equal(await c.locator('.tree-ornament').count(),1);
  note('PASS 管理员导出JSON和鉴权删除，其他浏览器自动读到移除结果');
  for(const filename of await readdir(resolve(output,'assets'))){if(filename.endsWith('.js'))assert.ok(!(await readFile(resolve(output,'assets',filename),'utf8')).includes(ADMIN));}
  await mf.dispose();options.port=Number(new URL(api).port);mf=new Miniflare(convertV4MiniflareOptions(options));await mf.ready;
  await c.reload();await c.locator(`[data-id="${idB}"]`).waitFor();assert.equal(await c.locator(`[data-id="${idA}"]`).count(),0);
  note('PASS 本地Worker重启，D1保存仍在；已删除挂件不会复活；前端产物无管理员凭据');
  await writeFile('screenshots/cloud-verification.txt',report.join('\n')+'\n','utf8');
}finally{await browser?.close();await mf.dispose();await new Promise(resolve=>server.close(resolve));}
