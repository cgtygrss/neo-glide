// Shared, deterministic marks for engine wakes and friendly fire. Coordinates are
// local to the effect, so previews and flight use exactly the same visual language.
export function drawCosmeticMark(ctx, cosmetic, palette, x, y, size, phase = 0) {
  if (!cosmetic) return;
  const id = cosmetic.id;
  ctx.save(); ctx.translate(x, y); ctx.scale(size, size);
  ctx.strokeStyle = palette.trim; ctx.fillStyle = palette.core; ctx.lineWidth = .8;
  ctx.beginPath();
  switch (id) {
    case 'void_pilot':
      ctx.arc(0, 0, 2.4, -.8 + phase, 1.5 + phase); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 1.5, 2.3 + phase, 4.5 + phase); ctx.stroke(); break;
    case 'solar_forge':
      ctx.moveTo(-3, 0); ctx.lineTo(1, -1.5); ctx.lineTo(3, 0); ctx.lineTo(1, 1.5); ctx.closePath(); ctx.fill(); break;
    case 'arctic_pulse':
      ctx.moveTo(-2, -2); ctx.lineTo(0, 0); ctx.lineTo(-2, 2); ctx.moveTo(0, -2); ctx.lineTo(2, 0); ctx.lineTo(0, 2); ctx.stroke(); break;
    case 'cyber_current':
      ctx.moveTo(-3, -2); ctx.lineTo(-1, -2); ctx.lineTo(-1, 2); ctx.lineTo(2, 2); ctx.stroke(); ctx.fillRect(1, 1, 1.5, 1.5); break;
    case 'rose_circuit':
      ctx.moveTo(0, -2.5); ctx.lineTo(2, 0); ctx.lineTo(0, 2.5); ctx.lineTo(-2, 0); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(-3, 0, .7, 0, Math.PI * 2); ctx.fill(); break;
    case 'jade_drift':
      ctx.moveTo(-3, 0); ctx.quadraticCurveTo(0, -3, 3, -2); ctx.quadraticCurveTo(1, 2, -3, 0); ctx.stroke(); break;
    case 'pearl_comet':
      ctx.moveTo(-3, 0); ctx.lineTo(3, 0); ctx.moveTo(0, -3); ctx.lineTo(0, 3); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 2.4, .2, 1.9); ctx.stroke(); break;
    case 'cobalt_storm':
      ctx.moveTo(-3, -2); ctx.lineTo(-1, 0); ctx.lineTo(0, -1); ctx.lineTo(2, 2); ctx.moveTo(0, -1); ctx.lineTo(2, -2); ctx.stroke(); break;
    case 'copper_horizon':
      ctx.moveTo(-3, -2); ctx.lineTo(-3, 2); ctx.moveTo(0, -2); ctx.lineTo(0, 2); ctx.moveTo(3, -2); ctx.lineTo(3, 2); ctx.moveTo(-3, 0); ctx.lineTo(3, 0); ctx.stroke(); break;
    case 'prism_voyager':
      ctx.moveTo(0, -3); ctx.lineTo(3, 0); ctx.lineTo(0, 3); ctx.lineTo(-3, 0); ctx.closePath(); ctx.stroke();
      ctx.strokeStyle = palette.accent; ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(2, 0); ctx.stroke(); break;
  }
  ctx.restore();
}

export function drawCosmeticShot(ctx, cosmetic, age = 1, lowPower = false) {
  if (!cosmetic) return;
  const palette = cosmetic.colors;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = palette.engine; ctx.globalAlpha *= .15; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(8, 0); ctx.stroke();
  ctx.globalAlpha *= 3; ctx.lineWidth = 1.5;
  const phase = age * 12, motion = Math.sin(phase) * 2;
  const stroke = (color = palette.engine, width = 1.5) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); };
  ctx.beginPath();
  switch (cosmetic.id) {
    case 'void_pilot':
      ctx.arc(-21, 0, 8, phase, phase + 2.7); ctx.arc(-21, 0, 5, -phase + 3, -phase + 5.7); stroke(palette.trim); break;
    case 'solar_forge':
      ctx.moveTo(-33, -7 - motion); ctx.lineTo(-10, -2); ctx.moveTo(-33, 7 + motion); ctx.lineTo(-10, 2); ctx.moveTo(-37, motion); ctx.lineTo(-13, 0); stroke(palette.accent); break;
    case 'arctic_pulse':
      ctx.moveTo(-30 + motion, -6); ctx.lineTo(-24 + motion, 0); ctx.lineTo(-30 + motion, 6); ctx.moveTo(-22 + motion, -5); ctx.lineTo(-17 + motion, 0); ctx.lineTo(-22 + motion, 5); stroke(palette.core); break;
    case 'cyber_current':
      ctx.moveTo(-34, -6); ctx.lineTo(-25 + motion, -6); ctx.lineTo(-25 + motion, -3); ctx.lineTo(-11, -3); ctx.moveTo(-34, 6); ctx.lineTo(-25 - motion, 6); ctx.lineTo(-25 - motion, 3); ctx.lineTo(-11, 3); stroke(palette.trim); break;
    case 'rose_circuit':
      ctx.moveTo(-34, motion); ctx.quadraticCurveTo(-23, -9 - motion, -11, motion); ctx.moveTo(-34, -motion); ctx.quadraticCurveTo(-23, 9 + motion, -11, -motion); stroke(palette.engine);
      ctx.fillStyle = palette.core; ctx.beginPath(); ctx.arc(-24, -4 - motion, 1.8, 0, Math.PI * 2); ctx.fill(); break;
    case 'jade_drift':
      ctx.moveTo(-35, -2 + motion); ctx.quadraticCurveTo(-22, 6 - motion, -10, 0); stroke(palette.engine, 4); break;
    case 'pearl_comet':
      ctx.moveTo(-36, motion); ctx.lineTo(-12, -4); ctx.lineTo(-12, 4); ctx.closePath(); ctx.fillStyle = palette.core; ctx.fill(); break;
    case 'cobalt_storm':
      ctx.moveTo(-35, -5 + motion); ctx.lineTo(-27, 1 - motion); ctx.lineTo(-23, -4 + motion); ctx.lineTo(-17, 4 - motion); ctx.lineTo(-11, -2); ctx.moveTo(-23, -4 + motion); ctx.lineTo(-20, -8); stroke(palette.trim); break;
    case 'copper_horizon':
      ctx.moveTo(-32, -5); ctx.lineTo(-12, -5); ctx.moveTo(-32, 5); ctx.lineTo(-12, 5); ctx.moveTo(-27 + motion, -5); ctx.lineTo(-27 + motion, 5); ctx.moveTo(-19 + motion, -5); ctx.lineTo(-19 + motion, 5); stroke(palette.trim); break;
    case 'prism_voyager':
      for (const [index, color] of [palette.accent, palette.trim, palette.engine].entries()) {
        const y = Math.sin(phase + index * 2.1) * 4;
        ctx.beginPath(); ctx.moveTo(-34, y); ctx.quadraticCurveTo(-23, -y, -11, y * .5); stroke(color);
      } break;
  }
  drawCosmeticMark(ctx, cosmetic, palette, -20, 0, 1.25, age * 2);
  if (!lowPower) drawCosmeticMark(ctx, cosmetic, palette, -28, 0, .65, age * 2 + 1);
  ctx.restore();
}

// Render at the firing origin, independently of the traveling projectile.
export function drawCosmeticMuzzle(ctx, cosmetic, age) {
  if (!cosmetic || age < 0 || age >= .12) return;
  ctx.save(); ctx.globalAlpha *= (1 - age / .12) * .65;
  ctx.strokeStyle = cosmetic.colors.core; ctx.lineWidth = 1.5;
  const radius = 4 + age * 35;
  ctx.beginPath(); ctx.arc(0, 0, radius, -.8, .8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -radius); ctx.lineTo(-5, -radius - 3); ctx.moveTo(0, radius); ctx.lineTo(-5, radius + 3); ctx.stroke();
  ctx.restore();
}
