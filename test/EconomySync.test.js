import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEconomyResponse } from '../src/account/EconomySync.js';
import { initialOnlineSave } from '../backend/shared/online-economy.js';
import { putLocalProfile,getLocalProfile } from '../src/account/ProfileStorage.js';

test('an older purchase/sync response cannot overwrite a newer authoritative wallet',()=>{
 const values=new Map();globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};
 const newest=initialOnlineSave(null,[],'Production'),wallet=JSON.parse(newest.neon_glide_wallet_v3);
 wallet.balance=450;newest.neon_glide_wallet_v3=JSON.stringify(wallet);
 putLocalProfile('pilot',{economyVersion:1,revision:12,data:newest,dirty:false});
 applyEconomyResponse('pilot',{economyVersion:1,revision:11,save:initialOnlineSave(null,[],'Production')});
 assert.equal(getLocalProfile('pilot').revision,12);assert.equal(JSON.parse(getLocalProfile('pilot').data.neon_glide_wallet_v3).balance,450);
});
