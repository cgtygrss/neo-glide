export const AUDIENCE_KEY = 'neo_glide_audience_v1';
export const AGE_GROUPS = ['under13', '13to17', 'adult'];

export function readAudience(storage) {
  try {
    storage ??= globalThis.localStorage;
    const value = JSON.parse(storage?.getItem(AUDIENCE_KEY) || 'null');
    return value?.version === 1 && AGE_GROUPS.includes(value.group) ? value.group : null;
  } catch { return null; }
}

// Missing, unreadable or unrecognized preferences always use local family play.
export const onlineServicesAllowed = () => readAudience() === 'adult';
export function requireAdultServices() {
  if (!onlineServicesAllowed()) throw new Error('Online services, ads and purchases are unavailable in family play.');
}

export function chooseAudience(group, storage = globalThis.localStorage) {
  if (!AGE_GROUPS.includes(group)) throw new Error('Choose an age group.');
  const current = readAudience(storage);
  // No back-button/reopen route lets a younger player select an older band.
  if (current && current !== group) throw new Error('This device already has an age group. A parent can contact support to correct it.');
  storage.setItem(AUDIENCE_KEY, JSON.stringify({ version: 1, group }));
  if (readAudience(storage) !== group) throw new Error('Your age choice could not be saved. You can still play locally.');
  return group;
}
