import { BOSS_REWARD, ENEMY_REWARD } from './Economy.js';
import { hostileShotTouchesRect } from './ScoutAttack.js';
import { PlayerProjectile } from './Entities.js';

export const MAX_HOSTILE_PROJECTILES = 32;
export const MAX_PLAYER_PROJECTILES = 96;

export function advanceAmmoRecharge(game, dt) {
  if (game.phase !== 'FLYING' || game.gameOver) return false;
  const before = game.ammo, interval = Math.max(.01, game.ammoRegenTime || 2);
  game.ammoTimer = (game.ammoTimer || 0) + Math.max(0, dt);
  while (game.ammoTimer + 1e-8 >= interval) {
    game.ammoTimer = Math.max(0, game.ammoTimer - interval);
    game.ammo = Math.min(game.maxAmmo, game.ammo + 1);
  }
  return before !== game.ammo;
}

export function fireNormalWeapon(game) {
  if (game.phase !== 'FLYING' || game.gameOver || game.transformation || (game.ammo <= 0 && !game.rapidFire)) return false;
  if (game.playerProjectiles.filter(shot => !shot.markedForDeletion).length >= MAX_PLAYER_PROJECTILES) return false;
  const shot = new PlayerProjectile(game.player.x + 50, game.player.y + 25, game.weaponType, game.cosmeticId);
  shot.speed *= game.shotSpeed || 1;
  game.playerProjectiles.push(shot);
  if (!game.rapidFire) game.ammo--;
  return true;
}
export const enemyRect = enemy => enemy.isEliteBoss || enemy.isBossDrone
  ? { x: enemy.x - enemy.width / 2, y: enemy.y - enemy.height / 2, w: enemy.width, h: enemy.height }
  : { x: enemy.x, y: enemy.y, w: enemy.width, h: enemy.height };
const center = enemy => { const r = enemyRect(enemy); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; };
const enemies = game => game.enemies || (game.villain ? [game.villain] : []);
const event = (game, value) => { (game.combatEvents ||= []).push(value); };
// Every damage source commits defeat here exactly once. The
// caller consumes events for wallet/audio/UI; rendering never awards anything.
export function damageEnemy(game, enemy, amount) {
  if (game.gameOver || game.phase !== 'FLYING' || enemy.markedForDeletion || enemy.defeatResolved
    || !Number.isFinite(amount) || amount <= 0) return false;
  enemy.takeDamage(amount);
  const defeated = enemy.hp <= 0;
  if (defeated) {
    enemy.defeatResolved = true; enemy.markedForDeletion = true;
    const reward = enemy.isBossDrone ? 0 : enemy.isEliteBoss ? BOSS_REWARD : ENEMY_REWARD;
    game.sessionCurrency = (game.sessionCurrency || 0) + reward;
    if (!enemy.isBossDrone) game.bossesDefeated = (game.bossesDefeated || 0) + 1;
    if (enemy.isEliteBoss) {
      enemy.defeatedAt = game.flightTime || 0;
      game.eliteBossesDefeated = (game.eliteBossesDefeated || 0) + 1;
    }
    event(game, { kind: 'defeat', enemy, reward, ...center(enemy) });
  }
  return defeated;
}

export function resolveFriendlyHits(game) {
  if (game.phase !== 'FLYING' || game.gameOver) return;
  const hulls = enemies(game).filter(enemy => !enemy.markedForDeletion).map(enemy => ({enemy, rect: enemyRect(enemy)}));
  for (const shot of game.playerProjectiles || []) {
    if (shot.markedForDeletion) continue;
    let target = null, nearest = Infinity;
    for (const hull of hulls) if (!hull.enemy.markedForDeletion && hull.rect.x < nearest && hostileShotTouchesRect(shot, hull.rect)) {
      target = hull.enemy; nearest = hull.rect.x;
    }
    if (!target) continue;
    shot.markedForDeletion = true;
    damageEnemy(game, target, shot.damage || 10);
  }
}

export function drainCombatEvents(game) {
  const events = game.combatEvents || [];
  game.combatEvents = [];
  return events;
}
