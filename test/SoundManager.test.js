import test from 'node:test';
import assert from 'node:assert/strict';
import { SoundManager } from '../src/game/SoundManager.js';
import { createMusicScore } from '../src/game/MusicScore.js';

class Param {
  constructor() { this.value = 0; }
  setValueAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
  cancelScheduledValues() {}
}
class Node {
  constructor() { for (const key of ['gain', 'frequency', 'Q', 'threshold', 'knee', 'ratio', 'attack', 'release']) this[key] = new Param(); this.stops = []; }
  connect() {}
  disconnect() { this.disconnected = true; }
  start(at) { this.started = at; }
  stop(at = 0) { this.stops.push(at); }
}
class AudioContext {
  constructor() { this.state = AudioContext.nextState || 'running'; this.currentTime = 0; this.sampleRate = 1000; this.destination = new Node(); this.sources = []; this.pending = []; }
  createGain() { return new Node(); }
  createBiquadFilter() { return new Node(); }
  createDynamicsCompressor() { return new Node(); }
  createOscillator() { const node = new Node(); this.sources.push(node); return node; }
  createBufferSource() { return this.createOscillator(); }
  createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
  resume() { return new Promise(resolve => this.pending.push(() => { this.state = 'running'; resolve(); })); }
  finishResume() { this.pending.splice(0).forEach(resolve => resolve()); }
  close() { this.state = 'closed'; return Promise.resolve(); }
}
function setup(t, state = 'running') {
  AudioContext.nextState = state;
  globalThis.window = { AudioContext };
  let timers = 0;
  t.mock.method(globalThis, 'setInterval', () => ++timers);
  t.mock.method(globalThis, 'clearInterval', () => {});
  const sound = new SoundManager();
  t.after(() => sound.cleanup());
  return { sound, timerCount: () => timers };
}

test('music and effects preferences apply independently and survive track switches and context recreation', async t => {
  const { sound } = setup(t);
  sound.setPreferences({ music: false, sfx: true });
  assert.equal(sound.ctx, null, 'Changing preferences must not create an audio context');
  await sound.startMusic();
  assert.equal(sound.musicGain.gain.value, 0);
  assert.equal(sound.sfxGain.gain.value, .55);
  sound.setPreferences({ music: true, sfx: false });
  assert.equal(sound.musicGain.gain.value, .65);
  assert.equal(sound.sfxGain.gain.value, 0);
  await sound.playBossMusic();
  assert.equal(sound.musicGain.gain.value, .65);
  assert.equal(sound.sfxGain.gain.value, 0);
  const oldContext = sound.ctx;
  await oldContext.close();
  sound.setPreferences({ music: false, sfx: false });
  await sound.startMenuMusic();
  assert.notEqual(sound.ctx, oldContext);
  assert.equal(sound.musicGain.gain.value, 0);
  assert.equal(sound.sfxGain.gain.value, 0);
  assert.equal(sound.session.score.track, 'menu');
});

test('rhythm-led backing retains its groove throughout all 32 bars', () => {
  const scores = ['menu', 'flight', 'boss'].map(createMusicScore);
  for (const score of scores) {
    assert.equal(score.beats, 128);
    assert.ok(score.events.every((e, i, all) => e.beat >= 0 && e.beat < score.beats && e.duration > 0 && (!i || all[i - 1].beat <= e.beat)));
    assert.ok(score.events.every(e => !['lead', 'bell'].includes(e.instrument)));
    for (let bar = 0; bar < 32; bar++) {
      const events = score.events.filter(e => e.beat >= bar * 4 && e.beat < (bar + 1) * 4);
      for (const instrument of ['kick', 'tap', 'tick', 'bass', 'pluck']) {
        assert.ok(events.some(e => e.instrument === instrument), `${score.track} bar ${bar}: missing ${instrument}`);
      }
    }
  }
  assert.ok(scores[0].events.length < scores[1].events.length);
  assert.ok(scores[2].events.length > scores[1].events.length);
});

test('stopping during blocked autoplay cannot resurrect music after resume', async t => {
  const { sound, timerCount } = setup(t, 'suspended');
  const start = sound.startMenuMusic();
  const ctx = sound.ctx;
  sound.stopMusic();
  ctx.finishResume();
  await start;
  assert.equal(sound.session, null);
  assert.equal(sound.desiredTrack, null);
  assert.equal(timerCount(), 0);
});

test('rapid asynchronous requests start only the latest track; repeated requests are idempotent', async t => {
  const { sound, timerCount } = setup(t, 'suspended');
  const pending = [sound.startMenuMusic(), sound.startMusic(), sound.playBossMusic()];
  sound.ctx.finishResume();
  await Promise.all(pending);
  assert.equal(sound.session.score.track, 'boss');
  assert.equal(timerCount(), 1);
  const session = sound.session;
  await sound.playBossMusic();
  assert.equal(sound.session, session);
  assert.equal(timerCount(), 1);
});

test('track switches and stopping fade and stop all scheduled voices', async t => {
  const { sound } = setup(t);
  await sound.startMusic();
  const old = sound.session;
  assert.ok(old.voices.size > 0);
  await sound.playBossMusic();
  assert.ok(old.retired);
  assert.ok([...old.voices].every(v => v.source.stops.at(-1) <= sound.ctx.currentTime + .2));
  const current = sound.session;
  sound.stopMusic();
  assert.ok(current.retired);
  assert.equal(sound.musicTimer, null);
  assert.equal(sound.session, null);
});

test('scheduler skips a long timer stall instead of playing an expired backlog', async t => {
  const { sound } = setup(t);
  await sound.startMusic();
  sound.ctx.currentTime = 600;
  const first = sound.ctx.sources.length;
  sound.scheduleAhead(sound.session);
  const newSources = sound.ctx.sources.slice(first);
  assert.ok(newSources.length < 20);
  assert.ok(newSources.every(source => source.started >= 600 && source.started < 600.12));
  assert.ok(sound.session.cycle >= 8);
});

test('closed contexts recreate correctly; disposal forbids later starts', async t => {
  const { sound } = setup(t);
  await sound.startMusic();
  const old = sound.ctx;
  old.state = 'closed';
  await sound.startMusic();
  assert.notEqual(sound.ctx, old);
  assert.equal(sound.session.ctx, sound.ctx);
  sound.cleanup();
  await sound.startMenuMusic();
  assert.equal(sound.session, null);
  assert.equal(sound.musicTimer, null);
  assert.equal(sound.sessions.size, 0);
});

test('delayed chimes start at their envelope time and dense SFX remain bounded', t => {
  const { sound } = setup(t);
  sound.playCollect();
  assert.equal(sound.ctx.sources[1].started, .065);
  for (let i = 0; i < 100; i++) sound.playShoot();
  assert.equal(sound.sfxVoices.size, 16);
});

test('iOS interrupted audio recovers both an existing session and a fresh request', async t => {
  const { sound } = setup(t);
  await sound.startMusic();
  const original = sound.session;
  sound.ctx.state = 'interrupted';
  const unlock = sound.unlock();
  sound.ctx.finishResume();
  await unlock;
  assert.equal(sound.ctx.state, 'running');
  assert.equal(sound.session, original);
  sound.stopMusic();
  sound.ctx.state = 'interrupted';
  const restart = sound.startMenuMusic();
  sound.ctx.finishResume();
  await restart;
  assert.equal(sound.ctx.state, 'running');
  assert.equal(sound.session.score.track, 'menu');
});

test('boss entrance flourish belongs to its session and never replays on resume', async t => {
  const { sound } = setup(t);
  await sound.playBossMusic();
  const normalCount = sound.session.voices.size;
  sound.stopMusic();
  await sound.playBossMusic({entrance:true});
  const entered = sound.session;
  assert.equal(entered.voices.size, normalCount + 3);
  sound.stopMusic();
  assert.ok([...entered.voices].every(v => v.source.stops.at(-1) <= .2));
  await sound.playBossMusic({entrance:false});
  assert.equal(sound.session.voices.size, normalCount);
  const kickBeats = track => createMusicScore(track).events.filter(e => e.instrument === 'kick' && e.beat < 4).map(e=>e.beat);
  assert.notDeepEqual(kickBeats('boss'), kickBeats('flight'));
  assert.equal(createMusicScore('boss').bpm, 144);
});

test('transformation cues respect SFX mute, use immediate bounded voices and differ by vehicle', t => {
  const { sound } = setup(t);
  sound.setPreferences({ music: true, sfx: false });
  sound.playTransformationCue('volt', 'activate');
  assert.equal(sound.ctx, null);
  sound.setPreferences({ music: false, sfx: true });
  sound.playTransformationCue('volt', 'fold');
  sound.playTransformationCue('striker', 'lock');
  sound.playTransformationCue('aegis', 'activate');
  assert.equal(sound.ctx.sources.length, 4);
  assert.ok(sound.ctx.sources.every(source => source.started === sound.ctx.currentTime));
  assert.notEqual(sound.ctx.sources[0].frequency.value, sound.ctx.sources[1].frequency.value);
  for (let i = 0; i < 100; i++) sound.playTransformationCue('drill', 'activate');
  assert.equal(sound.sfxVoices.size, 16);
});
