import test from 'node:test';
import assert from 'node:assert/strict';
import { Player, Fuel } from '../src/game/Entities.js';
import { FlightInput } from '../src/game/FlightInput.js';
import { prepareLaunch, advanceFlightStart, takeFlightControl, prepareFlightReady, pauseFlight, resumeFlight, refillFuel } from '../src/game/FlightStart.js';

function run() {
  const game = { player: new Player(), energy: 160, maxEnergy: 160, distance: 0 };
  prepareLaunch(game, 400);
  return game;
}

function tick(game, seconds, input) {
  for (let time = 0; time < seconds; time += 1 / 60) {
    if (advanceFlightStart(game, 1 / 60, input?.sources.size > 0)) {
      game.player.update(1 / 60);
      game.distance += 1;
    }
  }
}

test('every fresh run and retry stays safe indefinitely until deliberate Boost', () => {
  for (let retry = 0; retry < 3; retry++) {
    const game = run();
    tick(game, 20);
    assert.equal(game.phase, 'READY');
    assert.equal(game.player.x, 100);
    assert.equal(game.player.y, 180);
    assert.equal(game.player.velocity, 0);
    assert.equal(game.distance, 0);
    assert.equal(game.energy, 160);
    assert.equal(takeFlightControl(game, false), false);
    assert.equal(takeFlightControl(game, true), true);
    tick(game, 0.1);
    assert.ok(game.player.y < 180);
    assert.ok(game.distance > 0);
  }
});

test('held Boost crosses the cinematic handoff; a released tap never starts gravity', () => {
  for (const hold of [false, true]) {
    const game = run();
    const input = new FlightInput(active => game.player.boost(active && game.phase === 'FLYING'));
    input.press('pointer:1');
    tick(game, 0.4, input);
    assert.equal(game.player.isBoosting, false);
    if (!hold) input.release('pointer:1');
    tick(game, 0.8, input);
    assert.equal(game.phase, hold ? 'FLYING' : 'READY');
    if (hold) assert.ok(game.player.isBoosting);
    else assert.equal(game.player.y, 180);
  }
});

test('pausing a launch freezes progress and resuming cannot count hidden time', () => {
  const game = run();
  tick(game, 0.4);
  pauseFlight(game);
  const elapsed = game.launch.elapsed;
  const x = game.player.x;
  tick(game, 60);
  assert.equal(game.launch.elapsed, elapsed);
  assert.equal(game.player.x, x);
  resumeFlight(game);
  tick(game, 1);
  assert.equal(game.phase, 'READY');
  assert.equal(game.distance, 0);
});

test('revive countdown and active-flight resume wait safely for Boost', () => {
  const game = run();
  game.phase = 'COUNTDOWN';
  pauseFlight(game);
  tick(game, 10);
  resumeFlight(game);
  assert.equal(game.phase, 'COUNTDOWN');
  prepareFlightReady(game);
  tick(game, 10);
  assert.equal(game.distance, 0);
  takeFlightControl(game, true);
  tick(game, 0.1);
  pauseFlight(game);
  resumeFlight(game);
  const y = game.player.y;
  tick(game, 10);
  assert.equal(game.phase, 'READY');
  assert.equal(game.player.y, y);
});

test('reduced motion keeps the ship stationary and still requires Boost', () => {
  const game = run();
  prepareLaunch(game, 400, true);
  tick(game, 0.1);
  assert.equal(game.player.x, 100);
  assert.equal(game.player.rotation, 0);
  tick(game, 10);
  assert.equal(game.phase, 'READY');
  assert.equal(game.player.y, 180);
});

test('every yellow fuel completely fills any upgraded tank and restores held Boost', () => {
  for (const maxEnergy of [100, 160, 242]) {
    for (const energy of [0, 1, maxEnergy / 2, maxEnergy]) {
      const game = run();
      game.phase = 'FLYING';
      game.maxEnergy = maxEnergy;
      game.energy = energy;
      const fuel = new Fuel(100, 180);
      assert.equal(fuel.color, '#ffff00');
      assert.equal(refillFuel(game, fuel, true), true);
      assert.equal(game.energy, maxEnergy);
      assert.equal(game.player.isBoosting, true);
      game.energy -= 5;
      assert.equal(refillFuel(game, fuel, true), false);
      assert.equal(game.energy, maxEnergy - 5);
    }
  }
});
