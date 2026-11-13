import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceSupportDrop, supportDropPace, FIRST_CAPSULE_SECONDS } from '../src/game/SupportDrops.js';
import { advanceHealthPickupSpawn } from '../src/game/PlayerHealth.js';
import { Player } from '../src/game/Entities.js';
import { advanceTransformationCapsule, createTransformationDirector, beginTransformation, requestTransformationExit, advanceTransformation, resetTransformations } from '../src/game/Transformations.js';

const flight=(age=0)=>({phase:'FLYING',gameOver:false,flightTime:age,speed:360,player:new Player(),fuels:[],powerUps:[],healthPickups:[],healthPickupTimer:0,activePowerUps:[],transformationDirector:createTransformationDirector()});

test('all support categories get sparser as active flight progresses and late intervals stay bounded',()=>{
  assert.deepEqual(supportDropPace(0),{fuelMinimum:7,fuelJitter:3,powerMinimum:18,powerJitter:6,healthInterval:28,capsuleRetry:24,capsuleCooldown:45});
  assert.deepEqual(supportDropPace(180),{fuelMinimum:12,fuelJitter:3,powerMinimum:30,powerJitter:6,healthInterval:44,capsuleRetry:36,capsuleCooldown:60});
  assert.deepEqual(supportDropPace(10000),supportDropPace(180));
  let previous=supportDropPace(30);
  for(let age=31;age<=180;age++) {
    const pace=supportDropPace(age);
    for(const key of ['fuelMinimum','powerMinimum','healthInterval','capsuleRetry','capsuleCooldown']) assert.ok(pace[key]>previous[key]);
    previous=pace;
  }
});

function sample(kind,age,fps,random=()=>.5) {
  const game=flight(age), events=[], items=kind==='fuel'?game.fuels:game.powerUps;
  for(let frame=0;frame<180*fps;frame++) {
    for(const item of items) if(frame/fps-item.at>=.75) item.markedForDeletion=true;
    if(advanceSupportDrop(game,kind,1/fps,random)) {
      events.push((frame+1)/fps); items.push({at:frame/fps,markedForDeletion:false});
    }
    assert.ok(items.filter(item=>!item.markedForDeletion).length<=1);
  }
  return events;
}

test('fuel and power-up clocks enforce their spacing at 10/30/60/120 FPS and late flight yields fewer drops',t=>{
  for(const kind of ['fuel','power']) {
    const early=[],late=[];
    for(const fps of [10,30,60,120]) {
      const opening=sample(kind,0,fps), endgame=sample(kind,180,fps);
      assert.ok(endgame.length<opening.length);
      for(const [events,age] of [[opening,0],[endgame,180]]) {
        const pace=supportDropPace(age), min=kind==='fuel'?pace.fuelMinimum:pace.powerMinimum;
        const max=min+(kind==='fuel'?pace.fuelJitter:pace.powerJitter);
        for(let i=0;i<events.length;i++) {
          const gap=events[i]-(events[i-1]||0);
          assert.ok(gap>=min-1e-8 && gap<=max+1/fps+1e-8);
        }
      }
      if(fps===60) t.diagnostic(`${kind}: ${opening.length} opening drops → ${endgame.length} late drops per 180s`);
      early.push(opening.length);late.push(endgame.length);
    }
    assert.ok(Math.max(...early)-Math.min(...early)<=1);
    assert.ok(Math.max(...late)-Math.min(...late)<=1);
  }
});

test('minimum/maximum random rolls cannot create clusters, duplicate pickups or delayed backlogs',()=>{
  for(const kind of ['fuel','power']) for(const roll of [0,1]) {
    const game=flight(), pace=supportDropPace();
    const interval=kind==='fuel'?pace.fuelMinimum+roll*pace.fuelJitter:pace.powerMinimum+roll*pace.powerJitter;
    const items=kind==='fuel'?game.fuels:game.powerUps;
    assert.equal(advanceSupportDrop(game,kind,interval-.01,()=>roll),false);
    assert.equal(advanceSupportDrop(game,kind,.01,()=>roll),true);
    const item={markedForDeletion:false};items.push(item);
    assert.equal(advanceSupportDrop(game,kind,1000,()=>roll),false);
    item.markedForDeletion=true;
    assert.equal(advanceSupportDrop(game,kind,.001,()=>roll),true);
    assert.equal(advanceSupportDrop(game,kind,.001,()=>roll),false);
  }
});

test('resource and capsule clocks freeze before flight, during pause and after game over without catch-up drops',()=>{
  const game=flight();
  advanceSupportDrop(game,'fuel',1,()=>0);advanceSupportDrop(game,'power',1,()=>0);
  for(const phase of ['LAUNCH','READY','PAUSED','COUNTDOWN','ENDED','FLYING']) {
    game.phase=phase;game.gameOver=phase==='FLYING';const before=structuredClone(game);
    assert.equal(advanceSupportDrop(game,'fuel',1000,()=>0),false);
    assert.equal(advanceSupportDrop(game,'power',1000,()=>0),false);
    assert.equal(advanceHealthPickupSpawn(game,1000),false);
    assert.equal(advanceTransformationCapsule(game,1000,844,390),false);
    assert.deepEqual(structuredClone(game),before);
  }
  game.phase='FLYING';game.gameOver=false;
  assert.equal(advanceSupportDrop(game,'fuel',.01,()=>0),false);
  assert.equal(advanceSupportDrop(game,'power',.01,()=>0),false);
});

test('medical packs use the longer flight-dependent interval and remain limited to one visible pack',()=>{
  for(const age of [0,90,180]) {
    const game=flight(age), interval=supportDropPace(age).healthInterval;
    assert.equal(advanceHealthPickupSpawn(game,interval-.01),false);
    assert.equal(advanceHealthPickupSpawn(game,.01),true);
    game.healthPickups.push({markedForDeletion:false});
    assert.equal(advanceHealthPickupSpawn(game,1000),false);
    game.healthPickups[0].markedForDeletion=true;
    assert.equal(advanceHealthPickupSpawn(game,.01),true);
    assert.equal(advanceHealthPickupSpawn(game,.01),false);
  }
});

test('capsules wait 28 normal-flight seconds initially, then use longer miss and vehicle cooldowns',()=>{
  const game=flight();game.player.y=200;
  assert.equal(game.transformationDirector.nextAt,FIRST_CAPSULE_SECONDS);
  advanceTransformationCapsule(game,27.9,844,390);
  assert.equal(game.transformationDirector.capsule,null);
  advanceTransformationCapsule(game,.1,844,390);
  assert.ok(game.transformationDirector.capsule);
  for(const age of [0,180]) {
    const run=flight(age), pace=supportDropPace(age);
    run.transformationDirector.capsule={x:-30,y:200,radius:29,age:0};
    advanceTransformationCapsule(run,0,844,390);
    assert.equal(run.transformationDirector.nextAt,run.transformationDirector.normalTime+pace.capsuleRetry);
    assert.deepEqual(run.transformationDirector.bag,[]);
    beginTransformation(run,'sphere',844,390);
    const normalTime=run.transformationDirector.normalTime;
    advanceTransformationCapsule(run,100,844,390);
    assert.equal(run.transformationDirector.normalTime,normalTime);
    requestTransformationExit(run);
    for(let step=0;step<3;step++) advanceTransformation(run,.1,844,390);
    assert.equal(run.transformation,null);
    assert.equal(run.transformationDirector.nextAt,normalTime+pace.capsuleCooldown);
    resetTransformations(run);
    assert.equal(run.transformationDirector.nextAt,normalTime+pace.capsuleCooldown);
    resetTransformations(run,true);
    assert.equal(run.transformationDirector.nextAt,FIRST_CAPSULE_SECONDS);
    assert.equal(run.transformationDirector.normalTime,0);
  }
});
