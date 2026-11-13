import { getShipTraits } from './FlightEquipment.js';
import { Obstacle, Villain, SpeedsterVillain, JuggernautVillain, FuseProjectile, SonicBladeProjectile } from './Entities.js';
import { enemyVerticalBounds, findEnemyEntryY } from './EnemySpacing.js';
import { ScoutBeam, isScout, scoutRay, trackScoutAim, SCOUT_WARNING_SECONDS, SCOUT_LOCK_SECONDS } from './ScoutAttack.js';

export const START_SPEED = 360;
export const CRUISE_SPEED = 520;
export const INITIAL_RAMP_SECONDS = 35;
export const MAX_SPEED = 850;
export const SPEED_RAMP_SECONDS = 180;
export const ENEMY_ATTACK_WARNING_SECONDS = .55;
const initialAcceleration = (CRUISE_SPEED - START_SPEED) / INITIAL_RAMP_SECONDS;
const lateAcceleration = (MAX_SPEED - CRUISE_SPEED) / (SPEED_RAMP_SECONDS - INITIAL_RAMP_SECONDS);

export const flightEnemies = game => game.enemies ?? (game.villain ? [game.villain] : []);

export function flightDifficulty(seconds, height) {
  const pressure = Math.min(1, Math.max(0, (seconds - 20) / 160));
  return { enemyInterval: 12 - 10 * pressure,
    maxEnemies: seconds >= 180 && height >= 650 ? 5 : seconds >= 120 && height >= 390 ? 4
      : seconds >= 60 && height >= 360 ? 3 : seconds >= 20 && height >= 280 ? 2 : 1,
    encounterDuration: 16 + 8 * pressure };
}

export function advanceFlightPace(game, dt) {
  if (game.phase !== 'FLYING' || game.gameOver) return;
  const before = game.flightTime || 0;
  game.flightTime = before + dt;
  const initialTime = Math.min(INITIAL_RAMP_SECONDS, game.flightTime);
  const lateTime = Math.min(SPEED_RAMP_SECONDS - INITIAL_RAMP_SECONDS, Math.max(0, game.flightTime - INITIAL_RAMP_SECONDS));
  game.speed = START_SPEED + initialAcceleration * initialTime + lateAcceleration * lateTime;
  // Integrate the capped curve so distance is consistent at every frame rate.
  const travel = t => {
    const opening = Math.min(t, INITIAL_RAMP_SECONDS);
    const ramp = Math.min(Math.max(0, t - INITIAL_RAMP_SECONDS), SPEED_RAMP_SECONDS - INITIAL_RAMP_SECONDS);
    return START_SPEED * opening + initialAcceleration * opening ** 2 / 2
      + CRUISE_SPEED * ramp + lateAcceleration * ramp ** 2 / 2
      + MAX_SPEED * Math.max(0, t - SPEED_RAMP_SECONDS);
  };
  game.distance += (travel(game.flightTime) - travel(before)) / 10;
}

export function advanceHazardSpawns(game, dt, width, height, random = Math.random) {
  if (game.phase !== 'FLYING' || game.gameOver) return;
  game.obstacleSpawnTimer = (game.obstacleSpawnTimer ?? 4) - dt;
  if (game.obstacleSpawnTimer <= 0) {
    // Keep over half the screen free, even with opposing edge obstacles.
    const maxHeight = Math.min(100, height * .22);
    const h = maxHeight * (.5 + random() * .5);
    game.obstacles.push(new Obstacle(width, random() < .5 ? 0 : height - h, 50 * (game.viewport?.paceScale ?? 1), h));
    game.obstacleSpawnTimer = 2.4 + random() * .8;
  }

  const difficulty = flightDifficulty(game.flightTime || 0, height);
  game.enemies = flightEnemies(game).filter(enemy => !enemy.markedForDeletion);
  game.enemySpawnTimer = (game.enemySpawnTimer ?? 20) - dt;
  if (game.enemies.length >= difficulty.maxEnemies) {
    // A defeated/departed enemy always leaves a short breathing window.
    game.enemySpawnTimer = Math.max(game.flightTime >= 90 ? 1 : 3, game.enemySpawnTimer);
    return;
  }
  if (game.enemySpawnTimer > 0) return;
  const roll = random();
  const Enemy = roll < .4 ? Villain : roll < .7 ? SpeedsterVillain : JuggernautVillain;
  let enemy = new Enemy(width, height / 2);
  let entryY = findEnemyEntryY(enemy, game.enemies, height);
  // Late reinforcements can use a smaller hull if the rolled heavy ship will
  // not fit. Existing enemies keep moving naturally; nobody is repositioned.
  if (entryY === null && game.flightTime >= 90) {
    for (const Fallback of [SpeedsterVillain, Villain]) {
      const candidate = new Fallback(width, height / 2);
      const candidateY = findEnemyEntryY(candidate, game.enemies, height);
      if (candidateY !== null) { enemy = candidate; entryY = candidateY; break; }
    }
  }
  if (entryY === null) {
    game.enemySpawnTimer = .5;
    return;
  }
  enemy.y = entryY;
  enemy.targetY = entryY;
  enemy.encounterDuration = difficulty.encounterDuration;
  const occupied = new Set(game.enemies.map(item => item.encounterLane));
  enemy.encounterLane = Array.from({ length: difficulty.maxEnemies }, (_, lane) => lane)
    .find(lane => !occupied.has(lane)) ?? 0;
  game.enemies.push(enemy);
  game.enemySpawnTimer = difficulty.enemyInterval * (getShipTraits(game.shipType).encounterDelay || 1);
}

export function positionEnemyLanes(game, height) {
  for (const enemy of flightEnemies(game)) {
    const { top, bottom } = enemyVerticalBounds(enemy, height);
    enemy.laneTop = top;
    enemy.laneBottom = bottom;
    // These bounds depend only on the viewport, never the number of enemies.
    // Attacking ships keep tracking naturally; only incoming targets are fitted.
    if (enemy.state === 'ENTERING') enemy.targetY = Math.max(top, Math.min(bottom, enemy.targetY));
  }
}

export function enemyAttackPace(seconds = 0) {
  const pressure = Math.min(1, Math.max(0, (seconds - 20) / 160));
  const endgame = Math.min(1, Math.max(0, (seconds - 180) / 120));
  return { intervalScale: 1 - .75 * pressure - .09 * endgame,
    volleyCooldown: .75 - .5 * pressure,
    maxConcurrent: seconds >= 240 ? 5 : seconds >= 150 ? 4 : seconds >= 90 ? 3 : seconds >= 45 ? 2 : 1,
    maxProjectiles: seconds >= 240 ? 28 : seconds >= 150 ? 24 : seconds >= 90 ? 18 : seconds >= 45 ? 14 : 10,
    reactionSeconds: 1.2 - .55 * pressure - .1 * endgame };
}

const volleySize = enemy => enemy.type === 'SPEEDSTER' ? 3 : 1;

export function canEnemyFire(game, enemy, burstSize = volleySize(enemy), options = {}) {
  const pace = enemyAttackPace(game.flightTime);
  const parallel = options.parallel ?? pace.maxConcurrent > 1;
  const base = enemy.type === 'SPEEDSTER' ? 2.4 : enemy.type === 'JUGGERNAUT' ? 3.5 : 2.6;
  return enemy.attackTimer >= base * pace.intervalScale
    && (parallel || (game.enemyShotCooldown || 0) <= 1e-8)
    && game.projectiles.filter(shot => !shot.markedForDeletion).length + (options.reserved || 0) + burstSize <= pace.maxProjectiles;
}

function cancelCharge(enemy) { enemy.attackWarning = 0; enemy.scoutAim = null; }

export function resetEnemyAttacks(game) {
  for (const enemy of flightEnemies(game)) { cancelCharge(enemy); enemy.attackTimer = 0; }
  game.enemyAttackWarnings = []; game.enemyAttackWarning = null; game.enemyShotCooldown = .75;
}

function advanceAttacks(game, dt, solo = false) {
  if (game.phase !== 'FLYING' || game.gameOver) return [];
  const pace = enemyAttackPace(game.flightTime);
  const capacity = solo ? 1 : pace.maxConcurrent;
  const parallel = capacity > 1;
  game.enemyShotCooldown = Math.max(0, (game.enemyShotCooldown || 0) - dt);
  const enemies = flightEnemies(game).filter(enemy => !enemy.isEliteBoss && !enemy.isBossDrone);
  const warnings = game.enemyAttackWarnings ?? (game.enemyAttackWarning ? [game.enemyAttackWarning] : []);
  const pending = [], fired = [];
  let reserved = 0;
  for (const warning of warnings) {
    const enemy = warning.enemy;
    if (!enemies.includes(enemy) || enemy.markedForDeletion || enemy.state !== 'ATTACKING') {
      cancelCharge(enemy); continue;
    }
    warning.remaining = Math.max(0, warning.remaining - dt);
    const duration = warning.duration ?? ENEMY_ATTACK_WARNING_SECONDS;
    if (isScout(enemy)) {
      const wasLocked = enemy.scoutAim?.locked;
      trackScoutAim(enemy, game.player, duration - warning.remaining);
      if (!wasLocked && enemy.scoutAim.locked) warning.remaining = Math.max(warning.remaining, SCOUT_LOCK_SECONDS);
    }
    enemy.attackWarning = .1 + .9 * (1 - warning.remaining / duration);
    if (warning.remaining > 1e-8 || !canEnemyFire(game, enemy, volleySize(enemy), { parallel, reserved })) {
      pending.push(warning); continue;
    }
    if (isScout(enemy) && !scoutRay(enemy)) {
      cancelCharge(enemy); enemy.attackTimer = 0; continue;
    }
    enemy.attackTimer = 0; enemy.attackWarning = 0;
    fired.push(enemy); reserved += volleySize(enemy);
    game.enemyShotCooldown = pace.volleyCooldown;
    game.lastEnemyAttackLane = enemy.encounterLane ?? 0;
  }
  const attackers = enemies.filter(enemy => !enemy.markedForDeletion && enemy.state === 'ATTACKING')
    .sort((a,b) => (a.encounterLane ?? 0) - (b.encounterLane ?? 0));
  const next = attackers.findIndex(enemy => (enemy.encounterLane ?? 0) > (game.lastEnemyAttackLane ?? -1));
  const ordered = next < 0 ? attackers : [...attackers.slice(next), ...attackers.slice(0,next)];
  for (const enemy of ordered) {
    if (pending.length >= capacity) break;
    if (pending.some(warning => warning.enemy === enemy) || fired.includes(enemy)) continue;
    if (!canEnemyFire(game, enemy, volleySize(enemy), { parallel, reserved })) {
      if (!parallel) break; // The opening retains deliberate alternating turns.
      continue;
    }
    const duration = isScout(enemy) ? SCOUT_WARNING_SECONDS : ENEMY_ATTACK_WARNING_SECONDS;
    if (isScout(enemy)) {
      enemy.scoutAim = null; trackScoutAim(enemy, game.player);
      if (!scoutRay(enemy)) { enemy.scoutAim = null; continue; }
    }
    pending.push({ enemy, remaining: duration, duration });
    enemy.attackWarning = .1;
  }
  game.enemyAttackWarnings = pending;
  game.enemyAttackWarning = pending[0] ?? null;
  return fired;
}

// Production director: independent charges can fire in the same simulation step.
export const advanceEnemyAttacks = (game, dt) => advanceAttacks(game, dt);
// Single-enemy audition and opening behavior share exactly the same charge logic.
export const advanceEnemyVolley = (game, dt) => advanceAttacks(game, dt, true)[0] ?? null;

export function enemyShotSpeed(game, enemy) {
  const pace = enemyAttackPace(game.flightTime);
  const scale = game.viewport?.paceScale ?? 1;
  const ceiling = (500 + 500 * Math.min(1, Math.max(0, (game.flightTime || 0) / 300))) * scale;
  return Math.min(ceiling, Math.max(40 * scale, (enemy.x - game.player.x - 50 * scale) / pace.reactionSeconds));
}

export function createEnemyVolley(game, enemy) {
  const speed = enemyShotSpeed(game, enemy);
  if (enemy.type === 'SPEEDSTER') return [0, -.3, .3]
    .map(slope => new SonicBladeProjectile(enemy.x, enemy.y + 20, -speed, speed * slope));
  if (enemy.type === 'JUGGERNAUT') {
    const bomb = new FuseProjectile(enemy.x, enemy.y); bomb.vx = -speed;
    return [bomb];
  }
  const beam = new ScoutBeam(enemy);
  enemy.scoutAim = null;
  return [beam];
}
