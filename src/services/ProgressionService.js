import { CREDIT_SCALE, runXp } from '../game/Economy.js';

const PROFILE_KEY = 'neon_glide_pilot_profile_v2';

export const CAREER_MISSIONS = [
  { id: 'distance_5k', title: 'Deep Space Rookie', description: 'Travel 5,000m in total', stat: 'totalDistance', target: 5000, reward: 50000 },
  { id: 'coins_1k', title: 'Data Hunter', description: 'Collect 100,000 credits', stat: 'totalCoins', target: 100000, reward: 35000 },
  { id: 'bosses_10', title: 'Boss Breaker', description: 'Defeat 10 enemy ships', stat: 'bosses', target: 10, reward: 100000 },
  { id: 'runs_25', title: 'Veteran Pilot', description: 'Complete 25 runs', stat: 'runs', target: 25, reward: 75000 },
];

export const defaultProfile = {
  level: 1,
  xp: 0,
  totalDistance: 0,
  totalCoins: 0,
  runs: 0,
  bosses: 0,
  bestDistance: 0,
  claimedMissions: [],
};

export const xpForNextLevel = level => 400 + (level - 1) * 175;

export function loadProfile() {
  try {
    const current = localStorage.getItem(PROFILE_KEY);
    if (current !== null) return { ...defaultProfile, ...(JSON.parse(current) || {}) };
    const legacy = JSON.parse(localStorage.getItem('neon_glide_pilot_profile'));
    return legacy ? { ...defaultProfile, ...legacy, totalCoins: Math.max(0, Number(legacy.totalCoins) || 0) * CREDIT_SCALE } : { ...defaultProfile };
  } catch {
    return { ...defaultProfile };
  }
}

export function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

export function recordRun(profile, { distance, coins, bosses }, previous = null) {
  const committed = previous || { distance: 0, coins: 0, bosses: 0 };
  const xpEarned = Math.max(0, runXp({ distance, coins, bosses }) - runXp(committed));
  const next = {
    ...profile,
    xp: profile.xp + xpEarned,
    totalDistance: profile.totalDistance + Math.max(0, Math.floor(distance) - Math.floor(committed.distance)),
    totalCoins: profile.totalCoins + Math.max(0, coins - committed.coins),
    runs: profile.runs + (previous ? 0 : 1),
    bosses: profile.bosses + Math.max(0, bosses - committed.bosses),
    bestDistance: Math.max(profile.bestDistance, Math.floor(distance)),
  };

  let levelsGained = 0;
  while (next.xp >= xpForNextLevel(next.level)) {
    next.xp -= xpForNextLevel(next.level);
    next.level += 1;
    levelsGained += 1;
  }

  saveProfile(next);
  return { profile: next, xpEarned, levelsGained, committed: { distance, coins, bosses } };
}

export function claimMission(profile, missionId) {
  const mission = CAREER_MISSIONS.find(item => item.id === missionId);
  if (!mission || profile.claimedMissions.includes(missionId) || profile[mission.stat] < mission.target) return null;
  const next = { ...profile, claimedMissions: [...profile.claimedMissions, missionId] };
  saveProfile(next);
  return { profile: next, reward: mission.reward };
}
