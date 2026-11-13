import { Projectile } from './Entities.js';
import { ScoutBeam } from './ScoutAttack.js';
import { MAX_HOSTILE_PROJECTILES } from './Combat.js';
import { BOSS_REWARD } from './Economy.js';

export const BOSS_WARNING_SECONDS = .9;
export const BOSS_ARRIVAL_SECONDS = 3.6;
export const BOSS_APPROACH_SECONDS = 2.4;
export const BOSS_ENCOUNTER_SECONDS = 40;
export const BOSS_RECOVERY_SECONDS = 3;
export const BOSSES = [
  { id: 'forge', name: 'Forge Carrier', hp: 240, color: '#ffc181', width: 156, height: 104 },
  { id: 'prism', name: 'Prism Sentinel', hp: 480, color: '#c7b6ff', width: 128, height: 128 },
];
const EPS = 1e-8;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const createEncounterDirector = () => ({ nextAt: 60, number: 0, boss: null, arrival: null, updatedAt: 0, recoveryUntil: 0, events: [] });
export const encounterRestrictsSpawns = game => Boolean(game.encounter?.boss || game.encounter?.arrival || (game.encounter?.recoveryUntil || 0) > (game.flightTime || 0) + EPS);

// Presentation is derived from the active flight clock, never a render timer.
// It therefore freezes on pause and survives resize/background/continuation.
export function bossArrivalView(game) {
  const arrival = game.encounter?.arrival;
  if (!arrival) return null;
  const elapsed = Math.max(0, (game.flightTime || 0) - arrival.startsAt);
  return { ...arrival, intro: true, reward: BOSS_REWARD,
    remaining: Math.max(0, Math.ceil(arrival.combatAt - (game.flightTime || 0))),
    progress: clamp(elapsed / BOSS_ARRIVAL_SECONDS, 0, 1),
    approach: clamp((elapsed - (BOSS_ARRIVAL_SECONDS - BOSS_APPROACH_SECONDS)) / BOSS_APPROACH_SECONDS, 0, 1) };
}

class EncounterTarget {
  takeDamage(amount) {
    if (this.markedForDeletion || this.hp <= 0) return false;
    this.hp = Math.max(0, this.hp - amount); this.hitFlashTimer = .1;
    if (!this.hp) this.markedForDeletion = true;
    return !this.hp;
  }
  update(dt) { this.hitFlashTimer = Math.max(0, (this.hitFlashTimer || 0) - dt); }
}

export class EncounterBoss extends EncounterTarget {
  constructor(model, number, startedAt, width, height) {
    super();
    Object.assign(this, model, { type: `BOSS_${model.id.toUpperCase()}`, isEliteBoss: true,
      maxHp: model.hp * Math.min(3, 1 + .2 * Math.floor(number / 2)),
      state: 'ATTACKING', markedForDeletion: false, startedAt, nextAttackAt: startedAt + 2,
      warning: null, attackCount: 0, stage: 1, x: width * .8, y: height * .48, attackWarning: 0 });
    this.hp = this.maxHp;
  }
}

class BossDrone extends EncounterTarget {
  constructor(boss, slot) {
    super(); Object.assign(this, { boss, slot, type: 'BOSS_DRONE', isBossDrone: true,
      hp: 20, maxHp: 20, width: 30, height: 24, state: 'ATTACKING', markedForDeletion: false });
  }
}

function clearEncounterThreats(game) {
  game.obstacles = []; game.projectiles = [];
  game.enemies = []; game.enemyAttackWarnings = []; game.enemyAttackWarning = null;
  game.previousObstacleBounds = null; game.previousProjectileBounds = null;
}

function finishEncounter(game, outcome, endedAt) {
  const director = game.encounter, boss = director.boss;
  if (!boss) return;
  director.events.push({ name: 'boss_ended', data: { boss: boss.id, encounter: director.number,
    outcome, duration: Math.max(0, endedAt - boss.startedAt) } });
  director.boss = null; director.number++;
  director.nextAt = endedAt + 75; director.recoveryUntil = endedAt + BOSS_RECOVERY_SECONDS;
  clearEncounterThreats(game);
}

export function abandonBossEncounter(game) {
  if (game.encounter?.boss) finishEncounter(game, 'abandoned', game.flightTime || 0);
  if (game.encounter?.arrival) {
    game.encounter.events.push({ name: 'boss_arrival_cancelled', data: { boss: game.encounter.arrival.id } });
    game.encounter.arrival = null;
  }
}

function makeWarning(game, boss, at) {
  const laser = boss.id === 'prism' && (boss.stage === 1 || boss.attackCount % 2 === 0);
  const height = game.viewport.height;
  const targetY = clamp(game.player.y, height * .13, height * .87);
  const warning = { kind: laser ? 'laser' : boss.id === 'prism' ? 'spiral' : 'fan', at,
    targetX: game.player.x + 20, targetY,
    // All members of this volley share one advertised escape band.
    safeY: targetY < height * .5 ? height * .78 : height * .22,
    safeHalf: Math.max(32, game.player.height || 20), progress: 0 };
  if (boss.id === 'forge') {
    // Reserve a real gap in the three/five-shot fan instead of silently
    // dropping a primary round. Predict the muzzle at the warning deadline.
    const y = height * .48 + Math.sin((at - boss.startedAt) * .8) * Math.min(60, height * .14);
    const x = game.viewport.width * .8 - boss.width / 2;
    const heading = Math.atan2(targetY - y, warning.targetX - x);
    const count = boss.stage === 2 ? 5 : 3;
    const rows = [0, height];
    for (let i = 0; i < count; i++) {
      const angle = heading + (i / (count - 1) * 2 - 1) * .28;
      const crossing = y + Math.tan(angle) * (warning.targetX - x);
      if (crossing > 0 && crossing < height) rows.push(crossing);
    }
    rows.sort((a,b) => a-b);
    let start = 0, gap = 0;
    for (let i = 1; i < rows.length; i++) if (rows[i] - rows[i-1] > gap) {
      start = rows[i-1]; gap = rows[i] - start;
    }
    warning.safeY = start + gap / 2;
    warning.safeHalf = Math.min(32, gap / 2 - 14);
  }
  return warning;
}

function fireWarning(game, boss, warning) {
  const arena = game.viewport;
  const alive = game.projectiles.filter(shot => !shot.markedForDeletion).length;
  const available = MAX_HOSTILE_PROJECTILES - alive;
  if (available <= 0) return false;
  const muzzle = boss.x - boss.width / 2;
  if (warning.kind === 'laser') {
    const beam = new ScoutBeam({ x: boss.x, y: boss.y, width: boss.width,
      scoutAim: { targetX: warning.targetX, targetY: warning.targetY } });
    beam.bossShot = true; game.projectiles.push(beam);
  } else {
    const count = warning.kind === 'spiral' ? 8 : boss.stage === 2 ? 5 : 3;
    const heading = Math.atan2(warning.targetY - boss.y, warning.targetX - muzzle)
      + (warning.kind === 'spiral' ? .22 * Math.sin(boss.attackCount * 1.9) : 0);
    const halfArc = warning.kind === 'spiral' ? .8 : .28;
    const speed = Math.max(160, (muzzle - warning.targetX) / 1.05);
    const sources = [{ x: muzzle, y: boss.y, count }];
    if (boss.id === 'forge' && boss.stage === 2) {
      for (const drone of game.enemies.filter(enemy => enemy.isBossDrone && !enemy.markedForDeletion)) sources.push({ x: drone.x, y: drone.y, count: 1 });
    }
    const shots = [];
    for (const origin of sources) for (let i = 0; i < origin.count; i++) {
      const angle = heading + (origin.count === 1 ? 0 : ((i / (count - 1)) * 2 - 1) * halfArc);
      const vx = Math.cos(angle) * speed, vy = Math.sin(angle) * speed;
      const crossing = origin.y + vy * (warning.targetX - origin.x) / vx;
      if (Math.abs(crossing - warning.safeY) <= warning.safeHalf + 8) continue;
      const shot = new Projectile(origin.x, origin.y, vx, vy);
      shot.type = 'BOSS_ORB'; shot.bossShot = true; shot.radius = 6;
      shots.push(shot);
    }
    game.projectiles.push(...shots.slice(0, available));
  }
  boss.attackWarning = 0;
  game.encounter.events.push({ name: 'boss_attack', data: { boss: boss.id, kind: warning.kind } });
  // Projectile bounds remain those of the viewport, not the physical screen.
  for (const shot of game.projectiles) if (shot.bossShot) shot.arenaHeight = arena.height;
  return true;
}

// Absolute simulation deadlines keep spawn, retreat and warning durations
// identical at 30/60/120 FPS. Paused/READY/ended frames cannot advance anything.
export function advanceBossEncounter(game) {
  if (game.phase !== 'FLYING' || game.gameOver || !game.encounter) return;
  const director = game.encounter, now = game.flightTime || 0;
  const previous = director.updatedAt;
  director.updatedAt = now;
  if (director.boss?.hp <= 0 && director.boss.defeatResolved) finishEncounter(game, 'defeated', director.boss.defeatedAt ?? now);
  if (director.boss && now + EPS >= director.boss.startedAt + BOSS_ENCOUNTER_SECONDS) {
    finishEncounter(game, 'retreated', director.boss.startedAt + BOSS_ENCOUNTER_SECONDS);
  }
  if (!director.boss && !director.arrival && now + EPS >= director.nextAt - BOSS_ARRIVAL_SECONDS) {
    clearEncounterThreats(game);
    const model = BOSSES[director.number % BOSSES.length];
    // A genuinely skipped simulation interval still receives the full intro.
    // Ordinary frame boundary rounding retains the exact 60s combat deadline.
    const late = now - previous > .25 && now > director.nextAt - BOSS_ARRIVAL_SECONDS + .25;
    const startsAt = late ? now : director.nextAt - BOSS_ARRIVAL_SECONDS;
    director.nextAt = startsAt + BOSS_ARRIVAL_SECONDS;
    director.arrival = { ...model, startsAt, combatAt: director.nextAt };
    director.events.push({ name: 'boss_incoming', data: { boss: model.id, encounter: director.number, at: startsAt } });
  }
  if (!director.boss && director.arrival && now + EPS >= director.nextAt) {
    clearEncounterThreats(game);
    const model = BOSSES[director.number % BOSSES.length];
    director.boss = new EncounterBoss(model, director.number, director.nextAt, game.viewport.width, game.viewport.height);
    director.arrival = null;
    game.enemies.push(director.boss);
    director.events.push({ name: 'boss_started', data: { boss: model.id, encounter: director.number,
      hp: director.boss.maxHp, at: director.nextAt } });
  }
  const boss = director.boss;
  if (!boss) return;
  const elapsed = now - boss.startedAt, arena = game.viewport;
  boss.stage = boss.hp < boss.maxHp * .5 ? 2 : 1;
  boss.x = arena.width * .8;
  boss.y = arena.height * .48 + Math.sin(elapsed * .8) * Math.min(60, arena.height * .14);
  if (boss.stage === 2 && boss.id === 'forge') {
    // Defeated escorts stay gone until the next encounter: no reward farming.
    if (!boss.dronesCreated) {
      boss.dronesCreated = true;
      game.enemies.push(new BossDrone(boss, 0), new BossDrone(boss, 1));
    }
    for (const drone of game.enemies.filter(enemy => enemy.isBossDrone && !enemy.markedForDeletion)) {
      drone.x = boss.x - 92 - Math.cos(elapsed * 1.4 + drone.slot * Math.PI) * 20;
      drone.y = clamp(boss.y + (drone.slot ? 1 : -1) * 80, 35, arena.height - 45);
    }
  }
  if (!boss.warning && now + EPS >= boss.nextAttackAt - BOSS_WARNING_SECONDS) {
    // Late frames still receive the complete warning instead of immediate fire.
    boss.warning = makeWarning(game, boss, Math.max(boss.nextAttackAt, now + BOSS_WARNING_SECONDS));
    director.events.push({ name: 'boss_warning', data: { boss: boss.id, kind: boss.warning.kind } });
  }
  if (boss.warning) {
    boss.warning.progress = clamp(1 - (boss.warning.at - now) / BOSS_WARNING_SECONDS, 0, 1);
    boss.attackWarning = .1 + boss.warning.progress * .9;
    if (now + EPS >= boss.warning.at && fireWarning(game, boss, boss.warning)) {
      boss.attackCount++; boss.warning = null;
      boss.nextAttackAt = now + (boss.id === 'prism' ? 2.8 : boss.stage === 2 ? 2 : 2.8);
    }
  }
}

export function drainEncounterEvents(game) {
  const director = game.encounter;
  if (!director) return [];
  const events = director.events; director.events = [];
  return events;
}

export function bossHud(game) {
  const arrival = bossArrivalView(game);
  if (arrival) return arrival;
  const boss = game.encounter?.boss;
  return boss && !boss.markedForDeletion ? { id: boss.id, name: boss.name, color: boss.color, hp: boss.hp,
    maxHp: boss.maxHp, stage: boss.stage, remaining: Math.max(0, Math.ceil(BOSS_ENCOUNTER_SECONDS - (game.flightTime - boss.startedAt))) } : null;
}
