import { chromium } from '@playwright/test';
import { makeDemo } from '../src/model.ts';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
try {
 await page.goto((process.env.TREE_TEST_URL||'http://127.0.0.1:5174/'));
 await page.evaluate(items=>localStorage.setItem('my-christmas-tree:v1',JSON.stringify(items)),makeDemo(30));await page.reload();await page.evaluate(()=>document.fonts.ready);
 for(const [label,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  await page.setViewportSize(viewport);await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(400);
  await page.screenshot({path:`screenshots/${label}-30-friends.png`,fullPage:true});
  await page.locator('.tree-ornament').first().click();await page.waitForTimeout(400);
  await page.screenshot({path:`screenshots/${label}-detail.png`});await page.getByRole('button',{name:'关闭',exact:true}).click();
  await page.getByRole('button',{name:'我也来挂一个'}).click();
  await page.getByRole('button',{name:'泰迪熊',exact:true}).click();await page.locator('#nickname').fill('冬日来信');await page.waitForTimeout(400);
  await page.screenshot({path:`screenshots/${label}-diy.png`});await page.getByRole('button',{name:'关闭',exact:true}).click();
 }
 console.log('PASS refreshed desktop/mobile screenshots after transitions, dialogs captured within viewport');
}finally{await browser.close();}
