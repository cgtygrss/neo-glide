// Distances are displayed flight metres, independent of screen size/frame rate.
export const REGION_DISTANCE = 480;
export const BLEND_START = .64;
export const REGION_COUNT = 4;
export const JOURNEY_PIXEL_BUDGET = 4_000_000;
export const LOW_POWER_JOURNEY_PIXEL_BUDGET = 1_600_000;

// Each route keeps its destination's palette and opening landmark. These are
// related places inside that galaxy, not random catalog destinations.
const routes = {
  default: ['moonfield', 'clouds', 'twins'],
  andromeda: ['moonfield', 'dustbelt', 'twins'],
  triangulum: ['dustbelt', 'moonfield', 'peaks'],
  whirlpool: ['sea', 'moonfield', 'clouds'],
  sunflower: ['dustbelt', 'cluster', 'petals'],
  black_eye: ['dustbelt', 'moonfield', 'filaments'],
  sombrero: ['dustbelt', 'moonfield', 'pillars'],
  cartwheel: ['stations', 'dustbelt', 'twins'],
  centaurus_a: ['dustbelt', 'pillars', 'filaments'],
  bode: ['peaks', 'moonfield', 'clouds'],
  pinwheel: ['twins', 'cluster', 'petals'],
  orion: ['pillars', 'cluster', 'moonfield'],
  pleiades: ['moonfield', 'clouds', 'twins'],
  crab: ['dustbelt', 'moonfield', 'web'],
  helix: ['clouds', 'moonfield', 'filaments'],
  eagle: ['dustbelt', 'peaks', 'cluster'],
  lagoon: ['moonfield', 'clouds', 'petals'],
  rosette: ['clouds', 'cluster', 'moonfield'],
  carina: ['moonfield', 'dustbelt', 'pillars'],
  tarantula: ['filaments', 'cluster', 'clouds'],
  horsehead: ['pillars', 'dustbelt', 'clouds'],
  vega: ['moonfield', 'dustbelt', 'cluster'],
  magellanic: ['clouds', 'moonfield', 'cluster'],
  quasar: ['dustbelt', 'web', 'twins'],
};

export function journeyPosition(distance = 0) {
  const safe = Number.isFinite(distance) ? Math.max(0, distance) : 0;
  const section = Math.floor(safe / REGION_DISTANCE);
  const progress = safe / REGION_DISTANCE - section;
  const fade = Math.max(0, (progress - BLEND_START) / (1 - BLEND_START));
  return { region: section % REGION_COUNT, next: (section + 1) % REGION_COUNT,
    progress, blend: fade * fade * (3 - 2 * fade) };
}

export function journeyRegion(stage, region) {
  if (!region) return stage;
  return { ...stage, id: `${stage.id}:region:${region}`,
    scene: (routes[stage.id] || routes.default)[region - 1] };
}

// Backgrounds need less density than ships/HUD. Two retained rasters share a
// strict budget; gameplay's main canvas still uses full Retina density.
export function journeyResolution(width, height, density, lowPower) {
  const budget = lowPower ? LOW_POWER_JOURNEY_PIXEL_BUDGET : JOURNEY_PIXEL_BUDGET;
  const ratio = Math.min(Math.max(1, density), lowPower ? 1 : 1.75,
    Math.sqrt(budget / (2 * width * height)));
  return { pixelWidth: Math.max(1, Math.floor(width * ratio)),
    pixelHeight: Math.max(1, Math.floor(height * ratio)) };
}
