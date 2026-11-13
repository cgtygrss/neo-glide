import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { getLocalProfile, putLocalProfile } from '../src/account/ProfileStorage.js';

// Exercise the real coordinator and persistence with an isolated identity/API.
// No Firebase project or live credentials are used by these tests.
const firebaseUrl = new URL('../src/account/FirebaseClient.js', import.meta.url).href;
registerHooks({ load(url, context, nextLoad) {
  if (url === firebaseUrl) return { format: 'module', shortCircuit: true, source: `
    export const identity = new Proxy({}, {get: (_, key) => globalThis.accountTest.identity[key]});
    export const callServer = (...args) => globalThis.accountTest.callServer(...args);
  ` };
  return nextLoad(url, context);
} });
let sequence = 0;
async function fixture() {
  const values = new Map();
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
  globalThis.window = new EventTarget();
  localStorage.setItem('neo_glide_audience_v1', JSON.stringify({ version: 1, group: 'adult' }));
  localStorage.setItem('neo_glide_accounts_v1', JSON.stringify({ owner: 'pilot', guest: 'device-guest' }));
  const initial = { data: { neon_glide_pilot_profile_v2: '{"level":2}' }, revision: 1, dirty: false };
  putLocalProfile('pilot', initial);
  const remote = { save: initial.data, revision: 1, instances: [], serverNow: Date.now(), lease: { id: 'lease', end: Date.now() + 86400000 } };
  const calls = [];
  const api = async (action, body) => {
    calls.push(action);
    if (action === 'save') { remote.save = body.data; remote.revision++; }
    return structuredClone(remote);
  };
  globalThis.accountTest = {
    identity: { restore: async () => ({ uid: 'pilot' }), playerProfile: async () => ({}), token: async () => 'token' },
    callServer: api
  };
  const service = await import(`../src/account/AccountService.js?test=${sequence++}`);
  await service.startAccount(); calls.length = 0;
  return { service, remote, calls, api };
}

test('account sync flushes pending flights before refreshing events and saving player progress', async () => {
  const { service, calls } = await fixture();
  localStorage.setItem('neo_glide_flights:pilot', '[{"runId":"flight","seconds":10}]');
  putLocalProfile('pilot', { ...getLocalProfile(), dirty: true });
  await service.syncAccount();
  assert.deepEqual(calls, ['flight', 'sync', 'save']);
  assert.equal(getLocalProfile().dirty, false);
  assert.equal(service.accountSnapshot().status, 'synced');
  assert.deepEqual(JSON.parse(localStorage.getItem('neo_glide_flights:pilot')), []);
});

test('matching-revision progress uploads during a flight; remote replacement waits for release', async () => {
  const { service, remote, calls } = await fixture();
  service.setAccountLocked(true);
  putLocalProfile('pilot', { ...getLocalProfile(), data: { neon_glide_pilot_profile_v2: '{"level":3}' }, dirty: true });
  await service.syncAccount();
  assert.deepEqual(calls, ['sync', 'save']);
  assert.equal(getLocalProfile().revision, 2);
  remote.revision = 3; remote.save = { neon_glide_pilot_profile_v2: '{"level":4}' };
  await service.syncAccount();
  assert.equal(JSON.parse(getLocalProfile().data.neon_glide_pilot_profile_v2).level, 3);
  assert.equal(service.accountSnapshot().status, 'pending');
  service.setAccountLocked(false); await service.syncAccount();
  assert.equal(JSON.parse(getLocalProfile().data.neon_glide_pilot_profile_v2).level, 4);
});

test('writes during an upload stay dirty and the next automatic cycle saves them', async () => {
  const { service, api } = await fixture();
  putLocalProfile('pilot', { ...getLocalProfile(), dirty: true });
  globalThis.accountTest.callServer = async (action, body) => {
    if (action === 'save') putLocalProfile('pilot', { ...getLocalProfile(), data: { neon_glide_pilot_profile_v2: '{"level":5}' }, dirty: true });
    return api(action, body);
  };
  await service.syncAccount(); assert.equal(getLocalProfile().dirty, true);
  assert.equal(getLocalProfile().revision, 2);
  globalThis.accountTest.callServer = api;
  await service.syncAccount(); assert.equal(getLocalProfile().dirty, false);
  assert.equal(JSON.parse(getLocalProfile().data.neon_glide_pilot_profile_v2).level, 5);
});

test('divergent saves remain intact during flight and require a choice after release', async () => {
  const { service, remote, calls } = await fixture();
  service.setAccountLocked(true);
  putLocalProfile('pilot', { ...getLocalProfile(), dirty: true });
  remote.revision++;
  await service.syncAccount();
  assert.equal(service.accountSnapshot().conflict, null);
  assert.equal(getLocalProfile().dirty, true);
  assert.deepEqual(calls, ['sync']);
  service.setAccountLocked(false); await service.syncAccount();
  assert.ok(service.accountSnapshot().conflict);
  assert.equal(getLocalProfile().revision, 1);
});

test('a failed session restoration can retry without user action', async () => {
  const { service } = await fixture();
  // A fresh service starts without a restored user, just like offline launch.
  globalThis.accountTest.identity.restore = async () => { throw new Error('Offline'); };
  const fresh = await import(`../src/account/AccountService.js?test=${sequence++}`);
  await fresh.startAccount(); assert.equal(fresh.accountSnapshot().status, 'offline');
  globalThis.accountTest.identity.restore = async () => service.accountSnapshot().user;
  await fresh.startAccount(); assert.equal(fresh.accountSnapshot().status, 'synced');
});
