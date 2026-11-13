import { getStage } from './StageCatalog.js';
import { behindGalaxyBody, drawGalaxyArtwork, galaxyNoise, galaxySeed } from './GalaxyArt.js';
import { journeyPosition, journeyRegion, journeyResolution } from './StageJourney.js';

const wrap = value => ((value % 1) + 1) % 1;
const createSurface = () => typeof OffscreenCanvas === 'function'
  ? new OffscreenCanvas(1, 1) : globalThis.document?.createElement('canvas');
const release = frame => {
  if (frame?.bitmap) { frame.bitmap.width = 0; frame.bitmap.height = 0; }
};
const placement = (width, height, age) => ({
  x: -width * .04 + (.5 - age) * width * .04,
  y: -height * .04, width: width * 1.08, height: height * 1.08,
});

export class StageBackground {
  constructor({ createCanvas = createSurface } = {}) { this.cache = null; this.createCanvas = createCanvas; }
  reset() {
    if (this.cache) for (const frame of this.cache.frames.values()) release(frame);
    this.cache = null;
  }

  paintRegion(stage, region, width, height, density, lowPower) {
    const bitmap = this.createCanvas(), destination = journeyRegion(stage, region);
    let bodies = [];
    if (bitmap) {
      const size = journeyResolution(width, height, density, lowPower);
      bitmap.width = size.pixelWidth; bitmap.height = size.pixelHeight;
      const paint = bitmap.getContext('2d');
      paint.setTransform(bitmap.width / width, 0, 0, bitmap.height / height, 0, 0);
      bodies = drawGalaxyArtwork(paint, destination, width, height, lowPower);
    }
    return { bitmap, bodies, destination };
  }

  draw(ctx, id, width, height, time = 0, travel = 0, lowPower = false) {
    if (!(width > 0 && height > 0)) return;
    const stage = getStage(id), transform = ctx.getTransform?.();
    const density = Math.max(1, Math.abs(transform?.a || 1), Math.abs(transform?.d || 1));
    const distance = Number.isFinite(travel) ? Math.max(0, travel) : 0;
    const position = journeyPosition(distance);
    if (!this.cache || this.cache.ctx !== ctx || this.cache.id !== stage.id
      || this.cache.width !== width || this.cache.height !== height
      || this.cache.density !== density || this.cache.lowPower !== lowPower) {
      this.reset();
      const seed = galaxySeed(stage.id);
      const stars = Array.from({ length: lowPower ? 24 : 60 }, (_, i) => ({
        x: galaxyNoise(seed, i + 1200), y: .04 + galaxyNoise(seed, i + 1400) * .89,
        depth: .6 + (i % 3) * .45, size: i % 11 === 0 ? 1.3 : .55 + galaxyNoise(seed, i + 1600) * .6,
        alpha: .12 + galaxyNoise(seed, i + 1800) * .28, phase: galaxyNoise(seed, i + 2000) * Math.PI * 2,
      }));
      this.cache = { ctx, id: stage.id, width, height, density, lowPower, frames: new Map(), stars };
    }
    const { frames } = this.cache;
    // Release departed vistas before allocating. No history grows with flight
    // length, and skipped/restarted distances never replay intermediate regions.
    for (const [region, frame] of frames) {
      if (region !== position.region && region !== position.next) { release(frame); frames.delete(region); }
    }
    let painted = false;
    if (!frames.has(position.region)) {
      frames.set(position.region, this.paintRegion(stage, position.region, width, height, density, lowPower));
      painted = true;
    }
    // Warm one next region before the dissolve. Never rasterize two detailed
    // vistas in one frame, including after a large distance skip.
    if (!painted && position.progress >= .35 && !frames.has(position.next)) {
      frames.set(position.next, this.paintRegion(stage, position.next, width, height, density, lowPower));
    }

    ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
    const visible = [];
    const composite = (region, age, opacity, starOcclusion = opacity) => {
      const frame = frames.get(region), rect = placement(width, height, age);
      ctx.globalAlpha = opacity;
      if (frame.bitmap) ctx.drawImage(frame.bitmap, rect.x, rect.y, rect.width, rect.height);
      else {
        // Vector/headless fallback follows the same route and composition.
        ctx.save(); ctx.translate(rect.x, rect.y); ctx.scale(1.08, 1.08);
        frame.bodies = drawGalaxyArtwork(ctx, frame.destination, width, height, lowPower, opacity); ctx.restore();
      }
      if (starOcclusion > .4) visible.push({ bodies: frame.bodies, rect });
    };
    composite(position.region, position.progress, 1, 1 - position.blend);
    if (position.blend > 0 && frames.has(position.next)) composite(position.next, position.progress - 1, position.blend);
    ctx.scale(width, height); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const star of this.cache.stars) {
      const x = wrap(star.x - distance * .00012 * star.depth);
      if (visible.some(({ bodies, rect }) => behindGalaxyBody(bodies,
        (x * width - rect.x) / 1.08, (star.y * height - rect.y) / 1.08))) continue;
      const size = star.size / Math.max(520, width);
      ctx.globalAlpha = star.alpha * (.92 + Math.sin(time * .7 + star.phase) * .08);
      ctx.fillStyle = stage.colors[2];
      ctx.fillRect(x, star.y, size, size * width / height);
      if (star.size > 1.2 && !lowPower) {
        ctx.globalAlpha *= .35;
        ctx.fillRect(x - size, star.y + size * width / height * .4, size * 3, .5 / height);
      }
    }
    ctx.restore();
  }
}
