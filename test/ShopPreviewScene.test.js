import test from 'node:test';
import assert from 'node:assert/strict';
import { COSMETICS } from '../src/game/CosmeticsCatalog.js';
import { SHIPS } from '../src/game/ShipCatalog.js';
import { ShopPreviewScene } from '../src/game/ShopPreviewScene.js';

function previewCanvas() {
  const gradient = { addColorStop() {} };
  const context = new Proxy({
    roundRect() {},
    createLinearGradient() { return gradient; },
    createRadialGradient() { return gradient; },
  }, {
    get(target, key) {
      if (key in target) return target[key];
      return () => {};
    },
    set() { return true; },
  });
  return { width: 520, height: 230, getContext() { return context; } };
}

test('static cosmetic previews seed a visible wake, pause without mutation, and reset for a new theme', (t) => {
  const hadDocument = Object.hasOwn(globalThis, 'document');
  const previousDocument = globalThis.document;
  globalThis.document = { createElement() { return previewCanvas(); } };
  t.after(() => {
    if (hadDocument) globalThis.document = previousDocument;
    else delete globalThis.document;
  });
  const scene = new ShopPreviewScene(previewCanvas());
  scene.renderer.clear = () => {};
  scene.renderer.drawBackground = () => {};
  scene.renderer.drawPlayer = () => {};
  scene.renderer.drawPlayerProjectiles = () => {};
  const [first, second] = COSMETICS;
  const options = { kind: 'cosmetic', itemId: first.id, ship: 'default' };

  scene.draw(options, 0, false);
  const seeded = JSON.stringify(scene.cosmeticTrail.points);
  assert.equal(scene.cosmeticTrail.points.length, SHIPS[0].engines.length * 18);
  assert.notEqual(scene.cosmeticTrail.points[0].x, scene.cosmeticTrail.points[1].x, 'seeded samples are separated');

  scene.draw(options, 5, false);
  assert.equal(JSON.stringify(scene.cosmeticTrail.points), seeded, 'static redraws retain the seeded history');

  scene.draw({ ...options, itemId: second.id }, 5, false);
  assert.equal(scene.cosmeticTrail.signature, `default:${second.id}`);
  assert.equal(scene.cosmeticTrail.points.length, SHIPS[0].engines.length * 18, 'a new theme receives its own seeded history');

  const distance = scene.cosmeticPreviewDistance;
  const beforePlay = scene.cosmeticTrail.points[0].x;
  scene.draw({ ...options, itemId: second.id }, 6, true);
  assert.ok(scene.cosmeticPreviewDistance > distance, 'playing continues from the seed without a distance rewind');
  assert.ok(scene.cosmeticTrail.points[0].x < beforePlay, 'playing advances the seeded wake');
  const paused = JSON.stringify(scene.cosmeticTrail.points);
  scene.draw({ ...options, itemId: second.id }, 7, false);
  assert.equal(JSON.stringify(scene.cosmeticTrail.points), paused, 'a paused redraw does not advance the wake');
});
