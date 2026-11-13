import test from 'node:test';
import assert from 'node:assert/strict';
import { drawBossArt, drawBossWarnings, drawBossArrival } from '../src/game/BossArt.js';
import { BOSSES, EncounterBoss, createEncounterDirector, advanceBossEncounter } from '../src/game/BossEncounters.js';
import { GameLoop } from '../src/game/GameLoop.js';

test('both boss silhouettes and drones stay bounded, opaque, cached and read-only', () => {
  const originalPath = globalThis.Path2D;
  const paths = [];
  globalThis.Path2D = class { constructor(data) { this.data=data;paths.push(data); } };
  try {
    const state = {globalAlpha:.2,globalCompositeOperation:'lighter',shadowBlur:14}, stack=[];
    const context = new Proxy(state,{get(target,key){
      if(key==='save')return()=>stack.push({...target});
      if(key==='restore')return()=>Object.assign(target,stack.pop());
      if(key==='fill')return()=>{assert.equal(target.globalAlpha,1);assert.equal(target.globalCompositeOperation,'source-over');assert.equal(target.shadowBlur,0);};
      return key in target?target[key]:()=>{};
    }});
    const signatures=[];
    for(const model of BOSSES) {
      const boss=new EncounterBoss(model,0,60,844,390), before=structuredClone(boss), start=paths.length;
      drawBossArt(context,boss);assert.deepEqual({...boss},before);
      const own=paths.slice(start);signatures.push(own.join(''));
      for(const data of own) {
        const coords=data.match(/-?\d*\.?\d+/g).map(Number);
        for(let i=0;i<coords.length;i+=2){assert.ok(Math.abs(coords[i])<=model.width/2);assert.ok(Math.abs(coords[i+1])<=model.height/2);}
      }
      const warm=paths.length;
      for(let i=0;i<120;i++)drawBossArt(context,{...boss,stage:2,attackCount:i},{reducedMotion:i%2===0});
      assert.equal(paths.length,warm);
    }
    assert.notEqual(signatures[0],signatures[1]);
    drawBossArt(context,{isBossDrone:true,width:30,height:24});
    assert.equal(stack.length,0);assert.equal(context.globalAlpha,.2);assert.equal(context.shadowBlur,14);
  } finally {globalThis.Path2D=originalPath;}
});

test('boss warning rendering leaves the encounter unchanged',()=>{
  const ctx=new Proxy({},{get(){return()=>{};}});
  const game={encounter:{boss:{x:675,y:195,width:156,warning:{targetX:120,targetY:180,safeY:300,safeHalf:32,kind:'fan'}}}};
  const before=structuredClone(game);drawBossWarnings(ctx,game);assert.deepEqual(game,before);
});

test('arrival renderers remain bounded, cached and read-only through pause, resize and reduced motion',t=>{
  const previous=globalThis.Path2D,paths=[];
  globalThis.Path2D=class{constructor(d){paths.push(d);}};t.after(()=>{globalThis.Path2D=previous;});
  for(const width of [650,1380])for(const number of [0,1])for(const reducedMotion of [false,true]) {
    const game={phase:'FLYING',flightTime:56.4,viewport:{width,height:390},enemies:[],encounter:createEncounterDirector()};
    game.encounter.number=number;advanceBossEncounter(game);
    const state={globalAlpha:.2,globalCompositeOperation:'lighter',shadowBlur:13},stack=[],operations=[];
    const ctx=new Proxy(state,{get(target,key){
      if(key==='save')return()=>stack.push({...target});
      if(key==='restore')return()=>Object.assign(target,stack.pop());
      return key in target?target[key]:(...args)=>{assert.ok(args.filter(x=>typeof x==='number').every(Number.isFinite));operations.push([key,...args]);};
    }});
    for(const at of [56.4,57.6,58.2,58.8,59.9]) {
      game.flightTime=at;const before=structuredClone(game);
      drawBossArrival(ctx,game,{reducedMotion});assert.deepEqual(game,before);
      assert.ok(operations.length<600);operations.length=0;
      assert.equal(stack.length,0);assert.equal(state.globalAlpha,.2);assert.equal(state.shadowBlur,13);
    }
    const warm=paths.length;for(let i=0;i<120;i++)drawBossArrival(ctx,game,{reducedMotion,lowPower:true});
    assert.equal(paths.length,warm);
    if(reducedMotion)assert.equal(operations.filter(op=>op[0]==='rotate'&&op[1]!==0).length,0);
  }
});

test('stopping from an update leaves no extra RAF to duplicate a resumed loop',t=>{
  const prior={raf:globalThis.requestAnimationFrame,caf:globalThis.cancelAnimationFrame,document:globalThis.document};
  t.after(()=>Object.assign(globalThis,{requestAnimationFrame:prior.raf,cancelAnimationFrame:prior.caf,document:prior.document}));
  const pending=new Map();let id=0,draws=0;
  globalThis.document={hidden:false};globalThis.requestAnimationFrame=callback=>{pending.set(++id,callback);return id;};
  globalThis.cancelAnimationFrame=key=>pending.delete(key);
  const loop=new GameLoop(()=>loop.stop(),()=>draws++);loop.start();
  const callback=pending.get(id);pending.delete(id);callback(loop.lastTime+17);
  assert.equal(draws,1);assert.equal(pending.size,0);assert.equal(loop.isRunning,false);
  loop.start();assert.equal(pending.size,1);loop.stop();assert.equal(pending.size,0);
});
