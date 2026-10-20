import { getShip } from './ShipCatalog.js';
import { drawCosmeticMark } from './CosmeticEffects.js';

export const TRAIL_SAMPLE_SECONDS = 1 / 30;
export const TRAIL_MAX_POINTS = 144;
const LIFE = 1.35;

export function createCosmeticTrailState() { return { points: [], elapsed: 0, signature: '', run: null, distance: 0 }; }
export function resetCosmeticTrail(state) { state.points = []; state.elapsed = 0; state.signature = ''; state.run = null; state.distance = 0; }

export function advanceCosmeticTrail(state, { game, cosmetic, deltaTime, scale = .18 }) {
  const signature = cosmetic ? `${game.shipType}:${cosmetic.id}` : '';
  const dt = Number.isFinite(deltaTime) ? Math.max(0, Math.min(.1, deltaTime)) : 0;
  const running = game?.phase === 'FLYING' || game?.phase === 'LAUNCH';
  // Pause is a render-only frame: retain the exact history and avoid sampling.
  if (game?.phase === 'PAUSED' && state.signature === signature && state.run === game) return state.points;
  // A new run object or a distance rewind clears old exhaust immediately.
  if (!cosmetic || !game?.player || !running) { resetCosmeticTrail(state); return state.points; }
  if (state.signature !== signature || state.run !== game || Number(game.distance || 0) < state.distance) resetCosmeticTrail(state);
  state.signature = signature; state.run = game;
  if (!dt) return state.points;
  const scroll = Math.max(0, Number(game.speed) || 0) * dt;
  for (const point of state.points) { point.x -= scroll; point.age += dt; }
  state.elapsed += dt;
  if (!state.points.length || state.elapsed + 1e-9 >= TRAIL_SAMPLE_SECONDS) {
    const player = game.player, ship = getShip(game.shipType);
    const radians = (Number(player.rotation) || 0) * Math.PI / 180;
    const cos = Math.cos(radians), sin = Math.sin(radians);
    for (let engine = 0; engine < ship.engines.length; engine++) {
      const port = ship.engines[engine], dx = (port.x - 160) * scale, dy = (port.y - 120) * scale;
      state.points.push({ x: player.x + dx * cos - dy * sin, y: player.y + dx * sin + dy * cos, engine, age: 0 });
    }
    state.elapsed %= TRAIL_SAMPLE_SECONDS;
  }
  state.distance = Number(game.distance || 0);
  state.points = state.points.filter(point => point.age < LIFE && point.x > -72).slice(-TRAIL_MAX_POINTS);
  return state.points;
}

export function drawCosmeticTrail(ctx, points, cosmetic, palette, lowPower = false, effectScale = 1) {
  if (!cosmetic || points.length < 2) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.shadowBlur = 0;
  const engines = new Set(points.map(point => point.engine));
  const segmentBudget = Math.max(2, Math.floor((lowPower ? 18 : 36) / engines.size));
  for (const engine of engines) {
    const path = points.filter(point => point.engine === engine);
    const stride = Math.max(1, Math.ceil((path.length - 1) / segmentBudget));
    for (let i = stride; i < path.length; i += stride) {
      const a = path[i - stride], end = path[i], fade = Math.max(0, 1 - a.age / LIFE);
      // Scale only detail dimensions around the historical sample, preserving its path.
      const scale = Number.isFinite(effectScale) && effectScale > 0 ? effectScale : 1;
      const b = scale === 1 ? end : { ...end, x: a.x + (end.x - a.x) / scale, y: a.y + (end.y - a.y) / scale };
      if (scale !== 1) { ctx.save(); ctx.translate(a.x, a.y); ctx.scale(scale, scale); ctx.translate(-a.x, -a.y); }
      const phase = a.age * 12, nextPhase = b.age * 12;
      ctx.globalAlpha = fade * .12; ctx.strokeStyle = palette.engine; ctx.lineWidth = 1 + 9 * fade;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.globalAlpha = fade * .7; ctx.strokeStyle = palette.core; ctx.lineWidth = 1.3;
      const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
      const wave = (offset, amp, color, width = 1.5) => {
        ctx.strokeStyle = color; ctx.lineWidth = width * fade + .5;
        line(a.x, a.y + offset + Math.sin(phase + offset) * amp, b.x, b.y + offset + Math.sin(nextPhase + offset) * amp);
      };
      switch (cosmetic.id) {
        case 'void_pilot':
          wave(-2, 3, palette.engine); wave(2, -3, palette.trim);
          if (i % 4 === 0) { ctx.beginPath(); ctx.arc(a.x, a.y, 4 * fade, phase, phase + 2); ctx.stroke(); } break;
        case 'solar_forge': {
          // Short, independently drifting embers, with a restrained plume below.
          ctx.globalAlpha = fade * .2; ctx.strokeStyle = palette.engine; ctx.lineWidth = 2 * fade;
          line(a.x, a.y, b.x, b.y);
          if ((i / stride) % 2 === 0) {
            const drift = Math.sin(a.x * .075 + a.age * 4) * (3 + a.age * 6);
            const headX = a.x + Math.cos(a.x * .04) * 2, headY = a.y + drift;
            ctx.globalAlpha = fade * .65; ctx.strokeStyle = palette.engine; ctx.lineWidth = 1.2;
            line(headX - 6, headY + Math.sin(phase) * 1.5, headX, headY);
            ctx.fillStyle = palette.accent; ctx.fillRect(headX, headY - .7, 1.6, 1.4);
          }
          break;
        }
        case 'arctic_pulse':
          if (i % 2 === 0) { ctx.beginPath(); ctx.moveTo(a.x - 3, a.y - 4); ctx.lineTo(a.x, a.y); ctx.lineTo(a.x - 3, a.y + 4); ctx.stroke(); } break;
        case 'cyber_current':
          for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(a.x, a.y + side * 4); ctx.lineTo(b.x, a.y + side * 4); ctx.lineTo(b.x, b.y + side * 4); ctx.stroke(); }
          if (i % 4 === 0) { ctx.fillStyle = palette.core; ctx.fillRect(a.x, a.y + (Math.sin(phase) > 0 ? 3 : -5), 2, 2); } break;
        case 'rose_circuit':
          wave(0, 4, palette.engine); wave(0, -4, palette.trim);
          if (i % 2 === 0) { ctx.fillStyle = palette.core; ctx.beginPath(); ctx.arc(a.x, a.y + Math.sin(phase) * 4, 1.5, 0, Math.PI * 2); ctx.fill(); } break;
        case 'jade_drift':
          wave(0, 3, palette.engine, 5); wave(-2, 2, palette.trim, 1); break;
        case 'pearl_comet':
          ctx.strokeStyle = palette.core; ctx.lineWidth = 1 + 5 * fade; line(a.x, a.y, b.x, b.y); break;
        case 'cobalt_storm':
          ctx.strokeStyle = palette.engine; ctx.beginPath(); ctx.moveTo(a.x, a.y + (i % 2 ? -4 : 4)); ctx.lineTo((a.x + b.x) / 2, (a.y + b.y) / 2 + (i % 2 ? 4 : -4)); ctx.lineTo(b.x, b.y); ctx.stroke();
          if (i % 3 === 0) { ctx.strokeStyle = palette.trim; line(a.x, a.y, a.x - 3, a.y - 6); } break;
        case 'copper_horizon':
          if (i % 2 === 0) { ctx.strokeStyle = palette.engine; line(a.x, a.y - 4, b.x, b.y - 4); line(a.x, a.y + 4, b.x, b.y + 4); ctx.strokeStyle = palette.core; line(a.x, a.y - 4, a.x, a.y + 4); } break;
        case 'prism_voyager':
          wave(-2, 3, palette.accent); wave(0, 3, palette.trim); wave(2, 3, palette.engine); break;
      }
      if ((i / stride) % (lowPower ? 8 : 4) === 0) {
        ctx.globalAlpha = fade * .7;
        drawCosmeticMark(ctx, cosmetic, palette, a.x, a.y, .8 + fade * .5, phase);
      }
      if (scale !== 1) ctx.restore();
    }
  }
  ctx.restore();
}
