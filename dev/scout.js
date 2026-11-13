import { Player, Villain } from '../src/game/Entities.js';
import { Renderer } from '../src/game/Renderer.js';
import { SoundManager } from '../src/game/SoundManager.js';
import { advanceEnemyVolley, createEnemyVolley } from '../src/game/FlightDifficulty.js';
import { drawScoutAim, hostileShotTouchesRect } from '../src/game/ScoutAttack.js';
import { takeProjectileHit } from '../src/game/PlayerHealth.js';

const canvas = document.querySelector('canvas');
const renderer = new Renderer(canvas), ctx = renderer.ctx;
const sound = new SoundManager(); sound.setPreferences({ music: false, sfx: true });
const status = document.querySelector('#status'), pauseButton = document.querySelector('#pause');
let game, mode, elapsed = 0, lockedFor = 0, firedAt = null, paused = false, done = false;
let last = performance.now(), frame;
function start(nextMode) {
  void sound.unlock(); mode = nextMode;
  const player = new Player(); player.y = 210;
  const enemy = new Villain(700, 150);
  Object.assign(enemy, { state: 'ATTACKING', attackTimer: 10, encounterLane: 0 });
  game = { phase: 'FLYING', player, enemies: [enemy], projectiles: [], health: 100, activePowerUps: [] };
  elapsed = 0; lockedFor = 0; firedAt = null; paused = false; done = false;
  pauseButton.textContent = 'Pause simulation';
  document.querySelector('#result').textContent = 'Waiting for the shot…';
}
document.querySelector('#stationary').addEventListener('click', () => start('stationary'));
document.querySelector('#evasive').addEventListener('click', () => start('evasive'));
pauseButton.addEventListener('click', () => {
  paused = !paused;
  if (game) game.phase = paused ? 'PAUSED' : 'FLYING';
  pauseButton.textContent = paused ? 'Resume simulation' : 'Pause simulation';
});
function pause() { paused = true; game.phase = 'PAUSED'; pauseButton.textContent = 'Resume simulation'; }
function tick(now) {
  const dt = Math.max(0, Math.min(.05, (now - last) / 1000)); last = now;
  renderer.drawBackground(450, paused ? 0 : dt);
  if (game) {
    const enemy = game.enemies[0];
    if (!paused && !done) {
      elapsed += dt;
      const previousRect = { x: game.player.x, y: game.player.y - 10, w: 40, h: 20 };
      const wasLocked = enemy.scoutAim?.locked;
      if (wasLocked || firedAt !== null) lockedFor += dt;
      if (mode === 'evasive' && lockedFor >= .2) { game.player.boost(true); game.player.update(dt); }
      const hadWarning = Boolean(game.enemyAttackWarning);
      const fired = firedAt === null ? advanceEnemyVolley(game, dt) : null;
      if (!hadWarning && game.enemyAttackWarning) sound.playScoutLock();
      const becameLocked = !wasLocked && enemy.scoutAim?.locked;
      if (becameLocked) sound.playScoutLock();
      if (fired) { game.projectiles.push(...createEnemyVolley(game, fired)); sound.playScoutBeam(); firedAt = elapsed; }
      for (const shot of game.projectiles) {
        shot.update(dt);
        if (hostileShotTouchesRect(shot, { x: game.player.x, y: game.player.y - 10, w: 40, h: 20 }, previousRect)) takeProjectileHit(game, shot);
      }
      if (becameLocked && document.querySelector('#pause-lock').checked) pause();
      if (fired && document.querySelector('#pause-fire').checked) pause();
      if (firedAt !== null && elapsed - firedAt > .35) {
        done = true;
        document.querySelector('#result').textContent = game.health < 100 ? 'Stationary target hit once: 20 HP. Remaining health: 80.' : 'Evasive target cleared the locked ray. Remaining health: 100.';
      }
    }
    renderer.drawVillain(enemy);
    renderer.drawPlayer(game.player);
    drawScoutAim(ctx, enemy);
    renderer.drawProjectiles(game.projectiles);
    const phase = done ? 'Completed' : firedAt !== null ? 'Laser fired' : enemy.scoutAim?.locked ? 'Target locked' : 'Tracking';
    status.textContent = `${phase}${paused ? ' · Paused' : ''} · ${elapsed.toFixed(2)}s · Player Y ${game.player.y.toFixed(1)} · HP ${game.health}`;
  }
  frame = requestAnimationFrame(tick);
}
frame = requestAnimationFrame(tick);
window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); sound.cleanup(); }, { once: true });
