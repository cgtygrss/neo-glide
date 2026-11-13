import { profileStorage } from '../src/account/ProfileStorage.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES } from '../src/game/StageCatalog.js';
import { StageBackground } from '../src/game/StageBackground.js';
import { drawGalaxyArtwork } from '../src/game/GalaxyArt.js';
import { Renderer } from '../src/game/Renderer.js';
import { journeyPosition, journeyRegion, journeyResolution, REGION_DISTANCE, BLEND_START, JOURNEY_PIXEL_BUDGET, LOW_POWER_JOURNEY_PIXEL_BUDGET } from '../src/game/StageJourney.js';
import { ACCOUNT_KEY, saveWallet, loadWallet, getStageOwnership, getEquippedStage, unlockCreditStage, equipStage, syncStoreSnapshot, grantStoreTransaction, getCosmeticOwnership } from '../src/game/Economy.js';

function storage() {
  const data = new Map();
  globalThis.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) };
  return data;
}

test('galaxy destinations are unique, ordered, and permanently purchasable without disturbing store rights', () => {
  assert.equal(STAGES.length, 24); assert.equal(new Set(STAGES.map(s => s.id)).size, STAGES.length);
  assert.equal(STAGES[0].price, 0);
  assert.ok(STAGES.slice(1).every((stage, index) => stage.price > STAGES[index].price));
  storage(); saveWallet(2000000);
  grantStoreTransaction({ verified: true, transactionId: '123', productId: 'cosmetic_void_pilot' });
  const before = loadWallet();
  assert.equal(getEquippedStage(), 'default'); assert.equal(getStageOwnership().default, true);
  assert.throws(() => equipStage('andromeda'), /locked/);
  assert.throws(() => unlockCreditStage('unknown'), /Unknown/);
  assert.equal(unlockCreditStage('andromeda').unlocked, true); assert.equal(loadWallet(), before - 12000);
  assert.equal(getEquippedStage(), 'andromeda');
  assert.equal(unlockCreditStage('andromeda').unlocked, false); assert.equal(loadWallet(), before - 12000);
  equipStage('default'); assert.equal(getEquippedStage(), 'default'); equipStage('andromeda');
  syncStoreSnapshot(['cosmetic_void_pilot']);
  assert.equal(getStageOwnership().andromeda, true); assert.equal(getEquippedStage(), 'andromeda');
  const account = JSON.parse(profileStorage.getItem(ACCOUNT_KEY)); assert.equal(account.entitlements.cosmetic_void_pilot, true); assert.ok(account.transactions['123']);
  account.equippedStage = 'unknown'; profileStorage.setItem(ACCOUNT_KEY, JSON.stringify(account)); assert.equal(getEquippedStage(), 'default');
  account.equippedStage = 'bode'; profileStorage.setItem(ACCOUNT_KEY, JSON.stringify(account)); assert.equal(getEquippedStage(), 'default');
  saveWallet(19999); const saved = profileStorage.getItem(ACCOUNT_KEY); assert.throws(() => unlockCreditStage('triangulum'), /Not enough/); assert.equal(profileStorage.getItem(ACCOUNT_KEY), saved);
  saveWallet(200000); const stable = profileStorage.getItem(ACCOUNT_KEY), original = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('write failed'); }; assert.throws(() => unlockCreditStage('triangulum'), /write failed/);
  localStorage.setItem = original; assert.equal(profileStorage.getItem(ACCOUNT_KEY), stable); assert.equal(getStageOwnership().triangulum, false);
});

class Context {
  constructor() { this.ops=[]; this.stack=[]; this.globalAlpha=.4; this.lineCap='square'; this.lineJoin='bevel'; this.fillStyle='original-fill'; this.strokeStyle='original-stroke'; this.lineWidth=3; this.shadowBlur=9; this.globalCompositeOperation='lighter'; }
  save() { this.stack.push({ globalAlpha:this.globalAlpha, lineCap:this.lineCap, lineJoin:this.lineJoin, fillStyle:this.fillStyle, strokeStyle:this.strokeStyle, lineWidth:this.lineWidth, shadowBlur:this.shadowBlur, globalCompositeOperation:this.globalCompositeOperation }); }
  restore() { Object.assign(this, this.stack.pop()); }
  createLinearGradient() { return { addColorStop() {} }; }
  createRadialGradient() { return { addColorStop() {} }; }
}
for (const name of ['fillRect','scale','translate','rotate','clip','setTransform','drawImage','beginPath','moveTo','lineTo','closePath','fill','stroke','ellipse','arc','bezierCurveTo']) Context.prototype[name] = function (...args) { this.ops.push([name,...args]); };

test('all galaxy artworks differ geometrically, bound detail and restore canvas state', () => {
  const signatures = STAGES.map(stage => {
    const normal = new Context(), low = new Context();
    drawGalaxyArtwork(normal, stage, 520, 230, false);
    drawGalaxyArtwork(low, stage, 520, 230, true);
    assert.ok(low.ops.length < normal.ops.length); assert.ok(normal.ops.length < 5000);
    assert.equal(normal.stack.length, 0); assert.equal(normal.globalAlpha, .4); assert.equal(normal.lineCap, 'square'); assert.equal(normal.lineJoin, 'bevel'); assert.equal(normal.fillStyle, 'original-fill'); assert.equal(normal.strokeStyle, 'original-stroke'); assert.equal(normal.lineWidth, 3); assert.equal(normal.shadowBlur, 9); assert.equal(normal.globalCompositeOperation, 'lighter');
    return JSON.stringify(normal.ops);
  });
  assert.equal(new Set(signatures).size, STAGES.length);
});

test('flight stage time freezes while paused and resets for a new run without mutating game', () => {
  const renderer = Object.create(Renderer.prototype), frames = [];
  renderer.stageBackground = { reset() {}, draw(_ctx, id, _w, _h, time, distance) { frames.push([id,time,distance]); } };
  renderer.ctx = {}; renderer.width = 520; renderer.height = 230;
  for (const name of ['clear','drawSpeedLines','drawLaunchBay','drawEffects','drawCosmeticTrail','drawObstacles','drawVillain','drawCollectibles','drawFuels','drawHealthPickups','drawPowerUps','drawPlayerProjectiles','drawPlayer','drawFloatingTexts','drawProjectiles']) renderer[name] = () => {};
  const game = { phase:'FLYING', stageId:'andromeda', distance:30, launch:{} };
  const before = structuredClone(game); renderer.drawScene(game,.05); assert.deepEqual(game,before);
  game.phase='PAUSED'; renderer.drawScene(game,.05); assert.deepEqual(frames[1], frames[0]);
  const next = { ...game, phase:'FLYING', stageId:'bode', distance:0 }; renderer.drawScene(next,.05);
  assert.deepEqual(frames[2], ['bode',.05,0]);
  next.launch = { reducedMotion:true }; next.distance=10; renderer.drawScene(next,.05); assert.deepEqual(frames[3], ['bode',.05,0]);
  const milkyWay = { phase:'FLYING', stageId:'default', distance:15, launch:{} };
  renderer.drawScene(milkyWay,.05);
  assert.deepEqual(frames[4], ['default',.05,15], 'The free galaxy uses the same art in flight and its preview');
});

 test('detailed art is cached once and invalidates on stage, resize, density, detail and reset', () => {
  const ctx = new Context(); let created = 0, density = 1;
  ctx.getTransform = () => ({ a:density, d:density });
  const art = new StageBackground({ createCanvas() { created++; return { getContext: () => new Context() }; } });
  art.draw(ctx, 'andromeda', 520, 230); art.draw(ctx, 'andromeda', 520, 230);
  assert.equal(created, 1);
  art.draw(ctx, 'bode', 520, 230); art.draw(ctx, 'bode', 600, 230);
  assert.equal(created, 3);
  art.reset(); art.draw(ctx, 'bode', 600, 230); assert.equal(created, 4);
  density = 3; art.draw(ctx, 'bode', 600, 230); assert.equal(created, 5);
  assert.equal(art.cache.frames.get(0).bitmap.width, 1050, 'Scenery density is capped separately from gameplay Retina rendering');
  art.draw(ctx, 'bode', 600, 230, 0, 0, true); assert.equal(created, 6);
  ctx.ops = [];
  art.draw(ctx, 'bode', 600, 230, 10, 100, true);
  assert.equal(created, 6);
  assert.equal(ctx.ops.filter(op => op[0] === 'drawImage').length, 1);
  assert.ok(ctx.ops.length < 100, 'Steady-state frames composite cached art and bounded stars only');
});


test('every paid destination preserves legacy and cosmetic ownership through unlock, equip, and store revocation', () => {
  for (const stage of STAGES.slice(1)) {
    storage();
    // Existing v3 records may omit both stage fields.
    profileStorage.setItem(ACCOUNT_KEY, JSON.stringify({ version: 3, balance: stage.price + 100, transactions: {}, entitlements: {}, legacyPurchases: {}, creditCosmetics: { void_pilot: true } }));
    assert.equal(getEquippedStage(), 'default');
    assert.equal(unlockCreditStage(stage.id).unlocked, true);
    assert.equal(loadWallet(), 100);
    assert.deepEqual(Object.entries(getStageOwnership()).filter(([, owned]) => owned).map(([id]) => id), ['default', stage.id]);
    assert.equal(unlockCreditStage(stage.id).unlocked, false); assert.equal(loadWallet(), 100);
    equipStage('default'); equipStage(stage.id); assert.equal(loadWallet(), 100);
    syncStoreSnapshot([]);
    assert.equal(getEquippedStage(), stage.id); assert.equal(getStageOwnership()[stage.id], true);
    assert.equal(getCosmeticOwnership().void_pilot, true);
  }
});

test('star parallax remains continuous across the former wrap boundary', () => {
  const before = new Context(), after = new Context(), art = new StageBackground();
  art.draw(before, 'andromeda', 520, 230, 0, 5333.2);
  art.draw(after, 'andromeda', 520, 230, 0, 5333.4);
  const stars = ctx => ctx.ops.filter(op => op[0] === 'fillRect' && op[3] < .01);
  const a = stars(before), b = stars(after);
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i][1] - b[i][1]) < .001);
});

test('all 24 worlds reuse cached vistas across moving frames and repaint deterministically after pause', () => {
  for (const stage of STAGES) {
    const ctx = new Context(); let painted = 0;
    const art = new StageBackground({ createCanvas() { painted++; return { getContext: () => new Context() }; } });
    for (let frame = 0; frame < 20; frame++) {
      ctx.ops = [];
      art.draw(ctx, stage.id, 844, 390, frame / 60, frame * 10);
      assert.ok(ctx.ops.length < 100, stage.id);
    }
    assert.equal(painted, 2, `${stage.id} warms one upcoming vista`);
    const frozen = [...ctx.ops]; ctx.ops = [];
    art.draw(ctx, stage.id, 844, 390, 19 / 60, 190);
    assert.deepEqual(ctx.ops, frozen, `${stage.id} does not advance without simulation time/travel`);
  }
});

test('every destination has four distinct themed regions without modifying its catalog data', () => {
  for (const stage of STAGES) {
    const before = structuredClone(stage), shapes = [];
    for (let region = 0; region < 4; region++) {
      const ctx = new Context(), destination = journeyRegion(stage, region);
      drawGalaxyArtwork(ctx, destination, 844, 390);
      assert.deepEqual(destination.colors, stage.colors);
      assert.ok(ctx.ops.length < 5000, stage.id);
      assert.equal(ctx.stack.length, 0);
      shapes.push(JSON.stringify(ctx.ops));
    }
    assert.equal(new Set(shapes).size, 4, stage.id);
    assert.deepEqual(stage, before);
  }
});

test('route progression is bounded, smooth at each region boundary and repeats without a hard scene cut', () => {
  for (let region = 0; region < 40; region++) {
    const start = journeyPosition(region * REGION_DISTANCE);
    assert.equal(start.region, region % 4); assert.equal(start.progress, 0); assert.equal(start.blend, 0);
    const before = journeyPosition((region + 1) * REGION_DISTANCE - .001);
    assert.equal(before.next, (region + 1) % 4); assert.ok(before.blend > .999999);
    assert.ok(journeyPosition((region + BLEND_START) * REGION_DISTANCE).blend < 1e-20);
  }
  for (const invalid of [NaN, Infinity, -100]) assert.deepEqual(journeyPosition(invalid), journeyPosition(0));
});

test('long flights, distance skips and restarts keep two rasters within budget and explicitly release departed surfaces', () => {
  for (const low of [false, true]) {
    const surfaces = [], ctx = new Context(); ctx.getTransform = () => ({ a:3, d:3 });
    const art = new StageBackground({ createCanvas() { const surface = { getContext: () => new Context() }; surfaces.push(surface); return surface; } });
    const distances = Array.from({ length: 800 }, (_, i) => i * 31).concat([1e7, 1e7, 0, 200, 400, 480]);
    for (const distance of distances) {
      const before = surfaces.length;
      ctx.ops = []; art.draw(ctx, 'andromeda', 1366, 768, distance / 40, distance, low);
      assert.ok(surfaces.length - before <= 1, 'At most one detailed raster is painted per draw');
      assert.ok(art.cache.frames.size <= 2);
      const retained = surfaces.filter(surface => surface.width > 0);
      assert.ok(retained.length <= 2);
      assert.ok(retained.reduce((pixels, surface) => pixels + surface.width * surface.height, 0)
        <= (low ? LOW_POWER_JOURNEY_PIXEL_BUDGET : JOURNEY_PIXEL_BUDGET));
      assert.ok(ctx.ops.filter(op => op[0] === 'drawImage').length <= 2);
      assert.ok(ctx.ops.length < 100);
      assert.equal(ctx.globalAlpha, .4); assert.equal(ctx.stack.length, 0);
    }
    art.reset(); assert.equal(art.cache, null); assert.ok(surfaces.every(surface => surface.width === 0));
  }
});

test('crossfades reuse the incoming region bitmap across the boundary, with continuous placement and frozen pause', () => {
  const ctx = new Context(), art = new StageBackground({ createCanvas: () => ({ getContext: () => new Context() }) });
  art.draw(ctx, 'bode', 844, 390, 0, 0);
  art.draw(ctx, 'bode', 844, 390, 4, 200);
  ctx.ops = []; art.draw(ctx, 'bode', 844, 390, 10, REGION_DISTANCE - .001);
  const draws = ctx.ops.filter(op => op[0] === 'drawImage'), incoming = draws.at(-1);
  assert.equal(draws.length, 2);
  const frozen = [...ctx.ops]; ctx.ops = [];
  art.draw(ctx, 'bode', 844, 390, 10, REGION_DISTANCE - .001);
  assert.deepEqual(ctx.ops, frozen);
  ctx.ops = []; art.draw(ctx, 'bode', 844, 390, 10, REGION_DISTANCE);
  const next = ctx.ops.find(op => op[0] === 'drawImage');
  assert.equal(incoming[1], next[1], 'Incoming bitmap is reused as the current region');
  assert.ok(Math.abs(incoming[2] - next[2]) < .001);
});

test('raster resolution budgets remain bounded across phone, tablet and large desktop dimensions', () => {
  for (const [width,height] of [[844,390],[1366,768],[375,667],[4096,2160]]) {
    for (const low of [false,true]) {
      const size = journeyResolution(width,height,3,low);
      assert.ok(size.pixelWidth * size.pixelHeight * 2 <= (low ? LOW_POWER_JOURNEY_PIXEL_BUDGET : JOURNEY_PIXEL_BUDGET));
    }
  }
});
