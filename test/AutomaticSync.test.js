import test from 'node:test';
import assert from 'node:assert/strict';
import { startAutomaticSync, SYNC_INTERVAL_MS } from '../src/account/AutomaticSync.js';

const settle = () => new Promise(resolve => setImmediate(resolve));
function environment() {
  const window = new EventTarget(), document = new EventTarget();
  document.hidden = false;
  const navigator = { onLine: true };
  let tick, cleared = false;
  window.setInterval = (fn, delay) => { assert.equal(delay, SYNC_INTERVAL_MS); tick = fn; return 1; };
  window.clearInterval = id => { assert.equal(id, 1); cleared = true; };
  return { window, document, navigator, tick: () => tick(), cleared: () => cleared };
}

test('startup, periodic polling, reconnect and foreground refresh automatically', async () => {
  const env = environment(); let calls = 0;
  const stop = startAutomaticSync({ ...env, sync: () => { calls++; } });
  await settle(); assert.equal(calls, 1);
  await env.tick(); assert.equal(calls, 2);
  env.window.dispatchEvent(new Event('online')); await settle(); assert.equal(calls, 3);
  env.document.hidden = true;
  env.document.dispatchEvent(new Event('visibilitychange')); await env.tick(); assert.equal(calls, 3);
  env.document.hidden = false;
  env.document.dispatchEvent(new Event('visibilitychange')); await settle(); assert.equal(calls, 4);
  env.navigator.onLine = false;
  await env.tick(); assert.equal(calls, 4);
  env.navigator.onLine = true;
  env.window.dispatchEvent(new Event('online')); await settle(); assert.equal(calls, 5);
  stop(); assert.equal(env.cleared(), true);
  env.window.dispatchEvent(new Event('online'));
  env.document.dispatchEvent(new Event('visibilitychange'));
  await env.tick(); assert.equal(calls, 5);
});

test('slow requests are shared and a failure retries on the next interval', async () => {
  const env = environment(); let calls = 0, reject;
  const stop = startAutomaticSync({ ...env, sync: () => {
    calls++;
    if (calls === 1) return new Promise((_, fail) => { reject = fail; });
  } });
  await settle();
  env.tick(); env.window.dispatchEvent(new Event('online'));
  env.document.dispatchEvent(new Event('visibilitychange'));
  await settle(); assert.equal(calls, 1);
  reject(new Error('offline')); await settle();
  await env.tick(); assert.equal(calls, 2);
  stop();
});

test('unmount and remount leave exactly one active scheduler', async () => {
  const env = environment(); let calls = 0;
  const stop = startAutomaticSync({ ...env, sync: () => { calls++; } });
  stop(); await settle();
  const secondStop = startAutomaticSync({ ...env, sync: () => { calls++; } });
  await settle(); const initial = calls;
  env.window.dispatchEvent(new Event('online')); await settle();
  assert.equal(calls, initial + 1);
  secondStop();
});
