import { useEffect } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { ErrorBoundary } from '../ErrorBoundary.jsx';
import AudienceShell from '../privacy/AudienceShell.jsx';

const nativeStartup = registerPlugin('NeoGlideStartup');

export default function AppRoot() {
  // Outside ErrorBoundary so a render error also reveals its existing fallback.
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'ios') return;
    let secondFrame;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => { void nativeStartup.ready().catch(() => {}); });
    });
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); };
  }, []);
  return <ErrorBoundary><AudienceShell /></ErrorBoundary>;
}
