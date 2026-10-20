import test from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../src/game/Entities.js';
import { constrainFlightPlayer } from '../src/game/FlightBounds.js';
import { touchesFlightBoundary } from '../src/game/PlayerHealth.js';
import { prepareLaunch, advanceFlightStart, pauseFlight, resumeFlight, prepareFlightReady } from '../src/game/FlightStart.js';

const run = (level = 1) => ({ phase: 'FLYING', player: new Player(level), energy: 100 });

// Independently project the catalog viewbox through the production draw transform.
function assertVisible(player, width) {
  const angle = player.rotation * Math.PI / 180;
  for (const [x, y] of [[0, 0], [440, 0], [0, 240], [440, 240]]) {
    const localX = (x - 160) * .18;
    const localY = (y - 120) * .18;
    const screenX = player.x + localX * Math.cos(angle) - localY * Math.sin(angle);
    const screenY = player.y + localX * Math.sin(angle) + localY * Math.cos(angle);
    assert.ok(screenX >= 0 && screenX <= width, `horizontal art edge ${screenX}`);
    assert.ok(screenY >= 0, `top art edge ${screenY}`);
  }
}

test('holding boost against the ceiling stays alive and releasing immediately descends', () => {
  for (const level of [1, 3, 10]) {
    const game = run(level);
    game.player.y = 80;
    game.player.boost(true);
    for (let frame = 0; frame < 720; frame++) {
      game.player.update(1 / 60);
      constrainFlightPlayer(game, 320);
      assertVisible(game.player, 320);
      assert.equal(touchesFlightBoundary(game.player, 568), false);
    }
    assert.equal(game.player.velocity, 0);
    assert.equal(game.player.rotation, 0);
    const ceilingY = game.player.y;
    game.player.boost(false);
    game.player.update(1 / 60);
    constrainFlightPlayer(game, 320);
    assert.ok(game.player.y > ceilingY);
    assert.ok(game.player.velocity > 0);
  }
});

test('rotated ship art stays inside top and both sides at phone widths', () => {
  for (const width of [240, 320, 844]) {
    for (const rotation of [-45, -20, 0, 20, 45]) {
      for (const x of [-100, width + 100]) {
        const game = run();
        Object.assign(game.player, { x, y: 60, rotation });
        constrainFlightPlayer(game, width);
        assert.equal(game.player.rotation, rotation);
        assertVisible(game.player, width);
        game.player.y = -100;
        game.player.velocity = -200;
        constrainFlightPlayer(game, width);
        assertVisible(game.player, width);
        assert.equal(game.player.velocity, 0);
      }
    }
  }
});

test('bottom positions and downward velocity are never rescued by a boundary clamp', () => {
  for (const phase of ['FLYING', 'READY', 'PAUSED', 'COUNTDOWN']) {
    const game = run();
    game.phase = phase;
    Object.assign(game.player, { y: 700, velocity: 200, rotation: 45 });
    constrainFlightPlayer(game, 320);
    assert.equal(game.player.y, 700);
    assert.equal(game.player.velocity, 200);
    assert.equal(touchesFlightBoundary(game.player, 568), true);
  }
});

test('launch keeps its offscreen entrance through pause and transitions to a bounded ready pose', () => {
  const game = run();
  prepareLaunch(game, 390);
  constrainFlightPlayer(game, 320);
  assert.equal(game.player.x, -70);
  pauseFlight(game);
  constrainFlightPlayer(game, 240);
  assert.equal(game.player.x, -70);
  resumeFlight(game);
  assert.equal(game.phase, 'LAUNCH');
  advanceFlightStart(game, 2, false);
  constrainFlightPlayer(game, 240);
  assert.equal(game.phase, 'READY');
  assertVisible(game.player, 240);
});

test('ready, paused and revived countdown poses remain bounded after viewport changes', () => {
  const game = run();
  for (const phase of ['READY', 'PAUSED', 'COUNTDOWN']) {
    game.phase = phase;
    Object.assign(game.player, { x: 800, y: -10, rotation: -45, velocity: -100 });
    constrainFlightPlayer(game, 240);
    assertVisible(game.player, 240);
    assert.equal(game.player.velocity, 0);
  }
  prepareFlightReady(game);
  constrainFlightPlayer(game, 240);
  assertVisible(game.player, 240);
});
