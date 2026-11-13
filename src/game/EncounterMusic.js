import { flightEnemies } from './FlightDifficulty.js';
const FLIGHT_PHASES = ['LAUNCH', 'READY', 'FLYING'];
export function flightMusicTrack(game) {
  if (game.gameOver || !FLIGHT_PHASES.includes(game.phase)) return null;
  return game.encounter?.arrival || flightEnemies(game).some(enemy => !enemy.markedForDeletion) ? 'boss' : 'flight';
}

export function syncEncounterMusic(game, sound) {
  const track = flightMusicTrack(game);
  if (!sound || !track || sound.desiredTrack === track) return;
  // Retain the encounter theme until the last enemy leaves, including resume.
  if (track === 'boss') void sound.playBossMusic();
  else void sound.playNormalMusic();
}
