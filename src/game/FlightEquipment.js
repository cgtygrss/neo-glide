// Shared by flight, item descriptions and upgrade previews. Optional modules
// start at zero so older saves retain their original flight characteristics.
export const SHIP_TRAITS = {
  default: {}, interceptor: { ammoInterval: 1.5 }, cruiser: { health: 40 },
  stealth: { encounterDelay: 1.5 }, void_runner: { phaseHeight: 80 }, plasma_breaker: { smash: true },
  kestrel: { energy: 30 }, manta: { magnet: 40 }, bulwark: { health: 70, ammo: -2 },
  firefly: { energyRecovery: 2 }, lancer: { shotSpeed: 1.25 }, nomad: { powerDuration: 1.3 },
  mender: { recovery: 2 }, corsair: { ammo: 5 }, wisp: { hitProtection: .5 },
  sentinel: { damageReduction: 5 },
};
export const getShipTraits = id => SHIP_TRAITS[id] || SHIP_TRAITS.default;
export const MODULE_IDS = ['ammo_capacity', 'ammo_regen', 'boost_efficiency', 'energy_recovery', 'medical', 'armor', 'hit_guard', 'power_duration', 'tractor_speed', 'repair_amplifier'];
export const moduleLevel = (upgrades, id) => Math.max(0, Number(upgrades[id]) || 0);

export function flightEquipment(upgrades = {}, ship = 'default', pilotLevel = 1) {
  const trait = getShipTraits(ship), lv = id => moduleLevel(upgrades, id);
  return {
    maxEnergy: 100 + ((upgrades.battery || 1) - 1) * 20 + (pilotLevel - 1) * 2 + (trait.energy || 0),
    maxAmmo: 10 + lv('ammo_capacity') * 2 + (trait.ammo || 0),
    ammoRegenTime: (trait.ammoInterval || 2) / (1 + lv('ammo_regen') * .12),
    energyDrain: 10 / (1 + lv('boost_efficiency') * .1),
    energyRecovery: lv('energy_recovery') * .5 + (trait.energyRecovery || 0),
    healthPickupAmount: 25 + lv('medical') * 5,
    projectileDamage: Math.max(5, 20 / (1 + lv('armor') * .1) - (trait.damageReduction || 0)),
    hitProtectionSeconds: .9 + lv('hit_guard') * .1 + (trait.hitProtection || 0),
    powerDuration: (1 + lv('power_duration') * .1) * (trait.powerDuration || 1),
    magnetRange: 50 + (upgrades.magnet || 1) * 20 + (trait.magnet || 0),
    tractorRate: 1 + lv('tractor_speed') * .15,
    regenRate: (upgrades.shield_gen || 0) * (1 + lv('repair_amplifier') * .15) + (trait.recovery || 0),
    shotSpeed: trait.shotSpeed || 1,
  };
}

export function advanceEquipmentEnergy(game, deltaTime) {
  if (game.phase !== 'FLYING' || game.gameOver || game.transformation) return;
  const dt = Math.max(0, deltaTime);
  if (game.player.isBoosting) {
    game.energy = Math.max(0, game.energy - dt * (game.energyDrain ?? 10));
    if (game.energy === 0) game.player.boost(false);
  } else {
    game.energy = Math.min(game.maxEnergy, game.energy + dt * (game.energyRecovery || 0));
  }
}
