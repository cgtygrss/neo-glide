import test from 'node:test';
import assert from 'node:assert/strict';
import { AUDIENCE_KEY, readAudience, chooseAudience, onlineServicesAllowed, requireAdultServices } from '../src/privacy/AudiencePolicy.js';

function storage(raw) {
  const values = new Map(raw ? [[AUDIENCE_KEY, raw]] : []);
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
test('unknown, corrupt, unavailable and younger age choices cannot enable online services', () => {
  for (const raw of [null, '{', '{}', '{"version":2,"group":"adult"}', '{"version":1,"group":"18"}', '{"version":1,"group":"under13"}', '{"version":1,"group":"13to17"}']) {
    globalThis.localStorage = storage(raw);
    assert.equal(onlineServicesAllowed(), false);
    assert.throws(requireAdultServices, /family play/);
  }
  assert.equal(readAudience({ getItem() { throw new Error('blocked'); } }), null);
});
test('only an explicitly saved adult band enables online services; no birthday is collected', () => {
  globalThis.localStorage = storage();
  chooseAudience('adult');
  assert.equal(onlineServicesAllowed(), true);
  assert.deepEqual(JSON.parse(localStorage.getItem(AUDIENCE_KEY)), { version: 1, group: 'adult' });
});
test('a younger selection persists and cannot be upgraded by reopening the age screen', () => {
  const local = storage();
  chooseAudience('under13', local);
  assert.throws(() => chooseAudience('adult', local), /already has an age group/);
  assert.equal(readAudience(local), 'under13');
  assert.throws(() => chooseAudience('unknown', local), /Choose an age group/);
});
