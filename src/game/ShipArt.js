import { getEngineFlame, getShip } from "./ShipCatalog.js";
import { drawCosmeticMark, drawCosmeticShot } from "./CosmeticEffects.js";
import { getCosmetic, getCosmeticPalette } from "./CosmeticsCatalog.js";

const cachedArt = new Map();

function getArt(ship) {
  if (!cachedArt.has(ship.id)) {
    cachedArt.set(ship.id, {
      parts: ship.parts.map((part) => ({ ...part, path: new Path2D(part.d) })),
      engines: ship.engines.map((port) => ({
        ...port,
        idle: new Path2D(getEngineFlame(port)),
        boost: new Path2D(getEngineFlame(port, true)),
      })),
    });
  }
  return cachedArt.get(ship.id);
}

// Draws in catalog coordinates. Caller controls position/scale and owns world effects.
export function drawShipArt(ctx, shipId, { boosting = false, time = 0, cosmeticId = null, lowPower = false } = {}) {
  const ship = getShip(shipId);
  const art = getArt(ship);
  const palette = getCosmeticPalette(ship.palette, cosmeticId);
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const port of art.engines) {
    ctx.save();
    ctx.translate(port.x, port.y);
    ctx.scale(0.94 + Math.sin(time * 15 + port.y) * 0.06, 1);
    ctx.translate(-port.x, -port.y);
    const inheritedAlpha = ctx.globalAlpha;
    ctx.fillStyle = palette.engine;
    ctx.globalAlpha = inheritedAlpha * (boosting ? 0.9 : 0.6);
    ctx.fill(boosting ? port.boost : port.idle);
    ctx.translate(port.x, port.y);
    ctx.scale(0.6, 0.48);
    ctx.translate(-port.x, -port.y);
    ctx.fillStyle = palette.core;
    ctx.globalAlpha = inheritedAlpha * 0.9;
    ctx.fill(boosting ? port.boost : port.idle);
    ctx.restore();
    const cosmetic = getCosmetic(cosmeticId);
    if (cosmetic) {
      ctx.save(); ctx.globalAlpha *= boosting ? .7 : .4;
      ctx.translate(port.x, port.y); ctx.scale(boosting ? 1.4 : .9, 1.4);
      drawCosmeticShot(ctx, cosmetic, time, lowPower);
      ctx.restore();
      ctx.save(); ctx.globalAlpha *= boosting ? .7 : .4;
      drawCosmeticMark(ctx, cosmetic, palette, port.x - (boosting ? 32 : 20), port.y, 3, time * 2);
      if (!lowPower) drawCosmeticMark(ctx, cosmetic, palette, port.x - 15, port.y, 2, time * 2 + 1);
      ctx.restore();
    }
  }
  for (const part of art.parts) {
    ctx.save();
    ctx.globalAlpha *= part.opacity ?? 1;
    if (part.fill !== "none") {
      ctx.fillStyle = palette[part.fill] || part.fill;
      ctx.fill(part.path);
    }
    if (part.stroke !== "none") {
      ctx.strokeStyle = palette[part.stroke || "outline"];
      ctx.lineWidth = part.width ?? 3.5;
      ctx.stroke(part.path);
    }
    ctx.restore();
  }
  ctx.restore();
}
