import { MUSIC_VOLUME, SFX_VOLUME } from './MusicTracks.js';

const STORAGE_KEY = 'neon_glide_sound_preferences';
const MIX_VERSION = 2;
const volume = (value, fallback) => typeof value === 'number' && Number.isFinite(value)
  ? Math.min(1, Math.max(0, value)) : fallback;

export function normalizeSoundPreferences(value) {
  return {
    music: value?.music !== false, sfx: value?.sfx !== false,
    musicVolume: volume(value?.musicVolume, MUSIC_VOLUME),
    sfxVolume: volume(value?.sfxVolume, SFX_VOLUME),
  };
}

export function loadSoundPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    // Previous builds automatically saved the almost inaudible 5% default.
    // Upgrade it once; retain mute switches, zero and other chosen levels.
    if (saved && saved.mixVersion !== MIX_VERSION && saved.musicVolume === .05) {
      saved.musicVolume = MUSIC_VOLUME;
    }
    return normalizeSoundPreferences(saved);
  }
  catch { return normalizeSoundPreferences(); }
}

export function saveSoundPreferences(value) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...normalizeSoundPreferences(value), mixVersion: MIX_VERSION })); }
  catch { /* Preferences still apply for this session when storage is unavailable. */ }
}
