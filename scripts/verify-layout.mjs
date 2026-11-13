import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { makeDemo, getItemPage } from '../src/model.ts';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext();
const page=await context.newPage();
try {
 await page.goto((process.env.TREE_TEST_URL||'http://127.0.0.1:5174/'));
 for(const width of [320,375,768,1024]){
  await page.setViewportSize({width,height:900});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.getByRole('button',{name:'我也来挂一个'}).click();
  assert.ok(await page.locator('dialog').evaluate(d=>d.scrollWidth<=d.clientWidth));
  await page.screenshot({path:`screenshots/layout-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  console.log(`PASS ${width}px：首页及DIY无横向溢出`);
 }
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(items=>localStorage.setItem('my-christmas-tree:v1',JSON.stringify(items)),makeDemo(120));
 await page.reload();await page.locator('.tree-ornament').first().waitFor();
 await page.keyboard.press('Control+Shift+D');await page.getByRole('button',{name:'模拟 30 人',exact:true}).click();await page.getByRole('button',{name:'关闭调试'}).click();
 await page.getByRole('button',{name:'我也来挂一个'}).click();await page.locator('#nickname').fill('最后一颗星');await page.getByRole('button',{name:'开始答题'}).click();
 for(let q=0;q<10;q++){await page.waitForFunction(i=>document.querySelector('.question-count')?.textContent?.trim().startsWith(String(i+1)),q);await page.locator('.answer-options button').nth([2,0,1,2,1,3,0,1,0,3][q]).click();}
 await page.getByRole('button',{name:'把挂件挂上去'}).click();
 await page.getByRole('button',{name:/最后一颗星的/}).waitFor();
 await page.waitForTimeout(1500);
 assert.equal(await page.locator('.new-ornament').count(),1);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('my-christmas-tree:v1')));
 const expectedPage=getItemPage(saved,saved.find(d=>d.nickname==='最后一颗星').id,true)+1;
 assert.ok((await page.locator('.batch-button small').innerText()).startsWith(`${expectedPage}/`));
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('my-christmas-tree:v1')).length),121);
 console.log(`PASS 120人存档上开启模拟，再提交10分挂件：回归真实存档，自动定位第${expectedPage}批，总数121`);
 await page.screenshot({path:'screenshots/mobile-new-highlight.png',fullPage:true});
}finally{await browser.close();}
