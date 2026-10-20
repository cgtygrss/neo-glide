import test from 'node:test';
import assert from 'node:assert/strict';
import { Renderer } from '../src/game/Renderer.js';
import { Projectile, FuseProjectile, PlayerProjectile, SonicBladeProjectile } from '../src/game/Entities.js';
import { COSMETICS } from '../src/game/CosmeticsCatalog.js';

test('incoming fire stays above scenery, particles, rewards and ship effects', () => {
  const layers = [];
  const renderer = Object.create(Renderer.prototype);
  for (const name of ['clear', 'drawBackground', 'drawSpeedLines', 'drawLaunchBay', 'drawEffects', 'drawObstacles', 'drawVillain', 'drawCollectibles', 'drawFuels', 'drawHealthPickups', 'drawPowerUps', 'drawPlayerProjectiles', 'drawPlayer', 'drawFloatingTexts', 'drawProjectiles']) {
    renderer[name] = () => layers.push(name);
  }
  renderer.drawScene({ phase: 'FLYING', speed: 600, player: {}, launch: {} }, 1 / 60);
  assert.equal(layers.at(-1), 'drawProjectiles');
  for (const collectible of ['drawCollectibles', 'drawFuels', 'drawHealthPickups', 'drawPowerUps']) {
    assert.ok(layers.indexOf('drawEffects') < layers.indexOf(collectible));
  }
});

class Context {
  constructor() {
    this.globalAlpha = 0.4;
    this.globalCompositeOperation = 'lighter';
    this.shadowBlur = 17;
    this.stack = [];
    this.fills = [];
  }
  save() { this.stack.push({ alpha: this.globalAlpha, blend: this.globalCompositeOperation, blur: this.shadowBlur }); }
  restore() { const s = this.stack.pop(); this.globalAlpha = s.alpha; this.globalCompositeOperation = s.blend; this.shadowBlur = s.blur; }
  fill() { this.fills.push({ alpha: this.globalAlpha, blend: this.globalCompositeOperation, blur: this.shadowBlur }); }
  stroke() {}
  beginPath() {}
  moveTo() {}
  lineTo() {}
  closePath() {}
  translate() {}
  rotate() {}
  quadraticCurveTo() {}
  arc() {}
}

test('all hostile bodies remain opaque even after additive or translucent effects', () => {
  const renderer = Object.create(Renderer.prototype);
  const ctx = new Context();
  renderer.ctx = ctx;
  const shots = [new Projectile(100, 100), new FuseProjectile(100, 100), new SonicBladeProjectile(100, 100, -800, 0), { ...new Projectile(100, 100), radius: 10, target: {} }];
  const original = shots.map(shot => ({ ...shot }));
  renderer.drawProjectiles(shots);
  assert.ok(ctx.fills.length >= shots.length);
  assert.ok(ctx.fills.every(fill => fill.alpha === 1 && fill.blend === 'source-over' && fill.blur === 0));
  assert.equal(ctx.stack.length, 0);
  assert.equal(ctx.globalAlpha, 0.4);
  assert.equal(ctx.globalCompositeOperation, 'lighter');
  assert.equal(ctx.shadowBlur, 17);
  assert.deepEqual(shots.map(shot => ({ ...shot })), original);
});

class RecordingContext {
  constructor() {
    this.globalAlpha = 0.4;
    this.globalCompositeOperation = 'lighter';
    this.shadowBlur = 17;
    this.fillStyle = '#initial-fill';
    this.strokeStyle = '#initial-stroke';
    this.lineWidth = 3;
    this.lineJoin = 'bevel';
    this.stack = [];
    this.draws = [];
    this.geometry = [];
  }
  save() { this.stack.push({ globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation, shadowBlur: this.shadowBlur, fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth, lineJoin: this.lineJoin }); }
  restore() { Object.assign(this, this.stack.pop()); }
  fill() { this.draws.push({ kind: 'fill', color: this.fillStyle }); }
  stroke() { this.draws.push({ kind: 'stroke', color: this.strokeStyle }); }
  record(name, ...args) { this.geometry.push([name, ...args]); }
  beginPath() { this.record('beginPath'); }
  moveTo(...args) { this.record('moveTo', ...args); }
  lineTo(...args) { this.record('lineTo', ...args); }
  closePath() { this.record('closePath'); }
  arc(...args) { this.record('arc', ...args); }
  roundRect(...args) { this.record('roundRect', ...args); }
  translate(...args) { this.record('translate', ...args); }
  scale(...args) { this.record('scale', ...args); }
  quadraticCurveTo(...args) { this.record('quadraticCurveTo', ...args); }
  fillRect(...args) { this.record('fillRect', ...args); }
}

const WEAPON_TYPES = ['default', 'blaster', 'cannon', 'beam', 'wave', 'shock'];

function renderPlayerShot(type, cosmeticId = null) {
  const renderer = Object.create(Renderer.prototype);
  const ctx = new RecordingContext();
  renderer.ctx = ctx;
  const projectile = new PlayerProjectile(123, 456, type, cosmeticId || '');
  const before = { ...projectile };
  renderer.drawPlayerProjectiles([projectile], cosmeticId);
  return { ctx, projectile, before };
}

test('cosmetics decorate every player weapon while retaining its geometry, stats, and canvas state', () => {
  const baselines = new Map(WEAPON_TYPES.map(type => [type, renderPlayerShot(type)]));

  for (const cosmetic of COSMETICS) for (const type of WEAPON_TYPES) {
    const { ctx, projectile, before } = renderPlayerShot(type, cosmetic.id);
    const baseline = baselines.get(type);
    const colors = ctx.draws.map(draw => draw.color);

    assert.ok(colors.includes(cosmetic.colors.shot), `${cosmetic.id}/${type} uses its shot color`);
    assert.ok(colors.includes('#06121f'), `${cosmetic.id}/${type} retains the dark outline`);
    let cursor = 0;
    for (const operation of ctx.geometry) {
      if (JSON.stringify(operation) === JSON.stringify(baseline.ctx.geometry[cursor])) cursor++;
    }
    assert.equal(cursor, baseline.ctx.geometry.length, `${cosmetic.id}/${type} retains all base weapon geometry`);
    assert.ok(ctx.geometry.length > baseline.ctx.geometry.length, `${cosmetic.id}/${type} adds visual details`);
    assert.deepEqual({ ...projectile }, before, `${cosmetic.id}/${type} does not mutate the projectile`);
    assert.equal(projectile.speed, baseline.projectile.speed, `${cosmetic.id}/${type} retains speed`);
    assert.equal(projectile.damage, baseline.projectile.damage, `${cosmetic.id}/${type} retains damage`);
    assert.equal(projectile.radius, baseline.projectile.radius, `${cosmetic.id}/${type} retains radius`);
    assert.equal(ctx.stack.length, 0, `${cosmetic.id}/${type} balances canvas state`);
    assert.deepEqual({ globalAlpha: ctx.globalAlpha, globalCompositeOperation: ctx.globalCompositeOperation, shadowBlur: ctx.shadowBlur, fillStyle: ctx.fillStyle, strokeStyle: ctx.strokeStyle, lineWidth: ctx.lineWidth, lineJoin: ctx.lineJoin }, {
      globalAlpha: 0.4, globalCompositeOperation: 'lighter', shadowBlur: 17, fillStyle: '#initial-fill', strokeStyle: '#initial-stroke', lineWidth: 3, lineJoin: 'bevel'
    }, `${cosmetic.id}/${type} restores canvas state`);
  }
});

test('default player weapons retain their original colors without a cosmetic theme', () => {
  const expected = {
    default: ['#06121f', '#89e6ff', '#c9f6ff'],
    blaster: ['#06121f', '#89e6ff', '#e9f6ff'],
    cannon: ['#06121f', '#b8d6ff', '#e9f6ff', '#315d78'],
    beam: ['#06121f', '#d0f6ff', '#89e6ff'],
    wave: ['#06121f', '#89e6ff'],
    shock: ['#06121f', '#bdf4f5']
  };
  for (const type of WEAPON_TYPES) {
    const { ctx } = renderPlayerShot(type);
    assert.deepEqual([...new Set(ctx.draws.map(draw => draw.color))], expected[type], `${type} keeps its original palette`);
  }
});

 test('all ten shot effects have distinct color-independent geometry and bounded work', () => {
  const signatures = COSMETICS.map(cosmetic => {
    const { ctx } = renderPlayerShot('blaster', cosmetic.id);
    assert.ok(ctx.geometry.length < 100);
    return JSON.stringify(ctx.geometry);
  });
  assert.equal(new Set(signatures).size, COSMETICS.length);
});

test('shot effects move with simulation age and the muzzle stays at the firing origin', () => {
  for (const cosmetic of COSMETICS) {
    const make = age => {
      const renderer = Object.create(Renderer.prototype), ctx = new RecordingContext(); renderer.ctx = ctx;
      const projectile = new PlayerProjectile(200, 100, 'blaster', cosmetic.id);
      projectile.visualAge = age;
      renderer.drawPlayerProjectiles([projectile], cosmetic.id);
      return ctx;
    };
    const first = make(.04), later = make(.08), paused = make(.04);
    assert.notDeepEqual(first.geometry, later.geometry, cosmetic.id);
    assert.deepEqual(first.geometry, paused.geometry, `${cosmetic.id} pause freezes geometry`);
    assert.ok(first.geometry.some(op => op[0] === 'translate' && Math.abs(op[1] - (200 - 1200 * .04)) < .001 && op[2] === 100), 'muzzle is at the firing origin');
  }
});
