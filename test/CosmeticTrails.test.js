import test from 'node:test';
import assert from 'node:assert/strict';
import { COSMETICS, getCosmeticPalette } from '../src/game/CosmeticsCatalog.js';
import { SHIPS } from '../src/game/ShipCatalog.js';
import { TRAIL_MAX_POINTS, advanceCosmeticTrail, createCosmeticTrailState, drawCosmeticTrail } from '../src/game/CosmeticTrails.js';

function game(shipType = 'default') {
  return { phase: 'FLYING', shipType, speed: 300, distance: 1, player: { x: 100, y: 120, rotation: 0 } };
}
function canvas() {
  const strokes = [];
  return { strokes, save(){}, restore(){}, translate(){}, scale(){}, quadraticCurveTo(){}, closePath(){}, fillRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){ strokes.push({ color: this.strokeStyle, dash: this.dash || [] }); }, arc(){}, fill(){}, setLineDash(dash){ this.dash = dash; }, set lineDashOffset(_) {}, set globalAlpha(_) {}, set lineWidth(_) {}, set lineCap(_) {}, set lineJoin(_) {}, set shadowBlur(_) {}, set fillStyle(_) {} };
}

test('every cosmetic trails every ship with rotated real engine ports and bounded history', () => {
  for (const cosmetic of COSMETICS) for (const ship of SHIPS) {
    const state = createCosmeticTrailState(), run = game(ship.id);
    advanceCosmeticTrail(state, { game: run, cosmetic, deltaTime: 1 / 30 });
    advanceCosmeticTrail(state, { game: run, cosmetic, deltaTime: 1 / 30 });
    assert.equal(state.points.length, ship.engines.length * 2, `${cosmetic.id}/${ship.id}`);
    const first = state.points[0].x;
    advanceCosmeticTrail(state, { game: run, cosmetic, deltaTime: .1 });
    assert.ok(state.points[0].x < first, 'world scroll shifts historical samples');
    for (let i = 0; i < 100; i++) advanceCosmeticTrail(state, { game: run, cosmetic, deltaTime: .1 });
    assert.ok(state.points.length <= TRAIL_MAX_POINTS);
  }
  const plain = createCosmeticTrailState(), rotated = createCosmeticTrailState(), c = COSMETICS[0], a = game('default'), b = game('default'); b.player.rotation = 90;
  advanceCosmeticTrail(plain, { game: a, cosmetic: c, deltaTime: 1 / 30 });
  advanceCosmeticTrail(rotated, { game: b, cosmetic: c, deltaTime: 1 / 30 });
  assert.notEqual(plain.points[0].y, rotated.points[0].y);
});

test('pause retains history, a same-theme fresh run resets it, and lane styles are distinct', () => {
  const state = createCosmeticTrailState(), c = COSMETICS.find(item => item.id === 'prism_voyager'), run = game();
  advanceCosmeticTrail(state, { game: run, cosmetic: c, deltaTime: 1 / 30 });
  advanceCosmeticTrail(state, { game: run, cosmetic: c, deltaTime: 1 / 30 });
  const before = JSON.stringify(state.points); run.phase = 'PAUSED'; advanceCosmeticTrail(state, { game: run, cosmetic: c, deltaTime: .1 });
  assert.equal(JSON.stringify(state.points), before);
  const ctx = canvas(); drawCosmeticTrail(ctx, state.points, c, getCosmeticPalette(SHIPS[0].palette, c.id));
  assert.ok(new Set(ctx.strokes.map(stroke => stroke.color)).size >= 3, 'triple uses three lanes even on one engine');
  const fresh = game(); advanceCosmeticTrail(state, { game: fresh, cosmetic: c, deltaTime: 1 / 30 });
  assert.equal(state.points.length, 1, 'new game object clears same-theme history');
  run.phase = 'FLYING'; run.distance = 0; advanceCosmeticTrail(state, { game: run, cosmetic: c, deltaTime: 1 / 30 });
  assert.equal(state.points.length, 1, 'distance rewind clears history');
});

test('ten wakes have distinct geometry, animate from sampled age, and reduce detail in low power mode', () => {
  function recording() {
    const ops = [], stack = [];
    const ctx = { ops, globalAlpha: 1, lineCap: 'square', lineJoin: 'bevel', shadowBlur: 4,
      save() { stack.push({ globalAlpha: this.globalAlpha, lineCap: this.lineCap, lineJoin: this.lineJoin, shadowBlur: this.shadowBlur }); },
      restore() { Object.assign(this, stack.pop()); } };
    for (const name of ['translate', 'scale', 'beginPath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'arc', 'closePath', 'fillRect', 'stroke', 'fill']) ctx[name] = (...args) => ops.push([name, ...args]);
    return ctx;
  }
  const points = Array.from({ length: TRAIL_MAX_POINTS }, (_, i) => ({ x: i * 2, y: 100, age: (143 - i) / 120, engine: 0 }));
  const signatures = COSMETICS.map(cosmetic => {
    const normal = recording(), later = recording(), reduced = recording();
    drawCosmeticTrail(normal, points, cosmetic, cosmetic.colors);
    drawCosmeticTrail(later, points.map(p => ({ ...p, age: p.age + .04 })), cosmetic, cosmetic.colors);
    drawCosmeticTrail(reduced, points, cosmetic, cosmetic.colors, true);
    assert.notDeepEqual(normal.ops, later.ops, `${cosmetic.id} evolves with simulation`);
    assert.ok(reduced.ops.length < normal.ops.length && normal.ops.length < 1200, `${cosmetic.id} has bounded detail`);
    assert.deepEqual([normal.globalAlpha, normal.lineCap, normal.lineJoin, normal.shadowBlur], [1, 'square', 'bevel', 4]);
    return JSON.stringify(normal.ops);
  });
  assert.equal(new Set(signatures).size, COSMETICS.length);
});
