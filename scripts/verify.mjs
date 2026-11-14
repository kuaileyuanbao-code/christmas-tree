import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('screenshots',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const report=[];
const note=s=>{console.log(s);report.push(s);};
try {
  await page.goto((process.env.TREE_TEST_URL||'http://127.0.0.1:5174/'));await page.evaluate(()=>document.fonts.ready);
  await page.getByRole('button',{name:'我也来挂一个'}).click();
  for(const shape of ['圣诞彩球','许愿星星','冬日雪花','姜饼人','泰迪熊','礼物盒','蝴蝶结','圣诞袜','小铃铛','爱心']){
    await page.getByRole('button',{name:shape,exact:true}).click();
    for(const color of ['莓果红','香槟金','冰川蓝','玫瑰粉','松针绿','奶油白']){
      await page.getByRole('button',{name:color,exact:true}).click();
      assert.equal(await page.locator('.design-preview svg').count(),1);
      assert.ok(await page.locator('.design-preview').getAttribute('aria-label').then(t=>t.includes(color)&&t.includes(shape)));
    }
  }
  note('PASS 10 种挂件 × 6 种配色：选择状态、SVG 与实时预览');
  await page.getByRole('button',{name:'泰迪熊',exact:true}).click();await page.getByRole('button',{name:'莓果红',exact:true}).click();
  await page.locator('#nickname').fill('冬日来信');
  await page.screenshot({path:'screenshots/desktop-diy.png',fullPage:true});
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  for(const score of [0,3,5,7,10]){
    await page.getByRole('button',{name:'我也来挂一个'}).click();
    const shape=['圣诞彩球','小铃铛','泰迪熊','礼物盒','许愿星星'][[0,3,5,7,10].indexOf(score)];
    await page.getByRole('button',{name:shape,exact:true}).click();
    await page.getByRole('button',{name:['莓果红','香槟金','冰川蓝','玫瑰粉','奶油白'][[0,3,5,7,10].indexOf(score)],exact:true}).click();
    await page.locator('#nickname').fill(`冬日朋友${score}`);await page.getByRole('button',{name:'开始答题'}).click();
    const correct=[2,0,1,2,1,3,0,1,0,3];
    for(let q=0;q<correct.length;q++){
      await page.waitForFunction(index=>document.querySelector('.question-count')?.textContent?.trim().startsWith(String(index+1)),q);
      await page.locator('.answer-options button').nth(q<score?correct[q]:(correct[q]+1)%4).click();
    }
    await page.locator('[data-testid="final-score"]').waitFor();
    assert.equal(await page.locator('[data-testid="final-score"]').innerText(),String(score));
    await page.locator('#message').fill(`给你的第 ${score} 份祝福。愿这个冬天，温暖又明亮。`);
    if(score===10)await page.screenshot({path:'screenshots/desktop-result.png',fullPage:true});
    await page.getByRole('button',{name:'把挂件挂上去'}).click();
    const item=page.locator(`.tree-ornament[data-score="${score}"]`);await item.waitFor();
    await page.waitForTimeout(1450);
    const expected=score===10?'top':score===7?'upper':score===5?'middleUpper':score===3?'middleLower':'bottom';
    assert.equal(await item.getAttribute('data-layer'),expected);
    await item.press('Enter');await page.getByRole('dialog').waitFor();
    assert.ok((await page.locator('blockquote').innerText()).includes(`第 ${score} 份祝福`));
    await page.getByRole('button',{name:'关闭',exact:true}).click();
    note(`PASS ${score}分：DIY → 十题 → 成绩 → 留言 → 飞入 → ${expected} → 详情`);
  }
  await page.reload();await page.locator('.tree-ornament').first().waitFor();assert.equal(await page.locator('.tree-ornament').count(),5);
  note('PASS 刷新后 5 个真实试玩挂件与留言均保留');
  await page.screenshot({path:'screenshots/desktop-home.png',fullPage:true});
  await page.locator('.tree-ornament[data-score="10"]').click();
  await page.screenshot({path:'screenshots/desktop-detail.png',fullPage:true});await page.getByRole('button',{name:'关闭',exact:true}).click();
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
    const mobile=viewport.width<640;await page.setViewportSize(viewport);
    await page.keyboard.press('Control+Shift+D');await page.getByRole('complementary',{name:'开发调试'}).waitFor();
    for(const count of [10,30,60,120]){
      await page.getByRole('button',{name:`模拟 ${count} 人`,exact:true}).click();
      await page.getByRole('button',{name:'关闭调试'}).click();
      assert.equal(await page.locator('.batch-button').count(),0);
      const ornaments=await page.locator('.tree-ornament').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.id,x:parseFloat(n.style.left),y:parseFloat(n.style.top)})));
      assert.equal(ornaments.length,count);assert.equal(new Set(ornaments.map(o=>o.id)).size,count);
      for(const o of ornaments)assert.ok(o.x>=15&&o.x<=87&&o.y>12&&o.y<=90);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
      if(count===30||count===120){await page.screenshot({path:`screenshots/${mobile?'mobile':'desktop'}-${count}-friends.png`,fullPage:true});}
      await page.keyboard.press('Control+Shift+D');
      note(`PASS ${mobile?'390px 手机':'1440px 电脑'} ${count}人：全部${count}枚同屏，无分页、无横向溢出`);
    }
    await page.getByRole('button',{name:/回到我的存档/}).click();await page.getByRole('button',{name:'关闭调试'}).click();
    assert.equal(await page.locator('.tree-ornament').count(),5);
    if(mobile){
      await page.screenshot({path:'screenshots/mobile-home.png',fullPage:true});
      await page.locator('.tree-ornament').first().click();
      const bounds=await page.locator('dialog').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390&&bounds.y>=0&&bounds.y+bounds.height<=844);
      await page.screenshot({path:'screenshots/mobile-detail.png',fullPage:true});await page.getByRole('button',{name:'关闭',exact:true}).click();
      await page.getByRole('button',{name:'我也来挂一个'}).click();await page.screenshot({path:'screenshots/mobile-diy.png',fullPage:true});
      await page.getByRole('button',{name:'关闭',exact:true}).click();
    }
  }
  note('PASS 模拟预览不修改真实存档；手机详情在视口内；页面运行无异常');
  assert.deepEqual(errors,[]);
  await writeFile('screenshots/verification.txt',report.join('\n'),'utf8');
}finally{await browser.close();}
