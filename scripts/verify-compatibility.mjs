import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { questions } from '../src/config.ts';
import { makeDemo, getDecorationLayer } from '../src/model.ts';

const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const report=[];
const note=message=>{report.push(message);console.log(message);};
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
  const legacy=makeDemo(8).map(({maxScore,...item},score)=>({...item,id:`legacy-${score}`,nickname:`老朋友${score}`,score,message:`旧留言${score}`}));
  const existing={...makeDemo(1)[0],id:'formal-seven',score:7,nickname:'新朋友七分',demo:false};
  const original=[...legacy,existing];
  const raw=JSON.stringify(original);
  await page.goto((process.env.TREE_TEST_URL||'http://127.0.0.1:5174/'));
  assert.equal(await page.title(),'快乐源宝的圣诞树');
  assert.equal(await page.locator('h1').innerText(),'快乐源宝的圣诞树');
  await page.getByRole('button',{name:'怎么玩',exact:true}).click();
  assert.equal(await page.getByText('试玩数据保存在当前浏览器，暂不支持跨设备共享。',{exact:true}).count(),0);
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  await page.evaluate(raw=>localStorage.setItem('my-christmas-tree:v1',raw),raw);await page.reload();
  await page.locator('[data-id="legacy-7"]').waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem('my-christmas-tree:v1')),raw);
  assert.equal(await page.locator('[data-id="legacy-7"]').getAttribute('data-layer'),'top');
  assert.equal(await page.locator('[data-id="formal-seven"]').getAttribute('data-layer'),'upper');
  assert.ok((await page.locator('[data-id="legacy-7"]').getAttribute('aria-label')).includes('7/7'));
  await page.locator('[data-id="legacy-7"]').press('Enter');
  assert.equal(await page.locator('.detail-meta').count(),0);
  assert.equal(await page.locator('blockquote').innerText(),'旧留言7');
  await page.waitForTimeout(300);await page.screenshot({path:'screenshots/legacy-detail.png'});
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  note('PASS 旧7分仍在树顶，正式7分在上层；旧留言保留；详情按要求不显示成绩；读取不覆盖存档');

  await page.getByRole('button',{name:'我也来挂一个'}).click();
  await page.getByRole('button',{name:'爱心',exact:true}).click();await page.getByRole('button',{name:'奶油白',exact:true}).click();
  await page.locator('#nickname').fill('十题新朋友');await page.getByRole('button',{name:'开始答题'}).click();
  const correct=[2,0,1,2,1,3,0,1,0,3];
  for(let q=0;q<10;q++){
    await page.waitForFunction(index=>document.querySelector('.question-count')?.textContent?.replace(/\s/g,'')===`${index+1}/10`,q);
    assert.equal(await page.locator('.question-body h2').innerText(),questions[q].title);
    const options=await page.locator('.answer-options button').allTextContents();
    assert.deepEqual(options,questions[q].options.map((text,i)=>'ABCD'[i]+text));
    assert.equal(await page.locator('.demo-tag').innerText(),'关于我的小题');
    assert.equal(await page.getByText(/简单题|中等题|困难题|正确答案/).count(),0);
    assert.equal(await page.locator('.answer-options button.chosen').count(),0);
    if(q===9){await page.waitForTimeout(300);await page.screenshot({path:'screenshots/formal-question-10.png'});}
    // 第一题选错，其余均选对，独立验证9分分支。
    await page.locator('.answer-options button').nth(q===0?(correct[q]+1)%4:correct[q]).click();
    const selected=page.locator('.answer-options button.chosen');
    assert.equal(await selected.getAttribute('data-feedback'),q===0?'wrong':'correct');
    assert.equal(await selected.locator('svg path').getAttribute('d'),q===0?'m6 6 12 12M6 18 18 6':'m5 12 4 4L19 6');
    const iconColor=await selected.locator('svg').evaluate(el=>getComputedStyle(el).color);
    assert.equal(iconColor,q===0?'rgb(176, 93, 80)':'rgb(109, 135, 90)');
    assert.equal(await page.locator('.answer-options button:not(.chosen) svg').count(),0);
    if(q===0)await page.screenshot({path:'screenshots/answer-wrong.png',animations:'disabled'});
    if(q===1)await page.screenshot({path:'screenshots/answer-correct.png',animations:'disabled'});
  }
  await page.locator('[data-testid="final-score"]').waitFor();
  assert.equal(await page.locator('[data-testid="final-score"]').innerText(),'9');
  assert.equal(await page.locator('.result-content h2').innerText(),'差一点满分，厉害！');
  assert.ok((await page.locator('.result-score').innerText()).includes('/ 10'));
  await page.locator('#message').fill('旧树继续，新的祝福。');
  await page.waitForTimeout(300);await page.screenshot({path:'screenshots/formal-mobile-result.png'});
  await page.getByRole('button',{name:'把挂件挂上去'}).click();
  const newItem=page.getByRole('button',{name:/^十题新朋友的/});await newItem.waitFor();
  assert.equal(await newItem.getAttribute('data-layer'),'top');
  assert.ok(await newItem.evaluate(el=>el.classList.contains('new-ornament')));
  await page.waitForTimeout(1450);await newItem.press('Enter');
  assert.equal(await page.locator('.detail-meta').count(),0);
  assert.equal(await page.locator('blockquote').innerText(),'旧树继续，新的祝福。');
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('my-christmas-tree:v1')));
  assert.equal(saved.length,10);
  for(const old of legacy){const actual=saved.find(d=>d.id===old.id);assert.deepEqual(actual,{...old,maxScore:7});}
  assert.deepEqual(saved.find(d=>d.id===existing.id),existing);
  assert.equal(saved.at(-1).maxScore,10);assert.equal(saved.at(-1).score,9);
  note('PASS 新标题与移除指定说明；手机十题与40个选项准确；答错红叉、答对绿勾，未选选项不提示答案');
  note('PASS 9分文案、留言、提交、所有挂件同屏与高亮；旧记录完整保留并标记7分制');

  await page.reload();await page.locator('.tree-ornament').first().waitFor();
  const seen=new Set();assert.equal(await page.locator('.batch-button').count(),0);
  const displayed=await page.locator('.tree-ornament').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.id,layer:n.dataset.layer})));
  for(const item of displayed){seen.add(item.id);assert.equal(item.layer,getDecorationLayer(saved.find(d=>d.id===item.id)));}
  assert.equal(seen.size,10);assert.deepEqual(errors,[]);
  note('PASS 刷新后全部新旧挂件同屏显示，分层一致，无丢失或运行错误');
  await writeFile('screenshots/compatibility-verification.txt',report.join('\n'),'utf8');
}finally {await browser.close();}
