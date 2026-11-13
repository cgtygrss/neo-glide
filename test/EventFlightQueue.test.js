import test from 'node:test';
import assert from 'node:assert/strict';
import { flushEventFlights } from '../src/services/EventFlightQueue.js';

function fixture(flights = [{ runId: 'run', seconds: 10 }]) {
  const data = new Map([['neo_glide_flights:pilot', JSON.stringify(flights)]]);
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  return { uid: 'pilot', storage, isCurrent: () => true, read: () => JSON.parse(data.get('neo_glide_flights:pilot')) };
}

test('concurrent flushes share one request and acknowledge delivered checkpoints', async () => {
  const f = fixture(); let calls = 0, release;
  const options = { ...f, send: () => { calls++; return new Promise(resolve => { release = resolve; }); } };
  const first = flushEventFlights(options), second = flushEventFlights(options);
  assert.equal(first, second);
  await Promise.resolve(); assert.equal(calls, 1);
  release(); await first; assert.deepEqual(f.read(), []);
});

test('acknowledging a checkpoint preserves newer progress from the same flight', async () => {
  const f = fixture();
  await flushEventFlights({ ...f, send: async () => {
    f.storage.setItem('neo_glide_flights:pilot', JSON.stringify([{ runId: 'run', seconds: 20 }, { runId: 'next', seconds: 2 }]));
  } });
  assert.deepEqual(f.read(), [{ runId: 'run', seconds: 20 }, { runId: 'next', seconds: 2 }]);
  await flushEventFlights({ ...f, send: async () => {} });
  assert.deepEqual(f.read(), []);
});

test('network errors retain checkpoints for automatic retry; expired leases do not block the queue', async () => {
  const f = fixture();
  await assert.rejects(flushEventFlights({ ...f, send: async () => { throw new Error('Network unavailable'); } }));
  assert.equal(f.read().length, 1);
  await flushEventFlights({ ...f, send: async () => { throw new Error('Offline authorization expired.'); } });
  assert.deepEqual(f.read(), []);
});

test('switching owners during upload never sends the old queue under the new account', async () => {
  const f = fixture([{ runId: 'one' }, { runId: 'two' }]); let current = true, calls = 0;
  await flushEventFlights({ ...f, isCurrent: () => current, send: async () => { calls++; current = false; } });
  assert.equal(calls, 1); assert.deepEqual(f.read(), [{ runId: 'two' }]);
});

 test('authentication failures preserve flight checkpoints for retry', async () => {
  for (const message of ['Firebase ID token has expired.', 'Invalid authorization signature.', 'Session expired.']) {
    const f = fixture();
    await assert.rejects(flushEventFlights({ ...f, send: async () => { throw new Error(message); } }), { message });
    assert.equal(f.read().length, 1);
  }
});
