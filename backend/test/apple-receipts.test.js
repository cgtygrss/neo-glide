import test from 'node:test';
import assert from 'node:assert/strict';
import { Environment, VerificationStatus } from '@apple/app-store-server-library';
import { verifyAppleReceipt } from '../apple-receipts.js';
import { verifyStorePurchase } from '../purchases.js';
const input={productId:'cosmetic_void_pilot',transactionId:'123',signedTransaction:'signed-jws'};
const receipt={productId:input.productId,transactionId:input.transactionId,environment:Environment.PRODUCTION};
test('production purchases are verified once without falling back',async()=>{
 const attempts=[];
 const result=await verifyAppleReceipt(input,{environment:Environment.PRODUCTION,verify:async(env,jws)=>{attempts.push([env,jws]);return receipt;}});
 assert.equal(result,receipt);assert.deepEqual(attempts,[[Environment.PRODUCTION,input.signedTransaction]]);
});
test('production never retries Sandbox; only the isolated test context accepts Sandbox receipts',async()=>{
 const attempts=[];
 const verify=async env=>{attempts.push(env);if(env===Environment.PRODUCTION)throw Object.assign(new Error('environment'),{status:VerificationStatus.INVALID_ENVIRONMENT});return {...receipt,environment:env};};
 await assert.rejects(verifyAppleReceipt(input,{environment:Environment.PRODUCTION,verify}));
 assert.deepEqual(attempts,[Environment.PRODUCTION]);
 const result=await verifyAppleReceipt(input,{environment:Environment.SANDBOX,verify});
 assert.equal(result.environment,Environment.SANDBOX);
 await assert.rejects(verifyAppleReceipt(input,{environment:Environment.PRODUCTION,verify:async()=>({...receipt,environment:Environment.SANDBOX})}),/environment does not match/);
});
test('tampered signatures and unavailable verification never fall back',async()=>{
 for(const status of [VerificationStatus.INVALID_CERTIFICATE,VerificationStatus.VERIFICATION_FAILURE,VerificationStatus.RETRYABLE_VERIFICATION_FAILURE]){
  let attempts=0;await assert.rejects(verifyAppleReceipt(input,{environment:Environment.PRODUCTION,verify:async()=>{attempts++;throw Object.assign(new Error('unverified'),{status});}}),/unverified/);assert.equal(attempts,1);
 }
});
test('mismatched and revoked receipts cannot deliver a product',async()=>{
 for(const invalid of [{...receipt,productId:'another'},{...receipt,transactionId:'another'},{...receipt,revocationDate:1}])await assert.rejects(verifyAppleReceipt(input,{verify:async()=>invalid}),/does not match/);
});
test('Google license-test purchases are accepted only in the isolated test bank',async()=>{
 const purchase={platform:'android',productId:'cosmetic_void_pilot',transactionId:'GPA.123',purchaseToken:'token'},options={accessToken:async()=>'access',fetch:async()=>new Response(JSON.stringify({purchaseState:0,purchaseType:0}))};
 await assert.rejects(verifyStorePurchase(purchase,{...options,environment:'Production'}),/Test purchases/);
 assert.equal((await verifyStorePurchase(purchase,{...options,environment:'Sandbox'})).environment,'Sandbox');
});
