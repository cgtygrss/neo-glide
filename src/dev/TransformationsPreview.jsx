import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import './TransformationsPreview.css';
import HUD from '../components/HUD';
import { Renderer } from '../game/Renderer';
import { SoundManager } from '../game/SoundManager';
import { loadSoundPreferences } from '../game/SoundPreferences';
import { SHIPS } from '../game/ShipCatalog';
import { COSMETICS } from '../game/CosmeticsCatalog';
import { Player, Obstacle, Collectible, JuggernautVillain } from '../game/Entities';
import { collectCoin } from '../game/CoinTrails';
import { takeProjectileHit } from '../game/PlayerHealth';
import { FlightInput } from '../game/FlightInput';
import { TRANSFORMATIONS, transformationEntryDuration, transformationEntryCues } from '../game/TransformationCatalog';
import { advanceTransformation, beginTransformation, transformationHud, transformationPrimary, transformationSecondary, transformationHitbox, absorbTransformationHit, resizeTransformation, requestTransformationExit } from '../game/Transformations';

// A separate Vite development entry; production builds include only index.html.
export default function Playground() {
  const canvas = useRef(null), scene = useRef(null), game = useRef(null), input = useRef(null);
  const audio = useRef(null), entrySnapshot = useRef(null);
  const [timeline, setTimeline] = useState(0), [entryDuration, setEntryDuration] = useState(transformationEntryDuration({reducedMotion:window.matchMedia('(prefers-reduced-motion: reduce)').matches})), [ship, setShip] = useState('default'), [cosmetic, setCosmetic] = useState('');
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [lowPower, setLowPower] = useState(false);
  const [hud, setHud] = useState(null), [paused, setPaused] = useState(false), [selected, setSelected] = useState('striker');
  const [stage, setStage] = useState('default'), [distance, setDistance] = useState(0), [credits, setCredits] = useState(0);
  const dimensions = () => ({ width: canvas.current.clientWidth, height: canvas.current.clientHeight });
  const start = id => {
    const { width, height } = dimensions();
    input.current?.reset();
    game.current = { phase:'FLYING', player:new Player(), speed:380, distance:0, health:100, energy:100, ammo:10, maxAmmo:10,
      shipType:ship, weaponType:'default', cosmeticId:cosmetic, stageId:stage, gameOver:false, sessionCurrency:0, combo:0,
      activePowerUps:[], obstacles:[], collectibles:[], fuels:[], healthPickups:[], powerUps:[], projectiles:[], playerProjectiles:[], floatingTexts:[],
      launch:{reducedMotion:reduced} };
    game.current.player.y=height*.45;
    beginTransformation(game.current,id,width,height);
    entrySnapshot.current=structuredClone(game.current.transformation);
    setTimeline(0);setEntryDuration(transformationEntryDuration(game.current.transformation));
    void audio.current?.unlock();
    if(id==='volt')game.current.villain=new JuggernautVillain(Math.max(180,width-125),height*.32);
    setSelected(id);setHud(transformationHud(game.current));setPaused(false);setDistance(0);setCredits(0);
  };
  useEffect(() => {
    scene.current = new Renderer(canvas.current);
    audio.current = new SoundManager(); audio.current.setPreferences(loadSoundPreferences());
    input.current = new FlightInput(held=>{if(!game.current)return;if(game.current.transformation){if(held)transformationPrimary(game.current);}else game.current.player.boost(held);});
    const resize=()=>{const size=dimensions();scene.current.resize(size.width,size.height);if(game.current)resizeTransformation(game.current,size.width,size.height);};
    resize();
    // The initial preview shares exactly the same vehicle state machine as flight.
    const size=dimensions();
    game.current={ phase:'FLYING', player:new Player(), speed:380, distance:0, health:100, energy:100, ammo:10, shipType:'default', stageId:'default',
      gameOver:false, sessionCurrency:0, combo:0, activePowerUps:[], obstacles:[], collectibles:[], fuels:[], healthPickups:[], powerUps:[], projectiles:[], playerProjectiles:[], floatingTexts:[],
      launch:{reducedMotion:window.matchMedia('(prefers-reduced-motion: reduce)').matches} };
    game.current.player.y=size.height*.45;
    beginTransformation(game.current,'striker',size.width,size.height);
    entrySnapshot.current=structuredClone(game.current.transformation);
    let frame, last=null, ui=0;
    const draw=now=>{
      const dt=last===null?0:Math.min(.1,(now-last)/1000);last=now;
      if(!document.hidden){
        const size=dimensions(), current=game.current;
        if(current.phase==='FLYING') {
          const result=advanceTransformation(current,dt,size.width,size.height,input.current.sources.size>0);
          current.worldTimeScale=dt>0?result.worldDelta/dt:1;
          for(const cue of result.cues)audio.current.playTransformationCue(current.transformation?.id,cue);
          const worldDt=result.worldDelta;
          current.transformationSafety=Math.max(0,(current.transformationSafety || 0)-worldDt);
          if(current.villain?.markedForDeletion)current.villain=null;
          if(current.villain)current.villain.hitFlashTimer=Math.max(0,current.villain.hitFlashTimer-worldDt);
          for(const label of current.floatingTexts)label.life-=worldDt;
          current.floatingTexts=current.floatingTexts.filter(label=>label.life>0);
          current.speed+=worldDt*10; current.distance+=current.speed*worldDt/10;
          if(!current.transformation){ current.player.update(worldDt); current.player.y=Math.max(30,Math.min(size.height-30,current.player.y)); }
          current.spawnClock=(current.spawnClock || 0)+worldDt;
          if(current.spawnClock>=.8){
            current.spawnClock=0;
            const y=size.height*.5;
            current.obstacles.push(new Obstacle(size.width, size.height-90,50,90));
            current.collectibles.push(new Collectible(size.width,y,100));
            current.projectiles.push({x:size.width,y,radius:8,markedForDeletion:false});
          }
          for(const item of [...current.obstacles,...current.collectibles])item.update(worldDt,current.speed);
          for(const shot of current.playerProjectiles)shot.update(worldDt);
          for(const shot of current.playerProjectiles){
            const enemy=current.villain;
            if(enemy && !enemy.markedForDeletion && !shot.markedForDeletion && shot.x<enemy.x+enemy.width && shot.x+15>enemy.x && shot.y<enemy.y+enemy.height && shot.y+4>enemy.y){
              shot.markedForDeletion=true;enemy.takeDamage(shot.damage || 10);
              current.floatingTexts.push({x:enemy.x,y:enemy.y,text:`-${shot.damage || 10} HP`,color:'#ffe58b',life:1});
            }
          }
          for(const shot of current.projectiles){shot.x-=current.speed*worldDt;if(shot.x<0)shot.markedForDeletion=true;}
          const rect=transformationHitbox(current);
          for(const obstacle of current.obstacles)if(!obstacle.markedForDeletion && rect.x<obstacle.x+obstacle.width && rect.x+rect.w>obstacle.x && rect.y<obstacle.y+obstacle.height && rect.y+rect.h>obstacle.y){obstacle.markedForDeletion=true;absorbTransformationHit(current);}
          for(const shot of current.projectiles)if(!shot.markedForDeletion && Math.hypot(shot.x-current.player.x,shot.y-current.player.y)<30)takeProjectileHit(current,shot);
          for(const coin of current.collectibles)if(!coin.markedForDeletion && Math.hypot(coin.x-current.player.x,coin.y-current.player.y)<40)collectCoin(current,coin,1);
          for(const key of ['obstacles','collectibles','projectiles','playerProjectiles'])current[key]=current[key].filter(item=>!item.markedForDeletion);
        }
        scene.current.drawScene(current,current.phase==='FLYING'?dt:0);
        ui+=dt;
        if(ui>=.05){ui=0;setHud(transformationHud(current));setDistance(current.distance);setCredits(current.sessionCurrency);setTimeline(current.transformation?.phase==='ENTERING'?current.transformation.transitionTime:transformationEntryDuration(entrySnapshot.current));}
      }
      frame=requestAnimationFrame(draw);
    };
    frame=requestAnimationFrame(draw);
    const keyDown=event=>{
      if(event.target.closest('select,input,button') || event.repeat)return;
      if(['Space','ArrowUp'].includes(event.code)){event.preventDefault();input.current.press(`key:${event.code}`);}
      if(['ShiftLeft','ShiftRight'].includes(event.code)){event.preventDefault();transformationSecondary(game.current);}
    };
    const keyUp=event=>input.current.release(`key:${event.code}`);
    const release=()=>input.current.reset();
    window.addEventListener('resize',resize);window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',release);
    return()=>{audio.current.cleanup();cancelAnimationFrame(frame);window.removeEventListener('resize',resize);window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',release);};
  },[]);
  const seek = value => {
    input.current.reset();
    const current=game.current;
    current.phase='PAUSED';
    current.transformation=structuredClone(entrySnapshot.current);
    current.transformation.transitionTime=value;
    current.transformation.cueIndex=transformationEntryCues(current.transformation).filter(([at])=>at<=value).length;
    const size=dimensions();resizeTransformation(current,size.width,size.height);
    current.player.x=current.transformation.x-20;current.player.y=current.transformation.y;
    setTimeline(value);setPaused(true);setHud(transformationHud(current));
    scene.current.drawScene(current,0);
  };
  const press=event=>{event.preventDefault();if(event.pointerId!==undefined)event.currentTarget.setPointerCapture(event.pointerId);input.current.press(event.pointerId!==undefined?`pointer:${event.pointerId}`:`key:${event.code}`);};
  const release=event=>input.current.release(event.pointerId!==undefined?`pointer:${event.pointerId}`:`key:${event.code}`);
  return <main className="vehicle-playground">
    <header><div><strong>NEO GLIDE · VEHICLE PLAYGROUND</strong><span>Local preview · your save and wallet are untouched</span></div>
      <nav aria-label="Preview vehicle">{TRANSFORMATIONS.map(model=><button key={model.id} onClick={()=>start(model.id)} aria-pressed={selected===model.id}>{model.name}</button>)}</nav>
      <label>Galaxy <select value={stage} onChange={event=>{setStage(event.target.value);game.current.stageId=event.target.value;}}><option value="default">Milky Way</option><option value="andromeda">Andromeda Dawn</option><option value="triangulum">Triangulum Frost</option><option value="centaurus_a">Centaurus Ember</option><option value="black_eye">Black Eye Eclipse</option></select></label>
      <div className="assembly-preview-controls">
        <button onClick={()=>start(selected)}>Replay assembly</button>
        <button onClick={()=>{input.current.reset();game.current.phase=paused?'FLYING':'PAUSED';setPaused(!paused);}}>{paused?'Resume preview':'Pause preview'}</button>
        <button onClick={()=>{requestTransformationExit(game.current);setHud(transformationHud(game.current));game.current.phase='FLYING';setPaused(false);}}>Disassemble</button>
        <button onClick={()=>{requestTransformationExit(game.current,'collision');setHud(transformationHud(game.current));game.current.phase='FLYING';setPaused(false);}}>Collision exit</button>
        <label>Timeline <input aria-label="Assembly timeline" type="range" min="0" max={entryDuration} step="0.01" value={timeline} onChange={event=>seek(Number(event.target.value))}/><output>{timeline.toFixed(2)}s</output></label>
        <label>Ship <select aria-label="Preview ship" value={ship} onChange={event=>{setShip(event.target.value);game.current.shipType=event.target.value;}}>{SHIPS.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Colors <select aria-label="Preview cosmetic" value={cosmetic} onChange={event=>{setCosmetic(event.target.value);game.current.cosmeticId=event.target.value;}}><option value="">Vehicle colors</option>{COSMETICS.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label><input type="checkbox" checked={reduced} onChange={event=>{setReduced(event.target.checked);game.current.launch.reducedMotion=event.target.checked;}}/> Reduced motion (next replay)</label>
        <label><input type="checkbox" checked={lowPower} onChange={event=>{setLowPower(event.target.checked);scene.current.lowPowerMode=event.target.checked;}}/> Low power</label>
      </div>
    </header>
    <section className="vehicle-playground-scene" aria-label="Vehicle preview">
      <canvas ref={canvas} aria-label="Vehicle playfield" onPointerDown={press} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}/>
      <HUD distance={distance} currency={credits} energy={100} ammo={10} maxAmmo={10} health={100} maxHealth={100} transformation={hud}
        flightPhase='FLYING' paused={paused} onBoostStart={press} onBoostEnd={release}
        onShoot={()=>transformationSecondary(game.current)} onPause={()=>{input.current.reset();game.current.phase=paused?'FLYING':'PAUSED';setPaused(!paused);}}/>
      {!hud && <p className="vehicle-playground-finished">Normal flight continues. Choose a vehicle above to retry its ability.</p>}
    </section>
  </main>;
}
if (import.meta.env.DEV) {
  const root = import.meta.hot?.data.root || createRoot(document.getElementById('root'));
  if (import.meta.hot) import.meta.hot.data.root = root;
  root.render(<Playground/>);
}
