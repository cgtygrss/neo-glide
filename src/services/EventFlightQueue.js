const requests = new Map();

export function flushEventFlights({ uid, isCurrent, send, storage = localStorage }) {
  if (requests.has(uid)) return requests.get(uid);
  const request = Promise.resolve().then(async () => {
    const key = `neo_glide_flights:${uid}`;
    for (const flight of JSON.parse(storage.getItem(key) || '[]')) {
      if (!isCurrent()) return;
      try { await send(flight); }
      catch (error) {
        if (!/expired|authorization|period/.test(error.message)) throw error;
      }
      // A running/revived flight can persist a newer checkpoint while this
      // request is in flight. Only acknowledge the exact checkpoint we sent.
      const latest = JSON.parse(storage.getItem(key) || '[]');
      storage.setItem(key, JSON.stringify(latest.filter(item =>
        item.runId !== flight.runId || JSON.stringify(item) !== JSON.stringify(flight)
      )));
    }
  }).finally(() => { requests.delete(uid); });
  requests.set(uid, request);
  return request;
}
