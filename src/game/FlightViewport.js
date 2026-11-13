// One authored flight scale on phones, tablets and desktop. Display density is
// independent of simulation units, so a taller monitor never shrinks hazards.
export const FLIGHT_HEIGHT = 390;
export const FLIGHT_WIDTH = 844;
export const MIN_FLIGHT_ASPECT = 4 / 3;
export const MAX_FLIGHT_ASPECT = 2.4;
export const DEFAULT_FLIGHT_BOUNDS = { width: FLIGHT_WIDTH, height: FLIGHT_HEIGHT, paceScale: 1 };
export const flightHomeX = (width = FLIGHT_WIDTH) => width * 100 / FLIGHT_WIDTH;
export const flightScrollSpeed = game => game.speed * (game.viewport?.paceScale ?? 1);

export function flightViewport(width, height) {
  const w = Math.max(1, Number.isFinite(width) ? width : FLIGHT_WIDTH);
  const h = Math.max(1, Number.isFinite(height) ? height : FLIGHT_HEIGHT);
  const displayWidth = Math.min(w, h * MAX_FLIGHT_ASPECT);
  const displayHeight = Math.min(h, displayWidth / MIN_FLIGHT_ASPECT);
  const scale = displayHeight / FLIGHT_HEIGHT;
  const worldWidth = displayWidth / scale;
  return { width: worldWidth, height: FLIGHT_HEIGHT, paceScale: worldWidth / FLIGHT_WIDTH,
    scale, displayWidth, displayHeight, left: (w - displayWidth) / 2, top: (h - displayHeight) / 2 };
}

// Keep progress, timers, sizes and vertical physics intact on orientation/window
// changes. Remap positions and already travelling shots, never spawn a new run.
export function fitFlightViewport(game, next) {
  const previous = game.viewport;
  game.viewport = next;
  if (!previous || Math.abs(previous.width - next.width) < 1e-7) return false;
  const ratio = next.width / previous.width;
  const move = item => {
    for (const key of ['x', 'previousX', 'endX']) if (Number.isFinite(item[key])) item[key] *= ratio;
  };
  if (game.player) move(game.player);
  for (const key of ['obstacles', 'collectibles', 'fuels', 'healthPickups', 'powerUps', 'floatingTexts']) {
    for (const item of game[key] || []) { move(item); if (key === 'obstacles') item.width *= ratio; }
  }
  for (const enemy of game.enemies || (game.villain ? [game.villain] : [])) {
    move(enemy);
    if (enemy.scoutAim) enemy.scoutAim.targetX *= ratio;
    if (enemy.warning) enemy.warning.targetX *= ratio;
  }
  for (const shot of game.projectiles || []) {
    move(shot);
    if (Number.isFinite(shot.vx)) shot.vx *= ratio;
    if (shot.type === 'SONIC_BLADE') shot.rotation = Math.atan2(shot.vy, shot.vx);
  }
  for (const shot of game.playerProjectiles || []) {
    move(shot);
    if (Number.isFinite(shot.visualTravel)) shot.visualTravel *= ratio;
    if (['striker_missile', 'volt_bolt'].includes(shot.type)) { shot.width = next.width; if ('height' in shot) shot.height = next.height; }
  }
  if (game.transformationDirector?.capsule) move(game.transformationDirector.capsule);
  if (game.transformation) {
    move(game.transformation);
    game.transformation.baseX *= ratio;
    for (const point of game.transformation.trail || []) move(point);
  }
  if (game.launch) game.launch.homeX = flightHomeX(next.width);
  game.previousObstacleBounds = null;
  game.previousProjectileBounds = null;
  return true;
}
