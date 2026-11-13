import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSoundPreferences, saveSoundPreferences, normalizeSoundPreferences } from '../src/game/SoundPreferences.js';

test('sound switches persist independently and malformed saved preferences use safe defaults', () => {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  assert.deepEqual(loadSoundPreferences(), {music:true, sfx:true, musicVolume:.3, sfxVolume:.8});
  saveSoundPreferences({music:false, sfx:true, musicVolume:.3, sfxVolume:.8});
  assert.deepEqual(loadSoundPreferences(), {music:false, sfx:true, musicVolume:.3, sfxVolume:.8});
  saveSoundPreferences({music:true, sfx:false, musicVolume:.3, sfxVolume:.8});
  assert.deepEqual(loadSoundPreferences(), {music:true, sfx:false, musicVolume:.3, sfxVolume:.8});
  values.set('neon_glide_sound_preferences', '{broken');
  assert.deepEqual(loadSoundPreferences(), {music:true, sfx:true, musicVolume:.3, sfxVolume:.8});
  values.set('neon_glide_sound_preferences', JSON.stringify({music:'false', sfx:false}));
  assert.deepEqual(loadSoundPreferences(), {music:true, sfx:false, musicVolume:.3, sfxVolume:.8});
});

test('unavailable storage cannot prevent settings from being used for the session', () => {
  globalThis.localStorage = { getItem() { throw new Error('Unavailable'); }, setItem() { throw new Error('Unavailable'); } };
  assert.deepEqual(loadSoundPreferences(), {music:true, sfx:true, musicVolume:.3, sfxVolume:.8});
  assert.doesNotThrow(() => saveSoundPreferences({music:false, sfx:false}));
});


test('legacy switches migrate to quiet defaults without changing the mute choices', () => {
  assert.deepEqual(normalizeSoundPreferences({ music: false, sfx: true }),
    { music: false, sfx: true, musicVolume: .3, sfxVolume: .8 });
  assert.deepEqual(normalizeSoundPreferences({ music: true, sfx: false }),
    { music: true, sfx: false, musicVolume: .3, sfxVolume: .8 });
});

test('chosen levels persist independently, including zero, and invalid levels are bounded', () => {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  const preferences = { music: false, sfx: true, musicVolume: .12, sfxVolume: .73 };
  saveSoundPreferences(preferences);
  assert.deepEqual(loadSoundPreferences(), preferences);
  assert.deepEqual(normalizeSoundPreferences({ musicVolume: 0, sfxVolume: 1 }),
    { music: true, sfx: true, musicVolume: 0, sfxVolume: 1 });
  assert.equal(normalizeSoundPreferences({ musicVolume: -2 }).musicVolume, 0);
  assert.equal(normalizeSoundPreferences({ sfxVolume: 5 }).sfxVolume, 1);
  for (const value of [NaN, Infinity, null, '.9', {}]) {
    assert.equal(normalizeSoundPreferences({ musicVolume: value }).musicVolume, .3);
    assert.equal(normalizeSoundPreferences({ sfxVolume: value }).sfxVolume, .8);
  }
});

test('the old automatic 5% mix migrates once while mute and deliberately saved levels persist', () => {
  let saved = JSON.stringify({ music: false, sfx: true, musicVolume: .05, sfxVolume: .73 });
  globalThis.localStorage = { getItem: () => saved, setItem: (_, value) => { saved = value; } };
  assert.deepEqual(loadSoundPreferences(), { music: false, sfx: true, musicVolume: .3, sfxVolume: .73 });
  for (const musicVolume of [0, .05, .12, 1]) {
    const preferences = { music: true, sfx: false, musicVolume, sfxVolume: .73 };
    saveSoundPreferences(preferences);
    assert.deepEqual(loadSoundPreferences(), preferences);
  }
  for (const musicVolume of [0, .12, 1]) {
    saved = JSON.stringify({ musicVolume });
    assert.equal(loadSoundPreferences().musicVolume, musicVolume);
  }
});
