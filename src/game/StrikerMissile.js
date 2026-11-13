import { flightEnemies } from './FlightDifficulty.js';
import { hostileShotTouchesRect } from './ScoutAttack.js';
// Uses the normal friendly-projectile path for enemy damage and rewards.
// Only ordinary hazards are removed here; boss defeat remains owned by App.
export class StrikerMissile {
  constructor(game, x, y, width, height) {
    Object.assign(this, { game, x, y, angle: 0, width, height, type: 'striker_missile',
      speed: 520, damage: 18, radius: 6, visualAge: 0, markedForDeletion: false });
  }
  update(deltaTime) {
    if (this.markedForDeletion) return;
    this.previousX = this.x; this.previousY = this.y;
    let left = Math.max(0, Math.min(.1, deltaTime));
    while (left > 1e-8 && !this.markedForDeletion) {
      const dt = Math.min(left, 1 / 120); left -= dt; this.visualAge += dt;
      const game = this.game;
      const bosses = flightEnemies(game).filter(enemy => !enemy.markedForDeletion);
      const hazards = [...game.obstacles, ...game.projectiles].filter(item => !item.markedForDeletion);
      this.x += this.speed * (game.viewport?.paceScale ?? 1) * dt;
      for (const hazard of hazards) {
        const r = hazard.radius || 0;
        if (hazard.type === 'SCOUT_BEAM' ? hostileShotTouchesRect(hazard, { x: this.x - 7, y: this.y - 5, w: 14, h: 10 }) :
            this.x + 7 > hazard.x - r && this.x - 7 < hazard.x + (hazard.width || r) &&
            this.y + 5 > hazard.y - r && this.y - 5 < hazard.y + (hazard.height || r)) {
          hazard.markedForDeletion = true; this.markedForDeletion = true; break;
        }
      }
      // Stop inside the shared hitbox so low frame rates cannot skip a boss hit.
      if (!this.markedForDeletion && bosses.some(boss => this.x + 10 > boss.x && this.x < boss.x + boss.width && this.y > boss.y && this.y < boss.y + boss.height)) return;
      if (this.visualAge >= 2.2 || this.x > this.width + 50 || this.y < -40 || this.y > this.height + 40) this.markedForDeletion = true;
    }
  }
}
