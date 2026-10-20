import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSoundPreferences, saveSoundPreferences } from '../src/game/SoundPreferences.js';

test('sound switches persist independently and malformed saved preferences use safe defaults', () => {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  assert.deepEqual(loadSoundPreferences(), {music:true, sfx:true});
  saveSoundPreferences({music:false, sfx:true});
  assert.deepEqual(loadSoundPreferences(), {music:false, sfx:true});
  saveSoundPreferences({music:true, sfx:false});
  assert.deepEqual(loadSoundPreferences(), {music:true, sfx:false});
  values.set('neon_glide_sound_preferences', '{broken');
  assert.deepEqual(loadSoundPreferences(), {music:true, sfx:true});
  values.set('neon_glide_sound_preferences', JSON.stringify({music:'false', sfx:false}));
  assert.deepEqual(loadSoundPreferences(), {music:true, sfx:false});
});

test('unavailable storage cannot prevent settings from being used for the session', () => {
  globalThis.localStorage = { getItem() { throw new Error('Unavailable'); }, setItem() { throw new Error('Unavailable'); } };
  assert.deepEqual(loadSoundPreferences(), {music:true, sfx:true});
  assert.doesNotThrow(() => saveSoundPreferences({music:false, sfx:false}));
});
