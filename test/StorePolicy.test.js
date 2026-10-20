import test from 'node:test';
import assert from 'node:assert/strict';
import { canRetryPendingPurchase, canSimulateWebPurchase, isStoreProductAvailable } from '../src/services/StorePolicy.js';

test('only development web previews simulate grants and expose products', () => {
  assert.equal(canSimulateWebPurchase({ platform: 'web', isNative: false, isDevelopment: true }), true);
  assert.equal(isStoreProductAvailable({ platform: 'web', isNative: false, isDevelopment: false }), false);
  assert.equal(isStoreProductAvailable({ platform: 'ios', isNative: true, isDevelopment: false }), true);
});

test('only iOS may retry a durable pending Ask-to-Buy marker', () => {
  assert.equal(canRetryPendingPurchase({ platform: 'ios', isPending: true }), true);
  assert.equal(canRetryPendingPurchase({ platform: 'android', isPending: true }), false);
  assert.equal(canRetryPendingPurchase({ platform: 'web', isPending: true }), false);
  assert.equal(canRetryPendingPurchase({ platform: 'ios', isPending: true, isOwned: true }), false);
});
