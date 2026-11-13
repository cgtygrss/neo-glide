import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasResolution, resizeCanvas, MAX_CANVAS_PIXELS } from '../src/game/CanvasResolution.js';
import { Renderer } from '../src/game/Renderer.js';

test('Retina flight renders at native 2× and 3× without changing world coordinates', () => {
  for (const pixelRatio of [1, 2, 3]) {
    const result = canvasResolution(932, 430, { pixelRatio });
    assert.equal(result.pixelWidth, 932 * pixelRatio);
    assert.equal(result.pixelHeight, 430 * pixelRatio);
    assert.equal(result.scaleX, pixelRatio);
    assert.equal(result.scaleY, pixelRatio);
  }
});

test('preview density accounts for its displayed size as well as screen density', () => {
  const result = canvasResolution(520, 230, { pixelRatio: 2, displayScale: 1.5 });
  assert.equal(result.pixelWidth, 1560);
  assert.equal(result.pixelHeight, 690);
  const smaller = canvasResolution(520, 230, { pixelRatio: 3, displayScale: .5 });
  assert.equal(smaller.pixelWidth, 780);
});

test('very large screens bound backing memory, and fractional densities fill the bitmap exactly', () => {
  for (const [width, height, pixelRatio] of [[3840, 2160, 3], [1366, 1024, 3], [853, 393, 1.25]]) {
    const result = canvasResolution(width, height, { pixelRatio });
    assert.ok(result.pixelWidth * result.pixelHeight <= MAX_CANVAS_PIXELS);
    assert.ok(Math.abs(result.scaleX * width - result.pixelWidth) < 1e-9);
    assert.ok(Math.abs(result.scaleY * height - result.pixelHeight) < 1e-9);
  }
  for (const pixelRatio of [NaN, Infinity, 0, -1]) {
    assert.equal(canvasResolution(100, 50, { pixelRatio }).pixelWidth, 100);
  }
  assert.equal(canvasResolution(0, 0).pixelWidth, 0);
});

test('orientation and repeated resizes replace the transform rather than compounding it', () => {
  const transforms = [], canvas = { width: 0, height: 0 };
  const ctx = { setTransform(...args) { transforms.push(args); } };
  resizeCanvas(canvas, ctx, 932, 430, { pixelRatio: 3 });
  const repeat = resizeCanvas(canvas, ctx, 932, 430, { pixelRatio: 3 });
  assert.equal(repeat.changed, false);
  assert.equal(canvas.width, 2796);
  assert.deepEqual(transforms.at(-1), [3, 0, 0, 3, 0, 0]);
  resizeCanvas(canvas, ctx, 430, 932, { pixelRatio: 3 });
  assert.equal(canvas.width, 1290);
  assert.equal(canvas.height, 2796);
  assert.deepEqual(transforms.at(-1), [3, 0, 0, 3, 0, 0]);
  resizeCanvas(canvas, ctx, 430, 932, { pixelRatio: 2 });
  assert.deepEqual(transforms.at(-1), [2, 0, 0, 2, 0, 0]);
});

test('renderer and cached scenery share high resolution and composite into logical bounds', t => {
  const makeCanvas = () => {
    const context = {
      transforms: [], images: [],
      setTransform(...args) { this.transforms.push(args); },
      createLinearGradient() { return { addColorStop() {} }; },
      createRadialGradient() { return { addColorStop() {} }; },
      fillRect() {}, save() {}, restore() {},
      drawImage(...args) { this.images.push(args); },
    };
    return { width: 300, height: 150, getContext: () => context };
  };
  const previous = globalThis.document;
  globalThis.document = { createElement: makeCanvas };
  t.after(() => { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; });
  const canvas = makeCanvas(), renderer = new Renderer(canvas);
  renderer.resize(932, 430, { pixelRatio: 3 });
  assert.equal(renderer.width, 932);
  assert.equal(renderer.height, 430);
  for (const layer of [canvas, renderer.backgroundCanvas, renderer.vignetteCanvas]) {
    assert.equal(layer.width, 2796);
    assert.equal(layer.height, 1290);
    assert.deepEqual(layer.getContext('2d').transforms.at(-1), [3, 0, 0, 3, 0, 0]);
  }
  renderer.stars = []; renderer.planets = [];
  renderer.drawBackground(0, 0);
  renderer.drawEffects(0);
  assert.deepEqual(renderer.ctx.images.map(args => args.slice(1)), [[0, 0, 932, 430], [0, 0, 932, 430]]);
});
