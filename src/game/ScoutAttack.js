export const SCOUT_TRACK_SECONDS = .35;
export const SCOUT_LOCK_SECONDS = .6;
export const SCOUT_WARNING_SECONDS = SCOUT_TRACK_SECONDS + SCOUT_LOCK_SECONDS;
export const SCOUT_BEAM_SECONDS = .22;
export const isScout = enemy => !enemy.type || enemy.type === 'SCOUT';

export function trackScoutAim(enemy, player, elapsed = 0) {
  const aim = enemy.scoutAim ?? { locked: false };
  if (!aim.locked) {
    aim.targetX = player.x + 20;
    aim.targetY = player.y;
    aim.locked = elapsed >= SCOUT_TRACK_SECONDS - 1e-8;
  }
  aim.progress = Math.min(1, elapsed / SCOUT_WARNING_SECONDS);
  enemy.scoutAim = aim;
}

// Continue the exact advertised ray through the locked target to the left edge.
// The muzzle may move, but the target never follows the player after locking.
export function scoutRay(enemy) {
  const x = enemy.x - enemy.width / 2;
  const y = enemy.y;
  const aim = enemy.scoutAim;
  if (!aim || !Number.isFinite(aim.targetX) || aim.targetX >= x) return null;
  return { x, y, endX: 0, endY: y + (aim.targetY - y) * x / (x - aim.targetX) };
}

export class ScoutBeam {
  constructor(enemy) {
    Object.assign(this, scoutRay(enemy), { type: 'SCOUT_BEAM', radius: 6,
      remaining: SCOUT_BEAM_SECONDS, markedForDeletion: false });
  }
  update(dt) {
    this.wasActive = this.remaining < SCOUT_BEAM_SECONDS;
    this.remaining = Math.max(0, this.remaining - Math.max(0, dt));
    if (this.remaining <= 1e-8) this.markedForDeletion = true;
  }
}

// Slab clipping covers beams and fast bullet travel between frames.
export function hostileShotTouchesRect(shot, rect, previousRect = null) {
  if (shot.markedForDeletion) return false;
  const r = shot.radius;
  const beam = shot.type === 'SCOUT_BEAM';
  if (!beam) {
    if (rect.x < shot.x + r && rect.x + rect.w > shot.x - r && rect.y < shot.y + r && rect.y + rect.h > shot.y - r) return true;
    if (!Number.isFinite(shot.previousX) || !Number.isFinite(shot.previousY)) return false;
  }
  // Sweep only a ray that already existed. A freshly fired beam cannot hit the
  // player's old position from the final escape frame of its warning.
  if (beam && previousRect && shot.wasActive) {
    const x = Math.min(rect.x, previousRect.x), y = Math.min(rect.y, previousRect.y);
    rect = { x, y, w: Math.max(rect.x + rect.w, previousRect.x + previousRect.w) - x,
      h: Math.max(rect.y + rect.h, previousRect.y + previousRect.h) - y };
  }
  const x = beam ? shot.x : shot.previousX, y = beam ? shot.y : shot.previousY;
  const endX = beam ? shot.endX : shot.x, endY = beam ? shot.endY : shot.y;
  let start = 0, end = 1;
  for (const [origin, delta, lo, hi] of [
    [x, endX - x, rect.x - r, rect.x + rect.w + r],
    [y, endY - y, rect.y - r, rect.y + rect.h + r],
  ]) {
    if (Math.abs(delta) < 1e-8) { if (origin < lo || origin > hi) return false; }
    else {
      const a = (lo - origin) / delta, b = (hi - origin) / delta;
      start = Math.max(start, Math.min(a, b)); end = Math.min(end, Math.max(a, b));
      if (start > end) return false;
    }
  }
  return true;
}

export function nearestBeamPoint(beam, x, y) {
  const dx = beam.endX - beam.x, dy = beam.endY - beam.y;
  const t = Math.max(0, Math.min(1, ((x - beam.x) * dx + (y - beam.y) * dy) / (dx * dx + dy * dy || 1)));
  return { x: beam.x + dx * t, y: beam.y + dy * t };
}

export function drawScoutAim(ctx, enemy) {
  const ray = scoutRay(enemy), aim = enemy.scoutAim;
  if (!ray || !enemy.attackWarning || enemy.markedForDeletion) return;
  ctx.save();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
  ctx.strokeStyle = '#06121f'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(ray.x, ray.y); ctx.lineTo(ray.endX, ray.endY); ctx.stroke();
  ctx.strokeStyle = aim.locked ? '#ff627d' : '#ffd369'; ctx.lineWidth = 2;
  ctx.setLineDash(aim.locked ? [] : [7, 9]); ctx.stroke(); ctx.setLineDash([]);
  const r = aim.locked ? 12 : 18;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(aim.targetX, aim.targetY, r, 0, Math.PI * 2); ctx.stroke();
  for (const direction of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(aim.targetX + direction * (r - 3), aim.targetY);
    ctx.lineTo(aim.targetX + direction * (r + 5), aim.targetY); ctx.stroke();
  }
  ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left';
  ctx.strokeStyle = '#06121f'; ctx.lineWidth = 4; ctx.fillStyle = aim.locked ? '#ff627d' : '#ffd369';
  const label = aim.locked ? 'LOCKED' : 'TRACKING';
  ctx.strokeText(label, aim.targetX + 24, aim.targetY - 16); ctx.fillText(label, aim.targetX + 24, aim.targetY - 16);
  ctx.restore();
}

export function drawScoutBeam(ctx, beam) {
  ctx.save(); ctx.globalAlpha = Math.max(.4, beam.remaining / SCOUT_BEAM_SECONDS);
  ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(beam.x, beam.y); ctx.lineTo(beam.endX, beam.endY);
  for (const [color, width] of [['#06121f', 17], ['#ff627d', 12], ['#fff2ed', 3]]) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  ctx.restore();
}
