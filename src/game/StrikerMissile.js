// Uses the normal friendly-projectile path for enemy damage and rewards.
// Only ordinary hazards are removed here; boss defeat remains owned by App.
export class StrikerMissile {
  constructor(game, x, y, width, height) {
    Object.assign(this, { game, x, y, angle: 0, width, height, type: 'striker_missile',
      speed: 520, damage: 18, radius: 6, visualAge: 0, markedForDeletion: false });
  }
  update(deltaTime) {
    if (this.markedForDeletion) return;
    let left = Math.max(0, Math.min(.1, deltaTime));
    while (left > 1e-8 && !this.markedForDeletion) {
      const dt = Math.min(left, 1 / 120); left -= dt; this.visualAge += dt;
      const game = this.game;
      const boss = game.villain && !game.villain.markedForDeletion ? game.villain : null;
      const hazards = [...game.obstacles, ...game.projectiles].filter(item => !item.markedForDeletion);
      this.x += this.speed * dt;
      for (const hazard of hazards) {
        const r = hazard.radius || 0;
        if (this.x + 7 > hazard.x - r && this.x - 7 < hazard.x + (hazard.width || r) &&
            this.y + 5 > hazard.y - r && this.y - 5 < hazard.y + (hazard.height || r)) {
          hazard.markedForDeletion = true; this.markedForDeletion = true; break;
        }
      }
      // Stop inside the shared hitbox so low frame rates cannot skip a boss hit.
      if (!this.markedForDeletion && boss && this.x + 10 > boss.x && this.x < boss.x + boss.width && this.y > boss.y && this.y < boss.y + boss.height) return;
      if (this.visualAge >= 2.2 || this.x > this.width + 50 || this.y < -40 || this.y > this.height + 40) this.markedForDeletion = true;
    }
  }
}
