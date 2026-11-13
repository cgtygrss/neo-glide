export const PILOT_NAME_LIMIT = 24;

export function cleanPilotName(value) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFC').replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/gu, ' ').trim();
}

export function validatePilotName(value) {
  const name = cleanPilotName(value);
  const length = Array.from(name).length;
  if (length < 2 || length > PILOT_NAME_LIMIT) throw new Error(`Choose a name with 2–${PILOT_NAME_LIMIT} characters.`);
  return name;
}

export function automaticPilotName(user) {
  const platform = cleanPilotName(user?.platformName);
  if (platform) return platform;
  const account = cleanPilotName(user?.name);
  return !user?.anonymous && account && account.toLowerCase() !== 'guest pilot' ? account : 'Guest pilot';
}

export function pilotDisplayName(profile, user) {
  return cleanPilotName(profile?.displayName) || automaticPilotName(user);
}
