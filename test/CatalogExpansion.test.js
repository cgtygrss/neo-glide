import test from 'node:test';
import assert from 'node:assert/strict';
import { SHIPS } from '../src/game/ShipCatalog.js';
import { UPGRADES, WEAPONS, upgradeOffer, weaponDetails } from '../src/game/ShopCatalog.js';
import { roundUpgradeCreditCost } from '../backend/shared/store-catalog.js';
import { COSMETICS, COSMETIC_PRODUCT_IDS } from '../src/game/CosmeticsCatalog.js';
import { STAGES } from '../src/game/StageCatalog.js';
import { MODULE_IDS, flightEquipment, advanceEquipmentEnergy } from '../src/game/FlightEquipment.js';
import { Player, PlayerProjectile } from '../src/game/Entities.js';
import { collectHealth, maxHullHealth, takeProjectileHit } from '../src/game/PlayerHealth.js';
import { Renderer } from '../src/game/Renderer.js';
import { PRODUCTS } from '../src/services/MonetizationService.js';
import { grantStoreTransaction, saveWallet, loadWallet, unlockCreditCosmetic, getCosmeticOwnership } from '../src/game/Economy.js';
import { cosmeticCreditOffer } from '../src/game/GarageOffers.js';

test('expanded garage has unique, priced and usable choices in every category', () => {
  assert.deepEqual([SHIPS.length, WEAPONS.length, UPGRADES.length, COSMETICS.length, STAGES.length], [16, 16, 16, 26, 24]);
  for (const catalog of [SHIPS, WEAPONS, UPGRADES, COSMETICS, STAGES]) {
    assert.equal(new Set(catalog.map(item => item.id)).size, catalog.length);
    assert.equal(new Set(catalog.map(item => item.name)).size, catalog.length);
    for (const item of catalog) assert.ok(Number.isSafeInteger(item.cost ?? item.creditPrice ?? item.price));
  }
  assert.equal(new Set(SHIPS.map(ship => ship.parts[0].d)).size, SHIPS.length, 'every hull has its own silhouette');
});

test('optional modules start at zero on legacy saves and preview the first paid level', () => {
  const saved = Object.freeze({ battery: 3, shield_gen: 2 });
  const base = flightEquipment(saved);
  assert.equal(base.maxEnergy, 140);
  assert.equal(base.energyDrain, 10);
  assert.equal(base.maxAmmo, 10);
  assert.equal(base.ammoRegenTime, 2);
  assert.equal(base.regenRate, 2);
  for (const id of MODULE_IDS) {
    const offer = upgradeOffer(id, saved);
    assert.equal(offer.level, 0, id);
    assert.equal(offer.nextLevel, 1, id);
    assert.ok(Number.isFinite(offer.before) && Number.isFinite(offer.after), id);
    assert.notEqual(offer.before, offer.after, id);
    assert.equal(upgradeOffer(id, { ...saved, [id]: 1 }).cost, roundUpgradeCreditCost(Math.floor(offer.cost * 1.5)), id);
  }
  assert.equal(flightEquipment({ ...saved, repair_amplifier: 1 }).regenRate, 2.3);
  assert.equal(flightEquipment({ repair_amplifier: 1 }).regenRate, 0, 'amplifier needs a generator');
});

test('extended hull bonuses are reflected in flight resources and previews', () => {
  assert.equal(flightEquipment({}, 'kestrel').maxEnergy, 130);
  assert.equal(upgradeOffer('battery', {}, 'kestrel').beforeLabel, '13.0s');
  assert.equal(upgradeOffer('magnet', {}, 'manta').before, 110);
  assert.equal(maxHullHealth(1, 'bulwark'), 170);
  assert.equal(flightEquipment({}, 'bulwark').maxAmmo, 8);
  assert.equal(flightEquipment({}, 'corsair').maxAmmo, 15);
  assert.equal(flightEquipment({}, 'nomad').powerDuration, 1.3);
  assert.equal(upgradeOffer('shield_gen', {}, 'mender').before, 2);
  assert.equal(flightEquipment({}, 'wisp').hitProtectionSeconds, 1.4);
  assert.equal(weaponDetails('rail', 'lancer').speed, 3000);
});

test('energy modules work across frame rates, freeze on pause and stop at tank limits', () => {
  function run(fps, boosting) {
    const game = { ...flightEquipment({ boost_efficiency: 2, energy_recovery: 3 }, 'firefly'),
      player: new Player(), phase: 'FLYING', energy: 50 };
    game.player.boost(boosting);
    for (let i=0;i<fps*2;i++) advanceEquipmentEnergy(game, 1/fps);
    return game;
  }
  for (const boosting of [true, false]) assert.ok(Math.abs(run(30, boosting).energy - run(120, boosting).energy) < 1e-8);
  assert.ok(run(60, true).energy > 30, 'efficiency extends the tank');
  assert.ok(run(60, false).energy > 50, 'coasting replenishes energy');
  const game = run(60, false), before = game.energy;
  game.phase = 'PAUSED'; advanceEquipmentEnergy(game, 10); assert.equal(game.energy, before);
  game.phase = 'FLYING'; advanceEquipmentEnergy(game, 1000); assert.equal(game.energy, game.maxEnergy);
  game.player.boost(true); advanceEquipmentEnergy(game, 1000); assert.equal(game.energy, 0); assert.equal(game.player.isBoosting, false);
  game.transformation = {}; advanceEquipmentEnergy(game, 1); assert.equal(game.energy, 0);
});

test('armor, medical and barrier modules alter actual hits and pickups', () => {
  const game = { ...flightEquipment({ armor: 3, medical: 2, hit_guard: 2 }, 'sentinel'),
    maxHealth: 100, health: 80, activePowerUps: [], hitProtection: 0 };
  assert.equal(takeProjectileHit(game, { markedForDeletion: false }), true);
  assert.ok(game.health > 60, 'armor and Sentinel both reduce shot damage');
  assert.equal(game.hitProtection, 1.1);
  assert.equal(takeProjectileHit(game, { markedForDeletion: false }), false, 'barrier absorbs the next shot');
  game.health = 50;
  assert.equal(collectHealth(game, { markedForDeletion: false }), 35);
  assert.equal(game.health, 85);
  assert.equal(collectHealth(game, { markedForDeletion: false }), 15, 'medical pack cannot exceed maximum health');
  assert.ok(flightEquipment({ armor: 1000 }, 'sentinel').projectileDamage >= 5);
});

test('new weapons have real, distinct projectile artwork and matching impact statistics', () => {
  globalThis.window = { innerWidth: 2000 };
  const signatures = [];
  for (const item of WEAPONS.slice(6)) {
    const projectile = new PlayerProjectile(100, 100, item.id), details = weaponDetails(item.id);
    assert.equal(projectile.damage, details.damage);
    assert.equal(projectile.radius, details.radius);
    projectile.update(.1);
    assert.equal(projectile.x, 100 + details.speed * .1);
    const operations = [];
    const ctx = new Proxy({}, { get: (_, key) => (...args) => operations.push([key, ...args]), set: () => true });
    const renderer = Object.create(Renderer.prototype); renderer.ctx = ctx;
    renderer.drawPlayerProjectiles([projectile]);
    signatures.push(JSON.stringify(operations));
  }
  assert.equal(new Set(signatures).size, 10);
});

test('every skin supports permanent credit and native store unlocks', () => {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
  assert.equal(COSMETICS.length, 26);
  for (const [index, cosmetic] of COSMETICS.entries()) {
    assert.ok(COSMETIC_PRODUCT_IDS.includes(cosmetic.productId));
    assert.ok(PRODUCTS.some(item => item.id === cosmetic.productId));
    saveWallet(cosmeticCreditOffer(cosmetic).price + 123);
    assert.equal(unlockCreditCosmetic(cosmetic.id).unlocked, true);
    assert.equal(loadWallet(), 123);
    assert.equal(getCosmeticOwnership()[cosmetic.id], true);
    assert.equal(unlockCreditCosmetic(cosmetic.id).unlocked, false);
    assert.equal(loadWallet(), 123);
    const receipt = { transactionId: String(9000 + index), productId: cosmetic.productId, verified: true };
    assert.equal(grantStoreTransaction(receipt).applied, true);
    assert.equal(loadWallet(), 123);
    assert.equal(grantStoreTransaction(receipt).applied, false);
    assert.equal(loadWallet(), 123);
  }
});
