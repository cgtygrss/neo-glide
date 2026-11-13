import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import '../src/App.css';
import '../src/components/ResponsiveFlight.css';
import HUD from '../src/components/HUD.jsx';
import BossStatus from '../src/components/BossStatus.jsx';
import { Renderer } from '../src/game/Renderer.js';
import { Player, Projectile, PlayerProjectile, Villain, SpeedsterVillain, JuggernautVillain } from '../src/game/Entities.js';
import { fitFlightViewport, flightViewport } from '../src/game/FlightViewport.js';
import { createEncounterDirector, advanceBossEncounter, bossHud, drainEncounterEvents } from '../src/game/BossEncounters.js';
import { resolveFriendlyHits, fireNormalWeapon, damageEnemy, advanceAmmoRecharge, drainCombatEvents } from '../src/game/Combat.js';
import { takeFlightControl, pauseFlight, resumeFlight } from '../src/game/FlightStart.js';

// Development-only fixture. It uses production rules/components, but authored
// pilot movement is explicitly not evidence of native human gameplay testing.
function makeGame(viewport, mode='forge', active=false) {
  const game={phase:'FLYING',viewport,player:new Player(),weaponType:'default',shipType:'default',stageId:'bode',
    speed:420,distance:0,health:100,maxHealth:100,energy:100,ammo:10,maxAmmo:10,ammoRegenTime:2,ammoTimer:0,
    obstacles:[],collectibles:[],fuels:[],healthPickups:[],powerUps:[],projectiles:[],playerProjectiles:[],enemies:[],
    activePowerUps:[],floatingTexts:[],launch:{reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches},flightTime:56.4};
  game.player.x=viewport.width*.12;game.player.y=195;
  game.encounter=createEncounterDirector();game.encounter.number=mode==='prism'?1:0;
  if(mode==='flight')game.flightTime=0;
  else { advanceBossEncounter(game); if(active){game.flightTime=60;advanceBossEncounter(game);} }
  return game;
}
export default function App() {
  const canvas=useRef(null),renderer=useRef(null),game=useRef(null);
  const [viewport,setViewport]=useState(()=>flightViewport(innerWidth,innerHeight));
  const [tools,setTools]=useState(true),[,refresh]=useState(0),[report,setReport]=useState(null);
  const lastUI=useRef(0), lastShot=useRef(0);
  const reset=mode=>{game.current=makeGame(viewport,mode);refresh(n=>n+1);};
  const arrivalStill=()=>{
    const id=game.current.encounter.arrival?.id||game.current.encounter.boss?.id||'forge';
    const g=makeGame(viewport,id);g.flightTime=58.8;advanceBossEncounter(g);pauseFlight(g);game.current=g;refresh(n=>n+1);
  };
  useEffect(()=>{const resize=()=>setViewport(flightViewport(innerWidth,innerHeight));addEventListener('resize',resize);return()=>removeEventListener('resize',resize);},[]);
  useEffect(()=>{
    renderer.current=new Renderer(canvas.current);
    renderer.current.resize(flightViewport(innerWidth,innerHeight).width,390,{displayScale:flightViewport(innerWidth,innerHeight).scale});
    const initial=flightViewport(innerWidth,innerHeight);
    game.current=makeGame(initial);let frame,last=performance.now();
    const tick=now=>{
      const dt=Math.max(0,Math.min(.05,(now-last)/1000));last=now;const g=game.current;
      if(g.phase==='FLYING') {
        g.flightTime+=dt;g.distance+=dt*g.speed/10;
        g.player.y=195+Math.sin(g.flightTime*.7)*48;
        advanceBossEncounter(g);
        advanceAmmoRecharge(g,dt);
        if(now-lastShot.current>450){fireNormalWeapon(g);lastShot.current=now;}
        for(const shot of g.projectiles)shot.update(dt,g.viewport);
        for(const shot of g.playerProjectiles)shot.update(dt,g.viewport);
        resolveFriendlyHits(g);
        g.projectiles=g.projectiles.filter(shot=>!shot.markedForDeletion);
        g.playerProjectiles=g.playerProjectiles.filter(shot=>!shot.markedForDeletion);
        for(const event of drainCombatEvents(g))g.floatingTexts.push({x:event.x,y:event.y,text:`+${event.reward.toLocaleString()} credits`,color:'#ffd369',life:1.2});
        for(const text of g.floatingTexts)text.life-=dt;
        g.floatingTexts=g.floatingTexts.filter(text=>text.life>0);drainEncounterEvents(g);
      }
      renderer.current.drawScene(g,dt);
      if(now-lastUI.current>100){refresh(n=>n+1);lastUI.current=now;}
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[]);
  useEffect(()=>{if(game.current&&renderer.current){fitFlightViewport(game.current,viewport);renderer.current.resize(viewport.width,390,{displayScale:viewport.scale});}},[viewport]);
  useEffect(()=>{const key=e=>{if(e.code==='KeyT')setTools(value=>!value);};addEventListener('keydown',key);return()=>removeEventListener('keydown',key);},[]);
  const boost=()=>{if(game.current.phase==='PAUSED')resumeFlight(game.current);takeFlightControl(game.current,true);refresh(n=>n+1);};
  const benchmark=async()=>{
    setReport({status:'Benchmark running…'});
    const {Renderer:Baseline}=await import('/@fs/tmp/neo-glide-130-baseline/src/game/Renderer.js');
    const active=game.current;pauseFlight(active);
    const sample=()=>{
      const g=makeGame({width:844,height:390,paceScale:1});g.encounter=createEncounterDirector();
      g.enemies=[new Villain(650,75),new SpeedsterVillain(700,155),new JuggernautVillain(680,260),new SpeedsterVillain(760,330)];
      g.projectiles=Array.from({length:28},(_,i)=>new Projectile(200+(i%7)*75,60+Math.floor(i/7)*75,-400,0));
      g.playerProjectiles=Array.from({length:96},(_,i)=>new PlayerProjectile(170+(i%12)*47,70+Math.floor(i/12)*32));
      return g;
    };
    const collect=(Type,scene)=>{
      const c=document.createElement('canvas'),r=new Type(c);r.resize(844,390,{pixelRatio:1});
      for(let i=0;i<100;i++)r.drawScene(scene,0);
      const values=[];
      for(let i=0;i<80;i++){const start=performance.now();for(let j=0;j<20;j++)r.drawScene(scene,0);values.push((performance.now()-start)/20);}
      values.sort((a,b)=>a-b);return{median:values[40],p95:values[76]};
    };
    const batches=[];
    for(let batch=0;batch<5;batch++) {
      await new Promise(resolve=>setTimeout(resolve,30));
      const scene=sample();
      const baseline=collect(Baseline,scene),current=collect(Renderer,scene);
      const boss=makeGame({width:844,height:390,paceScale:1},'forge',true);boss.encounter.boss.hp=100;advanceBossEncounter(boss);
      boss.projectiles=scene.projectiles.concat(Array.from({length:4},(_,i)=>new Projectile(450+i*30,100,-300,10)));
      boss.playerProjectiles=scene.playerProjectiles;
      batches.push({baseline,current,boss:collect(Renderer,boss)});
      setReport({status:`Completed ${batch+1}/5 batches`});
    }
    const median=key=>{const xs=batches.map(batch=>batch[key].median).sort((a,b)=>a-b);return xs[2];};
    const result={kind:'Browser Canvas CPU render duration; authored worst-case fixture, not native frame timing',resolution:'844x390 @1x',batches,
      baselineMedian:median('baseline'),currentMedian:median('current'),bossMedian:median('boss'),
      ordinaryRegressionPercent:(median('current')/median('baseline')-1)*100,bossRegressionPercent:(median('boss')/median('baseline')-1)*100};
    setReport(result);
  };
  const g=game.current;
  return <div className="game-shell"><div className="flight-stage" style={{left:viewport.left,top:viewport.top,width:viewport.displayWidth,height:viewport.displayHeight}}>
    <canvas ref={canvas} className="game-canvas" aria-label="Run build development replay"/>
    {g&&<><HUD distance={g.distance} currency={g.sessionCurrency||0} energy={100} ammo={g.ammo} maxAmmo={10} health={g.health} maxHealth={g.maxHealth} flightPhase={g.phase} paused={g.phase==='PAUSED'} activePowerUps={[]}
      onPause={()=>{pauseFlight(g);refresh(n=>n+1);}} onShoot={()=>fireNormalWeapon(g)} onBoostStart={boost} onBoostEnd={()=>{}}/>
    <BossStatus boss={bossHud(g)}/></>}
  </div>
  {tools&&<aside style={{position:'fixed',zIndex:30,right:10,top:'38%',padding:12,borderRadius:10,background:'#102332e8',color:'#fff',font:'12px sans-serif',maxWidth:320}} aria-label="Development controls">
    <p>Development replay · T hides tools</p>
    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{['forge','prism','flight'].map(mode=><button key={mode} onClick={()=>reset(mode)}>{mode}</button>)}
      <button onClick={()=>{const b=g.encounter.boss;if(b)damageEnemy(g,b,b.maxHp*.55);}}>Phase two</button>
      <button onClick={()=>{const b=g.encounter.boss;if(b)damageEnemy(g,b,b.maxHp);}}>Defeat boss</button>
      <button onClick={arrivalStill}>Arrival still</button>
      <button onClick={boost}>Resume flight</button><button onClick={benchmark}>Benchmark</button><button onClick={()=>setTools(false)}>Hide tools</button></div>
    <p role="status">{g?.phase} · {g?.flightTime.toFixed(2)}s · {g?.projectiles.length} hostile shots</p>
    {report&&<pre aria-label="Benchmark report" style={{maxHeight:150,overflow:'auto',fontSize:10,whiteSpace:'pre-wrap'}}>{JSON.stringify(report,null,2)}</pre>}
  </aside>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
