import { flightEquipment, MODULE_IDS } from './FlightEquipment.js';
import { UPGRADE_PRICES, WEAPON_PRICES, coinMultiplier, MULTIPLIER_MAX_LEVEL } from './Economy.js';
import { Player, PlayerProjectile } from './Entities.js';
import { maxHullHealth } from './PlayerHealth.js';
import { roundUpgradeCreditCost } from '../../backend/shared/store-catalog.js';

export const UPGRADES = [
  { id: 'battery', name: 'Battery Capacity', cost: UPGRADE_PRICES.battery, desc: 'A bigger tank for longer boosts.' },
  { id: 'thruster', name: 'Thruster Power', cost: UPGRADE_PRICES.thruster, desc: 'Stronger lift for more responsive climbs.' },
  { id: 'magnet', name: 'Magnet Range', cost: UPGRADE_PRICES.magnet, desc: 'Pull nearby coins from further away.' },
  { id: 'hull', name: 'Hull Strength', cost: UPGRADE_PRICES.hull, desc: '+20 maximum health. Walls still end the flight.' },
  { id: 'multiplier', name: 'Data Multiplier', cost: UPGRADE_PRICES.multiplier, desc: 'Add 0.25× coin value per upgrade, up to 2×.' },
  { id: 'shield_gen', name: 'Shield Generator', cost: UPGRADE_PRICES.shield_gen, desc: 'Recover damaged hull while you fly.' },
  { id: 'ammo_capacity', name: 'Ammo Bay', cost: UPGRADE_PRICES.ammo_capacity, desc: 'Carry two more rounds per level.', startingLevel: 0, metric: 'Maximum ammo', stat: 'maxAmmo' },
  { id: 'ammo_regen', name: 'Ammo Fabricator', cost: UPGRADE_PRICES.ammo_regen, desc: 'Refill ammunition faster between volleys.', startingLevel: 0, metric: 'Ammo refill', stat: 'ammoRegenTime' },
  { id: 'boost_efficiency', name: 'Efficient Burn', cost: UPGRADE_PRICES.boost_efficiency, desc: 'Use less energy for every second of boost.', startingLevel: 0, metric: 'Boost drain', stat: 'energyDrain' },
  { id: 'energy_recovery', name: 'Coasting Dynamo', cost: UPGRADE_PRICES.energy_recovery, desc: 'Recover energy while gliding without boost.', startingLevel: 0, metric: 'Coasting recovery', stat: 'energyRecovery' },
  { id: 'medical', name: 'Medical Scanner', cost: UPGRADE_PRICES.medical, desc: 'Restore five extra health from each medical pack per level.', startingLevel: 0, metric: 'Medical pack', stat: 'healthPickupAmount' },
  { id: 'armor', name: 'Reactive Plating', cost: UPGRADE_PRICES.armor, desc: 'Reduce incoming enemy shot damage. Walls remain fatal.', startingLevel: 0, metric: 'Damage per hit', stat: 'projectileDamage' },
  { id: 'hit_guard', name: 'Emergency Barrier', cost: UPGRADE_PRICES.hit_guard, desc: 'Extend the protection window after an enemy shot.', startingLevel: 0, metric: 'Hit protection', stat: 'hitProtectionSeconds' },
  { id: 'power_duration', name: 'Power Capacitor', cost: UPGRADE_PRICES.power_duration, desc: 'Keep collected power-ups active for longer.', startingLevel: 0, metric: 'Power-up duration', stat: 'powerDuration' },
  { id: 'tractor_speed', name: 'Tractor Accelerator', cost: UPGRADE_PRICES.tractor_speed, desc: 'Pull attracted coins toward your ship faster.', startingLevel: 0, metric: 'Coin pull speed', stat: 'tractorRate' },
  { id: 'repair_amplifier', name: 'Repair Amplifier', cost: UPGRADE_PRICES.repair_amplifier, desc: 'Increase Shield Generator recovery by 15% per level. Requires a generator.', startingLevel: 0, metric: 'Generator output', stat: 'repairMultiplier' },
];
export const WEAPONS = [
  { id: 'default', name: 'Pulse Laser', cost: WEAPON_PRICES.default, desc: 'A compact, straight-flying pulse.' },
  { id: 'blaster', name: 'Solar Blaster', cost: WEAPON_PRICES.blaster, desc: 'Fast, pointed plasma shots.' },
  { id: 'cannon', name: 'Magma Cannon', cost: WEAPON_PRICES.cannon, desc: 'A heavy sphere with a bright directional core.' },
  { id: 'beam', name: 'Ion Beam', cost: WEAPON_PRICES.beam, desc: 'A slender, exceptionally fast laser bolt.' },
  { id: 'wave', name: 'Void Wave', cost: WEAPON_PRICES.wave, desc: 'A curved energy shot with heavy damage.' },
  { id: 'shock', name: 'Tesla Arc', cost: WEAPON_PRICES.shock, desc: 'A sharp electric bolt with a powerful impact.' },
  { id: 'needle', name: 'Needle Driver', cost: WEAPON_PRICES.needle, desc: 'A narrow, fast dart for precise aiming.' },
  { id: 'frost', name: 'Frost Shard', cost: WEAPON_PRICES.frost, desc: 'A broad ice crystal with a balanced impact.' },
  { id: 'ember', name: 'Ember Lance', cost: WEAPON_PRICES.ember, desc: 'A slow, wide ember with a heavy impact.' },
  { id: 'rail', name: 'Rail Driver', cost: WEAPON_PRICES.rail, desc: 'An extremely fast, narrow rail slug.' },
  { id: 'photon', name: 'Photon Star', cost: WEAPON_PRICES.photon, desc: 'A bright star shot with quick travel.' },
  { id: 'vortex', name: 'Vortex Orb', cost: WEAPON_PRICES.vortex, desc: 'A wide spiral orb built for heavy hits.' },
  { id: 'sonic', name: 'Sonic Rings', cost: WEAPON_PRICES.sonic, desc: 'A broad ring pulse with brisk travel.' },
  { id: 'shard', name: 'Prism Shard', cost: WEAPON_PRICES.shard, desc: 'A sharp crystal shot with high speed and damage.' },
  { id: 'nova', name: 'Nova Burst', cost: WEAPON_PRICES.nova, desc: 'A huge star core that trades speed for impact.' },
  { id: 'antimatter', name: 'Antimatter Core', cost: WEAPON_PRICES.antimatter, desc: 'A twin-orbit core with the strongest single impact.' },
];

export function upgradeOffer(id, upgrades = {}, ship = 'default', pilotLevel = 1) {
  const item = UPGRADES.find(item => item.id === id) || UPGRADES[0];
  const level = item.startingLevel === 0 ? (upgrades[item.id] || 0) : (upgrades[item.id] || (item.id === 'shield_gen' ? 0 : 1));
  // Match the existing purchase handler, including its first generator purchase.
  const purchaseLevel = item.startingLevel === 0 ? level : (upgrades[item.id] || 1);
  const maxed = item.id === 'multiplier' && level >= MULTIPLIER_MAX_LEVEL;
  const nextLevel = maxed ? level : purchaseLevel + 1;
  const cost = roundUpgradeCreditCost(Math.floor(item.cost * 1.5 ** Math.max(0, purchaseLevel - (item.startingLevel === 0 ? 0 : 1))));
  const pilot = Math.max(1, pilotLevel);
  const stat = lv => {
    if (MODULE_IDS.includes(item.id)) {
      if (item.stat === 'repairMultiplier') return 1 + lv * .15;
      return flightEquipment({ ...upgrades, [item.id]: lv }, ship, pilot)[item.stat];
    }
    switch (item.id) {
      case 'battery': { const equipment = flightEquipment({ ...upgrades, battery: lv }, ship, pilot); return equipment.maxEnergy / equipment.energyDrain * 10; }
      case 'thruster': return Math.abs(new Player(lv).lift);
      case 'magnet': return flightEquipment({ ...upgrades, magnet: lv }, ship, pilot).magnetRange;
      case 'hull': return maxHullHealth(lv, ship, pilot);
      case 'multiplier': return coinMultiplier(lv);
      case 'shield_gen': return flightEquipment({ ...upgrades, shield_gen: lv }, ship, pilot).regenRate;
    }
  };
  const before = stat(level), after = stat(nextLevel);
  const moduleFormat = value => ['ammoRegenTime', 'hitProtectionSeconds'].includes(item.stat) ? `${value.toFixed(2)}s` : ['energyDrain', 'energyRecovery'].includes(item.stat) ? `${value.toFixed(1)} /s` : ['powerDuration', 'tractorRate', 'repairMultiplier'].includes(item.stat) ? `${value.toFixed(2)}×` : item.stat === 'projectileDamage' ? `${value.toFixed(1)} HP` : String(value);
  const format = value => item.startingLevel === 0 ? moduleFormat(value) : item.id === 'battery' ? `${(value / 10).toFixed(1)}s` : item.id === 'shield_gen' ? `${value.toFixed(1)} HP/s` : item.id === 'magnet' ? `${value}px` : item.id === 'multiplier' ? `${value}×` : item.id === 'hull' ? `${value} HP` : String(value);
  const labels = { battery: 'Full-tank boost', thruster: 'Rise power', magnet: 'Attraction range', hull: 'Hull strength', multiplier: 'Coin value', shield_gen: 'Hull recovery' };
  return { ...item, level, nextLevel, maxed, cost, before, after, beforeLabel: format(before), afterLabel: format(after), metric: item.metric || labels[item.id] };
}

export function weaponDetails(id, ship = 'default') {
  const item = WEAPONS.find(item => item.id === id) || WEAPONS[0];
  const projectile = new PlayerProjectile(0, 0, item.id);
  return { ...item, damage: projectile.damage, speed: projectile.speed * flightEquipment({}, ship).shotSpeed, radius: projectile.radius, ammo: 1 };
}
