import { flightEnemies } from './FlightDifficulty.js';
// A straight electrical shot. Scenery and hostile projectiles are unaffected.
// Enemy damage and defeat rewards use the shared friendly-projectile handler.
export class VoltBolt {
  constructor(game, x, y, width) {
    Object.assign(this, { game, x, y, width, type: 'volt_bolt', speed: 900,
      damage: 45, radius: 6, visualAge: 0, markedForDeletion: false });
  }
  update(deltaTime) {
    if (this.markedForDeletion) return;
    this.previousX = this.x; this.previousY = this.y;
    let remaining = Math.max(0, Math.min(.1, deltaTime));
    while (remaining > 1e-8) {
      const dt = Math.min(remaining, 1 / 120); remaining -= dt;
      this.visualAge += dt; this.x += this.speed * (this.game.viewport?.paceScale ?? 1) * dt;
      // Preserve a contact for the shared collision handler at low frame rates.
      if (flightEnemies(this.game).some(enemy => !enemy.markedForDeletion && this.x + 10 > enemy.x && this.x < enemy.x + enemy.width && this.y > enemy.y && this.y < enemy.y + enemy.height)) return;
      if (this.visualAge >= 2 || this.x > this.width + 80) { this.markedForDeletion = true; return; }
    }
  }
}
