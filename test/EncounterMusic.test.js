import test from 'node:test';
import assert from 'node:assert/strict';
import { Villain, SpeedsterVillain, JuggernautVillain } from '../src/game/Entities.js';
import { flightMusicTrack, syncEncounterMusic } from '../src/game/EncounterMusic.js';

test('every enemy type changes music on entry and death or departure, with no repeated entrance on resume', () => {
  for (const Enemy of [Villain, SpeedsterVillain, JuggernautVillain]) {
    const calls = [];
    const sound = { desiredTrack: 'flight',
      playBossMusic(options) { calls.push({track:'boss', ...options}); this.desiredTrack = 'boss'; },
      playNormalMusic() { calls.push({track:'flight'}); this.desiredTrack = 'flight'; },
    };
    const game = { phase: 'FLYING', villain: new Enemy(800, 200) };
    syncEncounterMusic(game, sound);
    assert.deepEqual(calls, [{track:'boss',entrance:true}]);
    syncEncounterMusic(game, sound);
    assert.equal(calls.length, 1);
    game.phase = 'PAUSED'; sound.desiredTrack = null;
    syncEncounterMusic(game, sound);
    assert.equal(calls.length, 1);
    // Both normal resume and rewarded revival hand control back in READY.
    game.phase = 'READY';
    syncEncounterMusic(game, sound, {allowEntrance:false});
    assert.deepEqual(calls.at(-1), {track:'boss',entrance:false});
    game.villain.markedForDeletion = true;
    syncEncounterMusic(game, sound);
    assert.deepEqual(calls.at(-1), {track:'flight'});
    game.villain = null;
    syncEncounterMusic(game, sound);
    assert.equal(calls.length, 3);
    game.villain = new Enemy(800,200);
    syncEncounterMusic(game, sound);
    game.villain = null; // Survived the encounter until the enemy leaves.
    syncEncounterMusic(game,sound);
    assert.equal(calls.at(-1).track, 'flight');
    game.gameOver = true;
    assert.equal(flightMusicTrack(game), null);
  }
});
