import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage(); const failed=[];page.on('requestfailed',r=>failed.push(r.url()));
 await page.goto('http://127.0.0.1:4173/');await page.evaluate(()=>document.fonts.ready);
 await page.keyboard.press('Control+Shift+D');assert.equal(await page.locator('.dev-panel').count(),0);
 await page.getByRole('button',{name:'我也来挂一个'}).click();assert.equal(await page.locator('.shape-option').count(),10);
 assert.deepEqual(failed,[]);console.log('PASS 生产构建资源正常，DIY可打开，Ctrl+Shift+D不显示调试入口');
}finally {await browser.close();}
