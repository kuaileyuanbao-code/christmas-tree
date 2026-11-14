import test from 'node:test';
import assert from 'node:assert/strict';
import {readMyDecorationIds,rememberDecoration} from '../src/myDecorations.ts';
test('提交记录仅记ID，重新读取可定位，重复保存不增加记录；禁用存储不影响本次定位',()=>{
 const data=new Map<string,string>();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value)}});
 rememberDecoration('my-first');rememberDecoration('my-first');rememberDecoration('my-second');
 assert.deepEqual(readMyDecorationIds(),['my-first','my-second']);
 assert.equal(data.size,1);assert.deepEqual(JSON.parse([...data.values()][0]),['my-first','my-second']);
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}}});
 assert.doesNotThrow(()=>rememberDecoration('my-third'));assert(readMyDecorationIds().includes('my-third'));
});
