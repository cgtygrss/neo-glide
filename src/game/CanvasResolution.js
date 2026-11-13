export const MAX_PIXEL_RATIO = 3;
export const MAX_CANVAS_PIXELS = 9_000_000;

// Logical coordinates stay unchanged; displayScale maps them to the fitted CSS
// size while pixelRatio only increases backing-bitmap density.
export function canvasResolution(width, height, { pixelRatio = globalThis.devicePixelRatio || 1, displayScale = 1 } = {}) {
  const density = Number.isFinite(pixelRatio) ? Math.max(1, Math.min(MAX_PIXEL_RATIO, pixelRatio)) : 1;
  const scale = Number.isFinite(displayScale) && displayScale > 0 ? displayScale : 1;
  const ratio = width > 0 && height > 0
    ? Math.min(density * scale, Math.sqrt(MAX_CANVAS_PIXELS / (width * height))) : 1;
  const pixelWidth = Math.max(0, Math.floor(width * ratio));
  const pixelHeight = Math.max(0, Math.floor(height * ratio));
  return { pixelWidth, pixelHeight, scaleX: width > 0 ? pixelWidth / width : 1, scaleY: height > 0 ? pixelHeight / height : 1 };
}

export function resizeCanvas(canvas, ctx, width, height, options) {
  const resolution = canvasResolution(width, height, options);
  const changed = canvas.width !== resolution.pixelWidth || canvas.height !== resolution.pixelHeight;
  if (changed) {
    canvas.width = resolution.pixelWidth;
    canvas.height = resolution.pixelHeight;
  }
  // Absolute transforms avoid accumulating another scale on orientation changes.
  ctx.setTransform(resolution.scaleX, 0, 0, resolution.scaleY, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { ...resolution, changed };
}
