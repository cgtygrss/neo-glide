import { Capacitor, registerPlugin } from '@capacitor/core';

const nativeAudio = registerPlugin('NeoGlideAudio');

// Capture before ad loading: the SDK may change AVAudioSession even before
// presenting video. Recovery never changes the ad result or grants a reward.
export function createAdAudioRecovery({ capture = async () => {}, restore = async () => {},
  isForeground = () => true, schedule = setTimeout, cancel = clearTimeout } = {}) {
  const listeners = new Set(), timers = new Set();
  let depth = 0, epoch = 0, ready, active = false, hadAd = false, disposed = false;
  const clear = () => { for (const timer of timers) cancel(timer); timers.clear(); };
  const notify = event => {
    for (const listener of listeners) {
      try { Promise.resolve(listener(event)).catch(() => {}); } catch { /* Audio must not interrupt the ad result. */ }
    }
  };
  const recover = () => {
    if (disposed || depth || !hadAd) return;
    clear();
    const token = ++epoch;
    const attempt = async reset => {
      if (disposed || depth || token !== epoch || !isForeground()) return;
      let result;
      try { result = await restore(); } catch { /* Web Audio can still recover when the native bridge is unavailable. */ }
      if (disposed || depth || token !== epoch || !isForeground() || result?.restored === false) return;
      active = false;
      notify({ active: false, reset });
    };
    void attempt(true);
    // Some SDKs release their audio session just after dismissal. Bounded
    // retries reclaim the saved category without endlessly polling the SDK.
    for (const delay of [250, 1000]) {
      const timer = schedule(() => { timers.delete(timer); void attempt(delay === 250); }, delay);
      timers.add(timer);
    }
  };
  return {
    subscribe(listener) {
      listeners.add(listener);
      if (active) { try { Promise.resolve(listener({ active: true })).catch(() => {}); } catch { /* Isolate listeners. */ } }
      return () => listeners.delete(listener);
    },
    async run(action) {
      if (disposed) return action();
      clear(); ++epoch; depth++; hadAd = true;
      if (depth === 1) {
        ready = Promise.resolve().then(capture).catch(() => {});
      }
      try {
        await ready;
        if (!disposed && !active) { active = true; notify({ active: true }); }
        return await action();
      } finally {
        depth--;
        if (!depth) recover();
      }
    },
    foreground: recover,
    dispose() { disposed = true; ++epoch; clear(); listeners.clear(); },
  };
}

const isIOS = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
let nativeReleaseListener;
const recovery = createAdAudioRecovery({
  capture: async () => {
    if (!isIOS()) return;
    // The SDK can release audio after the dismissal callback and retry window.
    // Its real release signal retries recovery, but never while an ad is open.
    nativeReleaseListener ??= nativeAudio.addListener('audioReleased', () => recovery.foreground())
      .catch(() => { nativeReleaseListener = undefined; });
    await nativeReleaseListener;
    return nativeAudio.captureForAd();
  },
  restore: () => isIOS() ? nativeAudio.restoreAfterAd() : undefined,
  isForeground: () => typeof document === 'undefined' || !document.hidden,
});
export const withAdAudioRecovery = action => recovery.run(action);
export const subscribeAdAudio = listener => recovery.subscribe(listener);
export const recoverAdAudioOnForeground = () => recovery.foreground();
if (import.meta.hot) import.meta.hot.dispose(() => {
  recovery.dispose();
  void nativeReleaseListener?.then(handle => handle?.remove()).catch(() => {});
});
