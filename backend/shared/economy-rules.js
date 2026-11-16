export const CREDIT_SCALE = 100;
export const COIN_VALUES = [50, 100, 250, 500, 10000];
export const ENEMY_REWARD = 5000;
export const BOSS_REWARD = 25000;
export const LEVEL_REWARD = 10000;
export const MULTIPLIER_MAX_LEVEL = 5;
export const coinMultiplier = (level = 1) => Math.min(2, 1 + .25 * (Math.max(1, Number(level) || 1) - 1));
export const SHIP_PRICES = { default: 0, interceptor: 60000, cruiser: 180000, stealth: 400000, void_runner: 900000, plasma_breaker: 1800000, kestrel: 95000, manta: 140000, bulwark: 260000, firefly: 340000, lancer: 520000, nomad: 680000, mender: 850000, corsair: 1100000, wisp: 1400000, sentinel: 1650000 };
export const UPGRADE_PRICES = { battery: 5000, thruster: 7500, magnet: 10000, hull: 25000, multiplier: 50000, shield_gen: 100000, ammo_capacity: 18000, ammo_regen: 22000, boost_efficiency: 15000, energy_recovery: 45000, medical: 12000, armor: 35000, hit_guard: 28000, power_duration: 32000, tractor_speed: 16000, repair_amplifier: 60000 };
export const WEAPON_PRICES = { default: 0, blaster: 75000, cannon: 150000, beam: 300000, wave: 600000, shock: 1250000, needle: 35000, frost: 110000, ember: 220000, rail: 450000, photon: 260000, vortex: 780000, sonic: 540000, shard: 950000, nova: 1550000, antimatter: 2000000 };

export const runXp = ({ distance = 0, coins = 0, bosses = 0 }) =>
  Math.floor(Math.max(0, distance) / 8) + Math.floor(Math.max(0, coins) * 2 / (CREDIT_SCALE * 10)) + Math.max(0, bosses) * 125;
