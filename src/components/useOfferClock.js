import { useEffect, useState } from 'react';
import { nextGarageRefresh } from '../game/GarageOffers';

export default function useOfferClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    // Refresh at local midnight. Foreground events also catch timers throttled
    // while the app was backgrounded across a daily offer rollover.
    const current = Date.now();
    const timer = setTimeout(refresh, nextGarageRefresh(current) - current + 10);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh); };
  }, [now]);
  return now;
}
