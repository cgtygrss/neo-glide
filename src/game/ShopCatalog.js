import { UPGRADE_PRICES, WEAPON_PRICES, coinMultiplier, MULTIPLIER_MAX_LEVEL } from './Economy.js';
import { Player, PlayerProjectile } from './Entities.js';
import { maxHullHealth, hullRecoveryRate } from './PlayerHealth.js';

export const UPGRADES = [
  { id: 'battery', name: 'Battery Capacity', cost: UPGRADE_PRICES.battery, desc: 'A bigger tank for longer boosts.' },
  { id: 'thruster', name: 'Thruster Power', cost: UPGRADE_PRICES.thruster, desc: 'More lift and a faster starting pace.' },
  { id: 'magnet', name: 'Magnet Range', cost: UPGRADE_PRICES.magnet, desc: 'Pull nearby coins from further away.' },
  { id: 'hull', name: 'Hull Strength', cost: UPGRADE_PRICES.hull, desc: '+20 maximum health. Walls still end the flight.' },
  { id: 'multiplier', name: 'Data Multiplier', cost: UPGRADE_PRICES.multiplier, desc: 'Add 0.25× coin value per upgrade, up to 2×.' },
  { id: 'shield_gen', name: 'Shield Generator', cost: UPGRADE_PRICES.shield_gen, desc: 'Recover damaged hull while you fly.' },
];
export const WEAPONS = [
  { id: 'default', name: 'Pulse Laser', cost: WEAPON_PRICES.default, desc: 'A compact, straight-flying pulse.' },
  { id: 'blaster', name: 'Solar Blaster', cost: WEAPON_PRICES.blaster, desc: 'Fast, pointed plasma shots.' },
  { id: 'cannon', name: 'Magma Cannon', cost: WEAPON_PRICES.cannon, desc: 'A heavy sphere with a bright directional core.' },
  { id: 'beam', name: 'Ion Beam', cost: WEAPON_PRICES.beam, desc: 'A slender, exceptionally fast laser bolt.' },
  { id: 'wave', name: 'Void Wave', cost: WEAPON_PRICES.wave, desc: 'A curved energy shot with heavy damage.' },
  { id: 'shock', name: 'Tesla Arc', cost: WEAPON_PRICES.shock, desc: 'A sharp electric bolt with the highest damage.' },
];

export function upgradeOffer(id, upgrades = {}, ship = 'default', pilotLevel = 1) {
  const item = UPGRADES.find(item => item.id === id) || UPGRADES[0];
  const level = upgrades[item.id] || (item.id === 'shield_gen' ? 0 : 1);
  // Match the existing purchase handler, including its first generator purchase.
  const purchaseLevel = upgrades[item.id] || 1;
  const maxed = item.id === 'multiplier' && level >= MULTIPLIER_MAX_LEVEL;
  const nextLevel = maxed ? level : purchaseLevel + 1;
  const cost = Math.floor(item.cost * 1.5 ** (purchaseLevel - 1));
  const pilot = Math.max(1, pilotLevel);
  const stat = lv => {
    switch (item.id) {
      case 'battery': return 100 + (lv - 1) * 20 + (pilot - 1) * 2;
      case 'thruster': return Math.abs(new Player(lv).lift);
      case 'magnet': return 50 + lv * 20;
      case 'hull': return maxHullHealth(lv, ship, pilot);
      case 'multiplier': return coinMultiplier(lv);
      case 'shield_gen': return hullRecoveryRate(lv);
    }
  };
  const before = stat(level), after = stat(nextLevel);
  const format = value => item.id === 'battery' ? `${(value / 10).toFixed(1)}s` : item.id === 'shield_gen' ? `${value.toFixed(1)} HP/s` : item.id === 'magnet' ? `${value}px` : item.id === 'multiplier' ? `${value}×` : item.id === 'hull' ? `${value} HP` : String(value);
  const labels = { battery: 'Full-tank boost', thruster: 'Rise power', magnet: 'Attraction range', hull: 'Hull strength', multiplier: 'Coin value', shield_gen: 'Hull recovery' };
  return { ...item, level, nextLevel, maxed, cost, before, after, beforeLabel: format(before), afterLabel: format(after), metric: labels[item.id], startingSpeed: item.id === 'thruster' ? [300 + level * 20 + (pilot - 1) * 3, 300 + nextLevel * 20 + (pilot - 1) * 3] : null };
}

export function weaponDetails(id) {
  const item = WEAPONS.find(item => item.id === id) || WEAPONS[0];
  const projectile = new PlayerProjectile(0, 0, item.id);
  return { ...item, damage: projectile.damage, speed: projectile.speed, ammo: 1 };
}
