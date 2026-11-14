const KEY='my-christmas-tree:my-decoration-ids:v1';
const sessionIds=new Set<string>();
export function readMyDecorationIds():string[]{
  try{const value=JSON.parse(localStorage.getItem(KEY)??'[]');if(Array.isArray(value))return [...new Set([...value.filter((id):id is string=>typeof id==='string'&&/^[a-z0-9_-]{1,80}$/i.test(id)),...sessionIds])];}catch{}
  return [...sessionIds];
}
export function rememberDecoration(id:string){
  sessionIds.add(id);
  try{localStorage.setItem(KEY,JSON.stringify(readMyDecorationIds()));}catch{/* 共享挂件已保存；浏览器禁用存储时仍可在本次页面定位。 */}
}
