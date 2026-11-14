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
export const layerRegions:Record<Layer,{minY:number;maxY:number;halfWidth:number}>={
  top:{minY:17,maxY:28,halfWidth:10},upper:{minY:29,maxY:49,halfWidth:22},
  middleUpper:{minY:50,maxY:64,halfWidth:28},middleLower:{minY:65,maxY:76,halfWidth:34},
  bottom:{minY:77,maxY:85,halfWidth:32},
};
function fraction(value:string){
  let h=2166136261;for(let i=0;i<value.length;i++)h=Math.imul(h^value.charCodeAt(i),16777619);
  h=Math.imul(h^(h>>>16),0x85ebca6b);h=Math.imul(h^(h>>>13),0xc2b2ae35);
  return (((h^(h>>>16))>>>0)+.5)/4294967296;
}
function halfWidthAt(item:Decoration,y:number){const region=layerRegions[getDecorationLayer(item)];return region.halfWidth*(.76+.24*(y-region.minY)/(region.maxY-region.minY));}
// 每枚挂件独立抽取高度，使用云端记录中的ID与创建时间；不依赖提交顺序或显示批次。
// 手机和电脑共用同一高度，避让只调整左右位置，绝不改变运气或冠军。
export function getDecorationHeight(item:Decoration){
  const region=layerRegions[getDecorationLayer(item)];
  return region.minY+fraction(`height-v1:${item.id}:${item.createdAt}`)*(region.maxY-region.minY);
}
export function getTreeLeader(items:Decoration[]):Decoration|undefined {
  return items.reduce<Decoration|undefined>((best,item)=>!best||getDecorationHeight(item)<getDecorationHeight(best)||(getDecorationHeight(item)===getDecorationHeight(best)&&item.id<best.id)?item:best,undefined);
}
type PositionedDecoration={item:Decoration;x:number;y:number};
const layouts=new WeakMap<Decoration[],Map<boolean,PositionedDecoration[][]>>();
function pagesFor(items:Decoration[],mobile:boolean){
  const cached=layouts.get(items)?.get(mobile);if(cached)return cached;
  const capacities=mobile?[2,6,6,8,10]:[3,8,8,10,12],spacing=mobile?10:8.3;
  const pages:PositionedDecoration[][]=[[]];
  const ordered=[...items].sort((a,b)=>layers.indexOf(getDecorationLayer(a))-layers.indexOf(getDecorationLayer(b))||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
  for(const item of ordered){
    const layer=getDecorationLayer(item),y=getDecorationHeight(item),halfWidth=halfWidthAt(item,y);
    let placed=false;
    for(const page of pages){
      if(page.filter(p=>getDecorationLayer(p.item)===layer).length>=capacities[layers.indexOf(layer)])continue;
      for(let candidate=0;candidate<120;candidate++){
        const x=50+(fraction(`side-v1:${item.id}:${item.createdAt}:${candidate}`)*2-1)*halfWidth;
        if(page.every(p=>(p.x-x)**2+((p.y-y)*1.26)**2>=spacing**2)){
          page.push({item,x,y});placed=true;break;
        }
      }
      if(placed)break;
    }
    if(!placed)pages.push([{item,x:50+(fraction(`side-v1:${item.id}:${item.createdAt}:0`)*2-1)*halfWidth,y}]);
  }
  const cache=layouts.get(items)??new Map<boolean,PositionedDecoration[][]>();cache.set(mobile,pages);layouts.set(items,cache);return pages;
}
export function getPageCount(items:Decoration[],mobile=false){return pagesFor(items,mobile).length;}
export function getItemPage(items:Decoration[],id:string,mobile=false){return Math.max(0,pagesFor(items,mobile).findIndex(page=>page.some(p=>p.item.id===id)));}
export function layoutDecorations(items:Decoration[],page:number,mobile=false){const pages=pagesFor(items,mobile);return pages[((page%pages.length)+pages.length)%pages.length];}
export function makeDemo(count:number):Decoration[] { return Array.from({length:count},(_,i)=>({id:`demo-${count}-${i}`,nickname:['小满','阿栗','冬眠小熊','桃子','Momo','一颗松果','小鹿','星星'][i%8]+(i>=8?`${i+1}`:''),message:['愿你这一年，心里有光，身边有爱。','把所有美好的事，悄悄挂在你的树上。','下次见面，一起喝杯热可可吧！','圣诞快乐，愿平凡的日子也闪闪发光。'][i%4],score:i%(MAX_SCORE+1),maxScore:MAX_SCORE,design:{kind:'preset',shape:shapes[i%shapes.length],color:colors[i%colors.length].id,version:1},createdAt:new Date(2026,11,1,0,i).toISOString(),demo:true})); }
