import test from 'node:test';
import assert from 'node:assert/strict';
import { Player, Obstacle, Projectile } from '../src/game/Entities.js';
import { GameLoop } from '../src/game/GameLoop.js';
import { pauseFlight, resumeFlight, takeFlightControl } from '../src/game/FlightStart.js';
import { takeProjectileHit } from '../src/game/PlayerHealth.js';
import { TRANSFORMATIONS, TRANSFORMATION_ASSEMBLIES, ENTRY_SECONDS, EXIT_SECONDS, transformationWorldDelta, transformationEntryDuration, transformationCapsuleClosure } from '../src/game/TransformationCatalog.js';
import { beginTransformation, advanceTransformation, absorbTransformationHit, resetTransformations, resizeTransformation, transformationPrimary, transformationSecondary, transformationHud } from '../src/game/Transformations.js';
import { drawTransformationVehicle, drawTransformationCinematic, transformationCinematicPose } from '../src/game/TransformationArt.js';
import { Renderer } from '../src/game/Renderer.js';
import { SHIPS } from '../src/game/ShipCatalog.js';
import { COSMETICS } from '../src/game/CosmeticsCatalog.js';

function flight(id = 'striker', reducedMotion = false) {
  const game = { phase: 'FLYING', player: new Player(), health: 100, energy: 80, speed: 400, ammo: 10,
    obstacles: [], projectiles: [], playerProjectiles: [], activePowerUps: [], launch: { reducedMotion } };
  game.player.y = 280;
  beginTransformation(game, id, 800, 600);
  return game;
}
function advance(game, seconds, dt = 1 / 60, held = false) {
  const cues = []; let world = 0;
  for (let t = 0; t < seconds - 1e-8; t += dt) {
    const result = advanceTransformation(game, Math.min(dt, seconds - t), 800, 600, held);
    cues.push(...result.cues); world += result.worldDelta;
  }
  return { cues, world };
}

test('all five assemblies protect the core, reject buffered actions and start a full 12 seconds at handoff', () => {
  for (const model of TRANSFORMATIONS) {
    const game = flight(model.id), x = game.player.x, y = game.player.y;
    const cues = advance(game, ENTRY_SECONDS - .1).cues;
    assert.equal(game.transformation.phase, 'ENTERING');
    assert.equal(transformationPrimary(game), false);
    assert.equal(transformationSecondary(game), false);
    assert.equal(absorbTransformationHit(game), true);
    const shot = {}; takeProjectileHit(game, shot);
    assert.equal(shot.markedForDeletion, true);
    assert.equal(game.health, 100); assert.equal(game.transformation.phase, 'ENTERING');
    assert.deepEqual([game.player.x, game.player.y], [x, y]);
    assert.deepEqual(cues, ['fold', 'lock', 'lock', 'activate']);
    advance(game, .1);
    assert.equal(game.transformation.phase, 'ACTIVE');
    assert.equal(game.transformation.remaining, 12);
    assert.equal(game.transformation.cooldown, 0);
    assert.equal(game.playerProjectiles.length, 0);
    takeProjectileHit(game, {}); absorbTransformationHit(game);
    assert.equal(game.transformation.phase, 'ACTIVE', 'handoff grace protects against overlapping threats');
    advance(game, .35);
    absorbTransformationHit(game);
    assert.equal(game.transformation.phase, 'EXITING');
    advance(game, EXIT_SECONDS - .01); assert.ok(game.transformation);
    advance(game, .01); assert.equal(game.transformation, null);
  }
});

test('cinematic world time composes with TIME_SLOW, splits boundary frames, and moves real hazards consistently', t => {
  const previousWindow=globalThis.window;globalThis.window={innerWidth:1440,innerHeight:900};t.after(()=>{globalThis.window=previousWindow;});
  for (const slow of [false, true]) {
    const positions = [];
    for (const dt of [1 / 30, 1 / 60, .1]) {
      const game = flight('volt');
      if (slow) game.activePowerUps.push({ type: 'TIME_SLOW', remainingTime: 10 });
      const obstacle = new Obstacle(1000, 0, 50, 80), shot = new Projectile(1000, 200, -500, 0);
      let world = 0;
      const duration = ENTRY_SECONDS + .13;
      for (let t = 0; t < duration - 1e-8; t += dt) {
        const real = Math.min(dt, duration - t);
        const result = advanceTransformation(game, real, 800, 600);
        obstacle.update(result.worldDelta, game.speed); shot.update(result.worldDelta);
        world += result.worldDelta;
      }
      assert.ok(Math.abs(world - (ENTRY_SECONDS * .2 + .13) * (slow ? .5 : 1)) < 1e-8);
      assert.ok(Math.abs(game.transformation.elapsed - .13) < 1e-8);
      positions.push([obstacle.x, shot.x]);
    }
    for (const position of positions) position.forEach((x, i) => assert.ok(Math.abs(x - positions[0][i]) < 1e-7));
  }
  const game = flight(); game.transformation.transitionTime = 1.57;
  assert.ok(Math.abs(transformationWorldDelta(game, .1) - .076) < 1e-8);
});

test('pause, deliberate resume, resize and restart retain or clear cinematic progress and cue ownership', () => {
  const game = flight('aegis');
  assert.deepEqual(advance(game, .7).cues, ['fold', 'lock']);
  const progress = game.transformation.transitionTime;
  pauseFlight(game); const before = structuredClone(game.transformation);
  assert.deepEqual(advance(game, 3).cues, []); assert.deepEqual(game.transformation, before);
  resizeTransformation(game, 320, 550);
  assert.equal(game.transformation.transitionTime, progress);
  assert.ok(Number.isFinite(transformationCinematicPose(game.transformation, 320, 550).scale));
  resumeFlight(game); assert.deepEqual(advance(game, .1).cues, []);
  takeFlightControl(game, true);
  assert.deepEqual(advance(game, .9).cues, ['lock', 'activate']);
  resetTransformations(game, true);
  assert.equal(game.transformation, null); assert.equal(game.worldTimeScale, 1);
  beginTransformation(game, 'sphere', 320, 550);
  assert.deepEqual(advance(game, .05).cues, ['fold']);
});

test('reduced motion uses a short local equipment fade, with the same protected handoff and independent exit duration', () => {
  const game = flight('drill', true);
  assert.equal(transformationEntryDuration(game.transformation), .25);
  assert.deepEqual(advance(game, .25).cues, ['fold', 'activate']);
  assert.equal(game.transformation.phase, 'ACTIVE'); assert.equal(game.transformation.remaining, 12);
  advance(game, 12); assert.equal(game.transformation.phase, 'EXITING');
  advance(game, EXIT_SECONDS); assert.equal(game.transformation, null);
});

globalThis.Path2D = class { constructor(d) { this.d=d; } };

// Records drawing operations and verifies every save/restore, without a browser dependency.
class Context {
  constructor() { this.ops = []; this.stack = []; this.hullDraws = []; this.globalAlpha = .4; this.globalCompositeOperation = 'lighter'; this.shadowBlur = 9; }
  save() { this.stack.push(Object.fromEntries(Object.entries(this).filter(([key]) => !['ops', 'stack'].includes(key)))); }
  restore() { const state = this.stack.pop(); for (const key of Object.keys(this)) if (!['ops', 'stack'].includes(key)) delete this[key]; Object.assign(this, state); }
}
for (const method of ['beginPath', 'moveTo', 'lineTo', 'closePath', 'stroke', 'fill', 'translate', 'rotate', 'scale', 'arc', 'fillRect', 'clip', 'quadraticCurveTo']) {
  Context.prototype[method] = function (...args) {
    for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg));
    this.ops.push([method, ...args]);
    if (['fill','stroke'].includes(method) && args[0] instanceof Path2D) this.hullDraws.push({ path: args[0].d, alpha: this.globalAlpha, color: method === 'fill' ? this.fillStyle : this.strokeStyle });
  };
}

test('each cinematic is deterministic, bounded, read-only, fits viewports and restores Canvas state', () => {
  for (const model of TRANSFORMATIONS) for (const cosmetic of ['', ...COSMETICS.map(item => item.id)]) {
    const game = flight(model.id); game.cosmeticId = cosmetic;
    const specs = TRANSFORMATION_ASSEMBLIES[model.id];
    assert.equal(new Set(specs.map(piece => piece.id)).size, specs.length);
    assert.ok(specs.every(piece => piece.start >= .25 && piece.start + piece.duration <= 1.1 + 1e-8));
    for (const time of [0, .15, .38, .65, .95, 1.22, 1.5, 1.6]) {
      game.transformation.transitionTime = time;
      for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1440, 900]]) {
        const before = structuredClone(game), ctx = new Context();
        drawTransformationCinematic(ctx, game, width, height, false);
        assert.deepEqual(structuredClone(game), before); assert.equal(ctx.stack.length, 0);
        assert.equal(ctx.globalAlpha, .4); assert.equal(ctx.globalCompositeOperation, 'lighter'); assert.equal(ctx.shadowBlur, 9);
        assert.ok(ctx.ops.length < 1300);
        const repeated = new Context(); drawTransformationCinematic(repeated, game, width, height);
        assert.deepEqual(repeated.ops, ctx.ops);
        const pose = transformationCinematicPose(game.transformation, width, height);
        assert.ok(pose.scale > 0 && pose.scale <= 3.4);
      }
    }
    game.transformation.transitionTime = 1.22;
    const normal = new Context(), low = new Context();
    drawTransformationCinematic(normal, game, 800, 600, false);
    drawTransformationCinematic(low, game, 800, 600, true);
    assert.ok(low.ops.length < normal.ops.length);
    game.transformation.reducedMotion = true;
    const reduced = new Context(); drawTransformationCinematic(reduced, game, 800, 600);
    assert.equal(reduced.ops.length, 0);
  }
});

test('final assembled geometry matches active vehicle geometry and both exit reasons render without mutation', () => {
  for (const model of TRANSFORMATIONS) {
    const game = flight(model.id), form = game.transformation;
    form.transitionTime = ENTRY_SECONDS;
    const complete = new Context(); drawTransformationVehicle(complete, form);
    form.phase = 'ACTIVE'; const active = new Context(); drawTransformationVehicle(active, form);
    const geometry = ctx => ctx.ops.filter(([name]) => !['translate', 'rotate'].includes(name));
    assert.deepEqual(geometry(complete), geometry(active));
    for (const reason of ['timeout', 'collision']) {
      form.phase = 'EXITING'; form.exitReason = reason; form.transitionTime = .15;
      const before = structuredClone(form), ctx = new Context();
      drawTransformationVehicle(ctx, form);
      assert.deepEqual(form, before); assert.equal(ctx.stack.length, 0); assert.ok(ctx.ops.length < 1000);
    }
  }
});

test('Renderer uses the same scaled clock for the background, speed lines, particles and cosmetic animation', () => {
  const game = flight(); game.worldTimeScale = .1;
  // Exercise actual drawScene timing, substituting only drawing surfaces.
  const renderer = Object.create(Renderer.prototype), calls = [];
  renderer.ctx = new Context(); renderer.cosmeticEffectTime = 0;renderer.width=800;renderer.height=600;
  for (const name of ['clear', 'drawLaunchBay', 'drawObstacles', 'drawVillain', 'drawCollectibles', 'drawFuels', 'drawHealthPickups', 'drawPowerUps', 'drawPlayerProjectiles', 'drawFloatingTexts', 'drawProjectiles']) renderer[name] = () => {};
  renderer.drawBackground = (speed, dt) => calls.push(dt);
  renderer.drawSpeedLines = (speed, dt) => calls.push(dt);
  renderer.drawEffects = dt => calls.push(dt);
  renderer.drawPlayer = () => {};
  renderer.drawScene(game, .1);
  assert.ok(calls.every(dt => Math.abs(dt - .01) < 1e-8));
  assert.ok(Math.abs(renderer.cosmeticEffectTime - .01) < 1e-8);
  game.phase = 'PAUSED'; calls.length = 0; renderer.drawScene(game, .1);
  assert.ok(calls.every(dt => dt === 0));
});

test('a hidden tab does not advance animation or replay missed frames on return', t => {
  const documentBefore = globalThis.document, rafBefore = globalThis.requestAnimationFrame;
  t.after(() => { globalThis.document = documentBefore; globalThis.requestAnimationFrame = rafBefore; });
  globalThis.document = { hidden: true }; globalThis.requestAnimationFrame = () => 1;
  const game = flight(), deltas = [];
  const loop = new GameLoop(dt => { deltas.push(dt); advanceTransformation(game, dt, 800, 600); }, () => {});
  loop.isRunning = true; loop.loop(5000);
  assert.equal(game.transformation.transitionTime, 0); assert.deepEqual(deltas, []);
  globalThis.document.hidden = false; loop.loop(5017);
  assert.ok(Math.abs(game.transformation.transitionTime - .017) < 1e-8);
  assert.ok(Math.abs(deltas[0] - .017) < 1e-8);
});

test('HUD exposes transition progress without spending vehicle time', () => {
  const game = flight(); advance(game, .8);
  const hud = transformationHud(game);
  assert.ok(Math.abs(hud.transitionProgress-.5)<1e-8); assert.equal(hud.remaining, 12);
});


test('a transient zero-size canvas during layout or preview refresh cannot crash rendering', () => {
  const renderer=Object.create(Renderer.prototype);renderer.width=0;renderer.height=0;
  renderer.clear=()=>assert.fail('A zero-sized canvas should not render');
  assert.doesNotThrow(()=>renderer.drawScene(flight(),1/60));
});


test('each capsule encloses the selected ship during assembly and reveals it again during removal', () => {
  for (const ship of SHIPS) for (const model of TRANSFORMATIONS) for (const cosmetic of ['',COSMETICS[0].id]) {
    const game=flight(model.id);game.shipType=ship.id;game.cosmeticId=cosmetic;
    for (const reducedMotion of [false,true]) for (const [phase,time] of [['ENTERING',0],['ENTERING',.12],['ENTERING',.65],['ENTERING',1.2],['ACTIVE',0],['EXITING',0],['EXITING',.15],['EXITING',.3]]) {
      const form=game.transformation;form.phase=phase;form.transitionTime=time;form.reducedMotion=reducedMotion;
      const ctx=new Context();drawTransformationVehicle(ctx,form,cosmetic,false,reducedMotion,ship.id);
      for (const piece of ship.parts) {
        const draws=ctx.hullDraws.filter(draw=>draw.path===piece.d);
        assert.ok(draws.length>0,`${model.id}/${ship.id}/${phase}: missing selected hull part`);
        assert.ok(draws.every(draw=>Math.abs(draw.alpha-(piece.opacity ?? 1)*(1-.92*transformationCapsuleClosure(form)))<1e-8),`${model.id}/${ship.id}/${phase}: incorrect hull visibility inside the capsule`);
      }
      assert.equal(ctx.stack.length,0);assert.equal(ctx.globalAlpha,.4);
      if (phase==='ENTERING' && !reducedMotion) {
        const cinematic=new Context();drawTransformationCinematic(cinematic,game,800,600);
        assert.deepEqual(cinematic.hullDraws.map(draw=>draw.path),ctx.hullDraws.map(draw=>draw.path),'Close-up must use the same selected hull as active flight');
      }
    }
  }
});

test('capsules close progressively, conceal the original hull while active, and reopen on exit', () => {
  for(const model of TRANSFORMATIONS) {
    const game=flight(model.id), form=game.transformation;
    for(const [time,expected] of [[0,0],[.25,0],[.535,.5],[.82,1],[1.6,1]]) {
      form.transitionTime=time;
      assert.ok(Math.abs(transformationCapsuleClosure(form)-expected)<1e-8);
    }
    form.phase='ACTIVE';
    const ctx=new Context();drawTransformationVehicle(ctx,form);
    assert.ok(ctx.hullDraws.length>0);
    assert.ok(ctx.hullDraws.every(draw=>draw.alpha<=.08+1e-8),'The source ship must not dominate the ability silhouette');
    form.phase='EXITING';
    for(const [time,expected] of [[0,1],[.15,.5],[.3,0]]) {
      form.transitionTime=time;
      assert.ok(Math.abs(transformationCapsuleClosure(form)-expected)<1e-8);
    }
    form.phase='ENTERING';form.reducedMotion=true;form.transitionTime=.125;
    assert.ok(Math.abs(transformationCapsuleClosure(form)-.5)<1e-8);
  }
});
