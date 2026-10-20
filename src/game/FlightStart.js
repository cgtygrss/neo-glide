// The simulation stays frozen until the launch finishes AND Boost is held.
export function prepareLaunch(game, height, reducedMotion = false) {
  game.phase = 'LAUNCH';
  game.launch = { elapsed: 0, duration: reducedMotion ? 0.25 : 1.15, reducedMotion };
  game.player.x = reducedMotion ? 100 : -70;
  game.player.y = height * 0.45;
  game.player.velocity = 0;
  game.player.rotation = 0;
  game.player.boost(false);
}

export function takeFlightControl(game, held) {
  if (game.phase !== 'READY' || !held) return false;
  game.phase = 'FLYING';
  game.player.velocity = 0;
  game.player.boost(game.energy > 0);
  return true;
}

export function advanceFlightStart(game, deltaTime, held) {
  if (game.phase === 'FLYING') return true;
  if (game.phase !== 'LAUNCH') return false;
  const launch = game.launch;
  launch.elapsed = Math.min(launch.duration, launch.elapsed + deltaTime);
  const progress = launch.elapsed / launch.duration;
  const eased = 1 - Math.pow(1 - progress, 3);
  game.player.x = launch.reducedMotion ? 100 : -70 + 170 * eased;
  game.player.rotation = launch.reducedMotion ? 0 : -8 * Math.sin(progress * Math.PI);
  if (progress === 1) {
    game.player.x = 100;
    game.player.rotation = 0;
    game.player.velocity = 0;
    game.phase = 'READY';
    takeFlightControl(game, held);
  }
  // Even the handoff frame is cosmetic. Physics begins on the next frame.
  return false;
}

export function prepareFlightReady(game) {
  game.phase = 'READY';
  game.player.x = 100;
  game.player.velocity = 0;
  game.player.rotation = 0;
  game.player.boost(false);
}

export function pauseFlight(game) {
  if (!['LAUNCH', 'READY', 'FLYING', 'COUNTDOWN'].includes(game.phase)) return false;
  game.pausedPhase = game.phase;
  game.phase = 'PAUSED';
  game.player.boost(false);
  return true;
}

export function resumeFlight(game) {
  if (game.phase !== 'PAUSED') return;
  // Resuming an active flight also waits for deliberate input.
  if (game.pausedPhase === 'FLYING') prepareFlightReady(game);
  else game.phase = game.pausedPhase;
  game.player.velocity = 0;
}

export function refillFuel(game, fuel, held) {
  if (fuel.markedForDeletion) return false;
  fuel.markedForDeletion = true;
  game.energy = game.maxEnergy;
  game.player.boost(game.phase === 'FLYING' && held);
  return true;
}
