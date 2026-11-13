import test from 'node:test';
import assert from 'node:assert/strict';
import { flightViewport, flightHomeX, flightScrollSpeed, fitFlightViewport } from '../src/game/FlightViewport.js';
import { advanceHazardSpawns, advanceFlightPace, enemyShotSpeed } from '../src/game/FlightDifficulty.js';
import { Player, PlayerProjectile, Projectile, Villain } from '../src/game/Entities.js';
import { prepareLaunch, advanceFlightStart } from '../src/game/FlightStart.js';
import { advanceCoinTrails, createCoinTrailState } from '../src/game/CoinTrails.js';
import { touchesObstacle } from '../src/game/ObstacleCollision.js';
import { canvasResolution, MAX_CANVAS_PIXELS } from '../src/game/CanvasResolution.js';

const screens = [[844,390], [932,430], [1920,1080], [1024,768], [1366,1024], [3840,1080], [390,844], [320,240]];
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-7, `${a} != ${b}`);
function flight(viewport) {
  const game = { viewport, phase:'FLYING', player:new Player(), shipType:'default', obstacles:[], enemies:[], projectiles:[], distance:0, flightTime:0, obstacleSpawnTimer:0, enemySpawnTimer:20 };
  game.player.x=flightHomeX(viewport.width); game.player.y=195;
  return game;
}

test('phone, tablet, portrait and ultrawide fit one undistorted world with bounded field of view',()=>{
  for(const [w,h] of screens) {
    const v=flightViewport(w,h);
    assert.ok(v.width>=520-1e-7 && v.width<=936+1e-7);
    close(v.height,390); close(v.width*v.scale,v.displayWidth); close(v.height*v.scale,v.displayHeight);
    close(v.left*2+v.displayWidth,w); close(v.top*2+v.displayHeight,h);
    assert.ok(v.left>=0 && v.top>=0);
    close(40*v.scale/v.displayHeight,40/390);
    for(const pixelRatio of [1,2,3]) {
      const bitmap=canvasResolution(v.width,v.height,{displayScale:v.scale,pixelRatio});
      assert.ok(bitmap.pixelWidth*bitmap.pixelHeight<=MAX_CANVAS_PIXELS);
    }
  }
});

test('walls occupy equal screen fractions and take equal time to reach the player',()=>{
  const results=screens.map(([w,h])=>{
    const v=flightViewport(w,h),game=flight(v);
    advanceHazardSpawns(game,.01,v.width,v.height,()=>.75);
    const wall=game.obstacles[0];
    const result=[wall.height/v.height,wall.width/v.width,(wall.x-game.player.x)/flightScrollSpeed({...game,speed:520})];
    wall.x=game.player.x;wall.y=game.player.y-10;
    assert.equal(touchesObstacle(game,wall),true);
    wall.y=0;assert.equal(touchesObstacle(game,wall),false);
    return result;
  });
  for(const row of results) row.forEach((n,i)=>close(n,results[0][i]));
});

test('vertical control and flight rewards do not become slower or more generous on a large display',()=>{
  const results=screens.map(([w,h])=>{
    const game=flight(flightViewport(w,h)); prepareLaunch(game,game.viewport.height,true);
    for(let i=0;i<16;i++)advanceFlightStart(game,1/60,true);
    for(let i=0;i<10;i++){game.player.update(1/60);advanceFlightPace(game,1/60);}
    return [game.player.y,game.player.velocity,game.distance,game.speed,game.player.x/game.viewport.width];
  });
  for(const row of results)row.forEach((n,i)=>close(n,results[0][i]));
});

test('projectiles and enemies use logical bounds rather than the browser dimensions',()=>{
  const arena=flightViewport(1024,768);
  const shot=new PlayerProjectile(arena.width-2,200);
  shot.update(.1,arena);assert.equal(shot.markedForDeletion,true);
  const hostile=new Projectile(300,400,0,0);
  hostile.update(.01,arena);assert.equal(hostile.markedForDeletion,true);
  const enemy=new Villain(arena.width,195);
  for(let i=0;i<300;i++)enemy.update(1/60,195,[],[],arena);
  assert.equal(enemy.state,'ATTACKING');
  assert.ok(Math.abs(enemy.x-Math.max(arena.width-150,arena.width*.8))<10);
});

test('late bullet reaction time is preserved across tablet and desktop aspects',()=>{
  const times=screens.map(([w,h])=>{
    const game=flight(flightViewport(w,h));game.flightTime=240;
    const enemy={x:game.viewport.width*.8};
    return (enemy.x-game.player.x-50*game.viewport.paceScale)/enemyShotSpeed(game,enemy);
  });
  times.forEach(t=>close(t,times[0]));
});

test('aspect changes preserve live hazards, locked aim, form and rewards without sweeping through a resize',()=>{
  const before=flightViewport(844,390),next=flightViewport(1024,768),game=flight(before),r=next.width/before.width;
  game.obstacles=[{x:700,previousX:710,y:0,width:50,height:80}];
  game.enemies=[{x:650,y:180,scoutAim:{targetX:120,targetY:190,locked:true}}];
  game.projectiles=[{x:400,previousX:410,y:200,endX:0,vx:-500}];
  game.playerProjectiles=[{x:150,y:200,type:'volt_bolt',width:844,speed:900}];
  game.transformationDirector={normalTime:80,capsule:{x:800,y:140}};
  game.transformation={x:112,y:180,baseX:112,remaining:7,trail:[{x:90,y:180}]};
  game.distance=123;game.previousObstacleBounds={x:100};game.previousProjectileBounds={x:100};
  assert.equal(fitFlightViewport(game,next),true);
  close(game.obstacles[0].x,700*r);close(game.obstacles[0].width,50*r);assert.equal(game.obstacles[0].height,80);
  close(game.enemies[0].scoutAim.targetX,120*r);assert.equal(game.enemies[0].scoutAim.locked,true);
  close(game.projectiles[0].vx,-500*r);assert.equal(game.playerProjectiles[0].width,next.width);
  assert.equal(game.transformation.remaining,7);assert.equal(game.transformationDirector.normalTime,80);
  assert.equal(game.distance,123);assert.equal(game.previousObstacleBounds,null);assert.equal(game.previousProjectileBounds,null);
  assert.equal(fitFlightViewport(game,flightViewport(2048,1536)),false);
});

test('coin schedules and values stay identical when only the display aspect changes',()=>{
  const totals=screens.map(([w,h])=>{
    const v=flightViewport(w,h),state=createCoinTrailState();let count=0,total=0;
    for(let i=0;i<6000;i++)for(const coin of advanceCoinTrails(state,520/60,v.width,v.height,[],v.paceScale)){count++;total+=coin.value;}
    return [count,total,state.index];
  });
  for(const total of totals)assert.deepEqual(total,totals[0]);
});
