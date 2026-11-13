export const INTRO_DURATION = 1800;
export const INTRO_EXIT_DURATION = 250;
export const REDUCED_INTRO_DURATION = 300;

// Lives above the account-keyed game. Subscriptions may restart in StrictMode,
// but the original deadline never moves and completion cannot be undone.
export function createStartupTimeline({ reducedMotion = false, now = Date.now,
  setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const duration = reducedMotion ? REDUCED_INTRO_DURATION : INTRO_DURATION;
  const fade = reducedMotion ? REDUCED_INTRO_DURATION : INTRO_EXIT_DURATION;
  let startedAt = null, deadline = null, timer = null, phase = 'intro';
  const listeners = new Set();
  const refresh = () => {
    clearTimer(timer); timer = null;
    if (startedAt === null) { startedAt = now(); deadline = startedAt + duration; }
    const time = now();
    const next = phase === 'done' || time >= deadline ? 'done' : time >= deadline - fade ? 'exit' : 'intro';
    if (next !== phase) { phase = next; for (const notify of listeners) notify(); }
    if (phase !== 'done' && listeners.size) timer = setTimer(refresh, Math.max(0, (phase === 'intro' ? deadline - fade : deadline) - time));
  };
  return {
    getSnapshot: () => phase,
    subscribe(notify) {
      listeners.add(notify); refresh();
      return () => { listeners.delete(notify); if (!listeners.size) { clearTimer(timer); timer = null; } };
    },
    skip() {
      if (phase !== 'intro') return;
      if (startedAt === null) { startedAt = now(); deadline = startedAt + duration; }
      deadline = Math.min(deadline, now() + fade); refresh();
    },
    refresh,
  };
}
