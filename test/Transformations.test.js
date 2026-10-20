import test from 'node:test';
import assert from 'node:assert/strict';
import { Player, Collectible } from '../src/game/Entities.js';
import { takeProjectileHit } from '../src/game/PlayerHealth.js';
import { FlightInput } from '../src/game/FlightInput.js';
import { pauseFlight, resumeFlight, takeFlightControl } from '../src/game/FlightStart.js';
import { TRANSFORMATIONS, ENTRY_SECONDS, EXIT_SECONDS } from '../src/game/TransformationCatalog.js';
import { COSMETICS } from '../src/game/CosmeticsCatalog.js';
import { drawTransformationCapsule, drawTransformationVehicle } from '../src/game/TransformationArt.js';
import { advanceTransformation, advanceTransformationCapsule, beginTransformation, createTransformationDirector, requestTransformationExit, resetTransformations, resizeTransformation, absorbTransformationHit, transformationHitbox, transformationPrimary, transformationSecondary } from '../src/game/Transformations.js';

function flight() {
  return { phase:'FLYING', player:new Player(), speed:500, distance:0, gameOver:false,
    health:60, maxHealth:100, energy:12, ammo:0, ammoTimer:.8, healthPickupTimer:7,
    activePowerUps:[{type:'MAGNET',remainingTime:5}], obstacles:[], collectibles:[],
    fuels:[], healthPickups:[], powerUps:[], projectiles:[], playerProjectiles:[], floatingTexts:[],
    villain:null, sessionCurrency:0, combo:0, comboTimer:0, transformationDirector:createTransformationDirector() };
}
function advance(game, seconds, dt=1/60, width=800, height=600, held=false) {
  let paid=0, exits=0;
  for(let time=0;time<seconds-1e-8;time+=dt) {
    const result=advanceTransformation(game,Math.min(dt,seconds-time),width,height,held,1,()=>.4);
    paid+=result.credits; exits+=Number(result.exited);
  }
  return {paid,exits};
}
function active(id,width=800,height=600) {
  const game=flight(); assert.equal(beginTransformation(game,id,width,height),true);
  advance(game,ENTRY_SECONDS,1/60,width,height);
  game.transformation.entryProtection=0; // These tests exercise active abilities; entry protection is covered separately.
  assert.equal(game.transformation.phase,'ACTIVE');
  return game;
}

test('capsules run during ordinary encounters without clearing hazards, and missed capsules preserve the bag',()=>{
  const game=flight(); game.player.y=0;
  game.phase='PAUSED'; advanceTransformationCapsule(game,30,800,600); assert.equal(game.transformationDirector.normalTime,0);
  game.phase='FLYING'; game.villain={}; game.projectiles=[{}]; game.obstacles=[{x:700,y:0,width:50,height:100}];
  advanceTransformationCapsule(game,15,800,600); // Oversized test step misses this capsule.
  assert.equal(game.projectiles.length,1); assert.equal(game.obstacles.length,1);
  assert.equal(game.transformationDirector.capsule,null); assert.deepEqual(game.transformationDirector.bag,[]);
  assert.equal(game.transformationDirector.nextAt,game.transformationDirector.normalTime+12);
  advanceTransformationCapsule(game,12,800,600);
  advanceTransformationCapsule(game,0,800,600);
  game.transformationDirector.nextAt=game.transformationDirector.normalTime;
  advanceTransformationCapsule(game,0,800,600); assert.ok(game.transformationDirector.capsule);
});
test('every five collected capsules cover all five vehicles without a consecutive repeat across bags',()=>{
  const game=flight(), ids=[]; game.player.y=270;
  for(let index=0;index<20;index++) {
    game.transformationDirector.capsule={x:game.player.x+16,y:game.player.y,radius:29,age:0};
    assert.equal(advanceTransformationCapsule(game,0,800,600,()=>.4),true);
    ids.push(game.transformation.id); requestTransformationExit(game); advance(game,EXIT_SECONDS);
  }
  for(let i=0;i<ids.length;i+=5) assert.equal(new Set(ids.slice(i,i+5)).size,5);
  for(let i=1;i<ids.length;i++) assert.notEqual(ids[i],ids[i-1]);
});
test('entry and exit preserve the world, location and current speed; flight loop owns resources',()=>{
  const game=flight(); game.player.y=270; game.villain={health:30};
  const coin=new Collectible(400,270,250); game.collectibles=[coin]; game.projectiles=[{x:500}];
  assert.equal(beginTransformation(game,'drill',800,600),true); advance(game,ENTRY_SECONDS);
  const form=game.transformation; assert.equal(form.y,270); assert.equal(game.player.y,270);
  game.speed=750;
  assert.equal(game.transformation.remaining,12);
  const resources=()=>[game.health,game.energy,game.ammo,game.ammoTimer,game.healthPickupTimer,game.activePowerUps[0].remainingTime];
  const original=resources(); advance(game,12);
  assert.equal(game.transformation.phase,'EXITING'); assert.deepEqual(resources(),original);
  const distance=game.distance, exitY=form.y; const result=advance(game,EXIT_SECONDS,1/60,800,600,true);
  assert.equal(result.exits,1); assert.equal(game.transformation,null); assert.equal(game.distance,distance);
  assert.equal(game.player.velocity,0); assert.equal(game.player.isBoosting,true);
  assert.equal(game.hitProtection,1); assert.equal(game.transformationSafety,1);
  assert.equal(game.transformationDirector.nextAt,30); assert.equal(game.speed,750);
  assert.equal(game.player.y,exitY); assert.equal(game.collectibles[0],coin); assert.equal(game.projectiles.length,1); assert.equal(game.villain.health,30);
});
test('ordinary projectile or obstacle consumes only the vehicle, including timeout in the same frame',()=>{
  for(const kind of ['shot','wall']) {
    const game=active('sphere');
    if(kind==='shot') { const shot={}; assert.equal(takeProjectileHit(game,shot),false); assert.equal(shot.markedForDeletion,true); }
    else assert.equal(absorbTransformationHit(game),true);
    assert.equal(game.transformation.exitReason,'collision'); assert.equal(requestTransformationExit(game),false);
    assert.equal(advance(game,.5).exits,1); assert.equal(game.health,60); assert.equal(game.transformation,null);
    assert.equal(game.sessionCurrency,0);
  }
  const game=active('sphere'); advance(game,12); assert.equal(absorbTransformationHit(game),true);
  assert.equal(advance(game,.5).exits,1); assert.equal(game.health,60);
});
test('shield and hit protection retain their priority over consuming a vehicle',()=>{
  const game=active('sphere'); game.activePowerUps.push({type:'SHIELD'});
  takeProjectileHit(game,{}); assert.equal(game.transformation.phase,'ACTIVE');
  game.activePowerUps=[]; game.hitProtection=1; takeProjectileHit(game,{});
  assert.equal(game.transformation.phase,'ACTIVE');
});
test('normal pause/resume freezes vehicle and cooldown; new runs and revival clear all vehicle state',()=>{
  const game=active('striker'); transformationSecondary(game);
  pauseFlight(game); const snapshot=structuredClone(game.transformation);
  advance(game,20); assert.deepEqual(game.transformation,snapshot);
  resumeFlight(game); advance(game,2); assert.deepEqual(game.transformation,snapshot);
  assert.equal(takeFlightControl(game,true),true); advance(game,.1); assert.ok(game.transformation.cooldown<2.4);
  resetTransformations(game); assert.equal(game.transformation,null); assert.equal(game.transformationDirector.capsule,null);
  resetTransformations(game,true); assert.deepEqual(game.transformationDirector,createTransformationDirector());
});
test('Star Striker flies freely and launches exactly three parallel straight missiles without normal ammo',()=>{
  const game=active('striker'), form=game.transformation, origin=form.y;
  advance(game,.4,1/60,800,600,true); assert.ok(form.y<origin);
  advance(game,.5); assert.ok(form.vy>0);
  assert.equal(transformationSecondary(game),true); assert.equal(game.playerProjectiles.length,3);
  assert.equal(transformationSecondary(game),false); assert.equal(game.ammo,0);
  const missiles=game.playerProjectiles;
  assert.ok(missiles.every(shot=>shot.angle===0));
  const heights=missiles.map(shot=>shot.y);
  // Off-axis targets must not bend a missile's trajectory.
  game.villain={x:form.x+500,y:form.y-200,width:50,height:50};
  for(let i=0;i<10;i++)for(const shot of missiles)shot.update(1/60);
  assert.deepEqual(missiles.map(shot=>shot.y),heights);
  assert.ok(missiles.every(shot=>shot.angle===0)); game.villain=null;
  const target={x:form.x+220,y:form.y-25,width:40,height:50}; game.obstacles=[target];
  for(let i=0;i<100;i++)for(const missile of missiles)missile.update(1/60);
  assert.equal(target.markedForDeletion,true); assert.equal(game.sessionCurrency,0);
  advance(game,2.4); assert.equal(transformationSecondary(game),true);
});
test('straight missiles use the normal boss damage path, intercept hostile shots and expire',()=>{
  for(const dt of [1/30,1/60,.1]) {
    const game=active('striker'), form=game.transformation;
    game.villain={x:form.x+200,y:form.y-40,width:60,height:80,hp:100};
    transformationSecondary(game);
    const missile=game.playerProjectiles[1];
    for(let i=0;i<120;i++){missile.update(dt);if(missile.x+15>game.villain.x && missile.x<game.villain.x+60)break;}
    assert.equal(missile.markedForDeletion,false); assert.equal(game.villain.hp,100);
    assert.ok(missile.x+15>game.villain.x && missile.x<game.villain.x+60);
    assert.equal(missile.damage,18); // Shared collision handler consumes it and grants any reward.
    game.villain=null; game.projectiles=[{x:missile.x+25,y:missile.y,radius:8}];
    for(let i=0;i<30;i++)missile.update(dt);
    assert.equal(game.projectiles[0].markedForDeletion,true); assert.equal(missile.markedForDeletion,true);
    for(const shot of game.playerProjectiles.slice(1))for(let i=0;i<150;i++)shot.update(dt);
    assert.ok(game.playerProjectiles.slice(1).every(shot=>shot.markedForDeletion));
  }
});
test('Comet Drill rises on hold, glides on release and drills through ordinary hazards with a cooldown',()=>{
  const game=active('drill'), form=game.transformation, origin=form.y;
  advance(game,.35,1/60,800,600,true); assert.ok(form.y<origin); assert.ok(form.vy<0);
  advance(game,.5); assert.ok(form.vy>0);
  game.obstacles=[{x:form.x+60,y:form.y-15,width:30,height:30}];
  game.projectiles=[{x:form.x+45,y:form.y,radius:8}];
  assert.equal(transformationSecondary(game),true); assert.equal(transformationSecondary(game),false);
  assert.equal(game.obstacles[0].markedForDeletion,true); assert.equal(game.projectiles[0].markedForDeletion,true);
  advance(game,.25); assert.ok(form.x>form.baseX+80);
  assert.equal(absorbTransformationHit(game),true); assert.equal(form.phase,'ACTIVE');
  const shot={}; takeProjectileHit(game,shot); assert.equal(shot.markedForDeletion,true); assert.equal(game.health,60);
  advance(game,.31); assert.ok(Math.abs(form.x-form.baseX)<1e-6); assert.equal(form.dashRemaining,0);
  assert.equal(transformationSecondary(game),false); advance(game,2); assert.equal(transformationSecondary(game),true);
  assert.equal(game.ammo,0); assert.equal(game.sessionCurrency,0); assert.equal(game.distance,0);
});
test('sphere reverses gravity once per press and survives the floor and ceiling',()=>{
  const game=active('sphere'), form=game.transformation; form.nextAt=Infinity;
  advance(game,3); assert.equal(form.y,form.arena.bottom-22);
  const input=new FlightInput(held=>{if(held)transformationPrimary(game);});
  input.press('key:Space'); input.press('key:Space'); assert.equal(form.gravity,-1);
  advance(game,3); assert.equal(form.y,form.arena.top+22); assert.equal(game.health,60);
  input.release('key:Space'); input.press('pointer:1'); assert.equal(form.gravity,1);
  assert.equal(transformationSecondary(game),true); assert.equal(transformationSecondary(game),false);
});
test('special moves clear normal obstacles and hostile shots once without credits or ammo spending',()=>{
  for(const id of ['sphere']) {
    const game=active(id), form=game.transformation;
    game.obstacles=[{x:form.x+80,y:form.y,width:30,height:40},{x:1000,y:0,width:50,height:500}];
    game.projectiles=[{x:form.x+50,y:form.y,radius:8},{x:1000,y:0,radius:8}];
    const coin=new Collectible(form.x,form.y,250); game.collectibles=[coin];
    assert.equal(transformationSecondary(game),true); assert.equal(transformationSecondary(game),false);
    assert.equal(game.obstacles[0].markedForDeletion,true); assert.equal(game.projectiles[0].markedForDeletion,true);
    assert.equal(game.obstacles[1].markedForDeletion,undefined); assert.equal(game.projectiles[1].markedForDeletion,undefined);
    assert.equal(game.collectibles[0],coin); assert.equal(game.sessionCurrency,0); assert.equal(game.ammo,0);
    advance(game,1); assert.equal(game.sessionCurrency,0); assert.equal(game.distance,0);
  }
});
test('low and high frame rates advance the same time, distance and capsule schedule',()=>{
  for(const model of TRANSFORMATIONS) {
    const games=[1/30,1/60,.1].map(dt=>{const game=active(model.id);game.transformation.nextAt=Infinity;advance(game,3,dt);return game;});
    for(const game of games.slice(1)) {
      assert.ok(Math.abs(game.distance-games[0].distance)<.001,model.id);
      assert.ok(Math.abs(game.transformation.remaining-games[0].transformation.remaining)<.001,model.id);
      assert.ok(Math.abs(game.transformation.y-games[0].transformation.y)<.01,model.id);
    }
  }
});
test('resizing fits the vehicle without removing world objects or resetting duration',()=>{
  for(const model of TRANSFORMATIONS) for(const [width,height] of [[320,568],[575,878],[844,390],[1280,720]]) {
    const game=active(model.id), form=game.transformation; advance(game,.5);
    const obstacle={x:500,y:0,width:50,height:80}; game.obstacles=[obstacle]; game.collectibles=[new Collectible(500,300)];
    const remaining=form.remaining;resizeTransformation(game,width,height);
    assert.equal(form.remaining,remaining); assert.equal(game.obstacles[0],obstacle); assert.equal(game.collectibles.length,1);
    assert.ok(form.y>=form.arena.top && form.y<=form.arena.bottom); assert.equal(game.player.y,form.y);
    const box=transformationHitbox(game); assert.ok(box.w>0 && box.h>0); assert.equal(box.y+box.h/2,game.player.y);
  }
});
test('drill hitbox and enemy targeting follow actual dash position; pause freezes dash and cooldown',()=>{
  const game=active('drill'); transformationSecondary(game); advance(game,.2);
  const box=transformationHitbox(game); assert.equal(game.player.y,game.transformation.y);
  assert.equal(box.y+box.h/2,game.transformation.y); assert.equal(game.player.x+20,game.transformation.x);
  pauseFlight(game); const snapshot=structuredClone(game.transformation); advance(game,2);
  assert.deepEqual(game.transformation,snapshot);
});
test('sphere speed is bounded across viewports, reacts gently and brakes immediately when flipped',()=>{
  for(const [width,height] of [[320,568],[844,390],[1280,720]]) {
    const game=active('sphere',width,height), form=game.transformation, start=form.y;
    advance(game,.25,1/60,width,height);
    assert.ok(Math.abs(form.y-start)<form.arena.span*.04);
    advance(game,.4,1/60,width,height);
    assert.ok(Math.abs(form.vy)<=form.arena.span*.42);
    transformationPrimary(game); assert.equal(form.vy,0);
    const y=form.y; advance(game,.2,1/60,width,height);
    assert.ok(form.y<y); assert.ok(y-form.y<form.arena.span*.025);
  }
});
test('drill dash clears newly arriving hazards, fits narrow screens and resets on resize and restart',()=>{
  for(const [width,height] of [[320,568],[844,390],[1280,720]]) {
    const game=active('drill',width,height), form=game.transformation;
    transformationSecondary(game); advance(game,.15,1/60,width,height);
    game.obstacles=[{x:form.x+35,y:form.y-15,width:50,height:30}];
    advance(game,.03,1/60,width,height); assert.equal(game.obstacles[0].markedForDeletion,true);
    assert.ok(form.x+43<width); assert.equal(game.player.x+20,form.x);
    resizeTransformation(game,width+1,height); assert.equal(form.dashRemaining,0);
    resetTransformations(game); assert.equal(game.transformation,null);
  }
});

test('Volt Ray flaps on fresh presses and fires a straight damaging bolt with a cooldown',()=>{
  const game=active('volt'), form=game.transformation;
  const input=new FlightInput(held=>{if(held)transformationPrimary(game);});
  input.press('key:Space'); assert.ok(form.vy<0);
  advance(game,.2); const velocity=form.vy; input.press('pointer:1'); assert.equal(form.vy,velocity);
  input.release('key:Space');input.release('pointer:1');input.press('key:Space');assert.ok(form.vy<velocity);
  assert.equal(transformationSecondary(game),true);assert.equal(game.playerProjectiles.length,1);
  const bolt=game.playerProjectiles[0];assert.equal(bolt.type,'volt_bolt');assert.equal(bolt.damage,45);
  assert.equal(transformationSecondary(game),false);assert.equal(game.ammo,0);assert.equal(game.sessionCurrency,0);
  advance(game,2.2);assert.equal(transformationSecondary(game),true);assert.equal(game.playerProjectiles.length,2);
});
test('Volt bolt moves horizontally through obstacles and hostile shots without removing them or seeking',()=>{
  for(const [width,height] of [[320,568],[844,390],[1280,720]]) {
    const game=active('volt',width,height), form=game.transformation;
    const obstacle={x:form.x+60,y:form.y-30,width:30,height:60};
    const shot={x:form.x+100,y:form.y,radius:8};game.obstacles=[obstacle];game.projectiles=[shot];
    game.villain={x:width-90,y:form.y-150,width:80,height:60,hp:100};
    transformationSecondary(game);const bolt=game.playerProjectiles[0],startX=bolt.x,startY=bolt.y;
    for(let i=0;i<15;i++)bolt.update(1/60);
    assert.equal(bolt.y,startY);assert.ok(bolt.x>startX+200);
    assert.equal(obstacle.markedForDeletion,undefined);assert.equal(shot.markedForDeletion,undefined);
    assert.equal(game.villain.hp,100);assert.equal(game.sessionCurrency,0);
  }
});
test('Volt bolt reaches distant aligned enemies without skipping shared damage at different frame rates',()=>{
  for(const dt of [1/30,1/60,.1]) {
    const game=active('volt',1280,720), form=game.transformation;
    game.villain={x:1100,y:form.y-30,width:100,height:60,hp:100};
    transformationSecondary(game);const bolt=game.playerProjectiles[0];
    let hits=0;
    for(let i=0;i<200 && !bolt.markedForDeletion;i++){
      bolt.update(dt);
      const v=game.villain;
      if(bolt.x<v.x+v.width && bolt.x+15>v.x && bolt.y<v.y+v.height && bolt.y+4>v.y){
        bolt.markedForDeletion=true;v.hp-=bolt.damage;hits++;
      }
    }
    assert.equal(hits,1);assert.equal(game.villain.hp,55);
    assert.equal(game.sessionCurrency,0);
  }
});
test('missed Volt bolts expire and the transformation clock never advances their position while paused',()=>{
  const game=active('volt');transformationSecondary(game);const bolt=game.playerProjectiles[0],x=bolt.x;
  pauseFlight(game);advance(game,5);assert.equal(bolt.x,x);
  for(let i=0;i<150;i++)bolt.update(1/60);
  assert.equal(bolt.markedForDeletion,true);
});
test('Aegis barrier blocks collisions and incoming shots for two seconds and has a separate cooldown',()=>{
  const game=active('aegis'), form=game.transformation, origin=form.y;
  advance(game,.4,1/60,800,600,true); assert.ok(form.y<origin);
  advance(game,.5); assert.ok(form.vy>0);
  game.obstacles=[{x:form.x+35,y:form.y-10,width:50,height:20}];
  assert.equal(transformationSecondary(game),true); assert.equal(form.shieldRemaining,2);
  assert.equal(game.obstacles[0].markedForDeletion,true);
  assert.equal(absorbTransformationHit(game),true); assert.equal(form.phase,'ACTIVE');
  const shot={}; assert.equal(takeProjectileHit(game,shot),false); assert.equal(game.health,60);
  advance(game,1); pauseFlight(game); const remaining=form.shieldRemaining;
  advance(game,10); assert.equal(form.shieldRemaining,remaining);
  resumeFlight(game); takeFlightControl(game,true); advance(game,1);
  assert.equal(form.shieldRemaining,0); assert.equal(transformationSecondary(game),false);
  assert.equal(form.phase,'ACTIVE'); absorbTransformationHit(game); assert.equal(form.phase,'EXITING');
  advance(game,EXIT_SECONDS); assert.equal(game.transformation,null); assert.equal(game.health,60);
});
test('new abilities remain bounded at narrow and wide sizes and do not award credits or distance',()=>{
  for(const id of ['volt','aegis']) for(const [width,height] of [[320,568],[844,390],[1280,720]]) {
    const game=active(id,width,height), form=game.transformation;
    transformationPrimary(game); transformationSecondary(game);
    for(let i=0;i<40;i++)advance(game,.1,.1,width,height,i%2===0);
    assert.ok(form.y>=form.arena.top && form.y<=form.arena.bottom);
    assert.equal(game.player.y,form.y); assert.equal(game.sessionCurrency,0); assert.equal(game.distance,0);
    resetTransformations(game); assert.equal(game.transformation,null);
  }
});

globalThis.Path2D = class { constructor(d) { this.d=d; } };

class ArtContext {
  constructor(){ this.ops=[];this.stack=[];this.globalAlpha=.4;this.globalCompositeOperation='lighter';this.shadowBlur=9;this.lineWidth=7;this.lineCap='square';this.lineJoin='bevel';this.fillStyle='original-fill';this.strokeStyle='original-stroke';this.font='original-font';this.textAlign='left'; }
  save(){this.stack.push(Object.fromEntries(Object.entries(this).filter(([key])=>!['ops','stack'].includes(key))));}
  restore(){Object.assign(this,this.stack.pop());}
}
for(const name of ['beginPath','moveTo','lineTo','closePath','stroke','fill','translate','rotate','arc','fillRect','fillText','scale','quadraticCurveTo']) ArtContext.prototype[name]=function(...args){
  for(const arg of args) if(typeof arg==='number')assert.ok(Number.isFinite(arg));
  this.ops.push([name,...args]);
};
test('vehicle art stays bounded, distinct, read-only and restores canvas state for every cosmetic',()=>{
  const signatures=[];
  for(const model of TRANSFORMATIONS) for(const cosmetic of [null,...COSMETICS]) {
    const game=active(model.id), form=game.transformation;
    form.pulse=.2;form.trail=[{x:70,y:form.y,time:0},{x:90,y:form.y,time:.1}];
    const before=structuredClone(form), ctx=new ArtContext();
    const state=Object.fromEntries(Object.entries(ctx).filter(([key])=>!['ops','stack'].includes(key)));
    drawTransformationCapsule(ctx,{x:400,y:200,age:1});
    drawTransformationVehicle(ctx,form,cosmetic?.id);
    assert.ok(ctx.ops.length<500);assert.equal(ctx.stack.length,0);assert.deepEqual(structuredClone(form),before);
    for(const [key,value] of Object.entries(state))assert.equal(ctx[key],value,key);
    if(!cosmetic)signatures.push(JSON.stringify(ctx.ops));
    const low=new ArtContext();drawTransformationVehicle(low,form,cosmetic?.id,true,true);
    assert.ok(low.ops.length<ctx.ops.length);
  }
  assert.equal(new Set(signatures).size,5);
});
