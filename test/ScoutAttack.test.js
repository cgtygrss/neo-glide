import test from 'node:test';
import assert from 'node:assert/strict';
import { Player, Villain, JuggernautVillain, SpeedsterVillain, FuseProjectile, SonicBladeProjectile } from '../src/game/Entities.js';
import { advanceEnemyVolley, createEnemyVolley } from '../src/game/FlightDifficulty.js';
import { ScoutBeam, SCOUT_BEAM_SECONDS, SCOUT_LOCK_SECONDS, hostileShotTouchesRect, trackScoutAim, drawScoutAim, drawScoutBeam } from '../src/game/ScoutAttack.js';
import { takeProjectileHit } from '../src/game/PlayerHealth.js';

const setup = () => {
  const player = new Player(); player.y = 200;
  const enemy = new Villain(670, 180);
  Object.assign(enemy, { state: 'ATTACKING', attackTimer: 10, encounterLane: 0 });
  return { phase: 'FLYING', player, enemies: [enemy], projectiles: [], health: 100, activePowerUps: [] };
};
const rect = (x, y, w = 40, h = 20) => ({ x, y: y - h / 2, w, h });
const beamAt = y => {
  const enemy = new Villain(670, y);
  trackScoutAim(enemy, { x: 100, y }, 1);
  return new ScoutBeam(enemy);
};

test('scout tracks, visibly locks for at least 600ms, then fires at the old position at different frame rates', () => {
  for (const fps of [10, 30, 60, 120]) {
    const game = setup(), enemy = game.enemies[0];
    advanceEnemyVolley(game, 0);
    assert.equal(enemy.scoutAim.locked, false);
    const dt = 1 / fps;
    let elapsed = 0, lockedAt, target, fired;
    for (let frame = 0; frame < fps * 2 && !fired; frame++) {
      game.player.y += 2;
      fired = advanceEnemyVolley(game, dt); elapsed += dt;
      if (enemy.scoutAim.locked && target === undefined) {
        lockedAt = elapsed; target = enemy.scoutAim.targetY;
      }
      if (target !== undefined) assert.equal(enemy.scoutAim.targetY, target);
      else assert.equal(enemy.scoutAim.targetY, game.player.y);
    }
    assert.equal(fired, enemy);
    assert.ok(elapsed - lockedAt >= SCOUT_LOCK_SECONDS - 1e-8);
    const [beam] = createEnemyVolley(game, enemy);
    assert.equal(beam.type, 'SCOUT_BEAM');
    assert.equal(enemy.scoutAim, null);
    assert.equal(hostileShotTouchesRect(beam, rect(100, target)), true);
    assert.equal(hostileShotTouchesRect(beam, rect(100, target - 80)), false);
  }
});

test('fresh locks reacquire the player and killed, departing or removed scouts cannot fire a delayed beam', () => {
  for (const exit of ['killed', 'leaving', 'removed']) {
    const game = setup(), enemy = game.enemies[0];
    advanceEnemyVolley(game, 0); advanceEnemyVolley(game, .4);
    if (exit === 'killed') enemy.markedForDeletion = true;
    if (exit === 'leaving') enemy.state = 'LEAVING';
    if (exit === 'removed') game.enemies = [];
    assert.equal(advanceEnemyVolley(game, 1), null);
    assert.equal(enemy.scoutAim, null);
  }
  const game = setup(), enemy = game.enemies[0];
  advanceEnemyVolley(game, 0); advanceEnemyVolley(game, .4); advanceEnemyVolley(game, .6);
  createEnemyVolley(game, enemy);
  enemy.attackTimer = 10; game.enemyShotCooldown = 0; game.player.y = 90;
  advanceEnemyVolley(game, 0);
  assert.equal(enemy.scoutAim.targetY, 90);
  assert.equal(enemy.scoutAim.locked, false);
});

test('locked aim and all attack clocks freeze through pause and resume', () => {
  const game = setup(); advanceEnemyVolley(game, 0); advanceEnemyVolley(game, .4);
  game.phase = 'PAUSED'; const snapshot = structuredClone(game);
  assert.equal(advanceEnemyVolley(game, 10), null); assert.deepEqual(structuredClone(game), snapshot);
  game.phase = 'FLYING';
  assert.equal(advanceEnemyVolley(game, .5), null);
  assert.equal(advanceEnemyVolley(game, .1), game.enemies[0]);
});

test('scout pulse, tank bomb and speedster spread remain three distinct production attacks', () => {
  const game = setup(), scout = game.enemies[0];
  trackScoutAim(scout, game.player, 1);
  const pulse = createEnemyVolley(game, scout);
  assert.deepEqual(pulse.map(shot => shot.type), ['SCOUT_BEAM']);
  const bombs = createEnemyVolley(game, new JuggernautVillain(670, 180));
  assert.deepEqual(bombs.map(shot => shot.type), ['FUSE']); assert.ok(bombs[0].vx < 0);
  const blades = createEnemyVolley(game, new SpeedsterVillain(670, 180));
  assert.equal(blades.length, 3); assert.ok(blades.every(shot => shot.type === 'SONIC_BLADE'));
  assert.equal(new Set(blades.map(shot => shot.vy)).size, 3);
});

test('diagonal beam collisions use the ray, not the distant muzzle or an entire bounding rectangle', () => {
  const enemy = new Villain(670, 80); trackScoutAim(enemy, { x: 100, y: 240 }, 1);
  const beam = new ScoutBeam(enemy);
  assert.equal(hostileShotTouchesRect(beam, rect(100, 240)), true);
  assert.equal(hostileShotTouchesRect(beam, rect(100, 80)), false);
  assert.equal(hostileShotTouchesRect(beam, rect(100, 290)), false);
  assert.equal(hostileShotTouchesRect(beam, rect(700, 80)), false);
  assert.equal(hostileShotTouchesRect(beamAt(200), rect(100, 225)), false);
  assert.equal(hostileShotTouchesRect(beamAt(200), rect(100, 215)), true);
});

test('a last-frame dodge is safe, while crossing an already active ray cannot tunnel between frames', () => {
  const beam = beamAt(200); beam.update(.1);
  assert.equal(hostileShotTouchesRect(beam, rect(100, 150), rect(100, 200)), false);
  beam.update(.1);
  assert.equal(hostileShotTouchesRect(beam, rect(100, 150), rect(100, 250)), true);
  beam.update(.02); assert.equal(beam.markedForDeletion, true);
  assert.equal(hostileShotTouchesRect(beam, rect(100, 200)), false);
});

test('fast late-game bombs and blades cannot tunnel through a ship during a low-frame-rate step', t => {
  const previous=globalThis.window; globalThis.window={innerHeight:390}; t.after(()=>{globalThis.window=previous;});
  for (const Shot of [FuseProjectile,SonicBladeProjectile]) {
    const shot=new Shot(170,200,-1000,0); shot.vx=-1000;
    shot.update(.1);
    assert.equal(shot.x,70);
    assert.equal(hostileShotTouchesRect(shot,rect(100,200)),true);
    assert.equal(hostileShotTouchesRect(shot,rect(100,250)),false);
    shot.update(.01);
    assert.equal(hostileShotTouchesRect(shot,rect(100,200)),false);
  }
});

test('boosting after lock escapes with ordinary flight physics on small and large screens', () => {
  for (const [width, height] of [[320, 280], [844, 390], [1366, 1024]]) {
    for (const fps of [10, 30, 60, 120]) {
      const game = setup(), enemy = game.enemies[0];
      enemy.x = width * .8; enemy.y = height / 2; game.player.y = height / 2;
      trackScoutAim(enemy, game.player, 1);
      game.player.boost(true);
      // Allow a 200ms reaction delay; 400ms of ordinary boost must clear the ray.
      for (let i = 0; i < fps * .4 - 1e-8; i++) game.player.update(1 / fps);
      assert.equal(hostileShotTouchesRect(new ScoutBeam(enemy), rect(game.player.x, game.player.y)), false);
    }
  }
});

test('beam lifetime is bounded and shield, hit protection and vehicles keep normal damage priority', () => {
  for (const fps of [10, 30, 60, 120]) {
    const beam = beamAt(200); let elapsed = 0;
    while (!beam.markedForDeletion) { beam.update(1 / fps); elapsed += 1 / fps; }
    assert.ok(elapsed >= SCOUT_BEAM_SECONDS - 1e-8 && elapsed < SCOUT_BEAM_SECONDS + 1 / fps + 1e-8);
  }
  for (const defense of ['none', 'shield', 'protection', 'vehicle', 'barrier']) {
    const game = setup(), beam = beamAt(200);
    if (defense === 'shield') game.activePowerUps.push({ type: 'SHIELD' });
    if (defense === 'protection') game.hitProtection = .9;
    if (['vehicle', 'barrier'].includes(defense)) game.transformation = {
      id: defense === 'barrier' ? 'aegis' : 'sphere', phase: 'ACTIVE', shieldRemaining: defense === 'barrier' ? 2 : 0,
    };
    assert.equal(takeProjectileHit(game, beam), defense === 'none');
    assert.equal(game.health, defense === 'none' ? 80 : 100);
    assert.equal(takeProjectileHit(game, beam), false);
    if (defense === 'vehicle') assert.equal(game.transformation.phase, 'EXITING');
    if (defense === 'barrier') assert.equal(game.transformation.phase, 'ACTIVE');
  }
});

test('a resize across the muzzle cancels a locked attack instead of firing a reversed ray', () => {
  const game = setup(), enemy = game.enemies[0];
  advanceEnemyVolley(game, 0); advanceEnemyVolley(game, .4);
  enemy.x = 120;
  assert.equal(advanceEnemyVolley(game, .6), null);
  assert.equal(game.projectiles.length, 0); assert.equal(game.enemyAttackWarning, null);
});

test('targeting and firing art restore drawing state and leave simulation untouched', () => {
  const enemy = setup().enemies[0]; trackScoutAim(enemy, { x: 100, y: 200 }, 1); enemy.attackWarning = .8;
  const beam = new ScoutBeam(enemy), before = JSON.stringify({ enemy, beam });
  const ctx = {
    depth: 0, strokes: [], save() { this.depth++; }, restore() { this.depth--; },
    beginPath() {}, moveTo() {}, lineTo() {}, setLineDash() {}, arc() {}, strokeText() {}, fillText() {},
    stroke() { this.strokes.push([this.strokeStyle, this.lineWidth]); },
  };
  drawScoutAim(ctx, enemy); drawScoutBeam(ctx, beam);
  assert.equal(ctx.depth, 0); assert.equal(JSON.stringify({ enemy, beam }), before);
  assert.ok(ctx.strokes.some(([color, width]) => color === '#ff627d' && width === 12));
});
