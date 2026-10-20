// Match drawPlayer's catalog transform: scale(.18), then translate(-160, -120).
// A pixel of padding includes the art's outlines. Effects keep their existing reach.
const LEFT = -160 * .18 - 1;
const RIGHT = (440 - 160) * .18 + 1;
const TOP = -120 * .18 - 1;
const BOTTOM = (240 - 120) * .18 + 1;

export function flightArtExtents(rotation = 0) {
  const angle = rotation * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const corners = [[LEFT, TOP], [RIGHT, TOP], [RIGHT, BOTTOM], [LEFT, BOTTOM]];
  const xs = corners.map(([x, y]) => x * cos - y * sin);
  const ys = corners.map(([x, y]) => x * sin + y * cos);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

export function constrainFlightPlayer(game, width) {
  if (game.transformation) return;
  if (!['FLYING', 'READY', 'PAUSED', 'COUNTDOWN'].includes(game.phase)
    || (game.phase === 'PAUSED' && game.pausedPhase === 'LAUNCH')) return;

  const player = game.player;
  let bounds = flightArtExtents(player.rotation);
  if (player.y + bounds.top < 0) {
    if (player.velocity < 0) player.velocity = 0;
    player.rotation = 0;
    bounds = flightArtExtents();
    player.y = Math.max(player.y, -bounds.top);
  }
  const minX = -bounds.left;
  const maxX = width - bounds.right;
  player.x = maxX >= minX ? Math.min(maxX, Math.max(minX, player.x)) : (minX + maxX) / 2;
  // Never clamp the bottom: falling remains a fatal boundary collision.
}
