// Capture-only automation: observe flight state and send the game's normal
// keyboard controls. Never change progress, equipment, health, spawns or time.
(() => {
  const canvas = document.querySelector('canvas');
  let fiber = canvas[Object.keys(canvas).find(key => key.startsWith('__reactFiber'))];
  let gameRef;
  while (fiber && !gameRef) {
    for (let hook = fiber.memoizedState; hook; hook = hook.next) {
      const value = hook.memoizedState?.current;
      if (value?.player && Array.isArray(value.obstacles)) { gameRef = hook.memoizedState; break; }
    }
    fiber = fiber.return;
  }
  if (!gameRef) throw new Error('Flight state not found; inspect this release before capturing.');
  window.previewPilot?.stop();
  let held = false;
  let lastShot = 0;
  const key = (type, code, key) => window.dispatchEvent(new KeyboardEvent(type, { code, key, bubbles: true, cancelable: true }));
  const setBoost = value => {
    if (value === held) return;
    held = value;
    key(value ? 'keydown' : 'keyup', 'Space', ' ');
  };
  const observations = [];
  const timer = setInterval(() => {
    const game = gameRef.current;
    if (game.gameOver) { setBoost(false); return; }
    if (!['READY', 'FLYING'].includes(game.phase)) return;
    const h = game.viewport?.height || canvas.clientHeight;
    const player = game.player;
    let target = h * (.46 + .1 * Math.sin((game.flightTime || 0) * .48));
    const obstacle = game.obstacles.filter(o => !o.markedForDeletion && o.x + o.width > player.x - 45 && o.x < player.x + 360).sort((a,b) => a.x - b.x)[0];
    if (obstacle) target = obstacle.y < h * .3 ? Math.max(target, obstacle.height + 105) : Math.min(target, obstacle.y - 100);
    const enemy = game.enemies?.find(e => !e.markedForDeletion && e.x > player.x);
    if (enemy && !obstacle) target = Math.max(100, Math.min(h - 110, enemy.y));
    target = Math.max(100, Math.min(h - 100, target));
    setBoost(game.phase === 'READY' || player.y + player.velocity * .23 > target);
    if (performance.now() - lastShot > 650 && enemy) {
      key('keydown', 'ShiftLeft', 'Shift'); key('keyup', 'ShiftLeft', 'Shift'); lastShot = performance.now();
    }
    if (observations.length === 0 || game.flightTime - observations.at(-1).time > 1) observations.push({time:game.flightTime,distance:game.distance,y:player.y,health:game.health,enemies:game.enemies?.length,phase:game.phase});
  }, 25);
  window.previewPilot = { observations, stop() { clearInterval(timer); setBoost(false); } };
  return 'Pilot ready: keyboard input only';
})();
