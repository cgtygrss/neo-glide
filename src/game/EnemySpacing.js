export const ENEMY_HULL_GAP = 32;
const EDGE = 24;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const separation = (a, b) => (a.height + b.height) / 2 + ENEMY_HULL_GAP;

export function enemyVerticalBounds(enemy, height) {
  const top = EDGE + enemy.height / 2;
  return { top, bottom: Math.max(top, height - EDGE - enemy.height / 2) };
}

// Choose the widest genuinely empty vertical interval. Existing ships keep
// their position and velocity; defer entry if the viewport has no safe opening.
export function findEnemyEntryY(enemy, neighbors, height) {
  const { top, bottom } = enemyVerticalBounds(enemy, height);
  let openings = [[top, bottom]];
  for (const other of neighbors) {
    if (other.markedForDeletion) continue;
    const gap = separation(enemy, other);
    openings = openings.flatMap(([lo, hi]) => {
      const left = other.y - gap, right = other.y + gap;
      if (right <= lo || left >= hi) return [[lo, hi]];
      return [...(left >= lo ? [[lo, Math.min(hi, left)]] : []), ...(right <= hi ? [[Math.max(lo, right), hi]] : [])];
    });
  }
  const opening = openings.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
  return opening ? (opening[0] + opening[1]) / 2 : null;
}

// Called during each ship's physics step, using the neighbors' latest positions.
// Reserving a hull gap sequentially prevents ships from crossing or stacking.
export function constrainEnemyY(enemy, proposedY, neighbors, height, dt) {
  const bounds = enemyVerticalBounds(enemy, height);
  let top = bounds.top, bottom = bounds.bottom;
  for (const other of neighbors) {
    if (other === enemy || other.markedForDeletion || other.state === 'LEAVING') continue;
    const gap = separation(enemy, other);
    if (other.y < enemy.y || (other.y === enemy.y && other.encounterLane < enemy.encounterLane)) top = Math.max(top, other.y + gap);
    else bottom = Math.min(bottom, other.y - gap);
  }
  if (top > bottom) return enemy.y;
  const target = clamp(proposedY, top, bottom);
  // A resize can put an existing ship outside the new bounds. Recover with
  // bounded movement rather than snapping it to a new screen edge.
  const step = enemy.maxSpeed * Math.max(0, dt);
  return clamp(target, enemy.y - step, enemy.y + step);
}
