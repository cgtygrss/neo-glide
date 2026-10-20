import { VoltBolt } from './VoltBolt.js';
import { StrikerMissile } from './StrikerMissile.js';
import { getTransformation, TRANSFORMATIONS, TRANSFORMATION_SECONDS, ENTRY_PROTECTION_SECONDS, transformationEntryCues, transformationTransitionDuration, transformationProgress, transformationWorldDelta } from './TransformationCatalog.js';

export const createTransformationDirector = () => ({ normalTime: 0, nextAt: 15, capsule: null, bag: [], lastId: null });
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export function transformationArena(width, height) {
  // These are movement bounds inside the existing flight, not a separate arena.
  const top = Math.min(8, height * .02);
  const bottom = Math.max(top + 60, height - Math.min(80, height * .2));
  const span = bottom - top;
  return { width, height, top, bottom, span, x: Math.min(112, width * .23) };
}
function shuffled(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(clamp(random(), 0, .999999) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function nextVehicle(director, random) {
  if (!director.bag.length) {
    director.bag = shuffled(TRANSFORMATIONS.map(item => item.id), random);
    if (director.bag[0] === director.lastId) [director.bag[0], director.bag[1]] = [director.bag[1], director.bag[0]];
  }
  const id = director.bag.shift();
  director.lastId = id;
  return id;
}
export function beginTransformation(game, id, width, height) {
  if (game.transformation || game.phase !== 'FLYING' || game.gameOver || !getTransformation(id)) return false;
  const arena = transformationArena(width, height);
  game.transformationDirector ||= createTransformationDirector();
  game.transformationDirector.capsule = null;
  game.transformation = {
    id, phase: 'ENTERING', transitionTime: 0, remaining: TRANSFORMATION_SECONDS, elapsed: 0,
    reducedMotion: Boolean(game.launch?.reducedMotion), entryProtection: 0, cueIndex: 0,
    speed: game.speed,
    arena, origin: { x: game.player.x, y: game.player.y, rotation: game.player.rotation }, x: game.player.x + 20, y: game.player.y, vy: 0,
    baseX: game.player.x + 20, dashRemaining: 0, shieldRemaining: 0, arcs: [], gravity: 1, cooldown: 0,
    travel: 0, pulse: 0, trail: [], exitReason: null,
  };
  game.player.boost(false);
  game.visualRevision = (game.visualRevision || 0) + 1;
  return true;
}

// Only normal, active flight advances the capsule schedule. A missed capsule
// leaves the bag untouched, so every five collected capsules cover all modes.
export function advanceTransformationCapsule(game, dt, width, height, random = Math.random) {
  if (game.phase !== 'FLYING' || game.gameOver || game.transformation) return false;
  const director = game.transformationDirector ||= createTransformationDirector();
  director.normalTime += Math.max(0, dt);
  if (!director.capsule && director.normalTime >= director.nextAt) {
    const y = clamp(game.player.y, 60, Math.max(60, height - 120));
    director.capsule = { x: width + 30, y, radius: 29, age: 0 };
  }
  const capsule = director.capsule;
  if (!capsule) return false;
  capsule.age += dt;
  capsule.x -= game.speed * dt;
  if (capsule.x < -capsule.radius) { director.capsule = null; director.nextAt = director.normalTime + 12; return false; }
  if (Math.hypot(capsule.x - (game.player.x + 16), capsule.y - game.player.y) <= capsule.radius + 22) {
    return beginTransformation(game, nextVehicle(director, random), width, height);
  }
  return false;
}

export function transformationPrimary(game) {
  const form = game.transformation;
  if (game.phase !== 'FLYING' || form?.phase !== 'ACTIVE') return false;
  if (form.id === 'volt') form.vy = -form.arena.span * .48;
  else if (['drill', 'aegis', 'striker'].includes(form.id)) return true;
  else { form.gravity *= -1; form.vy = 0; }
  return true;
}
export function transformationSecondary(game) {
  const form = game.transformation;
  if (game.phase !== 'FLYING' || form?.phase !== 'ACTIVE' || form.cooldown > 0) return false;
  form.cooldown = getTransformation(form.id).cooldown;
  form.pulse = .32;
  if (form.id === 'striker') {
    for (const offset of [-12, 0, 12]) {
      game.playerProjectiles.push(new StrikerMissile(game, form.x + 30, form.y + offset, form.arena.width, form.arena.height));
    }
    return true;
  }
  if (form.id === 'drill') form.dashRemaining = .55;
  if (form.id === 'aegis') form.shieldRemaining = 2;
  if (form.id === 'volt') {
    game.playerProjectiles.push(new VoltBolt(game, form.x + 28, form.y, form.arena.width));
    return true;
  }
  clearTransformationHazards(game);
  return true;
}
function clearTransformationHazards(game) {
  const form = game.transformation;
  // Act on the same hazards the normal ship encounters, without creating rewards.
  for (const hazard of [...game.obstacles, ...game.projectiles]) {
    if (hazard.markedForDeletion) continue;
    const nearestX = clamp(form.x, hazard.x - (hazard.radius || 0), hazard.x + (hazard.width || hazard.radius || 0));
    const nearestY = clamp(form.y, hazard.y - (hazard.radius || 0), hazard.y + (hazard.height || hazard.radius || 0));
    const dx = nearestX - form.x, dy = nearestY - form.y;
    if (form.id === 'aegis' ? Math.hypot(dx, dy) < 65 : form.id === 'drill' ? dx >= -32 && dx <= 95 && Math.abs(dy) < 34 : Math.hypot(dx, dy) < 150) hazard.markedForDeletion = true;
  }
  return true;
}
export function requestTransformationExit(game, reason = 'timeout') {
  const form = game.transformation;
  if (!form || form.phase === 'EXITING') return false;
  form.phase = 'EXITING'; form.transitionTime = 0; form.exitReason = reason;
  form.trail = []; form.arcs = []; form.shieldRemaining = 0;
  return true;
}
function finishTransformation(game, width, height, held) {
  const form = game.transformation;
  if (!form) return;
  game.transformation = null;
  game.player.x = clamp(form.x - 20, 0, Math.max(0, width - 40));
  game.player.y = clamp(form.y, 30, height - 30); game.player.velocity = 0; game.player.rotation = 0;
  game.player.boost(Boolean(held && game.energy > 0));
  game.hitProtection = Math.max(game.hitProtection || 0, 1);
  game.transformationSafety = 1;
  game.transformationDirector.nextAt = game.transformationDirector.normalTime + 30;
  game.visualRevision = (game.visualRevision || 0) + 1;
}
export function resetTransformations(game, fresh = false) {
  game.transformation = null;
  game.transformationSafety = 0;
  game.transformationUiTimer = 0;
  game.worldTimeScale = 1;
  if (fresh || !game.transformationDirector) game.transformationDirector = createTransformationDirector();
  else { game.transformationDirector.capsule = null; game.transformationDirector.nextAt = game.transformationDirector.normalTime + 30; }
  game.visualRevision = (game.visualRevision || 0) + 1;
}
export function resizeTransformation(game, width, height) {
  const form = game.transformation;
  if (!form || (form.arena.width === width && form.arena.height === height)) return;
  const old = form.arena, fraction = (form.y - old.top) / old.span;
  form.arena = transformationArena(width, height);
  form.x = clamp(form.x, 30, Math.max(30, width - 30));
  form.y = clamp(form.arena.top + fraction * form.arena.span, form.arena.top + 23, form.arena.bottom - 23);
  form.vy = 0; form.baseX = form.x; form.dashRemaining = 0;
  form.trail = [];
  syncPlayer(game);
}

// The normal flight loop owns scenery, encounters, rewards, distance and clocks.
function syncPlayer(game) {
  const form = game.transformation;
  if (!form) return;
  game.player.x = form.x - 20;
  game.player.y = form.y;
  game.player.velocity = 0;
}
export function transformationHitbox(game) {
  const form = game.transformation;
  if (!form) return { x: game.player.x, y: game.player.y - 10, w: 40, h: 20 };
  const w = form.id === 'volt' ? 54 : form.id === 'aegis' ? 42 : form.id === 'drill' ? 64 : form.id === 'striker' ? 58 : 38;
  const h = form.id === 'volt' ? 24 : form.id === 'aegis' ? 42 : form.id === 'drill' ? 30 : form.id === 'striker' ? 30 : 38;
  return { x: form.x - w / 2, y: form.y - h / 2, w, h };
}
export const transformationProtected = game => Boolean(game.transformation && (game.transformation.phase !== 'ACTIVE' || game.transformation.entryProtection > 0));
export function absorbTransformationHit(game) {
  if (!game.transformation) return false;
  if (transformationProtected(game)) return true;
  if (game.transformation.id === 'aegis' && game.transformation.shieldRemaining > 0) return true;
  if (game.transformation.id === 'drill' && game.transformation.dashRemaining > 0) return true;
  requestTransformationExit(game, 'collision');
  return true;
}

export function advanceTransformation(game, dt, width, height, held = false) {
  const result = { credits: 0, collected: 0, exited: false, cues: [], worldDelta: transformationWorldDelta(game, dt) };
  if (!game.transformation || game.phase !== 'FLYING' || game.gameOver) return result;
  resizeTransformation(game, width, height);
  let left = clamp(Number(dt) || 0, 0, .1);
  while (left > 1e-8 && game.transformation) {
    const form = game.transformation;
    const boundary = form.phase === 'ACTIVE' ? form.remaining : transformationTransitionDuration(form) - form.transitionTime;
    const step = Math.min(left, 1 / 120, Math.max(1e-8, boundary)); left -= step;
    if (form.phase !== 'ACTIVE') {
      form.transitionTime += step;
      if (form.phase === 'ENTERING') {
        const cues = transformationEntryCues(form);
        while (form.cueIndex < cues.length && form.transitionTime + 1e-8 >= cues[form.cueIndex][0]) result.cues.push(cues[form.cueIndex++][1]);
      }
      if (form.transitionTime + 1e-8 >= transformationTransitionDuration(form)) {
        if (form.phase === 'ENTERING') { form.phase = 'ACTIVE'; form.transitionTime = 0; form.entryProtection = ENTRY_PROTECTION_SECONDS; }
        else { finishTransformation(game, width, height, held); result.exited = true; }
      }
      continue;
    }
    form.entryProtection = Math.max(0, form.entryProtection - step);
    form.elapsed += step; form.remaining = Math.max(0, TRANSFORMATION_SECONDS - form.elapsed);
    form.cooldown = Math.max(0, form.cooldown - step); form.pulse = Math.max(0, form.pulse - step);
    form.shieldRemaining = Math.max(0, form.shieldRemaining - step);
    if (form.shieldRemaining < 1e-8) form.shieldRemaining = 0;
    if (form.pulse <= 0) form.arcs = [];
    if (form.cooldown < 1e-8) form.cooldown = 0;
    if (form.id === 'striker') {
      const target = form.arena.span * (held ? -.4 : .24);
      form.vy += (target - form.vy) * (1 - Math.exp(-8 * step));
      form.y += form.vy * step;
      const y = clamp(form.y, form.arena.top + 24, form.arena.bottom - 24);
      if (y !== form.y) form.vy = 0;
      form.y = y;
    } else if (form.id === 'volt') {
      form.vy = clamp(form.vy + form.arena.span * .65 * step, -form.arena.span * .48, form.arena.span * .4);
      form.y += form.vy * step;
      const y = clamp(form.y, form.arena.top + 20, form.arena.bottom - 20);
      if (y !== form.y) form.vy = 0;
      form.y = y;
    } else if (form.id === 'aegis') {
      const target = form.arena.span * (held ? -.32 : .20);
      form.vy += (target - form.vy) * (1 - Math.exp(-6 * step));
      form.y += form.vy * step;
      const y = clamp(form.y, form.arena.top + 24, form.arena.bottom - 24);
      if (y !== form.y) form.vy = 0;
      form.y = y;
      if (form.shieldRemaining > 0) clearTransformationHazards(game);
    } else if (form.id === 'drill') {
      // A damped hover motor: predictable hold/release control without lane jumps.
      const targetVelocity = form.arena.span * (held ? -.48 : .25);
      form.vy += (targetVelocity - form.vy) * (1 - Math.exp(-7 * step));
      form.y += form.vy * step;
      const y = clamp(form.y, form.arena.top + 24, form.arena.bottom - 24);
      if (y !== form.y) form.vy = 0;
      form.y = y;
      if (form.dashRemaining > 0) {
        form.dashRemaining = Math.max(0, form.dashRemaining - step);
        const reach = Math.max(0, Math.min(100, (width - form.baseX - 40) * .45));
        form.x = form.baseX + Math.sin((1 - form.dashRemaining / .55) * Math.PI) * reach;
        clearTransformationHazards(game);
      } else form.x = form.baseX;
    } else {
      // Approximately 2.5s to cross the screen, including a gentle acceleration.
      const maxSpeed = form.arena.span * .42;
      form.vy = clamp(form.vy + form.gravity * form.arena.span * .9 * step, -maxSpeed, maxSpeed);
      form.y += form.vy * step;
      const y = clamp(form.y, form.arena.top + 22, form.arena.bottom - 22);
      if (y !== form.y) form.vy = 0;
      form.y = y;
    }
    form.speed = game.speed * (game.timeSlowMultiplier || 1);
    form.travel += form.speed * step;
    syncPlayer(game);
    if (!form.trail.length || form.elapsed - form.trail.at(-1).time > .035) form.trail.push({ x: form.x, y: form.y, time: form.elapsed });
    for (const point of form.trail) point.x -= form.speed * step;
    form.trail = form.trail.filter(point => form.elapsed - point.time < .5).slice(-16);
    if (form.remaining <= 1e-8) requestTransformationExit(game, 'timeout');
  }
  syncPlayer(game);
  return result;
}
export function transformationHud(game) {
  const form = game.transformation;
  return form ? { ...getTransformation(form.id), phase: form.phase, transitionProgress: transformationProgress(form), transitionDuration: transformationTransitionDuration(form), remaining: form.remaining, cooldownRemaining: form.cooldown, shieldRemaining: form.shieldRemaining } : null;
}
