const FLIGHT_PHASES = ['LAUNCH', 'READY', 'FLYING'];
export function flightMusicTrack(game) {
  if (game.gameOver || !FLIGHT_PHASES.includes(game.phase)) return null;
  return game.villain && !game.villain.markedForDeletion ? 'boss' : 'flight';
}

export function syncEncounterMusic(game, sound, { allowEntrance = true } = {}) {
  const track = flightMusicTrack(game);
  if (!sound || !track) return;
  const enemy = track === 'boss' ? game.villain : null;
  const entrance = Boolean(allowEntrance && enemy && game.musicEnemy !== enemy);
  game.musicEnemy = enemy;
  if (track === 'boss' && (entrance || sound.desiredTrack !== 'boss')) {
    void sound.playBossMusic({ entrance });
  } else if (track === 'flight' && sound.desiredTrack !== 'flight') {
    void sound.playNormalMusic();
  }
}
