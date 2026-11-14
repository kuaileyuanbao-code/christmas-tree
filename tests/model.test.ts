import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateScore, getLayer, getDecorationLayer, getMaxScore, getScoreMessage, makeDemo, layerRegions, MAX_SCORE } from '../src/model.ts';
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
