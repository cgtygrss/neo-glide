import './StartupIntro.css';

export default function StartupIntro({ phase, reducedMotion, onSkip }) {
  return <section className={`startup-screen ${reducedMotion ? 'startup-reduced' : ''} ${phase === 'exit' ? 'startup-exit' : ''}`} aria-label="Neo Glide opening">
    <button type="button" className="startup-surface" aria-label="Skip intro" autoFocus onClick={event => { event.stopPropagation(); onSkip(); }}
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onSkip(); } }}>
      <div className="startup-mark" aria-hidden="true">
        <img className="startup-base" src="/brand/neo-glide-mark.svg" alt="" width="120" height="97"/>
        <svg className="startup-orbit" viewBox="0 0 52 42"><ellipse cx="25" cy="21" rx="22" ry="10" fill="none" stroke="#79ddd4" strokeWidth="2" transform="rotate(-25 25 21)" pathLength="100"/></svg>
        <svg className="startup-ship" viewBox="0 0 52 42"><path d="M8 26 42 8 30 28 24 24 19 32 19 23Z" fill="#d6fff4" stroke="#78cfc8" strokeWidth="1.5"/><circle cx="43" cy="22" r="2" fill="#f3d895"/></svg>
      </div>
      <span className="startup-wordmark" aria-hidden="true">NEO <span>GLIDE</span></span>
      <span className="startup-skip-hint" aria-hidden="true">Tap to skip <span>↗</span></span>
    </button>
  </section>;
}
