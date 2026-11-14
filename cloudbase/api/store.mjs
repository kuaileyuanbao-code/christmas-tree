import { ApiError,hash } from './core.mjs';

export const COLLECTIONS={decorations:'christmas_decorations',submissions:'christmas_submissions',limits:'christmas_rate_limits'};
function checked(result){if(result?.code){const error=new Error('CloudBase database operation failed');error.code=result.code;throw error;}return result;}
async function get(ref){
  try{const result=checked(await ref.get()),data=Array.isArray(result.data)?result.data[0]:result.data;return data?._id?data:null;}
  catch(error){if(error?.code==='DATABASE_DOCUMENT_NOT_EXIST')return null;throw error;}
}
async function set(ref,data){checked(await ref.set(data));}
function counter(key,limit,seconds,now){const bucket=Math.floor(now/seconds);return {id:hash(key+':'+bucket),limit,expiresAt:(bucket+1)*seconds};}
export function createCloudBaseStore(db){
  async function transaction(fn){const result=checked(await db.runTransaction(fn));return result&&Object.hasOwn(result,'result')?result.result:result;}
  async function consumeIn(tx,key,limit,seconds,now){
    const item=counter(key,limit,seconds,now),ref=tx.collection(COLLECTIONS.limits).doc(item.id),previous=await get(ref);
    if((previous?.count??0)>=item.limit)throw new ApiError(429,'提交有点频繁，请稍后再来。',Math.max(1,item.expiresAt-now));
    await set(ref,{count:(previous?.count??0)+1,expiresAt:item.expiresAt,expireAt:new Date(item.expiresAt*1000)});
  }
  function replay(row,input){
    if(row.clientHash!==input.clientHash||row.payloadHash!==input.payloadHash)throw new ApiError(409,'这个提交标识已被使用，请重新开始。');
    if(row.deletedAt)throw new ApiError(410,'这枚挂件已由树主人移除。');
    return {row,replayed:true};
  }
  return {
    async ready(){for(const name of Object.values(COLLECTIONS))checked(await db.collection(name).limit(1).get());},
    async list(){
      const rows=[];let cursor;
      while(true){
        let query=db.collection(COLLECTIONS.decorations);if(cursor)query=query.where({_id:db.command.gt(cursor)});
        const result=checked(await query.orderBy('_id','asc').limit(100).get());
        if(!Array.isArray(result.data))throw new Error('CloudBase returned invalid records');
        rows.push(...result.data);if(result.data.length<100)break;
        const next=result.data.at(-1)?._id;if(!next||next===cursor)throw new Error('CloudBase pagination did not advance');cursor=next;
      }
      return rows.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
    },
    async consume(key,limit,seconds,now){await transaction(tx=>consumeIn(tx,key,limit,seconds,now));},
    async add(row,indexKey,budgets,now){
      return transaction(async tx=>{
        const recordRef=tx.collection(COLLECTIONS.decorations).doc(row.id),existing=await get(recordRef);
        if(existing)return replay(existing,row);
        const indexRef=tx.collection(COLLECTIONS.submissions).doc(indexKey),index=await get(indexRef);
        if(index){const original=await get(tx.collection(COLLECTIONS.decorations).doc(index.decorationId));if(!original)throw new Error('Submission index is inconsistent');return replay(original,row);}
        for(const [key,limit,seconds] of budgets)await consumeIn(tx,key,limit,seconds,now);
        await set(recordRef,row);await set(indexRef,{decorationId:row.id});return {row,replayed:false};
      });
    },
    async remove(id,date){return transaction(async tx=>{const ref=tx.collection(COLLECTIONS.decorations).doc(id),row=await get(ref);if(!row)return false;if(!row.deletedAt){const {_id,...fields}=row;await set(ref,{...fields,deletedAt:date});}return true;});},
    async import(rows){return transaction(async tx=>{let imported=0;for(const row of rows){const ref=tx.collection(COLLECTIONS.decorations).doc(row.id);if(!await get(ref)){await set(ref,row);imported++;}}return imported;});},
  };
}
