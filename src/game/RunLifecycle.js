import { resetTransformations } from './Transformations.js';
import { resetEnemyAttacks } from './FlightDifficulty.js';
import { HIT_PROTECTION_SECONDS } from './PlayerHealth.js';
import { constrainFlightPlayer } from './FlightBounds.js';

// Rewarded continuation resumes the same run. In particular, never replace the
// equipment-derived recharge interval, boss health or flight clock.
export function prepareRewardedContinue(game, viewport) {
  if (game.phase !== 'ENDED' || !game.gameOver) return false;
  resetTransformations(game);
  game.phase = 'COUNTDOWN'; game.gameOver = false;
  game.health = Math.max(1, Math.ceil(game.maxHealth * .5));
  game.hitProtection = HIT_PROTECTION_SECONDS;
  game.energy = Math.max(game.energy, game.maxEnergy * .5);
  game.projectiles = [];
  resetEnemyAttacks(game);
  if (game.encounter?.boss) {
    game.encounter.boss.warning = null;
    game.encounter.boss.nextAttackAt = game.flightTime + 2;
  }
  game.obstacles = game.obstacles.filter(obstacle => obstacle.x > game.player.x + 160);
  game.player.y = viewport.height / 2; game.player.velocity = 0;
  constrainFlightPlayer(game, viewport.width);
  return true;
}
