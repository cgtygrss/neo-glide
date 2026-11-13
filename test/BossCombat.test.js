import test from 'node:test';
import assert from 'node:assert/strict';
import { createEncounterDirector, advanceBossEncounter, drainEncounterEvents, encounterRestrictsSpawns, bossArrivalView, bossHud, BOSS_ARRIVAL_SECONDS, BOSS_ENCOUNTER_SECONDS, BOSSES } from '../src/game/BossEncounters.js';
import { damageEnemy, resolveFriendlyHits, drainCombatEvents, fireNormalWeapon, advanceAmmoRecharge, MAX_PLAYER_PROJECTILES, MAX_HOSTILE_PROJECTILES } from '../src/game/Combat.js';
import { beginTransformation, advanceTransformation, transformationSecondary } from '../src/game/Transformations.js';
import { pauseFlight, resumeFlight, takeFlightControl } from '../src/game/FlightStart.js';
import { getWeaponStats, WEAPON_STATS } from '../src/game/WeaponCatalog.js';
import { Villain, SpeedsterVillain, JuggernautVillain } from '../src/game/Entities.js';
import { prepareRewardedContinue } from '../src/game/RunLifecycle.js';
import { fitFlightViewport, flightViewport } from '../src/game/FlightViewport.js';
import { advanceFlightPace } from '../src/game/FlightDifficulty.js';
import { advanceEquipmentEnergy } from '../src/game/FlightEquipment.js';
import { SoundManager } from '../src/game/SoundManager.js';

const flight = () => ({ phase: 'FLYING', flightTime: 0, viewport: { width: 844, height: 390, paceScale: 1 },
  player: { x: 100, y: 180, height: 20, width: 40, velocity: 0, boost() {} },
  health: 80, maxHealth: 100, ammo: 10, maxAmmo: 10, ammoRegenTime: 2, weaponType: 'default',
  speed: 400, distance: 0, energy: 100, maxEnergy: 100, obstacles: [], projectiles: [], playerProjectiles: [], enemies: [],
  activePowerUps: [], sessionCurrency: 0, bossesDefeated: 0, launch: { reducedMotion: false }, encounter: createEncounterDirector() });
const stepTo = (game, until, fps = 60) => {
  while (game.flightTime < until - 1e-8) {
    const dt = Math.min(1 / fps, until - game.flightTime);
    advanceFlightPace(game, dt); advanceBossEncounter(game);
    for (const shot of game.projectiles) shot.update(dt, game.viewport);
    game.projectiles = game.projectiles.filter(shot => !shot.markedForDeletion);
  }
};
const target = (x, hp = 100) => { const enemy = new Villain(x, 100); enemy.hp = hp; return enemy; };

test('flight stays active through former choice times and a defeated boss', () => {
  for (const fps of [30,60,120]) {
    const game=flight();
    for(const time of [20,45,60]) {stepTo(game,time,fps);assert.equal(game.phase,'FLYING');}
    const before=game.distance, boss=game.encounter.boss;
    damageEnemy(game,boss,boss.maxHp);advanceBossEncounter(game);
    assert.equal(game.sessionCurrency,25000);assert.equal(drainCombatEvents(game).length,1);
    for(const time of [63,90,135,180]) {stepTo(game,time,fps);assert.equal(game.phase,'FLYING');}
    assert.ok(game.distance>before);assert.equal(game.encounter.boss,null);
    assert.equal('runPerks' in game,false);assert.equal('pauseContext' in game,false);
  }
});

test('all normal weapons keep their catalog damage and spend one round, within the shared cap',()=>{
  for(const type of Object.keys(WEAPON_STATS)) {
    const game=flight();game.weaponType=type;
    assert.ok(fireNormalWeapon(game));assert.equal(game.ammo,9);assert.equal(game.playerProjectiles.length,1);
    assert.equal(game.playerProjectiles[0].damage,getWeaponStats(type).damage);
    game.playerProjectiles=Array.from({length:MAX_PLAYER_PROJECTILES},()=>({}));
    assert.equal(fireNormalWeapon(game),false);assert.equal(game.ammo,9);
    game.playerProjectiles=[];game.ammo=0;assert.equal(fireNormalWeapon(game),false);
    game.rapidFire=true;assert.ok(fireNormalWeapon(game));assert.equal(game.ammo,0);
    game.transformation={phase:'ACTIVE'};assert.equal(fireNormalWeapon(game),false);
  }
});

test('simultaneous friendly shots and other damage commit each defeat reward once',()=>{
  const game=flight(),enemy=target(300,10);game.enemies=[enemy];
  game.playerProjectiles=Array.from({length:3},()=>({x:320,y:120,radius:5,damage:10}));
  resolveFriendlyHits(game);damageEnemy(game,enemy,100);resolveFriendlyHits(game);
  assert.equal(game.sessionCurrency,5000);assert.equal(game.bossesDefeated,1);
  assert.equal(drainCombatEvents(game).length,1);assert.equal(drainCombatEvents(game).length,0);
});

test('all five transformations retain their twelve-second duration across pause and resize',()=>{
  for(const id of ['striker','volt','drill','sphere','aegis']) {
    const game=flight();assert.ok(beginTransformation(game,id,844,390));
    for(let i=0;i<200;i++)advanceTransformation(game,1/120,844,390,true);
    assert.equal(game.transformation.duration,12);assert.equal(game.transformation.phase,'ACTIVE');
    pauseFlight(game);const remaining=game.transformation.remaining,health=game.health,energy=game.energy;
    fitFlightViewport(game,flightViewport(820,1180));
    for(let i=0;i<120;i++) {
      advanceTransformation(game,1/30,game.viewport.width,390);
      advanceEquipmentEnergy(game,1/30);advanceAmmoRecharge(game,1/30);advanceFlightPace(game,1/30);
    }
    assert.equal(game.transformation.remaining,remaining);assert.equal(game.health,health);assert.equal(game.energy,energy);
    resumeFlight(game);takeFlightControl(game,true);advanceTransformation(game,.1,game.viewport.width,390,true);
    assert.ok(game.transformation.remaining<remaining);
  }
});

test('rewarded continuation keeps equipment, boss health and the flight clock',()=>{
  const game=flight();game.maxHealth=140;game.ammoRegenTime=1.25;stepTo(game,62);
  const boss=game.encounter.boss;boss.hp=190;
  game.gameOver=true;game.phase='ENDED';game.health=0;game.energy=0;
  assert.ok(prepareRewardedContinue(game,game.viewport));
  assert.equal(game.maxHealth,140);assert.equal(game.health,70);assert.equal(game.ammoRegenTime,1.25);
  assert.ok(Math.abs(game.flightTime-62)<1e-7);assert.equal(game.encounter.boss,boss);assert.equal(boss.hp,190);
  assert.equal(boss.warning,null);assert.ok(Math.abs(boss.nextAttackAt-64)<1e-7);
  assert.equal(game.phase,'COUNTDOWN');assert.equal(game.energy,50);assert.equal('runPerks' in game,false);
  assert.equal(prepareRewardedContinue(game,game.viewport),false);
});

test('transformation weapons keep their own damage, shot counts and the shared budget',()=>{
  for(const id of ['striker','volt']) {
    const game=flight();beginTransformation(game,id,844,390);
    for(let i=0;i<200;i++)advanceTransformation(game,1/120,844,390,true);
    assert.ok(transformationSecondary(game));assert.equal(game.playerProjectiles.length,id==='striker'?3:1);
    const enemy=target(300,1),near=target(320,100);game.enemies=[enemy,near];
    const shot=game.playerProjectiles[0];shot.x=320;shot.y=120;shot.previousX=200;shot.previousY=120;
    resolveFriendlyHits(game);assert.ok(enemy.defeatResolved);assert.equal(near.hp,100);
    game.transformation.cooldown=0;game.playerProjectiles=Array.from({length:MAX_PLAYER_PROJECTILES},()=>({}));
    assert.equal(transformationSecondary(game),false);assert.equal(game.transformation.cooldown,0);
  }
});

test('friendly swept collision hits the nearest hull even if a fast shot crosses it in one frame', () => {
  const game = flight(), near = target(300, 10), far = target(600, 10);
  game.enemies = [far, near];
  game.playerProjectiles = [{ previousX: 100, previousY: 120, x: 800, y: 120, radius: 5, damage: 10, source: 'normal' }];
  resolveFriendlyHits(game); assert.ok(near.defeatResolved); assert.equal(far.hp, 10);
  resolveFriendlyHits(game); assert.equal(game.sessionCurrency, 5000);
});

test('boss spawn, 40-second retreat, recovery and alternation agree at 30/60/120 FPS', () => {
  const reports = [];
  for (const fps of [30,60,120]) {
    const game = flight(); game.enemies.push(target(600)); game.obstacles.push({}); game.projectiles.push({markedForDeletion:true,update(){}});
    stepTo(game, 59.9, fps); assert.equal(game.encounter.boss, null);
    stepTo(game, 60, fps); assert.equal(game.encounter.boss.id, 'forge'); assert.equal(game.encounter.boss.hp, 240);
    assert.equal(game.enemies.length, 1); assert.equal(game.obstacles.length, 0); assert.equal(game.projectiles.length, 0);
    stepTo(game, 100, fps); assert.equal(game.encounter.boss, null); assert.equal(game.encounter.nextAt, 175);
    assert.ok(encounterRestrictsSpawns(game)); assert.equal(game.sessionCurrency, 0);
    stepTo(game, 103, fps); assert.equal(encounterRestrictsSpawns(game), false);
    stepTo(game, 175, fps); assert.equal(game.encounter.boss.id, 'prism'); assert.equal(game.encounter.boss.hp, 480);
    reports.push(drainEncounterEvents(game).filter(event=>event.name==='boss_started'||event.name==='boss_ended'));
  }
  assert.deepEqual(reports[0],reports[1]); assert.deepEqual(reports[0],reports[2]);
});

test('both boss stages, minimum warning, shared safe corridor and projectile cap hold at every frame rate', () => {
  for (const fps of [30,60,120]) for (const number of [0,1]) {
    const game = flight(); game.encounter.number = number; stepTo(game,60,fps);
    const boss = game.encounter.boss; boss.hp = boss.maxHp * .49;
    const warningAt = new Map(); let attacks = 0;
    for (let i=0;i<fps*BOSS_ENCOUNTER_SECONDS-1;i++) {
      const dt=1/fps;game.flightTime+=dt;advanceBossEncounter(game);
      if (boss.warning && !warningAt.has(boss.attackCount)) warningAt.set(boss.attackCount,game.flightTime);
      const events=drainEncounterEvents(game);
      if(events.some(event=>event.name==='boss_attack')) {
        assert.ok(game.flightTime-warningAt.get(attacks)>=.8-1e-7);attacks++;
      }
      assert.ok(game.projectiles.length<=MAX_HOSTILE_PROJECTILES);
      for(const shot of game.projectiles)shot.update(dt,game.viewport);
      game.projectiles=game.projectiles.filter(shot=>!shot.markedForDeletion);
    }
    assert.equal(boss.stage,2);assert.ok(attacks>6);
    if(number===0)assert.equal(game.enemies.filter(enemy=>enemy.isBossDrone).length,2);
  }
});

test('boss defeat grants one credit reward without interrupting flight; drones yield nothing and health scaling caps at 3x', () => {
  const game=flight();stepTo(game,60);
  const boss=game.encounter.boss;boss.hp=100;advanceBossEncounter(game);
  for(const drone of game.enemies.filter(enemy=>enemy.isBossDrone))damageEnemy(game,drone,100);
  assert.equal(game.sessionCurrency,0);assert.equal(game.bossesDefeated,0);
  damageEnemy(game,boss,1000);damageEnemy(game,boss,1000);
  assert.equal(game.sessionCurrency,25000);assert.equal(game.eliteBossesDefeated,1);assert.equal(game.phase,'FLYING');
  advanceBossEncounter(game);assert.ok(Math.abs(game.encounter.recoveryUntil-63)<1e-8);
  assert.equal(drainEncounterEvents(game).filter(event=>event.name==='boss_ended'&&event.data.outcome==='defeated').length,1);
  for(const number of [2,8,20,100]) {
    const trial=flight();trial.encounter.number=number;stepTo(trial,60);
    const base=BOSSES[number%2].hp;
    assert.equal(trial.encounter.boss.maxHp,base*Math.min(3,1+.2*Math.floor(number/2)));
  }
});

test('paused and READY frames cannot mutate bosses, shots or resources, including while transformed', () => {
  const game=flight();stepTo(game,61);pauseFlight(game);
  const snapshot=JSON.stringify(game);
  for(let i=0;i<120;i++){advanceBossEncounter(game);resolveFriendlyHits(game);}
  assert.equal(JSON.stringify(game),snapshot);
  resumeFlight(game);const ready=JSON.stringify(game);advanceBossEncounter(game);
  assert.equal(JSON.stringify(game),ready);assert.equal(fireNormalWeapon(game),false);
});

test('equipment recharge intervals, distance and fuel produce equivalent results at 30/60/120 FPS',()=>{
  for(const interval of [2,1.5,1,.7]) {
    const results=[];
    for(const fps of [30,60,120]) {
      const game=flight();game.ammo=0;game.maxAmmo=100;game.ammoRegenTime=interval;
      game.player.isBoosting=true;game.energyDrain=1;
      for(let i=0;i<fps*9;i++) {advanceAmmoRecharge(game,1/fps);advanceFlightPace(game,1/fps);advanceEquipmentEnergy(game,1/fps);}
      results.push([game.ammo,game.ammoTimer,game.distance,game.energy]);
    }
    for(const result of results.slice(1))for(let i=0;i<4;i++)assert.ok(Math.abs(result[i]-results[0][i])<1e-7);
  }
});

test('a full hostile budget keeps the warning armed until a slot becomes available',()=>{
  const game=flight();stepTo(game,61.2);const boss=game.encounter.boss;
  assert.ok(boss.warning);const warning=boss.warning;
  game.projectiles=Array.from({length:32},()=>({markedForDeletion:false}));
  game.flightTime=63;advanceBossEncounter(game);
  assert.equal(boss.warning,warning);assert.equal(boss.attackCount,0);assert.equal(game.projectiles.length,32);
  game.projectiles[0].markedForDeletion=true;advanceBossEncounter(game);
  assert.equal(boss.warning,null);assert.equal(boss.attackCount,1);
  assert.equal(game.projectiles.filter(shot=>!shot.markedForDeletion).length,32);
});

test('Forge volleys and Prism rotating volleys leave their advertised escape band open',()=>{
  for(const number of [0,1])for(const playerY of [60,180,330]) {
    const game=flight();game.encounter.number=number;game.player.y=playerY;stepTo(game,60);
    const boss=game.encounter.boss;boss.hp=boss.maxHp*.49;
    for(let attack=0;attack<4;attack++) {
      game.flightTime=boss.nextAttackAt-.85;advanceBossEncounter(game);const warning={...boss.warning};
      game.projectiles=[];game.flightTime=boss.warning.at;advanceBossEncounter(game);
      for(const shot of game.projectiles.filter(shot=>shot.type!=='SCOUT_BEAM')) {
        const crossing=shot.y+shot.vy*(warning.targetX-shot.x)/shot.vx;
        assert.ok(Math.abs(crossing-warning.safeY)>warning.safeHalf+8);
      }
    }
  }
});

test('Forge changes from three to five primary shots; Prism alternates its locked laser with rotating fire',()=>{
  for(const number of [0,1]) {
    const game=flight();game.encounter.number=number;stepTo(game,60);const boss=game.encounter.boss;
    const fire=()=>{game.projectiles=[];game.flightTime=boss.nextAttackAt-.8;advanceBossEncounter(game);
      const kind=boss.warning.kind;game.flightTime=boss.warning.at;advanceBossEncounter(game);return kind;};
    assert.equal(fire(),number?'laser':'fan');
    if(!number)assert.equal(game.projectiles.length,3);
    else assert.equal(game.projectiles[0].type,'SCOUT_BEAM');
    boss.hp=boss.maxHp*.5;advanceBossEncounter(game);assert.equal(boss.stage,1);
    boss.hp-=1;advanceBossEncounter(game);assert.equal(boss.stage,2);
    if(!number) {
      fire();assert.equal(game.enemies.filter(enemy=>enemy.isBossDrone).length,2);
      assert.equal(game.projectiles.filter(shot=>Math.abs(shot.x-(boss.x-boss.width/2))<1e-8).length,5);
    } else { assert.equal(fire(),'spiral');assert.equal(fire(),'laser');assert.equal(fire(),'spiral'); }
  }
});

test('boss sounds distinguish Forge and Prism without creating a separate audio path',()=>{
  const sound=Object.create(SoundManager.prototype),calls=[];
  sound.playTransformationLayers=layers=>calls.push(layers);
  for(const cue of ['incoming','arrival','warning','attack']) {
    sound.playBossCue('forge',cue);sound.playBossCue('prism',cue);
    assert.notDeepEqual(calls.at(-1),calls.at(-2));
  }
});

test('both arrivals clear threats, announce before entry and retain the 60s combat deadline at every frame rate', () => {
  const reports=[];
  for (const fps of [30,60,120]) for (const number of [0,1]) {
    const game=flight();game.encounter.number=number;
    stepTo(game,56.3,fps);assert.equal(bossHud(game),null);
    game.enemies.push(target(600));game.obstacles.push({});game.projectiles.push({markedForDeletion:true,update(){}});
    stepTo(game,56.4,fps);
    assert.ok(encounterRestrictsSpawns(game));assert.equal(game.encounter.boss,null);
    assert.equal(game.enemies.length,0);assert.equal(game.obstacles.length,0);assert.equal(game.projectiles.length,0);
    assert.equal(bossHud(game).name,BOSSES[number].name);assert.equal(bossHud(game).reward,25000);
    const before=game.distance;stepTo(game,58.8,fps);
    assert.ok(game.distance>before);assert.equal(game.phase,'FLYING');
    assert.ok(Math.abs(bossArrivalView(game).approach-.5)<1e-7);
    assert.equal(game.enemies.length,0,'the visual arrival is not a damageable target');
    assert.equal(game.sessionCurrency,0);
    stepTo(game,60,fps);assert.equal(bossArrivalView(game),null);
    assert.equal(game.encounter.boss.startedAt,60);assert.equal(game.encounter.boss.attackCount,0);
    assert.equal(game.encounter.boss.x,game.viewport.width*.8);
    reports.push(drainEncounterEvents(game).filter(e=>['boss_incoming','boss_started'].includes(e.name)));
  }
  assert.deepEqual(reports[0],reports[2]);assert.deepEqual(reports[2],reports[4]);
  assert.deepEqual(reports[1],reports[3]);assert.deepEqual(reports[3],reports[5]);
});

test('a skipped simulation interval still gives the entire arrival warning instead of popping in a boss', () => {
  const game=flight();game.flightTime=60;advanceBossEncounter(game);
  assert.equal(game.encounter.boss,null);assert.ok(game.encounter.arrival);
  assert.equal(game.encounter.nextAt,60+BOSS_ARRIVAL_SECONDS);
  assert.deepEqual(drainEncounterEvents(game).map(e=>e.name),['boss_incoming']);
  game.flightTime=63;advanceBossEncounter(game);assert.equal(game.encounter.boss,null);
  game.flightTime=63.6;advanceBossEncounter(game);assert.ok(game.encounter.boss);
  assert.equal(game.encounter.boss.startedAt,63.6);
});

test('arrival presentation freezes with pause and resize, and rewarded continuation retains it', () => {
  const game=flight();stepTo(game,58.8);
  const arrival=game.encounter.arrival, view=bossArrivalView(game);
  drainEncounterEvents(game);pauseFlight(game);
  const snapshot=JSON.stringify(game);
  for(let i=0;i<120;i++){advanceBossEncounter(game);assert.deepEqual(bossHud(game),view);}
  assert.equal(JSON.stringify(game),snapshot);
  fitFlightViewport(game,flightViewport(820,1180));
  assert.equal(game.encounter.arrival,arrival);assert.deepEqual(bossHud(game),view);
  game.phase='ENDED';game.gameOver=true;game.health=0;
  assert.equal(prepareRewardedContinue(game,game.viewport),true);
  advanceBossEncounter(game);assert.deepEqual(bossHud(game),view);assert.equal(game.encounter.arrival,arrival);
  game.phase='READY';takeFlightControl(game,true);stepTo(game,60);
  assert.equal(game.encounter.boss.startedAt,60);
  assert.equal(drainEncounterEvents(game).filter(e=>e.name==='boss_incoming').length,0,'resume never repeats the arrival cue');
});

test('each regular enemy grants 5k and each large boss grants 25k once; retreat and escorts cannot pay', () => {
  for(const Type of [Villain,SpeedsterVillain,JuggernautVillain]) {
    const game=flight(),enemy=new Type(500,150);game.enemies=[enemy];
    damageEnemy(game,enemy,10000);damageEnemy(game,enemy,10000);
    assert.equal(game.sessionCurrency,5000);assert.equal(drainCombatEvents(game).length,1);
  }
  for(const number of [0,1]) {
    const game=flight();game.encounter.number=number;stepTo(game,60);
    const boss=game.encounter.boss;boss.hp=boss.maxHp*.49;advanceBossEncounter(game);
    for(const drone of game.enemies.filter(e=>e.isBossDrone)){damageEnemy(game,drone,1000);damageEnemy(game,drone,1000);}
    assert.equal(game.sessionCurrency,0);
    damageEnemy(game,boss,10000);damageEnemy(game,boss,10000);advanceBossEncounter(game);
    assert.equal(game.sessionCurrency,25000);assert.equal(game.eliteBossesDefeated,1);
    assert.equal(drainCombatEvents(game).filter(e=>e.reward===25000).length,1);
    const retreat=flight();retreat.encounter.number=number;stepTo(retreat,100);
    assert.equal(retreat.encounter.boss,null);assert.equal(retreat.sessionCurrency,0);
  }
});
