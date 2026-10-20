import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { ShopPreviewScene, PREVIEW_WIDTH, PREVIEW_HEIGHT } from '../game/ShopPreviewScene';

export default function ShopPreviewCanvas({ kind, itemId, ship = 'default', cosmeticId = '', upgrades = {}, pilotLevel = 1, compact = false, className = '' }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const [playing, setPlaying] = useState(() => ['ship', 'cosmetic'].includes(kind) && !compact && typeof window !== 'undefined' && !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  const elapsedRef = useRef(0);
  const level = upgrades[itemId] || 0;
  const hullLevel = upgrades.hull || 1;
  const thrusterLevel = upgrades.thruster || 1;
  useEffect(() => {
    const canvas = canvasRef.current;
    const scene = new ShopPreviewScene(canvas, { pixelRatio: Math.min(2, window.devicePixelRatio || 1) });
    sceneRef.current = scene;
    return () => { sceneRef.current = null; };
  }, []);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    let frame = null, last = null, active = true;
    const options = { kind, itemId, ship, cosmeticId, upgrades: { [itemId]: level, hull: hullLevel, thruster: thrusterLevel }, pilotLevel };
    const draw = now => {
      if(!active || document.hidden) return;
      if(last !== null) elapsedRef.current += Math.min(.05,(now-last)/1000);
      last=now;scene.draw(options,elapsedRef.current,playing && !compact);
      if(playing && !compact) frame=requestAnimationFrame(draw);
    };
    draw(performance.now());
    const onVisibility = () => {
      if(document.hidden) { if(frame!==null)cancelAnimationFrame(frame);setPlaying(false); }
      else scene.draw(options,elapsedRef.current,false);
    };
    document.addEventListener('visibilitychange',onVisibility);
    return () => { active=false;if(frame!==null)cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',onVisibility); };
  }, [kind,itemId,ship,cosmeticId,level,hullLevel,thrusterLevel,pilotLevel,playing,compact]);
  return <div className={`shop-preview ${compact ? 'shop-preview-compact' : ''} ${className}`}>
    <canvas ref={canvasRef} width={PREVIEW_WIDTH} height={PREVIEW_HEIGHT} role="img" aria-label={`${itemId.replaceAll('_',' ')} ${kind} preview`}/>
    {!compact && <button type="button" className={`preview-play ${kind === 'ship' ? 'flight-preview-control' : ''}`} aria-pressed={playing} onClick={()=>setPlaying(value=>!value)}>{playing?<Pause size={14}/>:<Play size={14}/>} {kind === 'ship' ? (playing ? 'Pause flight' : 'Watch flight') : (playing?'Pause preview':'Play preview')}</button>}
  </div>;
}
