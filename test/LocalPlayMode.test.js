import test from 'node:test';
import assert from 'node:assert/strict';
import { selectLocalPlay,localPlaySelection,returnToOnline } from '../src/account/LocalPlayMode.js';
import { scopedStorage } from '../src/account/RuntimeRealm.js';
import { eraseLocalAccount } from '../src/account/ProfileStorage.js';
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),get length(){return values.size;},key:index=>[...values.keys()][index]??null};};
test('previous progress can be played locally without replacing or importing the online bank',()=>{
 const storage=memory(),profile={data:{neon_glide_wallet_v3:'{"version":3,"balance":12345}'}};
 storage.setItem('neo_glide_profile:pilot','live');
 assert.equal(selectLocalPlay('pilot','Production',profile,storage),'Legacy-Production');
 assert.equal(storage.getItem('neo_glide_profile:pilot'),'live');
 const legacy=scopedStorage(storage,'Legacy-Production');
 assert.deepEqual(JSON.parse(legacy.getItem('neo_glide_profile:legacy-pilot')).data,profile.data);
 returnToOnline(storage);assert.equal(localPlaySelection(storage),null);assert.ok(legacy.getItem('neo_glide_profile:legacy-pilot'));
});
test('an interrupted local-bank setup cannot activate an incomplete bank',()=>{
 const storage=memory();storage.setItem=()=>{throw Error('storage full');};
 assert.throws(()=>selectLocalPlay('pilot','Production',{data:{}},storage));assert.equal(localPlaySelection(storage),null);
});
test('account deletion clears linked archives and local/test banks while preserving unrelated saves',()=>{
 const storage=memory();globalThis.localStorage=storage;
 const production=scopedStorage(storage,'Production'),sandbox=scopedStorage(storage,'Sandbox');
 production.setItem('neo_glide_accounts_v1',JSON.stringify({owner:'target',guest:'guest',accountAliases:{source:'target'}}));
 production.setItem('neo_glide_profile:other','unrelated');production.setItem('neo_glide_pre_economy_v1:source','archive');
 sandbox.setItem('neo_glide_accounts_v1',JSON.stringify({owner:'source',guest:'guest'}));sandbox.setItem('neo_glide_profile:source','sandbox save');
 selectLocalPlay('source','Production',{data:{}},storage);eraseLocalAccount('target');
 assert.equal(production.getItem('neo_glide_pre_economy_v1:source'),null);assert.equal(sandbox.getItem('neo_glide_profile:source'),null);
 assert.equal(scopedStorage(storage,'Legacy-Production').getItem('neo_glide_profile:legacy-source'),null);assert.equal(localPlaySelection(storage),null);assert.equal(production.getItem('neo_glide_profile:other'),'unrelated');
});
