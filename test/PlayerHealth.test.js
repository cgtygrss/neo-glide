import test from 'node:test';
import assert from 'node:assert/strict';
import { Player, HealthPickup } from '../src/game/Entities.js';
import { maxHullHealth, hullRecoveryRate, advanceHitProtection, takeProjectileHit, collectHealth, advanceHealthPickupSpawn, obstacleImpact, touchesFlightBoundary, HIT_PROTECTION_SECONDS } from '../src/game/PlayerHealth.js';
import { pauseFlight, resumeFlight } from '../src/game/FlightStart.js';

const run = () => ({ phase: 'FLYING', health: 100, maxHealth: 100, player: new Player(), activePowerUps: [], healthPickups: [], hitProtection: 0, healthPickupTimer: 0 });

test('100 starting HP preserves purchased hull, Cruiser and pilot capacity bonuses', () => {
  assert.equal(maxHullHealth(), 100);
  assert.equal(maxHullHealth(2), 120);
  assert.equal(maxHullHealth(3, 'cruiser', 11), 220);
  assert.equal(hullRecoveryRate(), 0);
  assert.equal(hullRecoveryRate(2), 2);
});

test('stacked enemy shots cost only 20 HP; five separated hits exhaust starting health', () => {
  const game = run();
  const shot = {};
  assert.equal(takeProjectileHit(game, shot), true);
  assert.equal(game.health, 80);
  assert.equal(takeProjectileHit(game, shot), false);
  for (let i = 0; i < 8; i++) {
    const overlapping = {};
    assert.equal(takeProjectileHit(game, overlapping), false);
    assert.equal(overlapping.markedForDeletion, true);
  }
  assert.equal(game.health, 80);
  advanceHitProtection(game, .5);
  assert.equal(takeProjectileHit(game, {}), false);
  advanceHitProtection(game, .41);
  assert.equal(takeProjectileHit(game, {}), true);
  for (let i = 0; i < 3; i++) { advanceHitProtection(game, 1); takeProjectileHit(game, {}); }
  assert.equal(game.health, 0);
  assert.equal(takeProjectileHit(game, {}), false);
  assert.equal(collectHealth(game, new HealthPickup(100, 100)), 0);
});

test('hit protection and medical spawn clocks freeze through pause, ready and revival countdown', () => {
  const game = run();
  game.hitProtection = HIT_PROTECTION_SECONDS;
  game.healthPickupTimer = 5;
  pauseFlight(game);
  for (const phase of ['PAUSED', 'READY', 'COUNTDOWN', 'LAUNCH']) {
    game.phase = phase;
    advanceHitProtection(game, 50);
    assert.equal(advanceHealthPickupSpawn(game, 50), false);
    assert.equal(game.hitProtection, HIT_PROTECTION_SECONDS);
    assert.equal(game.healthPickupTimer, 5);
  }
  game.phase = 'PAUSED'; game.pausedPhase = 'FLYING'; resumeFlight(game);
  assert.equal(game.phase, 'READY');
  assert.equal(game.hitProtection, HIT_PROTECTION_SECONDS);
  game.phase = 'FLYING'; advanceHitProtection(game, .5);
  assert.ok(game.hitProtection > .39 && game.hitProtection < .41);
});

test('Shield absorbs enemy shots, Ghost phases through them, and ended runs cannot change HP', () => {
  const game = run();
  game.activePowerUps = [{type: 'SHIELD'}];
  const shielded = {};
  assert.equal(takeProjectileHit(game, shielded), false);
  assert.equal(shielded.markedForDeletion, true);
  game.activePowerUps = []; game.ghostMode = true;
  const phased = {};
  assert.equal(takeProjectileHit(game, phased), false);
  assert.equal(phased.markedForDeletion, undefined);
  game.ghostMode = false; game.gameOver = true;
  assert.equal(takeProjectileHit(game, {}), false);
  game.health = 20;
  assert.equal(collectHealth(game, new HealthPickup(100, 100)), 0);
  assert.equal(advanceHealthPickupSpawn(game, 20), false);
});

test('medical packs restore 25 HP once, cap at upgraded maximum and stay available at full health', () => {
  for (const maxHealth of [100, 140, 220]) {
    const game = { ...run(), maxHealth, health: maxHealth - 40 };
    const pack = new HealthPickup(100, 100);
    assert.equal(collectHealth(game, pack), 25);
    assert.equal(game.health, maxHealth - 15);
    assert.equal(collectHealth(game, pack), 0);
    assert.equal(collectHealth(game, new HealthPickup(100, 100)), 15);
    assert.equal(game.health, maxHealth);
    const fullPack = new HealthPickup(100, 100);
    assert.equal(collectHealth(game, fullPack), 0);
    assert.equal(fullPack.markedForDeletion, false);
    game.health -= 3;
    assert.equal(collectHealth(game, fullPack), 3);
    assert.equal(game.health, maxHealth);
  }
});

test('medical spawns stay 12 seconds apart with at most one pack on screen', () => {
  const game = run();
  assert.equal(advanceHealthPickupSpawn(game, 11.9), false);
  assert.equal(advanceHealthPickupSpawn(game, .11), true);
  const pickup = new HealthPickup(600, 180); game.healthPickups.push(pickup);
  assert.equal(advanceHealthPickupSpawn(game, 20), false);
  pickup.update(3, 300);
  assert.equal(pickup.markedForDeletion, true);
  assert.equal(pickup.y, 180);
  assert.equal(advanceHealthPickupSpawn(game, .01), true);
  assert.equal(advanceHealthPickupSpawn(game, 1), false);
});

test('wall impacts stay fatal at full health and during protection; ship exceptions remain', () => {
  const game = run(); game.hitProtection = HIT_PROTECTION_SECONDS;
  assert.equal(obstacleImpact(game, {height: 60}), 'fatal');
  game.activePowerUps = [{type: 'SHIELD'}];
  assert.equal(obstacleImpact(game, {height: 60}), 'fatal');
  game.shipType = 'void_runner';
  assert.equal(obstacleImpact(game, {height: 60}), 'phase');
  assert.equal(obstacleImpact(game, {height: 80}), 'fatal');
  game.shipType = 'plasma_breaker';
  assert.equal(obstacleImpact(game, {height: 100}), 'smash');
  game.ghostMode = true;
  assert.equal(obstacleImpact(game, {height: 100}), 'phase');
  for (const y of [390, 400]) { game.player.y = y; assert.equal(touchesFlightBoundary(game.player, 400), true); }
  for (const y of [-100, 0, 10, 200]) { game.player.y = y; assert.equal(touchesFlightBoundary(game.player, 400), false); }
});
