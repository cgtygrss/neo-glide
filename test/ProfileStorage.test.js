import { newId } from '../src/account/Id.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeProfiles,profileStorage,getLocalProfile,activateProfile,ownerId } from '../src/account/ProfileStorage.js';
function storage(){const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};return values;}
test('migration backs up once and switching cannot import another pilots wallet',()=>{const data=storage();data.set('neon_glide_currency_v2','12345');const initial=initializeProfiles();assert.equal(profileStorage.getItem('neon_glide_currency_v2'),'12345');profileStorage.setItem('neon_glide_wallet_v3','{"balance":12345}');activateProfile('second');assert.equal(profileStorage.getItem('neon_glide_wallet_v3'),null);assert.equal(profileStorage.getItem('neon_glide_currency_v2'),null);profileStorage.setItem('neon_glide_wallet_v3','{"balance":77}');activateProfile(initial.owner);assert.equal(JSON.parse(profileStorage.getItem('neon_glide_wallet_v3')).balance,12345);assert.equal(JSON.parse(data.get('neo_glide_legacy_backup_v1')).neon_glide_currency_v2,'12345');assert.equal(initializeProfiles().owner,initial.owner);});
test('an interrupted scoped write cannot debit balance or alter active account',()=>{storage();initializeProfiles();profileStorage.setItem('neon_glide_wallet_v3','{"balance":100}');const owner=ownerId(),write=localStorage.setItem;localStorage.setItem=()=>{throw new Error('full');};assert.throws(()=>profileStorage.setItem('neon_glide_wallet_v3','{"balance":0}'));localStorage.setItem=write;assert.equal(ownerId(),owner);assert.equal(JSON.parse(getLocalProfile().data.neon_glide_wallet_v3).balance,100);});
test('device-only audio cannot leak into a cloud profile',()=>{const data=storage();initializeProfiles();data.set('neon_glide_sound_preferences','{"music":false}');assert.throws(()=>profileStorage.setItem('neon_glide_sound_preferences','{}'));activateProfile('other');assert.equal(localStorage.getItem('neon_glide_sound_preferences'),'{"music":false}');});

test('flight IDs work on early iOS without crypto.randomUUID',()=>{
 const uuid=crypto.randomUUID;crypto.randomUUID=undefined;
 try { const a=newId(),b=newId();assert.match(a,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);assert.notEqual(a,b); } finally {crypto.randomUUID=uuid;}
});
