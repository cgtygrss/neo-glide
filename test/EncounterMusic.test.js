import test from 'node:test';
import assert from 'node:assert/strict';
import { Villain, SpeedsterVillain, JuggernautVillain } from '../src/game/Entities.js';
import { flightMusicTrack, syncEncounterMusic } from '../src/game/EncounterMusic.js';

function audio() {
  const calls = [];
  const sound = { desiredTrack: 'flight',
    playBossMusic() { calls.push('boss'); this.desiredTrack = 'boss'; },
    playNormalMusic() { calls.push('flight'); this.desiredTrack = 'flight'; },
  };
  return { sound, calls };
}

test('each enemy selects a separate looping encounter theme and returns to flight on departure', () => {
  for (const Enemy of [Villain, SpeedsterVillain, JuggernautVillain]) {
    const { sound, calls } = audio();
    const game = { phase: 'FLYING', villain: new Enemy(800, 200) };
    assert.equal(flightMusicTrack(game), 'boss');
    syncEncounterMusic(game, sound); syncEncounterMusic(game, sound);
    assert.deepEqual(calls, ['boss']);
    game.villain.markedForDeletion = true;
    syncEncounterMusic(game, sound); syncEncounterMusic(game, sound);
    assert.deepEqual(calls, ['boss', 'flight']);
    game.villain = new Enemy(800, 200); syncEncounterMusic(game, sound);
    assert.deepEqual(calls, ['boss', 'flight', 'boss']);
    game.gameOver = true; assert.equal(flightMusicTrack(game), null);
  }
});

test('reinforcements and the first death in a paired encounter never restart combat music', () => {
  const { sound, calls } = audio();
  const game = { phase: 'FLYING', enemies: [new Villain(800, 150)] };
  syncEncounterMusic(game, sound);
  game.enemies.push(new SpeedsterVillain(800, 450)); syncEncounterMusic(game, sound);
  game.enemies[0].markedForDeletion = true; syncEncounterMusic(game, sound);
  assert.deepEqual(calls, ['boss']);
  game.enemies[1].markedForDeletion = true; syncEncounterMusic(game, sound);
  assert.deepEqual(calls, ['boss', 'flight']);
});

test('pause and resume restore the encounter theme when an enemy is still alive', () => {
  const { sound, calls } = audio();
  const game = { phase: 'PAUSED', villain: new Villain(800, 150) };
  sound.desiredTrack = null;
  syncEncounterMusic(game, sound); assert.deepEqual(calls, []);
  game.phase = 'READY'; syncEncounterMusic(game, sound);
  assert.deepEqual(calls, ['boss']);
  game.enemies = []; syncEncounterMusic(game, sound);
  assert.deepEqual(calls, ['boss', 'flight']);
});

test('inactive phases and ended flights never select a theme', () => {
  const { sound, calls } = audio();
  for (const phase of ['PAUSED', 'COUNTDOWN', 'ENDED']) syncEncounterMusic({ phase }, sound);
  syncEncounterMusic({ phase: 'FLYING', gameOver: true }, sound);
  syncEncounterMusic({ phase: 'FLYING' }, null);
  assert.deepEqual(calls, []);
});
