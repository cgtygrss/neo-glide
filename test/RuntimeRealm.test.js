import test from 'node:test';
import assert from 'node:assert/strict';
import { scopedStorage,configureRuntimeRealm,runtimeRealm } from '../src/account/RuntimeRealm.js';
const memory=()=>{const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key),get length(){return map.size;},key:index=>[...map.keys()][index]??null};};
test('test profiles, queues and purchase ownership never read or overwrite production keys',()=>{
 const raw=memory(),production=scopedStorage(raw,'Production'),sandbox=scopedStorage(raw,'Sandbox');
 for(const key of ['neo_glide_accounts_v1','neo_glide_profile:pilot','neo_glide_flights:pilot','neo_glide_store_owners_v1']){
  production.setItem(key,'live');assert.equal(sandbox.getItem(key),null);sandbox.setItem(key,'test');assert.equal(production.getItem(key),'live');
 }
 assert.equal(sandbox.length,4);assert.ok(sandbox.key(0).startsWith('neo_glide_'));sandbox.removeItem('neo_glide_profile:pilot');assert.equal(production.getItem('neo_glide_profile:pilot'),'live');
});
test('a verified runtime environment is fixed for the session and rejects unknown values',()=>{
 assert.throws(()=>configureRuntimeRealm('client-selected-other'));configureRuntimeRealm('Sandbox');assert.equal(runtimeRealm(),'Sandbox');assert.throws(()=>configureRuntimeRealm('Production'));
});
