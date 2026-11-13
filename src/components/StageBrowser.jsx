import React, { useEffect, useRef, useState } from 'react';
import { Coins, Pause, Play } from 'lucide-react';
import { STAGES } from '../game/StageCatalog';
import { StageBackground } from '../game/StageBackground';
import CatalogCarousel from './CatalogCarousel';
import CatalogDetails from './CatalogDetails';
import { sortCatalogByPrice } from '../game/CatalogSorting';
import { resizeCanvas } from '../game/CanvasResolution';

const SORTED_STAGES = sortCatalogByPrice(STAGES);

function StagePreview({ stage, compact = false }) {
  const canvas = useRef(null), elapsedRef = useRef(0);
  const [art] = useState(() => new StageBackground());
  const [playing, setPlaying] = useState(() => !compact && !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  useEffect(() => () => art.reset(), [art]);
  useEffect(() => {
    const ctx = canvas.current.getContext('2d');
    let frame = 0, previous = null, width = 520, height = 230;
    const draw = now => {
      if (document.hidden) { previous = null; return; }
      const delta = previous === null ? 0 : Math.min(.05, (now - previous) / 1000);
      elapsedRef.current += delta; previous = now;
      art.draw(ctx, stage.id, width, height, elapsedRef.current, elapsedRef.current * 90, compact);
      if (playing && !compact) frame = requestAnimationFrame(draw);
    };
    const resize = () => {
      width = canvas.current.clientWidth; height = canvas.current.clientHeight;
      if (resizeCanvas(canvas.current, ctx, width, height).changed) art.reset();
      cancelAnimationFrame(frame); previous = null; draw(performance.now());
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas.current);
    window.addEventListener('resize', resize);
    resize();
    const visibility = () => { cancelAnimationFrame(frame); previous = null; if (!document.hidden) draw(performance.now()); };
    if (!compact) document.addEventListener('visibilitychange', visibility);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', resize); if (!compact) document.removeEventListener('visibilitychange', visibility); };
  }, [stage.id, compact, playing, art]);
  return <div className="stage-preview"><canvas ref={canvas} width="520" height="230" aria-label={`${stage.name} galaxy preview`} role="img"/>{!compact && <button type="button" className="preview-play" aria-pressed={playing} onClick={() => setPlaying(value => !value)}>{playing ? <Pause size={14}/> : <Play size={14}/>} {playing ? 'Pause preview' : 'Play preview'}</button>}</div>;
}

export default function StageBrowser({ currency, equippedStage, ownership, onUnlock, onEquip }) {
  const [selectedId, setSelectedId] = useState(equippedStage);
  const [error, setError] = useState('');
  const selected = STAGES.find(stage => stage.id === selectedId) || STAGES[0];
  const owned = Boolean(ownership[selected.id]), active = selected.id === equippedStage;
  const choose = () => { try { if (owned) onEquip(selected.id); else onUnlock(selected.id); setError(''); } catch (e) { setError(e.message || 'Could not select this galaxy.'); } };
  return <div className="shop-item-browser stage-browser">
    <CatalogCarousel items={SORTED_STAGES} selectedId={selected.id} onSelect={id => { setSelectedId(id); setError(''); }} label="Galaxies" itemLabel="galaxy">
    <section className="shop-spotlight cosmetic-spotlight-layout" aria-label={`${selected.name} galaxy preview`}>
      <div className="shop-spotlight-stage stage-spotlight"><StagePreview key={selected.id} stage={selected}/></div>
      <CatalogDetails key={selected.id} className="shop-spotlight-details selection-reveal" actions={
        <button type="button" className={`arcade-button ${active || (!owned && currency < selected.price) ? 'secondary' : 'primary'}`} disabled={active || (!owned && currency < selected.price)} onClick={choose}>{active ? 'Active galaxy' : owned ? 'Travel here' : <><span>Unlock galaxy</span><Coins size={15}/>{selected.price.toLocaleString()}</>}</button>
      }><span className="eyebrow">GALAXY DESTINATION</span><h3>{selected.name}</h3><p>{selected.description}</p>
        <span className="shop-preview-note">4 evolving regions · scenery changes as you fly<br/>Permanent on this device · preview any destination</span>{error && <p role="status">{error}</p>}
      </CatalogDetails>
    </section>
    </CatalogCarousel>
  </div>;
}
