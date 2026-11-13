import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import '../src/components/ResponsiveFlight.css';
import HUD from '../src/components/HUD.jsx';
import { Renderer } from '../src/game/Renderer.js';
import { flightViewport, flightHomeX } from '../src/game/FlightViewport.js';
import { Player, Obstacle, Villain, SpeedsterVillain, JuggernautVillain, Collectible, Fuel, HealthPickup } from '../src/game/Entities.js';

// A read-only authored scene using the actual renderer, entities and HUD. No
// account, purchases or wallet is initialized by this development-only page.
export default function ResponsiveFlightPreview() {
  const canvas=useRef(null);
  const [viewport,setViewport]=useState(()=>flightViewport(innerWidth,innerHeight));
  useEffect(()=>{
    const resize=()=>setViewport(flightViewport(innerWidth,innerHeight));
    addEventListener('resize',resize);return()=>removeEventListener('resize',resize);
  },[]);
  useEffect(()=>{
    const renderer=new Renderer(canvas.current),w=viewport.width,h=viewport.height;
    renderer.resize(w,h,{displayScale:viewport.scale});
    const player=new Player();player.x=flightHomeX(w);player.y=h*.48;
    const enemies=[new Villain(w*.76,h*.24),new SpeedsterVillain(w*.88,h*.50),new JuggernautVillain(w*.73,h*.76)];
    const game={phase:'FLYING',viewport,player,enemies,shipType:'default',stageId:'milky_way',speed:650,distance:1250,
      obstacles:[new Obstacle(w*.39,0,50*viewport.paceScale,h*.20),new Obstacle(w*.57,h*.8,50*viewport.paceScale,h*.20)],
      collectibles:[new Collectible(w*.37,h*.46,250),new Collectible(w*.44,h*.49,100)],
      fuels:[new Fuel(w*.54,h*.30)],healthPickups:[new HealthPickup(w*.62,h*.55)],powerUps:[],projectiles:[],playerProjectiles:[],floatingTexts:[],activePowerUps:[],launch:{reducedMotion:true}};
    renderer.drawScene(game,0);
  },[viewport]);
  return <div className="game-shell"><div className="flight-stage" data-world-width={viewport.width} data-world-height={viewport.height}
    style={{left:viewport.left,top:viewport.top,width:viewport.displayWidth,height:viewport.displayHeight}}>
    <canvas ref={canvas} className="game-canvas" aria-label="Responsive flight scene"/>
    <HUD distance={1250} currency={25650} energy={72} ammo={8} maxAmmo={10} health={240} maxHealth={260} flightPhase="FLYING" activePowerUps={[]}
      onPause={()=>{}} onShoot={()=>{}} onBoostStart={()=>{}} onBoostEnd={()=>{}}/>
  </div></div>;
}
createRoot(document.getElementById('root')).render(<ResponsiveFlightPreview/>);
