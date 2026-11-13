import test from 'node:test';
import assert from 'node:assert/strict';
import { automaticPilotName, pilotDisplayName, validatePilotName } from '../src/account/PilotIdentity.js';
import { initializeProfiles, activateProfile, getLocalProfile, ownerId, profileStorage } from '../src/account/ProfileStorage.js';
import { loadProfile, saveProfile, updatePilotName, recordRun } from '../src/services/ProgressionService.js';
import { validateSave } from '../backend/shared/save.js';

function storage() {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
  return values;
}

test('platform gamer tags take priority over Firebase placeholder and Google account names', () => {
  assert.equal(automaticPilotName({ anonymous: false, name: 'Guest pilot', platformName: 'CometRider', platformProvider: 'Game Center' }), 'CometRider');
  assert.equal(automaticPilotName({ anonymous: false, name: 'Google Name', platformName: 'PlayGamer', platformProvider: 'Google Play Games' }), 'PlayGamer');
  assert.equal(automaticPilotName({ anonymous: true, name: 'Guest pilot', platformName: 'PlayGamer' }), 'PlayGamer', 'a platform gamer tag does not need to change the Firebase save identity');
  assert.equal(automaticPilotName({ anonymous: false, name: 'Çağatay Gürses' }), 'Çağatay Gürses');
  assert.equal(automaticPilotName({ anonymous: true, name: 'Old name' }), 'Guest pilot');
  assert.equal(automaticPilotName(null), 'Guest pilot');
});

test('manual nicknames survive repeated login and changing platform names', () => {
  assert.equal(pilotDisplayName({ displayName: 'My Pilot' }, { platformName: 'Old Gamer' }), 'My Pilot');
  assert.equal(pilotDisplayName({ displayName: 'My Pilot' }, { platformName: 'New Gamer' }), 'My Pilot');
  assert.equal(pilotDisplayName({ displayName: '' }, { platformName: 'New Gamer' }), 'New Gamer');
});

test('nicknames preserve Unicode, normalize spaces and reject empty or oversized input', () => {
  assert.equal(validatePilotName('  Çağatay   🚀  '), 'Çağatay 🚀');
  assert.equal(validatePilotName('e\u0301toile'), 'étoile');
  assert.equal(validatePilotName('Pilot\u202e One'), 'Pilot One');
  assert.equal(validatePilotName('🚀'.repeat(24)), '🚀'.repeat(24));
  for (const input of ['', ' ', 'A', '\u0000\u202e', 'a'.repeat(25), null, {}]) assert.throws(() => validatePilotName(input), /2–24/);
});

test('renaming reads the latest save, persists through flight progression and survives cloud validation', () => {
  storage(); initializeProfiles();
  saveProfile({ ...loadProfile(), level: 4, xp: 23, runs: 9 });
  const renamed = updatePilotName('  Space Pilot  ');
  assert.equal(renamed.displayName, 'Space Pilot');
  assert.equal(renamed.level, 4); assert.equal(renamed.runs, 9);
  const afterFlight = recordRun(renamed, { distance: 100, coins: 10, bosses: 0 }).profile;
  assert.equal(afterFlight.displayName, 'Space Pilot');
  const cloud = validateSave(getLocalProfile().data);
  assert.equal(JSON.parse(cloud.neon_glide_pilot_profile_v2).displayName, 'Space Pilot');
  profileStorage.setItem('neon_glide_pilot_profile_v2', cloud.neon_glide_pilot_profile_v2);
  assert.equal(loadProfile().displayName, 'Space Pilot');
});

test('renaming is isolated between game accounts and clearing returns to the current platform name', () => {
  storage(); initializeProfiles(); const first = ownerId();
  updatePilotName('First Pilot');
  activateProfile('second-account');
  assert.equal(loadProfile().displayName, '');
  updatePilotName('Second Pilot');
  activateProfile(first);
  assert.equal(loadProfile().displayName, 'First Pilot');
  const cleared = updatePilotName(null);
  assert.equal(pilotDisplayName(cleared, { platformName: 'Game Center Pilot' }), 'Game Center Pilot');
  activateProfile('second-account'); assert.equal(loadProfile().displayName, 'Second Pilot');
});

test('invalid or interrupted nickname writes leave the existing pilot progress unchanged', () => {
  storage(); initializeProfiles(); updatePilotName('Keep Me');
  const before = structuredClone(getLocalProfile());
  assert.throws(() => updatePilotName('  '));
  assert.deepEqual(getLocalProfile(), before);
  const write = localStorage.setItem; localStorage.setItem = () => { throw new Error('full'); };
  try { assert.throws(() => updatePilotName('New Name'), /full/); } finally { localStorage.setItem = write; }
  assert.deepEqual(getLocalProfile(), before);
});
