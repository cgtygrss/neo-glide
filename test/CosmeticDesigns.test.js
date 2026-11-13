import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_COSMETICS, COSMETICS, COSMETIC_COLLECTIONS, cosmeticsInCollection, getCosmeticPalette } from '../src/game/CosmeticsCatalog.js';
import { COSMETIC_DESIGNS, cosmeticNodePose, getCosmeticDesign, getCosmeticSurface } from '../src/game/CosmeticDesigns.js';
import { drawCosmeticLayer, drawCosmeticSurface } from '../src/game/CosmeticArt.js';
import { SHIPS } from '../src/game/ShipCatalog.js';

let allocations = 0;
globalThis.Path2D = class { constructor(d) { this.d = d; allocations++; } };
function recording() {
  const operations = [], stack = [];
  const ctx = { globalAlpha: .37, shadowBlur: 4, lineCap: 'square', lineJoin: 'bevel', operations,
    save() { stack.push({ globalAlpha: this.globalAlpha, shadowBlur: this.shadowBlur, lineCap: this.lineCap, lineJoin: this.lineJoin }); },
    restore() { Object.assign(this, stack.pop()); },
    translate(...args) { operations.push(['translate', ...args]); },
    rotate(...args) { operations.push(['rotate', ...args]); },
    scale(...args) { operations.push(['scale', ...args]); },
    clip(shape) { operations.push(['clip', shape.d]); },
    fill(shape) { assert.ok(this.globalAlpha <= .37); operations.push(['fill', shape.d]); },
    stroke(shape) { assert.ok(this.globalAlpha <= .37); operations.push(['stroke', shape.d]); },
  };
  return { ctx, stack };
}

test('every visual kit has its own sculpted silhouette, inlays and truthful catalog features', () => {
  assert.equal(Object.keys(COSMETIC_DESIGNS).length, ALL_COSMETICS.length);
  const signatures = ALL_COSMETICS.map(cosmetic => {
    const design = getCosmeticDesign(cosmetic.id);
    assert.ok(design.groups.some(group => group.layer === 'back'));
    assert.ok(design.groups.some(group => group.layer === 'front'));
    assert.ok(design.groups.some(group => group.motion !== 'still'));
    assert.ok(getCosmeticSurface(cosmetic.id).length > 0);
    assert.equal(cosmetic.signature, design.label);
    assert.equal(cosmetic.description, design.story);
    assert.equal(cosmetic.features.length, 3);
    return JSON.stringify(design.groups.map(group => [group.x, group.y, group.parts.map(part => part.d)]));
  });
  assert.equal(new Set(signatures).size, ALL_COSMETICS.length);
  assert.equal(getCosmeticDesign('missing'), null);
});

test('every kit renders both layers and clipped material with bounded detail, without changing ship data or ghost opacity', () => {
  const ships = structuredClone(SHIPS), designs = structuredClone(COSMETIC_DESIGNS);
  for (const cosmetic of ALL_COSMETICS) {
    const { ctx, stack } = recording();
    const palette = getCosmeticPalette(SHIPS[0].palette, cosmetic.id);
    for (const layer of ['back', 'front']) drawCosmeticLayer(ctx, cosmetic.id, palette, layer, { time: 2.5, boosting: true });
    drawCosmeticSurface(ctx, cosmetic.id, palette, new Path2D('hull-mask'));
    assert.ok(ctx.operations.some(op => op[0] === 'clip'));
    assert.ok(ctx.operations.filter(op => op[0] === 'fill' || op[0] === 'stroke').length < 60, cosmetic.id);
    assert.deepEqual([ctx.globalAlpha, ctx.shadowBlur, ctx.lineCap, ctx.lineJoin], [.37, 4, 'square', 'bevel']);
    assert.equal(stack.length, 0);
  }
  assert.deepEqual(SHIPS, ships);
  assert.deepEqual(COSMETIC_DESIGNS, designs);
});

test('boost deploys cosmetic wings and reduced motion freezes ornaments while keeping the complete design', () => {
  for (const cosmetic of ALL_COSMETICS) {
    const design = getCosmeticDesign(cosmetic.id);
    for (const group of design.groups) {
      const a = cosmeticNodePose(group, 0, false, true), b = cosmeticNodePose(group, 100, false, true);
      assert.deepEqual(a, b, cosmetic.id);
      assert.ok(Object.values(a).every(Number.isFinite));
      if (group.deploy) assert.ok(Math.abs(cosmeticNodePose(group, 0, true).sy) > Math.abs(a.sy));
    }
    const normal = recording(), low = recording();
    drawCosmeticLayer(normal.ctx, cosmetic.id, cosmetic.colors, 'back', { time: 1 });
    drawCosmeticLayer(low.ctx, cosmetic.id, cosmetic.colors, 'back', { time: 1, lowPower: true });
    assert.ok(low.ctx.operations.length <= normal.ctx.operations.length);
  }
});

test('flight animation reuses ornament and inlay paths after warmup', () => {
  const { ctx } = recording();
  const mask = new Path2D('mask');
  for (const cosmetic of ALL_COSMETICS) {
    for (const layer of ['back', 'front']) drawCosmeticLayer(ctx, cosmetic.id, cosmetic.colors, layer);
    drawCosmeticSurface(ctx, cosmetic.id, cosmetic.colors, mask);
  }
  const warm = allocations;
  for (let frame = 0; frame < 90; frame++) for (const cosmetic of ALL_COSMETICS) {
    for (const layer of ['back', 'front']) drawCosmeticLayer(ctx, cosmetic.id, cosmetic.colors, layer, { time: frame / 60, boosting: frame % 2 === 0 });
    drawCosmeticSurface(ctx, cosmetic.id, cosmetic.colors, mask);
  }
  assert.equal(allocations, warm);
});

test('unknown and removed cosmetics draw no ornaments or material', () => {
  const { ctx } = recording();
  for (const id of [null, '', 'missing']) {
    drawCosmeticLayer(ctx, id, {}, 'back');
    drawCosmeticSurface(ctx, id, {}, null);
  }
  assert.equal(ctx.operations.length, 0);
});

test('collections preserve every purchasable style and showpieces are the four highest-priced native kits', () => {
  const groups = COSMETIC_COLLECTIONS.filter(collection => !['all', 'showpieces'].includes(collection.id));
  const grouped = groups.flatMap(collection => cosmeticsInCollection(COSMETICS, collection.id));
  assert.equal(grouped.length, COSMETICS.length);
  assert.equal(new Set(grouped.map(cosmetic => cosmetic.id)).size, COSMETICS.length);
  assert.deepEqual(cosmeticsInCollection(COSMETICS).map(cosmetic => cosmetic.id), COSMETICS.map(cosmetic => cosmetic.id));
  const expensive = COSMETICS.filter(cosmetic => cosmetic.price).sort((a, b) => Number(a.price.slice(1)) - Number(b.price.slice(1))).slice(-4);
  assert.deepEqual(cosmeticsInCollection(COSMETICS, 'showpieces').map(cosmetic => cosmetic.id).sort(), expensive.map(cosmetic => cosmetic.id).sort());
  for (const cosmetic of expensive) {
    const design = getCosmeticDesign(cosmetic.id);
    assert.ok(design.groups.flatMap(group => group.parts).length >= 20, cosmetic.id);
    assert.ok(design.groups.some(group => group.detail), `${cosmetic.id} can reduce decorative detail`);
  }
});

test('butterfly wings visibly flutter, deploy on boost and freeze under reduced motion', () => {
  for (const id of ['pearl_comet', 'prism_voyager', 'lavender_dream', 'rose_circuit']) {
    const wings = getCosmeticDesign(id).groups.filter(group => group.motion === 'flutter');
    assert.equal(wings.length, 2);
    for (const wing of wings) {
      const open = cosmeticNodePose(wing, 0, true), closed = cosmeticNodePose(wing, wing.duration / 2, true);
      assert.ok(Math.abs(closed.sy) < Math.abs(open.sy));
      assert.deepEqual(cosmeticNodePose(wing, 0, true, true), cosmeticNodePose(wing, 12, true, true));
    }
  }
});

