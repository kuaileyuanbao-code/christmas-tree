export const shapes = ['ball','star','snowflake','gingerbread','bear','gift','bow','stocking','bell','heart'] as const;
export type Shape = typeof shapes[number];
export const shapeNames: Record<Shape,string> = { ball:'圣诞彩球', star:'许愿星星', snowflake:'冬日雪花', gingerbread:'姜饼人', bear:'泰迪熊', gift:'礼物盒', bow:'蝴蝶结', stocking:'圣诞袜', bell:'小铃铛', heart:'爱心' };
export const colors = [
  {id:'red',name:'莓果红',hex:'#d78074'}, {id:'gold',name:'香槟金',hex:'#e6c176'},
  {id:'blue',name:'冰川蓝',hex:'#93b8c7'}, {id:'pink',name:'玫瑰粉',hex:'#dfa9b6'},
  {id:'green',name:'松针绿',hex:'#8fb29a'}, {id:'white',name:'奶油白',hex:'#f6ecd4'},
] as const;
export type ColorId = typeof colors[number]['id'];
export interface OrnamentDesign { kind:'preset'; shape:Shape; color:ColorId; version:1 }
// 未来可添加 {kind:'drawing', assetUrl: ...} 联合类型，无需改变业务存储接口。
export const MAX_SCORE = 10;
export const LEGACY_MAX_SCORE = 7;
// 没有 maxScore 的存档来自旧版，必须按旧版读取，不能默认为新题库。
export interface Decoration { id:string; nickname:string; message:string; score:number; maxScore?:typeof MAX_SCORE|typeof LEGACY_MAX_SCORE; design:OrnamentDesign; createdAt:string; demo?:boolean }
export type Layer = 'top'|'upper'|'middleUpper'|'middleLower'|'bottom';
export const layers: Layer[] = ['top','upper','middleUpper','middleLower','bottom'];
export const layerNames: Record<Layer,string> = {top:'树顶附近',upper:'上层',middleUpper:'中上层',middleLower:'中下层',bottom:'下层'};
export function getMaxScore(item:Pick<Decoration,'maxScore'>) { return item.maxScore??LEGACY_MAX_SCORE; }
export function getLayer(score:number,maxScore=MAX_SCORE):Layer {
  if(maxScore===LEGACY_MAX_SCORE) return score===LEGACY_MAX_SCORE?'top':score===6?'upper':score>=4?'middleUpper':score>=2?'middleLower':'bottom';
  return score>=9?'top':score>=7?'upper':score>=5?'middleUpper':score>=3?'middleLower':'bottom';
}
export function getDecorationLayer(item:Decoration):Layer { return getLayer(item.score,getMaxScore(item)); }
export function getScoreMessage(score:number) {
  return score===MAX_SCORE?'满分！你也太了解我了吧！':score===9?'差一点满分，厉害！':score>=7?'看来我们真的挺熟！':score>=5?'还不错嘛，了解我不少！':score>=3?'哈哈哈，看来还有提升空间！':'没关系，欢迎继续了解我！';
}
export function calculateScore(answers:number[], correct:number[]) { return correct.reduce((n,a,i)=>n+Number(answers[i]===a),0); }
type Point = {x:number;y:number};
function row(y:number, xs:number[]):Point[] { return xs.map(x=>({x,y})); }
export const desktopSlots: Record<Layer,Point[]> = {
  top:[...row(21,[50]),...row(28,[43,57])],
  upper:[...row(36,[37,50,63]),...row(42,[43,57])],
  middleUpper:[...row(49,[30,43,57,70]),...row(55,[35,47,59,71])],
  middleLower:[...row(63,[24,37,50,63,76]),...row(69,[29,42,55,68,81])],
  bottom:[...row(77,[17,28,39,50,61,72,83]),...row(84,[20,31,42,53,64,75,86])],
};
export const mobileSlots: Record<Layer,Point[]> = {
  top:row(20,[50]), upper:row(31,[35,50,65]),
  middleUpper:[...row(42,[30,50,70]),...row(51,[36,56,76])],
  middleLower:[...row(60,[23,41,59,77]),...row(69,[29,47,65,83])],
  bottom:[...row(78,[18,34,50,66,82]),...row(87,[20,36,52,68,84])],
};
export function getPageCount(items:Decoration[],mobile=false) { const slots=mobile?mobileSlots:desktopSlots; return Math.max(1,...layers.map(l=>Math.ceil(items.filter(d=>getDecorationLayer(d)===l).length/slots[l].length))); }
export function getItemPage(items:Decoration[],id:string,mobile=false) { const item=items.find(d=>d.id===id); if(!item) return 0; const l=getDecorationLayer(item); return Math.floor(items.filter(d=>getDecorationLayer(d)===l).findIndex(d=>d.id===id)/(mobile?mobileSlots:desktopSlots)[l].length); }
export function layoutDecorations(items:Decoration[],page:number,mobile=false) {
  const slots=mobile?mobileSlots:desktopSlots;
  return layers.flatMap(layer=>{
    const group=items.filter(d=>getDecorationLayer(d)===layer);
    const batches=Math.ceil(group.length/slots[layer].length);
    if(!batches) return [];
    const current=group.slice((page%batches)*slots[layer].length,(page%batches+1)*slots[layer].length);
    return current.map((item,i)=>({item,...slots[layer][current.length===1?Math.floor((slots[layer].length-1)/2):i]}));
  });
}
export function makeDemo(count:number):Decoration[] { return Array.from({length:count},(_,i)=>({id:`demo-${count}-${i}`,nickname:['小满','阿栗','冬眠小熊','桃子','Momo','一颗松果','小鹿','星星'][i%8]+(i>=8?`${i+1}`:''),message:['愿你这一年，心里有光，身边有爱。','把所有美好的事，悄悄挂在你的树上。','下次见面，一起喝杯热可可吧！','圣诞快乐，愿平凡的日子也闪闪发光。'][i%4],score:i%(MAX_SCORE+1),maxScore:MAX_SCORE,design:{kind:'preset',shape:shapes[i%shapes.length],color:colors[i%colors.length].id,version:1},createdAt:new Date(2026,11,1,0,i).toISOString(),demo:true})); }
