import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES } from '../src/game/StageCatalog.js';
import { StageBackground } from '../src/game/StageBackground.js';
import { Renderer } from '../src/game/Renderer.js';
import { ACCOUNT_KEY, saveWallet, loadWallet, getStageOwnership, getEquippedStage, unlockCreditStage, equipStage, syncStoreSnapshot, grantStoreTransaction, getCosmeticOwnership } from '../src/game/Economy.js';

function storage() {
  const data = new Map();
  globalThis.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) };
  return data;
}

test('galaxy destinations are unique, ordered, and permanently purchasable without disturbing store rights', () => {
  assert.equal(STAGES.length, 11); assert.equal(new Set(STAGES.map(s => s.id)).size, 11);
  assert.equal(STAGES[0].price, 0);
  assert.ok(STAGES.slice(1).every((stage, index) => stage.price > STAGES[index].price));
  const data = storage(); saveWallet(2000000);
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
  const account = JSON.parse(data.get(ACCOUNT_KEY)); assert.equal(account.entitlements.cosmetic_void_pilot, true); assert.ok(account.transactions['123']);
  account.equippedStage = 'unknown'; data.set(ACCOUNT_KEY, JSON.stringify(account)); assert.equal(getEquippedStage(), 'default');
  account.equippedStage = 'bode'; data.set(ACCOUNT_KEY, JSON.stringify(account)); assert.equal(getEquippedStage(), 'default');
  saveWallet(19999); const saved = data.get(ACCOUNT_KEY); assert.throws(() => unlockCreditStage('triangulum'), /Not enough/); assert.equal(data.get(ACCOUNT_KEY), saved);
  saveWallet(200000); const stable = data.get(ACCOUNT_KEY), original = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('write failed'); }; assert.throws(() => unlockCreditStage('triangulum'), /write failed/);
  localStorage.setItem = original; assert.equal(data.get(ACCOUNT_KEY), stable); assert.equal(getStageOwnership().triangulum, false);
});

class Context {
  constructor() { this.ops=[]; this.stack=[]; this.globalAlpha=.4; this.lineCap='square'; this.lineJoin='bevel'; this.fillStyle='original-fill'; this.strokeStyle='original-stroke'; this.lineWidth=3; this.shadowBlur=9; this.globalCompositeOperation='lighter'; }
  save() { this.stack.push({ globalAlpha:this.globalAlpha, lineCap:this.lineCap, lineJoin:this.lineJoin, fillStyle:this.fillStyle, strokeStyle:this.strokeStyle, lineWidth:this.lineWidth, shadowBlur:this.shadowBlur, globalCompositeOperation:this.globalCompositeOperation }); }
  restore() { Object.assign(this, this.stack.pop()); }
  createLinearGradient() { return { addColorStop() {} }; }
  createRadialGradient() { return { addColorStop() {} }; }
}
for (const name of ['fillRect','scale','beginPath','moveTo','lineTo','closePath','fill','stroke','ellipse','arc','bezierCurveTo']) Context.prototype[name] = function (...args) { this.ops.push([name,...args]); };

test('stage scenes differ geometrically, bound low-power work and restore canvas state', () => {
  const signatures = STAGES.map(stage => {
    const normal = new Context(), low = new Context(), art = new StageBackground();
    art.draw(normal, stage.id, 520, 230, 1, 100, false);
    art.draw(low, stage.id, 520, 230, 1, 100, true);
    assert.ok(low.ops.length < normal.ops.length); assert.ok(normal.ops.length < 300);
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
});

 test('stage gradient cache invalidates on stage, resize, and reset', () => {
  const ctx = new Context(); let created = 0;
  ctx.createLinearGradient = () => { created++; return { addColorStop() {} }; };
  const art = new StageBackground();
  art.draw(ctx, 'andromeda', 520, 230); art.draw(ctx, 'andromeda', 520, 230);
  assert.equal(created, 1);
  art.draw(ctx, 'bode', 520, 230); art.draw(ctx, 'bode', 600, 230);
  assert.equal(created, 3);
  art.reset(); art.draw(ctx, 'bode', 600, 230); assert.equal(created, 4);
});


test('every paid destination preserves legacy and cosmetic ownership through unlock, equip, and store revocation', () => {
  for (const stage of STAGES.slice(1)) {
    const data = storage();
    // Existing v3 records may omit both stage fields.
    data.set(ACCOUNT_KEY, JSON.stringify({ version: 3, balance: stage.price + 100, transactions: {}, entitlements: {}, legacyPurchases: {}, creditCosmetics: { void_pilot: true } }));
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
