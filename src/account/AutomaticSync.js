export const SYNC_INTERVAL_MS = 60_000;

// Own this once, above the account-keyed game, so navigation and account
// remounts cannot create extra timers. Suspended apps catch up on return.
export function startAutomaticSync({ sync, window, document, navigator, interval = SYNC_INTERVAL_MS }) {
  let stopped = false;
  let running;
  const refresh = () => {
    if (stopped || document.hidden || navigator.onLine === false) return;
    if (!running) {
      running = Promise.resolve().then(() => { if (!stopped) return sync(); }).catch(() => {
        // Keep retrying after a failed startup or network request.
      }).finally(() => { running = null; });
    }
    return running;
  };
  const timer = window.setInterval(refresh, interval);
  window.addEventListener('online', refresh);
  document.addEventListener('visibilitychange', refresh);
  void refresh();
  return () => {
    stopped = true;
    window.clearInterval(timer);
    window.removeEventListener('online', refresh);
    document.removeEventListener('visibilitychange', refresh);
  };
}
