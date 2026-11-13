import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileEntitlements } from '../shared/entitlements.js';
import { googlePurchaseRevoked } from '../purchases.js';
import { verifyAppleReceipt } from '../apple-receipts.js';

test('verified refunds remove store ownership and preserve earned unlocks and other platform purchases', () => {
 const wallet={version:3,balance:50,cloudEntitlements:{cosmetic_void_pilot:true,cosmetic_jade_drift:true},creditCosmetics:{void_pilot:true},eventCosmetics:{jade_drift:true},transactions:{receipt:'cosmetic_void_pilot'}};
 const save={neon_glide_wallet_v3:JSON.stringify(wallet)};
 const records=[{id:'apple:Production:1',productId:'cosmetic_void_pilot',revoked:true},{id:'google:2',productId:'cosmetic_jade_drift'},{id:'apple:Production:3',productId:'cosmetic_jade_drift',revoked:true},{id:'google:4',productId:'credits_1000',consumable:true}];
 const updated=JSON.parse(reconcileEntitlements(save,records).neon_glide_wallet_v3);
 assert.deepEqual(updated,{...wallet,cloudEntitlements:{cosmetic_jade_drift:true}});
 assert.equal(JSON.parse(save.neon_glide_wallet_v3).cloudEntitlements.cosmetic_void_pilot,true);
});

test('Google cancellations are explicit; unavailable and pending receipts cannot revoke ownership', async () => {
 const input={productId:'cosmetic_void_pilot',purchaseToken:'token'};
 const options=state=>({accessToken:async()=>'test',fetch:async()=>new Response(JSON.stringify({purchaseState:state}))});
 assert.equal(await googlePurchaseRevoked(input,options(1)),true);
 assert.equal(await googlePurchaseRevoked(input,options(0)),false);
 await assert.rejects(googlePurchaseRevoked(input,options(2)),/not completed/);
 await assert.rejects(googlePurchaseRevoked(input,{...options(0),fetch:async()=>new Response('',{status:503})}),/could not verify/);
});

test('only signed matching Apple revocations can enter reconciliation; they cannot deliver purchases', async () => {
 const input={productId:'cosmetic_void_pilot',transactionId:'1',signedTransaction:'signed'};
 const receipt={...input,environment:'Production',revocationDate:123};
 const verify=async()=>receipt;
 await assert.rejects(verifyAppleReceipt(input,{verify}),/does not match/);
 assert.equal((await verifyAppleReceipt(input,{verify,allowRevoked:true})).revocationDate,123);
 await assert.rejects(verifyAppleReceipt({...input,productId:'cosmetic_jade_drift'},{verify,allowRevoked:true}),/does not match/);
 await assert.rejects(verifyAppleReceipt(input,{verify:async()=>{throw Error('invalid signature');},allowRevoked:true}),/invalid signature/);
});
