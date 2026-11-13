export const FIRST_CAPSULE_SECONDS = 28;
export const BASE_HEALTH_DROP_SECONDS = 28;

export function supportDropPace(seconds = 0) {
  const pressure = Math.min(1, Math.max(0, (seconds - 30) / 150));
  return { fuelMinimum: 7 + 5 * pressure, fuelJitter: 3,
    powerMinimum: 18 + 12 * pressure, powerJitter: 6,
    healthInterval: BASE_HEALTH_DROP_SECONDS + 16 * pressure,
    capsuleRetry: 24 + 12 * pressure, capsuleCooldown: 45 + 15 * pressure };
}

// Explicit cooldowns prevent the old per-frame rolls producing pickup clusters.
// Waiting for an existing item never creates a backlog of missed drops.
export function advanceSupportDrop(game, kind, dt, random = Math.random) {
  if (game.phase !== 'FLYING' || game.gameOver || dt <= 0) return false;
  const pace = supportDropPace(game.flightTime);
  const fuel = kind === 'fuel';
  const minimum = fuel ? pace.fuelMinimum : pace.powerMinimum;
  const jitter = fuel ? pace.fuelJitter : pace.powerJitter;
  const interval = () => minimum + Math.max(0, Math.min(1, random())) * jitter;
  const timers = game.supportDropTimers ||= {};
  const timer = timers[kind] ||= { remaining: interval() };
  timer.remaining = Math.max(0, timer.remaining - dt);
  if (timer.remaining > 1e-8) return false;
  if ((fuel ? game.fuels : game.powerUps).some(item => !item.markedForDeletion)) return false;
  timer.remaining = interval();
  return true;
}
