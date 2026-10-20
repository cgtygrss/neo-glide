import React, { useEffect, useRef, useState } from 'react';
import { Coins, Eye, Pause, Play } from 'lucide-react';
import { STAGES } from '../game/StageCatalog';
import { StageBackground } from '../game/StageBackground';
import { Renderer } from '../game/Renderer';

function StagePreview({ stage, compact = false }) {
  const canvas = useRef(null), elapsedRef = useRef(0), defaultRenderer = useRef(null);
  const [playing, setPlaying] = useState(() => !compact && !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  useEffect(() => {
    const ctx = canvas.current.getContext('2d'), art = new StageBackground();
    let frame = 0, previous = null;
    const draw = now => {
      if (document.hidden) { previous = null; return; }
      const delta = previous === null ? 0 : Math.min(.05, (now - previous) / 1000);
      elapsedRef.current += delta; previous = now;
      if (stage.id === 'default') {
        if (!defaultRenderer.current) defaultRenderer.current = new Renderer(canvas.current);
        defaultRenderer.current.drawBackground(90, delta);
      } else art.draw(ctx, stage.id, 520, 230, elapsedRef.current, elapsedRef.current * 90, compact);
      if (playing && !compact) frame = requestAnimationFrame(draw);
    };
    draw(performance.now());
    const visibility = () => { cancelAnimationFrame(frame); previous = null; if (!document.hidden) draw(performance.now()); };
    if (!compact) document.addEventListener('visibilitychange', visibility);
    return () => { cancelAnimationFrame(frame); if (!compact) document.removeEventListener('visibilitychange', visibility); };
  }, [stage.id, compact, playing]);
  return <div className="stage-preview"><canvas ref={canvas} width="520" height="230" aria-label={`${stage.name} galaxy preview`} role="img"/>{!compact && <button type="button" className="preview-play" aria-pressed={playing} onClick={() => setPlaying(value => !value)}>{playing ? <Pause size={14}/> : <Play size={14}/>} {playing ? 'Pause preview' : 'Play preview'}</button>}</div>;
}

export default function StageBrowser({ currency, equippedStage, ownership, onUnlock, onEquip }) {
  const [selectedId, setSelectedId] = useState(equippedStage);
  const spotlight = useRef(null);
  const [error, setError] = useState('');
  const selected = STAGES.find(stage => stage.id === selectedId) || STAGES[0];
  const owned = Boolean(ownership[selected.id]), active = selected.id === equippedStage;
  const choose = () => { try { if (owned) onEquip(selected.id); else onUnlock(selected.id); setError(''); } catch (e) { setError(e.message || 'Could not select this galaxy.'); } };
  return <div className="shop-item-browser stage-browser">
    <section ref={spotlight} className="shop-spotlight cosmetic-spotlight-layout" aria-label={`${selected.name} galaxy preview`}>
      <div className="shop-spotlight-stage stage-spotlight"><StagePreview key={selected.id} stage={selected}/></div>
      <div key={selected.id} className="shop-spotlight-details selection-reveal"><span className="eyebrow">GALAXY DESTINATION</span><h3>{selected.name}</h3><p>{selected.description}</p>
        <button type="button" className={`arcade-button ${active || (!owned && currency < selected.price) ? 'secondary' : 'primary'}`} disabled={active || (!owned && currency < selected.price)} onClick={choose}>{active ? 'Active galaxy' : owned ? 'Travel here' : <><span>Unlock galaxy</span><Coins size={15}/>{selected.price.toLocaleString()}</>}</button>
        <span className="shop-preview-note">Permanent on this device · preview any destination</span>{error && <p role="status">{error}</p>}
      </div>
    </section>
    <div className="shop-selection-heading"><span>Galaxy destinations</span><span>{STAGES.length} destinations</span></div>
    <div className="garage-grid">{STAGES.map(stage => <article className={`garage-card visual-garage-card ${stage.id === selected.id ? 'preview-selected' : ''}`} key={stage.id}>
      <div className="garage-card-top"><span className="garage-item-icon">✦</span><span className="item-level">{stage.id === equippedStage ? 'Active' : ownership[stage.id] ? 'Owned' : 'Locked'}</span></div>
      <button type="button" className="garage-preview-choice" aria-label={`Preview ${stage.name}`} aria-pressed={stage.id === selected.id} onClick={() => { setSelectedId(stage.id); setError(''); spotlight.current?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 'auto' : 'smooth', block: 'start' }); }}><StagePreview stage={stage} compact/><span><Eye size={13}/>Preview</span></button>
      <h3>{stage.name}</h3><p>{stage.price ? `${stage.price.toLocaleString()} credits` : 'Free'}</p>
    </article>)}</div>
  </div>;
}
