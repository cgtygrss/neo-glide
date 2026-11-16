import test from 'node:test';
import assert from 'node:assert/strict';
import { initialOnlineSave,protectEconomicSave,walletOf,spendCredits,applyFlightEarnings,claimCareerReward,reverseSpend,debitRefund,creditWallet } from '../shared/online-economy.js';
const paid=(credits=250000)=>initialOnlineSave(null,[{id:'apple:Production:1',productId:'credits_250000',credits,environment:'Production',consumable:true}],'Production');
test('migration excludes forged legacy money/gear and Sandbox receipts while retaining verified production purchases',()=>{
 const legacy={neon_glide_wallet_v3:JSON.stringify({version:3,balance:999999999,creditCosmetics:{void_pilot:true}}),neon_glide_owned_ships:'["void_runner"]',neon_glide_pilot_profile_v2:'{"displayName":"Pilot","level":999}'};
 const result=initialOnlineSave(legacy,[{environment:'Sandbox',productId:'credits_15000',credits:1500000},{environment:'Production',productId:'credits_50000',credits:50000,consumable:true},{environment:'Production',productId:'starter_pack',credits:200000,revoked:true}],'Production');
 assert.equal(walletOf(result).balance,50000);assert.deepEqual(walletOf(result).creditCosmetics,{});assert.deepEqual(JSON.parse(result.neon_glide_owned_ships),['default']);assert.equal(JSON.parse(result.neon_glide_pilot_profile_v2).displayName,'Pilot');assert.equal(JSON.parse(result.neon_glide_pilot_profile_v2).level,1);
 const forged=protectEconomicSave({...legacy,neon_glide_upgrades:'{"battery":999}'},result);
 assert.equal(walletOf(forged).balance,50000);assert.deepEqual(JSON.parse(forged.neon_glide_upgrades),{});
});
test('server prices, insufficient funds, forged prices and paid ownership control spending',()=>{
 const start=paid(),body={kind:'ship',id:'interceptor',expectedPrice:60000};
 assert.throws(()=>spendCredits(start,{...body,expectedPrice:1},0),error=>error.code==='offer-changed');
 assert.throws(()=>spendCredits(start,{kind:'ship',id:'constructor',expectedPrice:0},0));
 const result=spendCredits(start,body,0);assert.equal(walletOf(result.save).balance,190000);assert.equal(result.charged,60000);
 assert.equal(spendCredits(result.save,body,0).charged,0);
 assert.throws(()=>spendCredits(start,{kind:'weapon',id:'antimatter',expectedPrice:2000000},0),/Not enough/);
 assert.equal(spendCredits(start,{kind:'upgrade',id:'battery',expectedPrice:5000},0).save.neon_glide_upgrades,'{"battery":2}');
});

test('prototype names cannot select unowned presentation equipment',()=>{
 const authoritative=initialOnlineSave(null,[],'Production');
 for(const id of ['constructor','__proto__','prototype']){
  const wallet={...walletOf(authoritative),equippedStage:id};
  const next=protectEconomicSave({...authoritative,neon_glide_equipped_cosmetic:id,neon_glide_wallet_v3:JSON.stringify(wallet)},authoritative);
  assert.equal(next.neon_glide_equipped_cosmetic,'');assert.equal(walletOf(next).equippedStage,'default');
 }
});
test('validated flight highwater grants loot, distance, combat and levels exactly once',()=>{
 const start=initialOnlineSave(null,[],'Production'),run={seconds:300,distance:3000,coins:20000,bosses:1,eliteBosses:0};
 const first=applyFlightEarnings(start,run,null);assert.equal(walletOf(first).balance,65000);assert.equal(JSON.parse(first.neon_glide_pilot_profile_v2).level,2);
 assert.deepEqual(applyFlightEarnings(first,run,run),first);
 const claimable={...first,neon_glide_pilot_profile_v2:JSON.stringify({...JSON.parse(first.neon_glide_pilot_profile_v2),runs:25})};
 const reward=claimCareerReward(claimable,'runs_25');assert.equal(reward.reward,75000);assert.equal(claimCareerReward(reward.save,'runs_25').reward,0);
 assert.throws(()=>claimCareerReward(first,'bosses_10'),/not ready/);
});
test('refunded spent credits unwind server purchases and future earnings repay any remainder',()=>{
 const bought=spendCredits(paid(),{kind:'ship',id:'interceptor',expectedPrice:60000},0);
 const wallet=debitRefund(walletOf(bought.save),250000);assert.equal(wallet.balance,0);assert.equal(wallet.debt,60000);
 const reverted=reverseSpend({...bought.save,neon_glide_wallet_v3:JSON.stringify(wallet)},{kind:'ship',id:'interceptor',charged:60000});
 assert.equal(walletOf(reverted).debt,0);assert.equal(walletOf(reverted).balance,0);assert.deepEqual(JSON.parse(reverted.neon_glide_owned_ships),['default']);
 const debt=debitRefund(walletOf(paid(0)),10000);creditWallet(debt,5000);assert.equal(debt.balance,0);assert.equal(debt.debt,5000);
 creditWallet(debt,7000);assert.equal(debt.debt,0);assert.equal(debt.balance,2000);
});
