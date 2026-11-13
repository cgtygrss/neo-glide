import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import AccountRuntime from '../account/AccountRuntime.jsx';
import { createStartupTimeline } from '../game/StartupTimeline.js';
import StartupIntro from './StartupIntro.jsx';

export default function StartupShell() {
  const [reducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [timeline] = useState(() => createStartupTimeline({ reducedMotion }));
  const phase = useSyncExternalStore(timeline.subscribe, timeline.getSnapshot);
  const content = useRef(null);
  const heldKeys = useRef(new Set());
  const complete = phase === 'done';
  useEffect(() => {
    const focusHome = () => { if (!document.hidden && timeline.getSnapshot() === 'done' && !heldKeys.current.size) content.current?.querySelector('.hangar-play')?.focus({ preventScroll: true }); };
    const refresh = () => { if (!document.hidden) { timeline.refresh(); focusHome(); } };
    const keyDown = event => {
      if (timeline.getSnapshot() !== 'done') {
        heldKeys.current.add(event.code);
        if (!['Enter', 'Space', 'Escape'].includes(event.code)) return;
        event.preventDefault(); event.stopImmediatePropagation(); timeline.skip();
      } else if (heldKeys.current.has(event.code)) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const keyUp = event => {
      if (!heldKeys.current.delete(event.code)) return;
      event.preventDefault(); event.stopImmediatePropagation(); focusHome();
    };
    const blur = () => heldKeys.current.clear();
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('keydown', keyDown, true);
    window.addEventListener('keyup', keyUp, true);
    window.addEventListener('blur', blur);
    return () => {
      document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh);
      window.removeEventListener('keydown', keyDown, true); window.removeEventListener('keyup', keyUp, true); window.removeEventListener('blur', blur);
    };
  }, [timeline]);
  useEffect(() => {
    if (complete && !document.hidden && !heldKeys.current.size) content.current?.querySelector('.hangar-play')?.focus({ preventScroll: true });
  }, [complete]);
  return <>
    <div ref={content} className="startup-content" inert={!complete} aria-hidden={!complete || undefined}><AccountRuntime startupComplete={complete}/></div>
    {!complete && <StartupIntro phase={phase} reducedMotion={reducedMotion} onSkip={timeline.skip}/>}
  </>;
}
