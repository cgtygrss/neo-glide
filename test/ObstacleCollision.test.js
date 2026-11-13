import test from 'node:test';
import assert from 'node:assert/strict';
import { Player, Obstacle } from '../src/game/Entities.js';
import { constrainFlightPlayer } from '../src/game/FlightBounds.js';
import { obstacleImpact } from '../src/game/PlayerHealth.js';
import { obstacleCollisionBounds, touchesObstacle } from '../src/game/ObstacleCollision.js';

const flight = () => ({ phase: 'FLYING', player: new Player(), shipType: 'default' });

test('visible top hull touching an overhead wall is fatal even outside the old projectile box', () => {
  const game = flight();
  game.player.y = 60;
  const wall = new Obstacle(80, 0, 50, 44);
  assert.ok(game.player.y - 10 > wall.height); // Old hitbox misses the contact.
  assert.equal(touchesObstacle(game, wall), true);
  assert.equal(obstacleImpact(game, wall), 'fatal');
});

test('holding boost at the ceiling hits a top obstacle, but empty ceiling remains safe', () => {
  for (const rotation of [-45, 0, 45]) {
    const game = flight();
    Object.assign(game.player, { y: -20, rotation });
    constrainFlightPlayer(game, 390);
    assert.ok(game.player.y > 0);
    assert.equal(touchesObstacle(game, new Obstacle(75, 0, 50, 40)), true);
    assert.equal(touchesObstacle(game, new Obstacle(220, 0, 50, 40)), false);
    assert.equal(touchesObstacle(game, new Obstacle(75, 300, 50, 50)), false);
  }
});

test('a low frame rate cannot move a boosting hull or scrolling wall through contact', () => {
  const game = flight();
  game.player.y = 140;
  game.previousObstacleBounds = obstacleCollisionBounds(game);
  game.player.y = 20;
  assert.equal(touchesObstacle(game, new Obstacle(80, 70, 50, 30)), true);
  game.previousObstacleBounds = null;
  game.player.y = 100;
  const wall = new Obstacle(-100, 80, 30, 50);
  wall.previousX = 250;
  assert.equal(touchesObstacle(game, wall), true);
  wall.y = 250;
  assert.equal(touchesObstacle(game, wall), false);
});

test('solid collision includes lower and rotated hull edges without killing a clear center route', () => {
  const game = flight();
  game.player.y = 200;
  for (const rotation of [-45, 0, 45]) {
    game.player.rotation = rotation;
    assert.equal(touchesObstacle(game, new Obstacle(80, 215, 50, 100)), true);
    assert.equal(touchesObstacle(game, new Obstacle(80, 0, 50, 80)), false);
    assert.equal(touchesObstacle(game, new Obstacle(80, 320, 50, 80)), false);
  }
});
