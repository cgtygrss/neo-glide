export function catalogSwipeDirection(start, end, width) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const threshold = Math.max(36, Math.min(72, width * .1));
  if (Math.abs(dx) < threshold || Math.abs(dx) <= Math.abs(dy) * 1.4) return 0;
  return dx < 0 ? 1 : -1;
}

// null means ordinary page scrolling; zero consumes horizontal gesture inertia.
export function advanceCatalogWheel(state, event, now, width) {
  const { deltaX, deltaY, deltaMode = 0 } = event;
  if (Math.abs(deltaX) < 1 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return null;
  const direction = Math.sign(deltaX);
  if (now - (state.last ?? -Infinity) > 180 || state.direction !== direction) {
    state.total = 0;
    state.locked = false;
  }
  state.last = now;
  state.direction = direction;
  if (state.locked) return 0;
  state.total += deltaX * (deltaMode === 1 ? 16 : deltaMode === 2 ? width : 1);
  if (Math.abs(state.total) < 55) return 0;
  state.locked = true;
  return direction;
}
