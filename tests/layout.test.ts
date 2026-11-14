import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutDecorations,getDecorationHeight,getDecorationLayer,getTreeLeader,makeDemo,layerRegions} from '../src/model.ts';

for(const count of [8,10,30,60,120])for(const mobile of [false,true]){
  test(`${count}人/${mobile?'手机':'电脑'}：一次显示全部挂件，不改原高度或存档`,()=>{
    const items=makeDemo(count),snapshot=JSON.stringify(items),visible=layoutDecorations(items,mobile);
    assert.equal(visible.length,count);assert.equal(new Set(visible.map(p=>p.item.id)).size,count);
    for(const p of visible){const region=layerRegions[getDecorationLayer(p.item)];assert(p.y>=region.minY&&p.y<=region.maxY);assert.equal(p.y,getDecorationHeight(p.item));}
    assert.equal(JSON.stringify(items),snapshot);
  });
}

test('8个满分不再拆页；120个树顶挂件也全部显示，固定星星上方不放挂件',()=>{
  for(const count of [8,120])for(const mobile of [false,true]){
    const items=makeDemo(count).map((d,i)=>({...d,score:i%2?9:10}));
    const visible=layoutDecorations(items,mobile);
    assert.equal(visible.length,count);assert.equal(new Set(visible.map(p=>p.item.id)).size,count);
    assert(visible.every(p=>p.y>12&&p.scale>=.6&&p.scale<=1));
  }
});

test('同得7分的120枚全部位于上层，刷新稳定，新增不会重抽原有高度',()=>{
  const items=makeDemo(120).map(item=>({...item,score:7}));
  for(const mobile of [true,false]){
    const first=layoutDecorations(items,mobile);assert.equal(first.length,120);
    assert.deepEqual(layoutDecorations([...items],mobile),first);
    assert.equal(new Set(first.map(p=>p.y)).size,first.length);
    for(const p of first)assert(p.y>=layerRegions.upper.minY&&p.y<=layerRegions.upper.maxY);
    const more=layoutDecorations([...items,{...items[0],id:'extra',createdAt:'2027-01-01T00:00:00Z'}],mobile);
    for(const item of items)assert.equal(more.find(p=>p.item.id===item.id)!.y,getDecorationHeight(item));
  }
});

test('拥挤时适当缩小并允许重叠，全部位置仍位于树身范围内',()=>{
  const items=makeDemo(120);
  for(const mobile of [true,false]){
    const points=layoutDecorations(items,mobile);assert.equal(points.length,items.length);
    for(const p of points){const region=layerRegions[getDecorationLayer(p.item)];assert(p.y>=region.minY&&p.y<=region.maxY);assert(Math.abs(p.x-50)<=region.halfWidth);assert(p.scale>=.6&&p.scale<=1);}
    assert(points.some(p=>p.scale<1));assert.equal(new Set(points.map(p=>`${p.x},${p.y}`)).size,items.length);
  }
});

test('手机电脑的最高者与实际最高位置一致，独立运气及成绩区域规则不变',()=>{
  assert.equal(getTreeLeader([]),undefined);
  const items=makeDemo(120).map(item=>({...item,score:7})),leader=getTreeLeader(items)!;
  assert.equal(new Set(items.map(getDecorationHeight)).size,items.length);
  assert.equal(getTreeLeader([...items].reverse())?.id,leader.id);
  for(const mobile of [true,false]){
    const all=layoutDecorations(items,mobile),highest=[...all].sort((a,b)=>a.y-b.y)[0];
    assert.equal(highest.item.id,leader.id);assert.equal(highest.y,getDecorationHeight(leader));
  }
  const ordered=[...items].sort((a,b)=>getDecorationHeight(a)-getDecorationHeight(b));
  const luckySeven=ordered[0],unluckyEight={...ordered.at(-1)!,score:8};
  assert.equal(getTreeLeader([unluckyEight,luckySeven])?.id,luckySeven.id);
  assert.equal(getTreeLeader([luckySeven,{...unluckyEight,score:9}])?.score,9);
});

test('旧版与正式挂件180枚混合全部显示，保留旧分制的分层含义',()=>{
  const items=[...makeDemo(60).map((d,i)=>({...d,id:`legacy-${i}`,score:i%8,maxScore:undefined})),...makeDemo(120)];
  for(const mobile of [false,true]){
    const visible=layoutDecorations(items,mobile);assert.equal(visible.length,180);assert.equal(new Set(visible.map(p=>p.item.id)).size,180);
    for(const p of visible){const region=layerRegions[getDecorationLayer(p.item)];assert(p.y>=region.minY&&p.y<=region.maxY);}
  }
});

test('空树没有遗留分页或挂件',()=>{assert.deepEqual(layoutDecorations([]),[]);});
