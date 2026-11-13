import { cosmeticNodePose, getCosmeticDesign, getCosmeticSurface } from './CosmeticDesigns.js';

const paths = new WeakMap();
function cachedPath(part) {
  if (!paths.has(part)) paths.set(part, new Path2D(part.d));
  return paths.get(part);
}

export function drawCosmeticSurface(ctx, cosmeticId, palette, hullMask) {
  const inlays = getCosmeticSurface(cosmeticId);
  if (!inlays.length) return;
  ctx.save(); ctx.clip(hullMask); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const part of inlays) {
    ctx.save(); ctx.globalAlpha *= part.opacity;
    const shape = cachedPath(part);
    if (part.fill !== 'none') { ctx.fillStyle = palette[part.fill]; ctx.fill(shape); }
    if (part.stroke !== 'none') { ctx.strokeStyle = palette[part.stroke]; ctx.lineWidth = part.width; ctx.stroke(shape); }
    ctx.restore();
  }
  ctx.restore();
}

export function drawCosmeticLayer(ctx, cosmeticId, palette, layer, { time = 0, boosting = false, lowPower = false, reducedMotion = false } = {}) {
  const design = getCosmeticDesign(cosmeticId);
  if (!design) return;
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const group of design.groups) {
    if (group.layer !== layer || (lowPower && group.detail)) continue;
    const pose = cosmeticNodePose(group, time, boosting, reducedMotion);
    ctx.save(); ctx.translate(pose.x, pose.y); ctx.rotate(pose.angle * Math.PI / 180); ctx.scale(pose.sx, pose.sy);
    ctx.globalAlpha *= pose.opacity;
    for (const part of group.parts) {
      ctx.save(); ctx.globalAlpha *= part.opacity;
      const shape = cachedPath(part);
      if (part.fill !== 'none') { ctx.fillStyle = palette[part.fill] || part.fill; ctx.fill(shape); }
      if (part.stroke !== 'none') { ctx.strokeStyle = palette[part.stroke] || part.stroke; ctx.lineWidth = part.width; ctx.stroke(shape); }
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();
}
