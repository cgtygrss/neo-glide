import test from 'node:test';
import assert from 'node:assert/strict';
import { identity, callServer } from '../src/account/FirebaseClient.js';
import { startAccount } from '../src/account/AccountService.js';
import { showRewardedAd, purchaseProduct, restorePurchases, initializeMonetization, refreshStoreProducts } from '../src/services/MonetizationService.js';
import { isNativeAdMobAvailable, initializeAdMob } from '../src/services/AdMobService.js';

test('family and unknown audiences cannot reach identity, server, ads or purchase bridges', async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error('Network must not be reached'); };
  try {
    for (const group of [null, 'under13', '13to17']) {
      globalThis.localStorage = { getItem: key => key === 'neo_glide_audience_v1' && group ? JSON.stringify({ version: 1, group }) : null, setItem() {} };
      for (const action of [() => identity.restore(), () => identity.guest(), () => identity.token(), () => identity.auto(), () => identity.begin(), () => identity.commit(), () => identity.playerProfile(), () => identity.clear(), () => identity.remove(), () => callServer('sync', {}, 'existing-token'), () => showRewardedAd('test'), () => purchaseProduct('starter_pack'), () => restorePurchases()]) {
        await assert.rejects(action(), /family play/);
      }
      await startAccount();
      await initializeMonetization();
      assert.equal(isNativeAdMobAvailable(), false);
      assert.equal((await initializeAdMob()).ready, false);
      assert.ok((await refreshStoreProducts()).every(product => !product.available));
    }
    assert.equal(requests, 0);
  } finally { globalThis.fetch = originalFetch; }
});
