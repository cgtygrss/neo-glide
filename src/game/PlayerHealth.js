import { absorbTransformationHit, transformationProtected } from './Transformations.js';

export const BASE_HEALTH = 100;
export const ENEMY_HIT_DAMAGE = 20;
export const HEALTH_PICKUP_AMOUNT = 25;
export const HEALTH_PICKUP_INTERVAL = 12;
export const HIT_PROTECTION_SECONDS = .9;

export function maxHullHealth(hullLevel = 1, ship = 'default', pilotLevel = 1) {
  return BASE_HEALTH + Math.max(0, hullLevel - 1) * 20 + (ship === 'cruiser' ? 40 : 0)
    + Math.floor((Math.max(1, pilotLevel) - 1) / 5) * 20;
}

export const hullRecoveryRate = (generatorLevel = 0) => generatorLevel;

export function advanceHitProtection(game, deltaTime) {
  if (game.phase !== 'FLYING' || game.gameOver) return;
  game.hitProtection = Math.max(0, (game.hitProtection || 0) - deltaTime);
}

// Called only for overlapping enemy shots. Absorbed shots cannot linger and hit later.
export function takeProjectileHit(game, projectile) {
  if (game.gameOver || game.health <= 0 || projectile.markedForDeletion || (game.ghostMode && !transformationProtected(game))) return false;
  projectile.markedForDeletion = true;
  if (game.hitProtection > 0 || game.activePowerUps.some(power => power.type === 'SHIELD')) return false;
  if (absorbTransformationHit(game)) return false;
  game.health = Math.max(0, game.health - ENEMY_HIT_DAMAGE);
  game.hitProtection = HIT_PROTECTION_SECONDS;
  return true;
}

export function collectHealth(game, pickup) {
  if (game.gameOver || game.health <= 0 || pickup.markedForDeletion || game.health >= game.maxHealth) return 0;
  const restored = Math.min(HEALTH_PICKUP_AMOUNT, game.maxHealth - game.health);
  game.health += restored;
  pickup.markedForDeletion = true;
  return restored;
}

export function advanceHealthPickupSpawn(game, deltaTime) {
  if (game.phase !== 'FLYING' || game.gameOver) return false;
  game.healthPickupTimer = Math.min(HEALTH_PICKUP_INTERVAL, (game.healthPickupTimer || 0) + deltaTime);
  if (game.healthPickupTimer < HEALTH_PICKUP_INTERVAL || game.healthPickups.some(pickup => !pickup.markedForDeletion)) return false;
  game.healthPickupTimer = 0;
  return true;
}

export function obstacleImpact(game, obstacle) {
  if (game.ghostMode || (game.shipType === 'void_runner' && obstacle.height < 80)) return 'phase';
  return game.shipType === 'plasma_breaker' ? 'smash' : 'fatal';
}

export function touchesFlightBoundary(player, height) {
  return player.y + player.height / 2 >= height;
}
