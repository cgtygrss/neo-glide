import { Player } from './Entities.js';

export const FLIGHT_DEMO_BOUNDS = { top: 68, bottom: 156 };
const STEP = 1 / 120;

// Real local Player physics with a gentle pilot; it never touches a live run.
export class ShipFlightDemo {
  constructor(thrusterLevel = 1) {
    this.player = new Player(thrusterLevel);
    this.player.x = 220;
    this.player.y = 126;
    this.player.boost(true);
    this.elapsed = 0;
    this.phaseTime = 0;
    this.remainder = 0;
    this.scroll = 0;
  }

  advance(deltaTime) {
    this.remainder += Math.max(0, Math.min(.1, deltaTime));
    while (this.remainder + 1e-9 >= STEP) {
      this.elapsed += STEP;
      this.phaseTime += STEP;
      const p = this.player;
      const target = 112 + Math.sin(this.elapsed * .85) * 23;
      const desiredVelocity = Math.max(-80, Math.min(80, (target - p.y) * 2.5));
      let boost = p.isBoosting;
      if (this.phaseTime >= .28) {
        if (boost && p.velocity < desiredVelocity - 65) boost = false;
        else if (!boost && p.velocity > desiredVelocity + 65) boost = true;
      }
      if (p.y > 145) boost = true;
      if (p.y < 80) boost = false;
      if (boost !== p.isBoosting) { p.boost(boost); this.phaseTime = 0; }
      p.update(STEP);
      if (p.y < FLIGHT_DEMO_BOUNDS.top || p.y > FLIGHT_DEMO_BOUNDS.bottom) {
        p.y = Math.max(FLIGHT_DEMO_BOUNDS.top, Math.min(FLIGHT_DEMO_BOUNDS.bottom, p.y));
        p.velocity = 0;
      }
      this.scroll += 125 * STEP;
      this.remainder -= STEP;
    }
  }
}
