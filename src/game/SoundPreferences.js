const STORAGE_KEY = 'neon_glide_sound_preferences';

export function normalizeSoundPreferences(value) {
  return { music: value?.music !== false, sfx: value?.sfx !== false };
}

export function loadSoundPreferences() {
  try { return normalizeSoundPreferences(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch { return normalizeSoundPreferences(); }
}

export function saveSoundPreferences(value) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSoundPreferences(value))); }
  catch { /* Preferences still apply for this session when storage is unavailable. */ }
}
