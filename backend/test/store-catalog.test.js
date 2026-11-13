import test from 'node:test';
import assert from 'node:assert/strict';
import { COSMETIC_PRODUCT_IDS, CREDIT_PACK_CATALOG } from '../shared/store-catalog.js';
import { verifyStorePurchase } from '../purchases.js';

test('all skin SKUs reach receipt verification and never deliver without a signed receipt', async () => {
  for (const productId of COSMETIC_PRODUCT_IDS) {
    await assert.rejects(verifyStorePurchase({productId, transactionId: '123', platform: 'ios'}), /Missing App Store signed transaction/);
    await assert.rejects(verifyStorePurchase({productId, transactionId: '123', platform: 'android'}), /Product unavailable on Android/);
    await assert.rejects(verifyStorePurchase({productId, transactionId: '123', platform: 'web'}), /native store receipt/);
  }
  await assert.rejects(verifyStorePurchase({productId: 'cosmetic_forged', transactionId: '123', platform: 'ios'}), /Unknown store product/);
});

test('all six credit SKUs reach Apple signature verification and remain unavailable on unsupported platforms',async()=>{
  assert.equal(CREDIT_PACK_CATALOG.length,6);
  for(const pack of CREDIT_PACK_CATALOG) {
    await assert.rejects(verifyStorePurchase({productId:pack.id,transactionId:'123',platform:'ios'}),/Missing App Store signed transaction/);
    await assert.rejects(verifyStorePurchase({productId:pack.id,transactionId:'123',platform:'android'}),/Product unavailable on Android/);
    await assert.rejects(verifyStorePurchase({productId:pack.id,transactionId:'123',platform:'web'}),/native store receipt/);
  }
  await assert.rejects(verifyStorePurchase({productId:'credits_forged',transactionId:'123',platform:'ios'}),/Unknown store product/);
});
