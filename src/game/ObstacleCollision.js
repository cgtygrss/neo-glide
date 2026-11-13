import { flightHullExtents } from './FlightBounds.js';
import { transformationHitbox } from './Transformations.js';

// Solid scenery must contact the visible hull, not the smaller projectile hitbox.
export function obstacleCollisionBounds(game) {
  if (game.transformation) return transformationHitbox(game);
  const p = game.player;
  const art = flightHullExtents(game.shipType, p.rotation);
  return { x: p.x + art.left, y: p.y + art.top,
    w: art.right - art.left, h: art.bottom - art.top };
}

export function touchesObstacle(game, obstacle) {
  const now = obstacleCollisionBounds(game);
  const before = game.previousObstacleBounds || now;
  // Include the obstacle's visible 6px outline. Sweep relative movement so a
  // dropped frame cannot carry a wall or a boosting ship through the other.
  const x = (obstacle.previousX ?? obstacle.x) - 3;
  const y = obstacle.y - 3;
  const width = obstacle.width + 6;
  const height = obstacle.height + 6;
  const dx = now.x - before.x - (obstacle.x - (obstacle.previousX ?? obstacle.x));
  const dy = now.y - before.y;
  let enter = 0, exit = 1;
  for (const [start, size, edge, span, movement] of [
    [before.x, Math.max(before.w, now.w), x, width, dx],
    [before.y, Math.max(before.h, now.h), y, height, dy],
  ]) {
    if (movement === 0) {
      if (start + size < edge || start > edge + span) return false;
      continue;
    }
    const a = (edge - start - size) / movement;
    const b = (edge + span - start) / movement;
    enter = Math.max(enter, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
    if (enter > exit) return false;
  }
  return true;
}
