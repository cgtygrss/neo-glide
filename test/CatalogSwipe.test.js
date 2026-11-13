import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogSwipeDirection, advanceCatalogWheel } from '../src/components/CatalogSwipe.js';

test('a deliberate horizontal swipe discovers one neighbor on phones and tablets', () => {
  for (const width of [240, 390, 844, 1100]) {
    assert.equal(catalogSwipeDirection({ x: 200, y: 100 }, { x: 80, y: 106 }, width), 1);
    assert.equal(catalogSwipeDirection({ x: 80, y: 106 }, { x: 200, y: 100 }, width), -1);
    assert.equal(catalogSwipeDirection({ x: 800, y: 100 }, { x: 10, y: 100 }, width), 1);
  }
});

test('a trackpad gesture advances once, consumes inertia and accepts the next gesture', () => {
  const state = {}, event = { deltaX: 30, deltaY: 2 };
  assert.equal(advanceCatalogWheel(state, event, 0, 600), 0);
  assert.equal(advanceCatalogWheel(state, event, 16, 600), 1);
  for (let time = 32; time < 160; time += 16) assert.equal(advanceCatalogWheel(state, event, time, 600), 0);
  assert.equal(advanceCatalogWheel(state, { deltaX: 80, deltaY: 1 }, 400, 600), 1);
  assert.equal(advanceCatalogWheel(state, { deltaX: -80, deltaY: 1 }, 420, 600), -1);
});

test('ordinary vertical wheel scrolling never selects another product', () => {
  const state = {};
  assert.equal(advanceCatalogWheel(state, { deltaX: 20, deltaY: 100 }, 0, 600), null);
  assert.deepEqual(state, {});
  assert.equal(advanceCatalogWheel(state, { deltaX: 4, deltaY: 0, deltaMode: 1 }, 100, 600), 1);
});

test('taps, hand jitter and vertical page scrolling do not switch the selected purchase', () => {
  const start = { x: 150, y: 100 };
  for (const end of [{ x: 150, y: 100 }, { x: 140, y: 102 }, { x: 115, y: 100 },
    { x: 80, y: 300 }, { x: 250, y: 200 }, { x: 220, y: 0 }]) {
    assert.equal(catalogSwipeDirection(start, end, 390), 0);
  }
});
