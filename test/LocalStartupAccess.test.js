import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { configureRuntimeRealm } from '../src/account/RuntimeRealm.js';
import { AUDIENCE_KEY } from '../src/privacy/AudiencePolicy.js';

// Real account coordination, with any unexpected identity/network call recorded.
const firebaseUrl = new URL('../src/account/FirebaseClient.js', import.meta.url).href;
registerHooks({ load(url, context, nextLoad) {
  if (url === firebaseUrl) return { format: 'module', shortCircuit: true, source: `
    export const identity = new Proxy({}, { get: (_, key) => async () => { globalThis.startupCalls.push(key); throw Error('Unexpected identity request'); } });
    export const callServer = async () => { globalThis.startupCalls.push('server'); throw Error('Unexpected server request'); };
  ` };
  return nextLoad(url, context);
} });
function fixture(group) {
  const values = new Map([['neo_glide_profile:existing', '{"data":{"saved":"retained"}}']]);
  if (group) values.set(AUDIENCE_KEY, JSON.stringify({ version: 1, group }));
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
  globalThis.window = new EventTarget();
  globalThis.startupCalls = [];
  return values;
}
test('opening without an age choice or with a younger choice never starts auth/cloud or changes existing saves', async () => {
  for (const group of [null, 'under13', '13to17']) {
    const values = fixture(group), before = [...values];
    const service = await import(`../src/account/AccountService.js?local-startup=${group}`);
    await service.startAccount(); await service.syncAccount();
    await assert.rejects(service.connectAccount('google'), /family play/);
    assert.deepEqual(globalThis.startupCalls, []);
    assert.deepEqual([...values], before);
  }
});
test('the simulator local realm cannot authenticate, upload progress, buy, restore or grant ad rewards even for an adult choice', async () => {
  const values = fixture('adult'), before = [...values];
  configureRuntimeRealm('Xcode');
  const service = await import('../src/account/AccountService.js?local-startup=simulator');
  const store = await import('../src/services/MonetizationService.js');
  await service.startAccount(); await service.syncAccount();
  await assert.rejects(service.connectAccount('google'), /physical device/);
  await store.initializeMonetization();
  await assert.rejects(store.purchaseProduct('credits_50000'), /physical device/);
  await assert.rejects(store.restorePurchases(), /physical device/);
  await assert.rejects(store.showRewardedAd('earnings'), /simulator/);
  assert.deepEqual(globalThis.startupCalls, []);
  assert.deepEqual([...values], before);
});
