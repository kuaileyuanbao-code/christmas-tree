import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateScore, getLayer, getDecorationLayer, getMaxScore, getScoreMessage, getPageCount, getItemPage, layoutDecorations, getDecorationHeight, getTreeLeader, makeDemo, layerRegions, MAX_SCORE } from '../src/model.ts';
import { questions, isDemoQuestions } from '../src/config.ts';
test('0～10 每个分数均按新规则分层，树顶不遮住星星',()=>{
  const expected=['bottom','bottom','bottom','middleLower','middleLower','middleUpper','middleUpper','upper','upper','top','top'];
  expected.forEach((layer,score)=>assert.equal(getLayer(score),layer));
  assert(layerRegions.top.minY>12);
});
test('十题等权计分，每个分数与单题答案对应准确',()=>{
  const correct=[2,0,1,2,1,3,0,1,0,3];
  assert.deepEqual(questions.map(q=>q.correct),correct);
  for(let score=0;score<=MAX_SCORE;score++)assert.equal(calculateScore(correct.map((c,i)=>i<score?c:(c+1)%4),correct),score);
  for(let index=0;index<MAX_SCORE;index++)assert.equal(calculateScore(correct.map((c,i)=>i===index?c:(c+1)%4),correct),1);
});
test('正式题目内容和难度分组保留，三个选项位置按要求调整',()=>{
  const expected=[
    ['上课我喜欢坐哪里？',['前排','中间','后排','哪有位置坐哪']],
    ['我平时用哪个软件听歌？',['网易云音乐','QQ 音乐','汽水音乐','酷狗音乐']],
    ['周末没事，我通常会？',['出去探店拍照','在宿舍休息、玩游戏','约人去健身房','去图书馆学习']],
    ['我最不爱吃什么？',['香菜','榴莲','苦瓜','茄子']],
    ['我最喜欢哪部电视剧？',['偷偷藏不住','当我飞奔向你','以爱为营','致我们暖暖的小时光']],
    ['我起床一般设几个闹钟？',['一个','两个','三个','四个及以上']],
    ['出去玩时，我更喜欢？',['逛商场、随便走走','去热门景点打卡','去游乐园玩项目','爬山看自然风景']],
    ['我一般用哪种键盘打字？',['九键拼音','26 键拼音','手写输入','语音输入']],
    ['我更喜欢哪种旅行方式？',['只规划大致路线','提前做好详细攻略','到当地随便逛','完全跟着朋友安排']],
    ['哪组游戏我都玩过？',['猫和老鼠＋重返未来：1999','第五人格＋光遇','英雄联盟＋和平精英','崩铁＋蛋仔派对']],
  ];
  assert.equal(questions.length,MAX_SCORE);assert.equal(isDemoQuestions,false);
  assert.deepEqual(questions.map(q=>[q.title,q.options]),expected);
  assert.deepEqual(questions.map(q=>q.id),Array.from({length:10},(_,i)=>`q${i+1}`));
  assert.deepEqual(questions.map(q=>q.difficulty),['easy','easy','easy','medium','medium','medium','medium','hard','hard','hard']);
});
test('每个成绩均显示指定文案',()=>{
  const messages=['没关系，欢迎继续了解我！','没关系，欢迎继续了解我！','没关系，欢迎继续了解我！','哈哈哈，看来还有提升空间！','哈哈哈，看来还有提升空间！','还不错嘛，了解我不少！','还不错嘛，了解我不少！','看来我们真的挺熟！','看来我们真的挺熟！','差一点满分，厉害！','满分！你也太了解我了吧！'];
  messages.forEach((message,score)=>assert.equal(getScoreMessage(score),message));
});
test('无满分字段的旧存档保持旧高度，相同数值与新成绩分别处理',()=>{
  const legacyExpected=['bottom','bottom','middleLower','middleLower','middleUpper','middleUpper','upper','top'];
  const item=makeDemo(1)[0];
  legacyExpected.forEach((layer,score)=>{const legacy={...item,score,maxScore:undefined};assert.equal(getMaxScore(legacy),7);assert.equal(getDecorationLayer(legacy),layer);});
  assert.equal(getDecorationLayer({...item,score:7,maxScore:7}),'top');
  assert.equal(getDecorationLayer({...item,score:7,maxScore:10}),'upper');
});
for(const count of [10,30,60,120])for(const mobile of [false,true]){
  test(`${count}人/${mobile?'手机':'电脑'}：不丢挂件，保持高度、容量和可定位性`,()=>{
    const items=makeDemo(count),snapshot=JSON.stringify(items),seen=new Set<string>();
    const pages=getPageCount(items,mobile);
    for(let page=0;page<pages;page++){
      const visible=layoutDecorations(items,page,mobile);
      assert.ok(visible.length<=(mobile?32:41));
      for(const p of visible){seen.add(p.item.id);const region=layerRegions[getDecorationLayer(p.item)];assert(p.y>=region.minY&&p.y<=region.maxY);assert.equal(p.y,getDecorationHeight(p.item));}
    }
    assert.equal(seen.size,count);assert.equal(JSON.stringify(items),snapshot);
    for(const item of items)assert.ok(layoutDecorations(items,getItemPage(items,item.id,mobile),mobile).some(p=>p.item.id===item.id));
  });
}
test('120 个满分挂件也能逐批查看，定位新挂件',()=>{
  const items=makeDemo(120).map((d,i)=>({...d,score:i%2?9:10}));
  for(const mobile of [false,true]){
    const seen=new Set<string>();for(let p=0;p<getPageCount(items,mobile);p++)layoutDecorations(items,p,mobile).forEach(d=>seen.add(d.item.id));
    assert.equal(seen.size,120);assert.ok(layoutDecorations(items,getItemPage(items,items[119].id,mobile),mobile).some(p=>p.item.id===items[119].id));
  }
});

test('同得7分时自然散落在上层，刷新稳定、翻批可达且不串层',()=>{
  const items=makeDemo(120).map(item=>({...item,score:7}));
  for(const mobile of [true,false]){
    const first=layoutDecorations(items,0,mobile);
    assert(first.length>3&&first.length<=(mobile?6:8));
    assert.deepEqual(layoutDecorations([...items],0,mobile),first);
    assert.equal(new Set(first.map(p=>p.y)).size,first.length);
    for(const p of first)assert(p.y>=layerRegions.upper.minY&&p.y<=layerRegions.upper.maxY);
    for(const item of items)assert(layoutDecorations(items,getItemPage(items,item.id,mobile),mobile).some(p=>p.item.id===item.id));
    const extended=[...items,{...items[0],id:'extra',createdAt:'2027-01-01T00:00:00Z'}];
    for(const item of items){const positioned=layoutDecorations(extended,getItemPage(extended,item.id,mobile),mobile).find(p=>p.item.id===item.id)!;assert.equal(positioned.y,getDecorationHeight(item));}
  }
});
test('最拥挤时所有层仍保有间距，随机点始终位于树身范围内',()=>{
  const items=makeDemo(120);
  for(const mobile of [true,false])for(let page=0;page<getPageCount(items,mobile);page++){
    const points=layoutDecorations(items,page,mobile);
    for(const point of points){
      const region=layerRegions[getDecorationLayer(point.item)];
      assert(point.y>=region.minY&&point.y<=region.maxY);assert(Math.abs(point.x-50)<=region.halfWidth);
    }
    for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)assert(Math.hypot(points[i].x-points[j].x,(points[i].y-points[j].y)*1.26)>=(mobile?9.999:8.299));
  }
});

test('每人独立抽取真实高度，跨设备、刷新和换批次都不改变；最高者以全树实际高度为准',()=>{
  assert.equal(getTreeLeader([]),undefined);
  const items=makeDemo(120).map(item=>({...item,score:7})),leader=getTreeLeader(items)!;
  assert.equal(new Set(items.map(getDecorationHeight)).size,items.length);
  assert.equal(getTreeLeader([...items].reverse())?.id,leader.id);
  for(const mobile of [true,false]){
    const all=Array.from({length:getPageCount(items,mobile)},(_,page)=>layoutDecorations(items,page,mobile)).flat();
    assert.equal(all.length,120);assert.equal(new Set(all.map(p=>p.item.id)).size,120);
    const physicallyHighest=[...all].sort((a,b)=>a.y-b.y)[0];assert.equal(physicallyHighest.item.id,leader.id);
    assert.equal(physicallyHighest.y,getDecorationHeight(leader));
    const first=layoutDecorations(items,0,mobile);
    assert(!first.some(p=>p.item.id===leader.id),'样本最高者不在首批，以此验证不是仅对可见挂件评选');
  }
  const ordered=[...items].sort((a,b)=>getDecorationHeight(a)-getDecorationHeight(b));
  const luckySeven=ordered[0],unluckyEight={...ordered.at(-1)!,score:8};
  assert.equal(getTreeLeader([unluckyEight,luckySeven])?.id,luckySeven.id);
  const higherTier={...unluckyEight,score:9};assert.equal(getTreeLeader([luckySeven,higherTier])?.id,higherTier.id);
});
test('旧版与正式挂件混合分页不丢失，保留每份成绩的分层含义',()=>{
  const modern=makeDemo(120),legacy=makeDemo(60).map((d,i)=>({...d,id:`legacy-${i}`,score:i%8,maxScore:undefined}));
  const items=[...legacy,...modern];
  for(const mobile of [false,true]){
    const seen=new Set<string>();
    for(let page=0;page<getPageCount(items,mobile);page++)for(const p of layoutDecorations(items,page,mobile)){
      seen.add(p.item.id);const region=layerRegions[getDecorationLayer(p.item)];assert(p.y>=region.minY&&p.y<=region.maxY);
    }
    assert.equal(seen.size,180);
    for(const item of items)assert.ok(layoutDecorations(items,getItemPage(items,item.id,mobile),mobile).some(p=>p.item.id===item.id));
  }
});
