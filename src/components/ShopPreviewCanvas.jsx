import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { ShopPreviewScene, PREVIEW_WIDTH, PREVIEW_HEIGHT } from '../game/ShopPreviewScene';

export default function ShopPreviewCanvas({ kind, itemId, ship = 'default', cosmeticId = '', upgrades = {}, pilotLevel = 1, compact = false, className = '' }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const [playing, setPlaying] = useState(() => ['ship', 'cosmetic'].includes(kind) && !compact && typeof window !== 'undefined' && !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  const elapsedRef = useRef(0);
  const [boostPreview, setBoostPreview] = useState(true);
  useEffect(() => {
    const canvas = canvasRef.current;
    const scene = new ShopPreviewScene(canvas);
    sceneRef.current = scene;
    return () => { sceneRef.current = null; };
  }, []);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    let frame = null, last = null, active = true;
    const options = { kind, itemId, ship, cosmeticId, upgrades, pilotLevel, cosmeticBoost: boostPreview };
    const draw = now => {
      if(!active || document.hidden) return;
      if(last !== null) elapsedRef.current += Math.min(.05,(now-last)/1000);
      last=now;scene.draw(options,elapsedRef.current,playing && !compact);
      if(playing && !compact) frame=requestAnimationFrame(draw);
    };
    const resize = () => {
      const canvas = canvasRef.current;
      // object-fit: contain displays the authored 520×230 scene at this scale.
      const displayScale = Math.min(canvas.clientWidth / PREVIEW_WIDTH, canvas.clientHeight / PREVIEW_HEIGHT);
      scene.resize({ displayScale });
      if (frame !== null) cancelAnimationFrame(frame);
      last = null;
      draw(performance.now());
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvasRef.current);
    window.addEventListener('resize', resize);
    resize();
    const onVisibility = () => {
      if(document.hidden) { if(frame!==null)cancelAnimationFrame(frame);setPlaying(false); }
      else scene.draw(options,elapsedRef.current,false);
    };
    document.addEventListener('visibilitychange',onVisibility);
    return () => { active=false;if(frame!==null)cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',onVisibility); };
  }, [kind,itemId,ship,cosmeticId,upgrades,pilotLevel,playing,compact,boostPreview]);
  return <div className={`shop-preview ${compact ? 'shop-preview-compact' : ''} ${className}`}>
    <canvas ref={canvasRef} width={PREVIEW_WIDTH} height={PREVIEW_HEIGHT} role="img" aria-label={`${itemId.replaceAll('_',' ')} ${kind} preview`}/>
    {kind === 'cosmetic' && !compact && <div className="cosmetic-engine-switch" role="group" aria-label="Preview engine state"><button type="button" aria-pressed={!boostPreview} onClick={() => setBoostPreview(false)}>Glide</button><button type="button" aria-pressed={boostPreview} onClick={() => setBoostPreview(true)}>Boost</button></div>}
    {!compact && <button type="button" className={`preview-play ${kind === 'ship' ? 'flight-preview-control' : ''}`} aria-pressed={playing} onClick={()=>setPlaying(value=>!value)}>{playing?<Pause size={14}/>:<Play size={14}/>} {kind === 'ship' ? (playing ? 'Pause flight' : 'Watch flight') : (playing?'Pause preview':'Play preview')}</button>}
  </div>;
}
