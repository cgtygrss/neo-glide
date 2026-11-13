import test from 'node:test';
import assert from 'node:assert/strict';
import { START_SPEED, CRUISE_SPEED, MAX_SPEED, SPEED_RAMP_SECONDS, advanceFlightPace, advanceHazardSpawns,
  flightDifficulty, positionEnemyLanes, canEnemyFire, enemyShotSpeed, advanceEnemyVolley,
  ENEMY_ATTACK_WARNING_SECONDS, enemyAttackPace, createEnemyVolley, advanceEnemyAttacks, resetEnemyAttacks } from '../src/game/FlightDifficulty.js';
import { VoltBolt } from '../src/game/VoltBolt.js';
import { StrikerMissile } from '../src/game/StrikerMissile.js';
import { Villain, SpeedsterVillain, JuggernautVillain } from '../src/game/Entities.js';
import { ENEMY_HULL_GAP, enemyVerticalBounds } from '../src/game/EnemySpacing.js';
import { SCOUT_WARNING_SECONDS } from '../src/game/ScoutAttack.js';

const run = () => ({ phase: 'FLYING', speed: START_SPEED, distance: 0, player: { x: 100, y: 200 }, obstacles: [], enemies: [], projectiles: [] });

test('pace keeps increasing after the opening and caps after three active minutes at every frame rate', () => {
  const results = [];
  for (const fps of [10, 30, 60, 120]) {
    const game = run();
    for (let i = 0; i < 600 * fps; i++) {
      advanceFlightPace(game, 1 / fps);
      assert.ok(game.speed >= START_SPEED && game.speed <= MAX_SPEED);
      if (i >= SPEED_RAMP_SECONDS * fps) assert.equal(game.speed, MAX_SPEED);
    }
    results.push(game.distance);
  }
  for (const distance of results) assert.ok(Math.abs(distance - 47172.5) < 1e-5);
  const game = run(); advanceFlightPace(game, 17.5); assert.equal(game.speed, 440);
  advanceFlightPace(game, 17.5); assert.equal(game.speed, CRUISE_SPEED);
  const speeds = [game.speed];
  for (const dt of [25, 30, 60, 90]) { advanceFlightPace(game, dt); speeds.push(game.speed); }
  assert.ok(speeds.every((speed, i) => i === 0 || speed > speeds[i - 1]));
  assert.equal(speeds.at(-1), MAX_SPEED);
});

test('pace and spawn clocks freeze before flight, on pause and after death', () => {
  for (const phase of ['LAUNCH', 'READY', 'PAUSED', 'COUNTDOWN', 'ENDED']) {
    const game = run(); game.phase = phase;
    const before = structuredClone(game);
    advanceFlightPace(game, 100); advanceHazardSpawns(game, 100, 844, 390);
    assert.deepEqual(game, before);
  }
  const game = run(); game.gameOver = true;
  advanceFlightPace(game, 100); advanceHazardSpawns(game, 100, 844, 390);
  assert.equal(game.distance, 0); assert.equal(game.enemies.length, 0);
});

test('edge obstacles have a safe opening, an initial grace period and at least 2.4 seconds spacing', () => {
  for (const height of [240, 390, 430, 844]) {
    for (const random of [() => 0, () => .999999]) {
      const game = run(); let last = 0;
      for (let i = 1; i <= 600; i++) {
        const count = game.obstacles.length;
        advanceHazardSpawns(game, .1, 844, height, random);
        if (game.obstacles.length === count) continue;
        const time = i * .1;
        assert.ok(time - last >= (last ? 2.4 - 1e-8 : 4 - 1e-8));
        last = time;
        const wall = game.obstacles.at(-1);
        assert.ok(wall.height <= height * .22);
        assert.ok(height - wall.height * 2 >= height * .56 - 1e-8);
      }
    }
  }
});

test('later flights send more enemies with caps, separated lanes and breathing time after defeat', () => {
  const early = flightDifficulty(19, 600), late = flightDifficulty(200, 600);
  assert.equal(early.maxEnemies, 1); assert.equal(late.maxEnemies, 4);
  assert.ok(late.enemyInterval < early.enemyInterval);
  assert.equal(flightDifficulty(19.99, 390).maxEnemies, 1);
  assert.equal(flightDifficulty(20, 390).maxEnemies, 2);
  assert.equal(flightDifficulty(59.99, 390).maxEnemies, 2);
  assert.equal(flightDifficulty(60, 390).maxEnemies, 3);
  assert.equal(flightDifficulty(10000, 320).maxEnemies, 2);
  assert.equal(flightDifficulty(10000, 240).maxEnemies, 1);
  const game = run();
  advanceHazardSpawns(game, 19.9, 844, 600, () => .1);
  assert.equal(game.enemies.length, 0);
  advanceHazardSpawns(game, .11, 844, 600, () => .1);
  assert.equal(game.enemies.length, 1);
  advanceHazardSpawns(game, 60, 844, 600, () => .1);
  assert.equal(game.enemies.length, 1);
  game.enemies[0].markedForDeletion = true;
  advanceHazardSpawns(game, 2.9, 844, 600, () => .1);
  assert.equal(game.enemies.length, 0);
  advanceHazardSpawns(game, .11, 844, 600, () => .1);
  assert.equal(game.enemies.length, 1);
  game.flightTime = 200;
  advanceHazardSpawns(game, 15, 844, 600, () => .9);
  assert.equal(game.enemies.length, 2);
  advanceHazardSpawns(game, 100, 844, 600, () => .9);
  assert.equal(game.enemies.length, 3);
  advanceHazardSpawns(game, 100, 844, 600, () => .9);
  assert.equal(game.enemies.length, 3);
  positionEnemyLanes(game, 600);
  const [upper, middle] = [...game.enemies].sort((a, b) => a.y - b.y);
  assert.ok(middle.y - upper.y >= (upper.height + middle.height) / 2 + ENEMY_HULL_GAP);
});

test('Stealth preserves a longer delay and volleys cannot stack without room to dodge', () => {
  const game = run(); game.shipType = 'stealth'; game.enemySpawnTimer = 0; game.flightTime = 200;
  advanceHazardSpawns(game, .1, 844, 600, () => .1);
  assert.equal(game.enemySpawnTimer, 3);
  const enemy = { type: 'SPEEDSTER', attackTimer: 3 };
  assert.equal(canEnemyFire(game, enemy, 3), true);
  game.enemyShotCooldown = .75;
  assert.equal(canEnemyFire(game, enemy, 3), true, 'Late crossfire bypasses the shared opening cooldown');
  assert.equal(canEnemyFire(game, enemy, 3, { parallel:false }), false);
  game.enemyShotCooldown = 0; game.projectiles = Array.from({ length: 22 }, () => ({}));
  assert.equal(canEnemyFire(game, enemy, 3), false);
});

test('phone encounters grow to three distinct enemies and preserve hull gaps when one is replaced', () => {
  const game = run(); game.flightTime = 180;
  for (let i = 0; i < 3; i++) advanceHazardSpawns(game, 21, 844, 390, () => .9);
  assert.equal(game.enemies.length, 3);
  const assertLanes = () => {
    positionEnemyLanes(game, 390);
    assert.equal(new Set(game.enemies.map(enemy => enemy.encounterLane)).size, 3);
    const sorted = [...game.enemies].sort((a, b) => a.y - b.y);
    for (let i = 0; i < sorted.length; i++) {
      const enemy = sorted[i];
      assert.ok(enemy.laneBottom >= enemy.laneTop);
      assert.ok(enemy.y + enemy.height / 2 < 390);
      if (i) assert.ok(enemy.y - sorted[i - 1].y >= (enemy.height + sorted[i - 1].height) / 2 + ENEMY_HULL_GAP - 1e-8);
    }
  };
  assertLanes();
  game.enemies[1].markedForDeletion = true;
  advanceHazardSpawns(game, 21, 844, 390, () => .9);
  assertLanes();
});

test('new enemies enter a vacant height without moving or retargeting the first attacker', t => {
  const oldWindow = globalThis.window;
  t.after(() => { globalThis.window = oldWindow; });
  for (const height of [280, 390, 430, 844]) {
    globalThis.window = { innerWidth: 844, innerHeight: height };
    for (const Enemy of [Villain, SpeedsterVillain, JuggernautVillain]) {
      const game = run(); game.flightTime = 200;
      const first = new Enemy(675, height === 280 ? 84 : height / 2);
      Object.assign(first, { state: 'ATTACKING', encounterLane: 0, vy: 40 });
      game.enemies = [first]; game.enemySpawnTimer = 0;
      const before = { y: first.y, vy: first.vy, targetY: first.targetY };
      advanceHazardSpawns(game, .01, 844, height, () => .9);
      positionEnemyLanes(game, height);
      assert.equal(game.enemies.length, 2);
      assert.deepEqual({ y: first.y, vy: first.vy, targetY: first.targetY }, before);
      const added = game.enemies[1];
      assert.equal(added.x, 844);
      assert.equal(added.y, added.targetY);
      assert.ok(Math.abs(added.y - first.y) >= (added.height + first.height) / 2 + ENEMY_HULL_GAP - 1e-8);
      first.update(1 / 60, height / 2, [], game.enemies);
      assert.ok(Math.abs(first.y - before.y) <= first.maxSpeed * 2 / 60 + 1e-8);
      assert.equal(first.state, 'ATTACKING');
    }
  }
});

test('a crowded viewport defers entry until space opens without relocating existing ships', () => {
  const game = run(); game.flightTime = 60; game.enemySpawnTimer = 0;
  const first = new JuggernautVillain(675, 140);
  Object.assign(first, { state: 'ATTACKING', encounterLane: 0, vy: 40 });
  game.enemies = [first];
  advanceHazardSpawns(game, 0, 844, 280, () => .9);
  positionEnemyLanes(game, 280);
  assert.equal(game.enemies.length, 1);
  assert.equal(game.enemySpawnTimer, .5);
  assert.equal(first.y, 140);
  assert.equal(first.vy, 40);
  first.y = 84;
  advanceHazardSpawns(game, .5, 844, 280, () => .9);
  positionEnemyLanes(game, 280);
  assert.equal(game.enemies.length, 2);
  assert.equal(first.y, 84);
  assert.ok(game.enemies[1].y - first.y >= 112);
});

test('neighbor-aware movement stays continuous and separated when enemies spawn, leave or are replaced', t => {
  const oldWindow = globalThis.window;
  t.after(() => { globalThis.window = oldWindow; });
  for (const fps of [10, 30, 60, 120]) {
    const height = 390;
    globalThis.window = { innerWidth: 844, innerHeight: height };
    const game = run(); game.flightTime = 200;
    for (let frame = 0; frame < fps * 8; frame++) {
      if (frame % fps === 0) game.enemySpawnTimer = 0;
      advanceHazardSpawns(game, 1 / fps, 844, height, () => .9);
      positionEnemyLanes(game, height);
      for (const enemy of game.enemies) {
        const y = enemy.y;
        enemy.update(1 / fps, height / 2 + Math.sin(frame / fps * 2) * 150, [], game.enemies);
        assert.ok(Math.abs(enemy.y - y) <= enemy.maxSpeed * 2 / fps + 1e-8);
        const bounds = enemyVerticalBounds(enemy, height);
        assert.ok(enemy.y >= bounds.top && enemy.y <= bounds.bottom);
      }
      const sorted = [...game.enemies].sort((a, b) => a.y - b.y);
      for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i].y - sorted[i - 1].y >= (sorted[i].height + sorted[i - 1].height) / 2 + ENEMY_HULL_GAP - 1e-8);
      if (frame === fps * 4) {
        const survivor = game.enemies[0], before = survivor.y;
        game.enemies[1].markedForDeletion = true;
        game.enemySpawnTimer = 0;
        advanceHazardSpawns(game, 0, 844, height, () => .1);
        positionEnemyLanes(game, height);
        assert.equal(survivor.y, before);
      }
    }
    assert.ok(game.enemies.length >= 3 && game.enemies.length <= flightDifficulty(game.flightTime,height).maxEnemies);
  }
});

test('transformation weapons preserve hits against either enemy of a paired encounter', () => {
  for (const EnemyShot of [VoltBolt, StrikerMissile]) {
    for (const lane of [150, 450]) {
      const game = run();
      game.enemies = [150, 450].map(y => ({ x: 200, y, width: 80, height: 60 }));
      const shot = new EnemyShot(game, 190, lane + 20, 844, 600);
      shot.update(.1);
      assert.ok(shot.x < 280);
      assert.equal(shot.markedForDeletion, false);
    }
  }
});

test('enemy shots leave reaction time at phone and tablet encounter distances', () => {
  for (const width of [320, 390, 844, 1366]) {
    const game = { player: { x: 100 } };
    const enemy = { x: Math.max(width - 150, width * .8) };
    const speed = enemyShotSpeed(game, enemy);
    assert.ok(speed <= 500);
    assert.ok((enemy.x - 150) / speed >= 1.2 - 1e-8);
  }
});

const attacker = (lane, type) => ({ encounterLane: lane, type, x: 650, y: 200, width: 80, state: 'ATTACKING', attackTimer: 10 });

test('a volley has a full visible warning at every supported frame rate', () => {
  for (const fps of [10, 30, 60, 120]) {
    const game = run(); const enemy = attacker(0);
    game.enemies = [enemy];
    assert.equal(advanceEnemyVolley(game, 0), null);
    assert.ok(enemy.attackWarning > 0);
    let elapsed = 0, fired = null;
    while (!fired && elapsed < 1) {
      elapsed += 1 / fps;
      fired = advanceEnemyVolley(game, 1 / fps);
      if (elapsed < SCOUT_WARNING_SECONDS - 1e-8) assert.equal(fired, null);
    }
    assert.equal(fired, enemy);
    assert.ok(elapsed >= SCOUT_WARNING_SECONDS - 1e-8);
    assert.ok(elapsed <= SCOUT_WARNING_SECONDS + 1 / fps + 1e-8);
    assert.equal(enemy.attackWarning, 0);
    assert.equal(enemy.attackTimer, 0);
    assert.equal(game.enemyShotCooldown, .75);
  }
});

test('active enemies rotate through upper and lower lanes without overlapping warnings or volleys', () => {
  const game = run(); game.enemies = [attacker(0), attacker(1, 'SPEEDSTER'), attacker(2, 'JUGGERNAUT')];
  const order = [], times = [];
  for (let i = 0; i < 1200; i++) {
    for (const enemy of game.enemies) enemy.attackTimer += 1 / 60;
    const fired = advanceEnemyVolley(game, 1 / 60);
    assert.ok(game.enemies.filter(enemy => enemy.attackWarning > 0).length <= 1);
    if (fired) { order.push(fired.encounterLane); times.push(i / 60); }
  }
  assert.deepEqual(order.slice(0, 6), [0, 1, 2, 0, 1, 2]);
  assert.ok(times.every((time, i) => !i || time - times[i - 1] >= .75 + ENEMY_ATTACK_WARNING_SECONDS - 1e-8));
});

test('a killed or departing attacker cancels its warning and a full projectile budget holds fire', () => {
  for (const exit of ['killed', 'leaving', 'removed']) {
    const game = run(), enemy = attacker(0);
    game.enemies = [enemy]; advanceEnemyVolley(game, 0);
    if (exit === 'killed') enemy.markedForDeletion = true;
    if (exit === 'leaving') enemy.state = 'LEAVING';
    if (exit === 'removed') game.enemies = [];
    assert.equal(advanceEnemyVolley(game, 1), null);
    assert.equal(enemy.attackWarning, 0);
    assert.equal(game.enemyAttackWarning, null);
  }
  const game = run(), enemy = attacker(0, 'SPEEDSTER');
  game.enemies = [enemy]; advanceEnemyVolley(game, 0);
  game.projectiles = Array.from({ length: 8 }, () => ({}));
  assert.equal(advanceEnemyVolley(game, 1), null);
  game.projectiles[0].markedForDeletion = true;
  assert.equal(advanceEnemyVolley(game, .01), enemy);
});

test('warning and shared shot cooldown freeze during pause, launch and after game over', () => {
  for (const phase of ['PAUSED', 'LAUNCH', 'ENDED', 'FLYING']) {
    const game = run(), enemy = attacker(0);
    game.enemies = [enemy]; advanceEnemyVolley(game, 0);
    game.enemyShotCooldown = .4;
    game.phase = phase; game.gameOver = phase === 'FLYING';
    const before = structuredClone(game);
    assert.equal(advanceEnemyVolley(game, 10), null);
    assert.deepEqual(game, before);
  }
});

test('fire pressure keeps rising into endgame with bounded parallel attacks and faster projectiles', () => {
  assert.deepEqual(enemyAttackPace(-10),enemyAttackPace(0));
  assert.equal(enemyAttackPace(20).intervalScale,1);
  assert.equal(enemyAttackPace(180).intervalScale,.25);
  assert.ok(Math.abs(enemyAttackPace(300).intervalScale-.16)<1e-8);
  assert.deepEqual(enemyAttackPace(100000),enemyAttackPace(300));
  for (const [seconds,concurrent,budget] of [[0,1,10],[45,2,14],[90,3,18],[150,4,24],[240,5,28]]) {
    assert.equal(enemyAttackPace(seconds).maxConcurrent,concurrent);
    assert.equal(enemyAttackPace(seconds).maxProjectiles,budget);
  }
  let previous=enemyAttackPace(20);
  for (let seconds=21;seconds<=300;seconds++) {
    const pace=enemyAttackPace(seconds);
    assert.ok(pace.intervalScale<previous.intervalScale);
    assert.ok(pace.reactionSeconds<previous.reactionSeconds);
    previous=pace;
  }
  for (const [type,base] of [['SCOUT',2.6],['SPEEDSTER',2.4],['JUGGERNAUT',3.5]]) {
    for (const seconds of [0,30,90,180,300,600]) {
      const game=run(); game.flightTime=seconds;
      const interval=base*enemyAttackPace(seconds).intervalScale;
      const enemy={type,attackTimer:interval-1e-6};
      assert.equal(canEnemyFire(game,enemy),false);
      enemy.attackTimer=interval;
      assert.equal(canEnemyFire(game,enemy),true);
    }
  }
});

function sampleAttackRate(types, flightTime, fps) {
  const game=run(); game.flightTime=flightTime;
  game.enemies=types.map((type,lane)=>({...attacker(lane,type),attackTimer:0}));
  const shots=[], order=[], starts=new Map();
  let maxWarnings=0,maxBatch=0,maxShots=0;
  for (let frame=0;frame<30*fps;frame++) {
    const dt=1/fps;
    for (const enemy of game.enemies) enemy.attackTimer+=dt;
    const fired=advanceEnemyAttacks(game,dt);
    maxBatch=Math.max(maxBatch,fired.length);
    for (const warning of game.enemyAttackWarnings) if (!starts.has(warning.enemy)) starts.set(warning.enemy,frame/fps);
    maxWarnings=Math.max(maxWarnings,game.enemyAttackWarnings.length);
    assert.ok(game.enemyAttackWarnings.length<=enemyAttackPace(flightTime).maxConcurrent);
    for (const enemy of fired) {
      assert.ok(frame/fps-starts.get(enemy)>=(enemy.type==='SCOUT'?SCOUT_WARNING_SECONDS:ENEMY_ATTACK_WARNING_SECONDS)-1e-8);
      starts.delete(enemy);
      order.push(enemy.encounterLane);
      shots.push({at:frame/fps,type:enemy.type,cooldown:game.enemyShotCooldown});
      game.projectiles.push(...createEnemyVolley(game,enemy));
    }
    maxShots=Math.max(maxShots,game.projectiles.length);
    assert.ok(game.projectiles.length<=enemyAttackPace(flightTime).maxProjectiles);
    for (const shot of game.projectiles) shot.update(dt);
    game.projectiles=game.projectiles.filter(shot=>!shot.markedForDeletion);
  }
  return {shots,order,maxWarnings,maxBatch,maxShots};
}

test('all three enemies actually fire more often later, with real projectile lifetimes at every supported frame rate', t => {
  const previous=globalThis.window; globalThis.window={innerWidth:844,innerHeight:390};
  t.after(()=>{globalThis.window=previous;});
  for (const type of ['SCOUT','SPEEDSTER','JUGGERNAUT']) {
    const earlyCounts=[],lateCounts=[];
    for (const fps of [10,30,60,120]) {
      const early=sampleAttackRate([type],30,fps),middle=sampleAttackRate([type],105,fps),late=sampleAttackRate([type],180,fps);
      assert.ok(middle.shots.length>early.shots.length,`${type}/${fps} accelerates mid-flight`);
      assert.ok(late.shots.length>middle.shots.length,`${type}/${fps} accelerates late-flight`);
      assert.ok(late.shots.every(shot=>Math.abs(shot.cooldown-.25)<1e-8));
      if (fps===60) t.diagnostic(`${type}: ${early.shots.length} → ${middle.shots.length} → ${late.shots.length} volleys per 30s at 30/105/180s flight age`);
      earlyCounts.push(early.shots.length);lateCounts.push(late.shots.length);
    }
    assert.ok(Math.max(...earlyCounts)-Math.min(...earlyCounts)<=1);
    assert.ok(Math.max(...lateCounts)-Math.min(...lateCounts)<=1);
  }
});

test('late mixed encounters more than double their volleys while overlapping telegraphs and live attacks', t => {
  const previous=globalThis.window; globalThis.window={innerWidth:844,innerHeight:390};
  t.after(()=>{globalThis.window=previous;});
  for (const fps of [10,30,60,120]) {
    const types=['SCOUT','SPEEDSTER','JUGGERNAUT'];
    const early=sampleAttackRate(types,0,fps),late=sampleAttackRate(types,180,fps);
    assert.ok(late.shots.length>early.shots.length*2);
    assert.equal(early.maxWarnings,1);
    assert.equal(late.maxWarnings,3);
    assert.ok(late.maxShots>=4);
    for (const type of types) assert.ok(late.shots.some(shot=>shot.type===type));
    if (fps===60) t.diagnostic(`Mixed encounter: ${early.shots.length} → ${late.shots.length} volleys/30s; ${late.maxWarnings} simultaneous warnings; ${late.maxBatch} simultaneous volleys; ${late.maxShots} live shots`);
  }
});

test('revival clears all pending crossfire without resetting earned flight difficulty', () => {
  const game=run(); game.flightTime=180;
  game.enemies=[attacker(0,'SCOUT'),attacker(1,'SPEEDSTER'),attacker(2,'JUGGERNAUT')];
  advanceEnemyAttacks(game,0); advanceEnemyAttacks(game,.4);
  resetEnemyAttacks(game);
  assert.equal(game.flightTime,180);
  assert.deepEqual(game.enemyAttackWarnings,[]);
  assert.equal(game.enemyAttackWarning,null);
  assert.ok(game.enemies.every(enemy=>enemy.attackWarning===0 && enemy.attackTimer===0 && enemy.scoutAim===null));
  assert.deepEqual(advanceEnemyAttacks(game,.1),[]);
});

test('three prepared attackers can charge together and two can fire in the same simulation frame', () => {
  const game=run(); game.flightTime=90;
  game.enemies=[attacker(0,'SCOUT'),attacker(1,'SPEEDSTER'),attacker(2,'JUGGERNAUT')];
  assert.deepEqual(advanceEnemyAttacks(game,0),[]);
  assert.equal(game.enemyAttackWarnings.length,3);
  const firing=advanceEnemyAttacks(game,.55);
  assert.deepEqual(firing.map(enemy=>enemy.type),['SPEEDSTER','JUGGERNAUT']);
  assert.equal(game.enemyAttackWarnings.length,1);
  assert.equal(game.enemyAttackWarnings[0].enemy.type,'SCOUT');
});

test('parallel attack capacity grows from one to five actual same-frame volleys', () => {
  for (const [age,capacity] of [[0,1],[45,2],[90,3],[150,4],[240,5]]) {
    const game=run();game.flightTime=age;
    game.enemies=Array.from({length:5},(_,lane)=>attacker(lane,'SPEEDSTER'));
    advanceEnemyAttacks(game,0);
    assert.equal(game.enemyAttackWarnings.length,capacity);
    const firing=advanceEnemyAttacks(game,.55);
    assert.equal(firing.length,capacity);
    for (const enemy of firing) game.projectiles.push(...createEnemyVolley(game,enemy));
    assert.equal(game.projectiles.length,capacity*3);
    assert.ok(game.projectiles.length<=enemyAttackPace(age).maxProjectiles);
  }
});

test('concurrent volleys reserve capacity before the caller creates projectiles', () => {
  const game=run(); game.flightTime=90;
  game.enemies=[0,1,2].map(lane=>attacker(lane,'SPEEDSTER'));
  advanceEnemyAttacks(game,0);
  game.projectiles=Array.from({length:14},()=>({}));
  const firing=advanceEnemyAttacks(game,.55);
  assert.equal(firing.length,1);
  assert.equal(game.enemyAttackWarnings.length,2);
  game.projectiles.push(...createEnemyVolley(game,firing[0]));
  assert.equal(game.projectiles.length,17);
  assert.deepEqual(advanceEnemyAttacks(game,.1),[]);
  game.projectiles.splice(0,3);
  const next=advanceEnemyAttacks(game,.1);
  assert.equal(next.length,1);
  assert.notEqual(next[0],firing[0]);
});

test('all overlapping charges freeze on pause and invalid attackers cancel independently', () => {
  const game=run(); game.flightTime=180;
  game.enemies=[attacker(0,'SCOUT'),attacker(1,'SPEEDSTER'),attacker(2,'JUGGERNAUT')];
  advanceEnemyAttacks(game,0); advanceEnemyAttacks(game,.4);
  game.phase='PAUSED'; const before=structuredClone(game);
  assert.deepEqual(advanceEnemyAttacks(game,100),[]);
  assert.deepEqual(game,before);
  game.phase='FLYING'; game.enemies[0].markedForDeletion=true; game.enemies[1].state='LEAVING';
  const firing=advanceEnemyAttacks(game,.2);
  assert.deepEqual(firing,[game.enemies[2]]);
  assert.equal(game.enemies[0].scoutAim,null);
  assert.equal(game.enemies[0].attackWarning,0);
  assert.equal(game.enemies[1].attackWarning,0);
});

test('late reinforcements fit four phone hulls and five tablet hulls without relocating survivors', () => {
  for (const [height,count,Enemy] of [[390,4,SpeedsterVillain],[844,5,JuggernautVillain]]) {
    const game=run(); game.flightTime=200; game.enemySpawnTimer=0;
    const gap=Enemy===SpeedsterVillain?72:112;
    const top=Enemy===SpeedsterVillain?44:64;
    game.enemies=Array.from({length:count-1},(_,lane)=>Object.assign(new Enemy(675,top+lane*gap),{state:'ATTACKING',encounterLane:lane}));
    const positions=game.enemies.map(enemy=>enemy.y);
    advanceHazardSpawns(game,0,844,height,()=>.9); positionEnemyLanes(game,height);
    assert.equal(game.enemies.length,count);
    assert.deepEqual(game.enemies.slice(0,-1).map(enemy=>enemy.y),positions);
    const newest=game.enemies.at(-1);
    for (const other of game.enemies.slice(0,-1)) assert.ok(Math.abs(newest.y-other.y)>=(newest.height+other.height)/2+ENEMY_HULL_GAP);
  }
  const game=run(); game.flightTime=200; game.enemySpawnTimer=0;
  const tank=Object.assign(new JuggernautVillain(675,140),{state:'ATTACKING',encounterLane:0}); game.enemies=[tank];
  advanceHazardSpawns(game,0,844,280,()=>.9);
  assert.equal(game.enemies.length,2); assert.equal(tank.y,140);
  assert.equal(game.enemies[1].type,'SPEEDSTER');
});

test('late shots get faster across viewport sizes and stop accelerating after five minutes', () => {
  for (const width of [320,390,844,1366]) {
    const game=run(),enemy={x:Math.max(width-150,width*.8)};
    const speeds=[0,90,180,300,600].map(age=>{game.flightTime=age;return enemyShotSpeed(game,enemy);});
    assert.ok(speeds[0]<speeds[1] && speeds[1]<speeds[2] && speeds[2]<=speeds[3]);
    assert.equal(speeds[3],speeds[4]);
    assert.ok(speeds.every(speed=>Number.isFinite(speed) && speed<=1000));
  }
});

test('late fire pressure never bypasses a full projectile budget or shortens an in-progress warning', () => {
  for (const type of ['SCOUT','SPEEDSTER','JUGGERNAUT']) {
    const game=run(); game.flightTime=180; const enemy=attacker(0,type); game.enemies=[enemy];
    game.projectiles=Array.from({length:enemyAttackPace(game.flightTime).maxProjectiles},()=>({}));
    assert.equal(advanceEnemyVolley(game,0),null);
    assert.equal(game.enemyAttackWarning,null);
    game.projectiles=[]; advanceEnemyVolley(game,0);
    assert.equal(advanceEnemyVolley(game,.2),null);
    assert.ok(game.enemyAttackWarning.remaining>0);
    game.projectiles=Array.from({length:enemyAttackPace(game.flightTime).maxProjectiles},()=>({}));
    assert.equal(advanceEnemyVolley(game,.2),null);
    assert.equal(advanceEnemyVolley(game,.6),null);
    assert.equal(enemy.attackWarning,1);
    game.projectiles=[];
    assert.equal(advanceEnemyVolley(game,.01),enemy);
  }
});
