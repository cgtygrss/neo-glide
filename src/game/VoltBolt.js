// A straight electrical shot. Scenery and hostile projectiles are unaffected.
// Enemy damage and defeat rewards use the shared friendly-projectile handler.
export class VoltBolt {
  constructor(game, x, y, width) {
    Object.assign(this, { game, x, y, width, type: 'volt_bolt', speed: 900,
      damage: 45, visualAge: 0, markedForDeletion: false });
  }
  update(deltaTime) {
    if (this.markedForDeletion) return;
    let remaining = Math.max(0, Math.min(.1, deltaTime));
    while (remaining > 1e-8) {
      const dt = Math.min(remaining, 1 / 120); remaining -= dt;
      this.visualAge += dt; this.x += this.speed * dt;
      const enemy = this.game.villain;
      // Preserve a contact for the shared collision handler at low frame rates.
      if (enemy && !enemy.markedForDeletion && this.x + 10 > enemy.x && this.x < enemy.x + enemy.width && this.y > enemy.y && this.y < enemy.y + enemy.height) return;
      if (this.visualAge >= 2 || this.x > this.width + 80) { this.markedForDeletion = true; return; }
    }
  }
}
