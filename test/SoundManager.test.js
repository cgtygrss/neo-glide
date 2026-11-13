import test from 'node:test';
import assert from 'node:assert/strict';
import { SoundManager } from '../src/game/SoundManager.js';
import { MUSIC_TRACKS, MUSIC_VOLUME, SFX_VOLUME, MUSIC_CROSSFADE_SECONDS, MENU_EXIT_SECONDS } from '../src/game/MusicTracks.js';

class Param {
  constructor() { this.value = 0; this.events = []; }
  setValueAtTime(value, at) { this.value = value; this.events.push({ kind: 'set', value, at }); }
  linearRampToValueAtTime(value, at) { this.value = value; this.events.push({ kind: 'ramp', value, at }); }
  exponentialRampToValueAtTime(value) { this.value = value; }
  cancelScheduledValues() {}
}
class Node {
  constructor(kind) {
    this.kind = kind;
    for (const key of ['gain', 'frequency', 'Q', 'threshold', 'knee', 'ratio', 'attack', 'release']) this[key] = new Param();
    this.stops = [];
  }
  connect(output) { this.output = output; }
  disconnect() { this.disconnected = true; }
  start(at, offset = 0) { this.started = at; this.offset = offset; }
  stop(at = 0) { this.stops.push(at); }
}
class AudioContext {
  constructor() {
    this.state = AudioContext.nextState || 'running'; this.currentTime = 0; this.sampleRate = 1000;
    this.destination = new Node('destination'); this.sources = []; this.pending = [];
  }
  createGain() { return new Node('gain'); }
  createBiquadFilter() { return new Node('filter'); }
  createDynamicsCompressor() { return new Node('compressor'); }
  createOscillator() { const source = new Node('oscillator'); this.sources.push(source); return source; }
  createBufferSource() { const source = new Node('recording'); this.sources.push(source); return source; }
  createBuffer(channels, length) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { duration: length / this.sampleRate, getChannelData: channel => data[channel] };
  }
  decodeAudioData(data) {
    const url = new TextDecoder().decode(data);
    return Promise.resolve({ duration: 60, url });
  }
  resume() { return new Promise(resolve => this.pending.push(() => { this.state = 'running'; resolve(); })); }
  suspend() { this.suspends = (this.suspends || 0) + 1; this.state = 'suspended'; return Promise.resolve(); }
  finishResume() { this.pending.splice(0).forEach(resolve => resolve()); }
  close() { this.state = 'closed'; return Promise.resolve(); }
}
const response = url => ({ ok: true, arrayBuffer: async () => new TextEncoder().encode(url).buffer });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const settle = () => new Promise(resolve => setImmediate(resolve));
function setup(t, state = 'running') {
  AudioContext.nextState = state;
  globalThis.window = { AudioContext };
  const fetched = []; let fetcher = url => response(url), timers = 0;
  t.mock.method(globalThis, 'fetch', url => { fetched.push(url); return Promise.resolve(fetcher(url)); });
  t.mock.method(globalThis, 'setInterval', () => ++timers);
  const sound = new SoundManager();
  t.after(() => sound.cleanup());
  return { sound, fetched, fetchWith: fn => { fetcher = fn; }, timerCount: () => timers };
}

test('recorded menu and flight assets replace synthesized background music and share decoded buffers', async t => {
  const { sound, fetched, timerCount } = setup(t);
  await sound.startMenuMusic();
  assert.equal(sound.session.source.buffer.url, MUSIC_TRACKS.menu.url);
  assert.equal(sound.session.source.loop, true);
  await sound.startMusic();
  assert.equal(sound.session.source.buffer.url, MUSIC_TRACKS.flight.url);
  await sound.startMenuMusic();
  assert.deepEqual(new Set(fetched), new Set(Object.values(MUSIC_TRACKS).map(track => track.url)));
  assert.equal(fetched.length, 3);
  assert.ok(sound.ctx.sources.every(source => source.kind === 'recording'));
  assert.equal(timerCount(), 0, 'Recorded loops need no note scheduler');
});

test('simultaneous requests for the same track share loading and create one loop', async t => {
  const { sound, fetched } = setup(t);
  await Promise.all([sound.startMusic(), sound.startMusic(), sound.unlock()]);
  assert.equal(fetched.length, 1);
  assert.equal(sound.ctx.sources.length, 1);
  const session = sound.session;
  await sound.playNormalMusic(); assert.equal(sound.session, session);
});

test('menu navigation preserves its source while preloading both gameplay recordings without playing them', async t => {
  const { sound, fetched } = setup(t);
  await sound.startMenuMusic(); await sound.preloadGameplay();
  const menu = sound.session;
  await sound.startMenuMusic(); await sound.playMenuMusic(); await sound.unlock();
  assert.equal(sound.session, menu);
  assert.equal(sound.ctx.sources.length, 1);
  assert.deepEqual([...sound.buffers.keys()].sort(), ['boss', 'flight', 'menu']);
  assert.equal(fetched.length, 3);
});

test('Play stops menu in 100ms before a slow load, then leaves 250ms silence and fades flight in for 150ms', async t => {
  const { sound, fetchWith } = setup(t);
  const wait = deferred();
  fetchWith(url => url === MUSIC_TRACKS.flight.url ? wait.promise : response(url));
  await sound.startMenuMusic(); const menu = sound.session;
  sound.ctx.currentTime = 1;
  const pending = sound.startMusic();
  assert.equal(menu.source.stops.at(-1), 1.1);
  assert.equal(sound.session, null, 'Menu is detached before the new recording loads');
  assert.equal(sound.desiredTrack, 'flight');
  wait.resolve(response(MUSIC_TRACKS.flight.url)); await pending;
  assert.equal(sound.session.source.started, 1.35);
  assert.deepEqual(sound.session.bus.gain.events.slice(-2), [
    { kind: 'set', value: 0, at: 1.35 },
    { kind: 'ramp', value: 1, at: 1.5 },
  ]);
  assert.equal(sound.session.source.buffer.url, MUSIC_TRACKS.flight.url);
});

test('a failed flight load leaves menu stopped and effects usable; a gesture retries the flight', async t => {
  const { sound, fetchWith } = setup(t);
  fetchWith(url => url === MUSIC_TRACKS.flight.url ? { ok: false } : response(url));
  await sound.startMenuMusic(); await sound.preloadGameplay();
  const menu = sound.session; sound.ctx.currentTime = 1;
  await sound.startMusic();
  assert.ok(menu.retired); assert.equal(sound.session, null);
  assert.match(sound.musicError, /unavailable/);
  sound.playShoot(); assert.equal(sound.sfxVoices.size, 1);
  sound.ctx.currentTime = 2;
  fetchWith(response); await sound.unlock();
  assert.equal(sound.session.track, 'flight');
  assert.equal(sound.session.source.started, 2);
  assert.equal(sound.musicError, null);
});

test('pause cancels a scheduled post-menu entry before its source can start', async t => {
  const { sound } = setup(t);
  await sound.startMenuMusic(); sound.ctx.currentTime = 1;
  await sound.startMusic(); const flight = sound.session;
  assert.equal(flight.startedAt, 1.35);
  sound.ctx.currentTime = 1.05; sound.stopMusic();
  assert.equal(flight.source.stops.at(-1), 1.05);
  assert.ok(flight.disconnected);
  assert.equal(sound.entryTransition, null);
  await sound.unlock(); assert.equal(sound.session, null);
});

test('leaving and retrying during slow flight loading starts only the newest entry after its own silence', async t => {
  const { sound, fetchWith } = setup(t);
  const wait = deferred();
  fetchWith(url => url === MUSIC_TRACKS.flight.url ? wait.promise : response(url));
  await sound.startMenuMusic(); sound.ctx.currentTime = 1;
  const obsolete = sound.startMusic();
  sound.ctx.currentTime = 1.05; await sound.startMenuMusic();
  sound.ctx.currentTime = 2; const latest = sound.startMusic();
  wait.resolve(response(MUSIC_TRACKS.flight.url));
  await Promise.all([obsolete, latest]);
  const flights = sound.ctx.sources.filter(source => source.buffer.url === MUSIC_TRACKS.flight.url);
  assert.equal(flights.length, 1);
  assert.equal(flights[0].started, 2.35);
  assert.equal(sound.desiredTrack, 'flight');
});

test('custom slider values survive switches, mute/unmute and audio context recreation', async t => {
  const { sound } = setup(t);
  sound.setPreferences({ music: true, sfx: true, musicVolume: .08, sfxVolume: .91 });
  await sound.startMenuMusic(); await sound.startMusic(); await sound.playBossMusic();
  assert.equal(sound.musicGain.gain.value, .08); assert.equal(sound.sfxGain.gain.value, .91);
  sound.setPreferences({ ...sound.preferences, music: false });
  assert.equal(sound.musicGain.gain.value, 0); assert.equal(sound.preferences.musicVolume, .08);
  sound.setPreferences({ ...sound.preferences, music: true, sfx: false });
  assert.equal(sound.musicGain.gain.value, .08); assert.equal(sound.sfxGain.gain.value, 0);
  await sound.ctx.close(); await sound.playBossMusic();
  assert.equal(sound.musicGain.gain.value, .08); assert.equal(sound.sfxGain.gain.value, 0);
  sound.setPreferences({ ...sound.preferences, sfx: true, musicVolume: 0 });
  assert.equal(sound.musicGain.gain.value, 0); assert.equal(sound.sfxGain.gain.value, .91);
});

test('music and effects preferences remain independent across recording switches and context recreation', async t => {
  const { sound } = setup(t);
  sound.setPreferences({ music: false, sfx: true }); assert.equal(sound.ctx, null);
  await sound.startMusic();
  assert.equal(sound.musicGain.gain.value, 0); assert.equal(sound.sfxGain.gain.value, SFX_VOLUME);
  sound.setPreferences({ music: true, sfx: false });
  await sound.startMenuMusic();
  assert.equal(sound.musicGain.gain.value, MUSIC_VOLUME); assert.equal(sound.sfxGain.gain.value, 0);
  const old = sound.ctx; await old.close();
  sound.setPreferences({ music: false, sfx: false }); await sound.startMusic();
  assert.notEqual(sound.ctx, old);
  assert.equal(sound.musicGain.gain.value, 0); assert.equal(sound.sfxGain.gain.value, 0);
});

test('stopping during blocked autoplay cannot resurrect music after resume', async t => {
  const { sound } = setup(t, 'suspended');
  const start = sound.startMenuMusic(), ctx = sound.ctx;
  sound.stopMusic(); ctx.finishResume(); await start;
  assert.equal(sound.session, null); assert.equal(sound.desiredTrack, null); assert.equal(sound.ctx.sources.length, 0);
});

test('rapid asynchronous track changes start only the latest recording', async t => {
  const { sound, fetched } = setup(t, 'suspended');
  const pending = [sound.startMenuMusic(), sound.startMusic()];
  sound.ctx.finishResume(); await Promise.all(pending);
  assert.equal(sound.session.track, 'flight');
  assert.deepEqual(new Set(fetched), new Set([MUSIC_TRACKS.flight.url, MUSIC_TRACKS.boss.url]));
});

test('stopping while a recording downloads prevents late playback', async t => {
  const { sound, fetchWith } = setup(t); const wait = deferred(); fetchWith(() => wait.promise);
  const pending = sound.startMusic(); sound.stopMusic();
  wait.resolve(response(MUSIC_TRACKS.flight.url)); await pending;
  assert.equal(sound.session, null); assert.equal(sound.ctx.sources.length, 0);
});

test('failed audio loading stays retryable and never falls back to an electronic melody', async t => {
  const { sound, fetchWith } = setup(t);
  fetchWith(() => ({ ok: false })); await sound.startMusic();
  assert.match(sound.musicError, /unavailable/); assert.equal(sound.session, null);
  fetchWith(response); await sound.unlock();
  assert.equal(sound.musicError, null); assert.equal(sound.session.track, 'flight');
  assert.equal(sound.ctx.sources.length, 1);
});

test('iOS local media with status zero decodes and plays all three recordings', async t => {
  const { sound, fetchWith } = setup(t);
  window.location = { protocol: 'capacitor:' };
  fetchWith(url => ({ ...response(url), ok: false, status: 0 }));
  for (const track of ['menu', 'flight', 'boss']) {
    await sound.startTrack(track);
    assert.equal(sound.musicError, null);
    assert.equal(sound.session.track, track);
    assert.equal(sound.session.source.buffer.url, MUSIC_TRACKS[track].url);
  }
});

test('HTTP errors, empty native files and browser status-zero failures remain retryable errors', async t => {
  const { sound, fetchWith } = setup(t);
  for (const [protocol, status, empty] of [['https:', 0, false], ['capacitor:', 404, false], ['capacitor:', 0, true]]) {
    window.location = { protocol };
    fetchWith(url => ({ ok: false, status, arrayBuffer: empty ? async () => new ArrayBuffer(0) : response(url).arrayBuffer }));
    await sound.startMusic();
    assert.match(sound.musicError, /unavailable/);
    assert.equal(sound.session, null);
  }
  fetchWith(response);
  await sound.unlock();
  assert.equal(sound.musicError, null);
  assert.equal(sound.session.track, 'flight');
});

test('all three themes stay quiet enough for effects across switches and mute changes', async t => {
  const { sound } = setup(t);
  assert.ok(MUSIC_VOLUME >= .25 && MUSIC_VOLUME < SFX_VOLUME / 2);
  for (const track of ['menu', 'flight', 'boss', 'flight']) {
    await sound.startTrack(track);
    assert.equal(sound.session.track, track);
    assert.equal(sound.session.source.loop, true);
    assert.equal(sound.musicGain.gain.value, MUSIC_VOLUME);
    assert.equal(sound.sfxGain.gain.value, SFX_VOLUME);
    sound.setPreferences({ music: false, sfx: true });
    assert.equal(sound.musicGain.gain.value, 0);
    assert.equal(sound.sfxGain.gain.value, SFX_VOLUME);
    sound.setPreferences({ music: true, sfx: true });
    assert.equal(sound.musicGain.gain.value, MUSIC_VOLUME);
  }
});

test('encounter theme crossfades once and returning to flight resumes its playhead', async t => {
  const { sound, fetched } = setup(t); await sound.startMusic();
  const flight = sound.session;
  sound.ctx.currentTime = 12;
  await sound.playBossMusic();
  const boss = sound.session;
  assert.equal(boss.track, 'boss');
  assert.equal(boss.source.loop, true);
  assert.equal(flight.retired, true);
  assert.equal(flight.source.stops.at(-1), 12 + MUSIC_CROSSFADE_SECONDS);
  await sound.playBossMusic(); assert.equal(sound.session, boss);
  sound.ctx.currentTime = 18;
  await sound.playNormalMusic();
  assert.equal(sound.session.track, 'flight');
  assert.equal(sound.session.source.offset, 12);
  assert.equal(fetched.filter(url => url === MUSIC_TRACKS.flight.url).length, 1);
  await sound.startMenuMusic();
  await sound.startMusic();
  assert.equal(sound.session.source.offset, 0, 'A new run starts its theme afresh');
});

test('flight keeps playing until encounter audio is ready; a quick departure cancels late combat audio', async t => {
  const { sound, fetchWith } = setup(t); await sound.startMusic();
  const flight = sound.session, wait = deferred();
  fetchWith(url => url === MUSIC_TRACKS.boss.url ? wait.promise : response(url));
  const pending = sound.playBossMusic(); await settle();
  assert.equal(sound.session, flight); assert.equal(flight.retired, false);
  await sound.playNormalMusic();
  wait.resolve(response(MUSIC_TRACKS.boss.url)); await pending;
  assert.equal(sound.session, flight); assert.equal(sound.desiredTrack, 'flight');
  assert.equal(sound.ctx.sources.length, 1);
});

test('menu or pause during encounter loading cannot resurrect combat music', async t => {
  for (const destination of ['menu', 'stop']) {
    const { sound, fetchWith } = setup(t); await sound.startMusic();
    const wait = deferred();
    fetchWith(url => url === MUSIC_TRACKS.boss.url ? wait.promise : response(url));
    const pending = sound.playBossMusic(); await settle();
    if (destination === 'menu') await sound.startMenuMusic();
    else sound.stopMusic();
    wait.resolve(response(MUSIC_TRACKS.boss.url)); await pending;
    assert.equal(sound.desiredTrack, destination === 'menu' ? 'menu' : null);
    assert.equal(sound.session?.track ?? null, destination === 'menu' ? 'menu' : null);
  }
});

test('failed encounter loading leaves flight audible and can retry on unlock', async t => {
  const { sound, fetchWith } = setup(t); await sound.startMusic();
  const flight = sound.session;
  fetchWith(() => ({ ok: false })); await sound.playBossMusic();
  assert.match(sound.musicError, /unavailable/);
  assert.equal(sound.session, flight); assert.equal(flight.retired, false);
  fetchWith(response); await sound.unlock();
  assert.equal(sound.session.track, 'boss'); assert.equal(sound.musicError, null);
});

test('pausing during a crossfade stops every outgoing recording', async t => {
  const { sound } = setup(t); await sound.startMusic(); const flight = sound.session;
  sound.ctx.currentTime = 1;
  await sound.playBossMusic(); const boss = sound.session;
  sound.ctx.currentTime = 1.1;
  sound.stopMusic();
  assert.equal(flight.source.stops.at(-1), 1.1 + MENU_EXIT_SECONDS);
  assert.equal(boss.source.stops.at(-1), 1.1 + MENU_EXIT_SECONDS);
  assert.equal(sound.session, null);
});

test('track switches and stopping fade and stop recorded loops and disconnect ended nodes', async t => {
  const { sound } = setup(t); await sound.startMusic(); const old = sound.session;
  sound.ctx.currentTime = 1;
  await sound.startMenuMusic(); assert.ok(old.retired); assert.equal(old.source.stops.at(-1), 1 + MUSIC_CROSSFADE_SECONDS);
  old.source.onended(); assert.equal(old.disconnected, true);
  const current = sound.session; sound.stopMusic();
  assert.ok(current.retired); assert.equal(sound.session, null); assert.equal(sound.isPlayingMusic, false);
});

test('iOS interrupted audio resumes an existing recording without refetching or restarting it', async t => {
  const { sound, fetched } = setup(t); await sound.startMusic(); const original = sound.session;
  sound.ctx.state = 'interrupted'; const unlock = sound.unlock(); sound.ctx.finishResume(); await unlock;
  assert.equal(sound.ctx.state, 'running'); assert.equal(sound.session, original); assert.equal(fetched.length, 1);
});

test('first video ad restores music and effects with the same playhead and volume preferences', async t => {
  const {sound,fetched}=setup(t);
  sound.setPreferences({music:true,sfx:true,musicVolume:.37,sfxVolume:.24});
  await sound.startMusic();const session=sound.session,ctx=sound.ctx;
  ctx.currentTime=7;sound.playShoot();
  const oldEffects=[...sound.sfxVoices];
  sound.beginAdAudio();
  assert.equal(ctx.state,'suspended');assert.equal(sound.masterGain.gain.value,0);
  assert.ok(oldEffects.every(source=>source.stops.length>0));
  const sourceCount=ctx.sources.length;sound.playShoot();await sound.unlock();
  assert.equal(ctx.sources.length,sourceCount,'Controls cannot wake game audio under an ad');
  const recover=sound.recoverAfterAd({reset:true});ctx.finishResume();assert.equal(await recover,true);
  assert.equal(sound.ctx,ctx);assert.equal(sound.session,session);assert.equal(ctx.currentTime,7);
  assert.equal(sound.musicGain.gain.value,.37);assert.equal(sound.sfxGain.gain.value,.24);
  assert.equal(sound.masterGain.gain.value,.65);assert.equal(fetched.length,1);
  sound.playShoot();assert.equal(sound.sfxVoices.size,1);
});

test('ad recovery cycles a graph that reports running but has lost its native output', async t => {
  const {sound}=setup(t);await sound.startMenuMusic();const session=sound.session;
  sound.beginAdAudio();sound.ctx.state='running';
  const before=sound.ctx.suspends,recover=sound.recoverAfterAd({reset:true});
  await settle();assert.equal(sound.ctx.suspends,before+1);sound.ctx.finishResume();
  assert.equal(await recover,true);assert.equal(sound.session,session);
});

test('a gesture restores both audio buses after automatic post-ad resume was rejected', async t => {
  const {sound}=setup(t);await sound.startMusic();sound.beginAdAudio();
  const resume=sound.ctx.resume;sound.ctx.resume=async()=>{throw new Error('Gesture required');};
  assert.equal(await sound.recoverAfterAd(),false);assert.equal(sound.masterGain.gain.value,0);
  sound.ctx.resume=resume;const retry=sound.unlock();sound.ctx.finishResume();await retry;
  assert.equal(sound.ctx.state,'running');assert.equal(sound.masterGain.gain.value,.65);
  assert.equal(sound.adRecoveryPending,false);sound.playShoot();assert.equal(sound.sfxVoices.size,1);
});

test('ad recovery respects mute, paused music, disposal and a newer ad during an old resume', async t => {
  const {sound}=setup(t);await sound.startMusic();
  sound.beginAdAudio();const stale=sound.recoverAfterAd();sound.beginAdAudio();
  sound.ctx.finishResume();assert.equal(await stale,false);assert.equal(sound.masterGain.gain.value,0);
  sound.setPreferences({music:false,sfx:false,musicVolume:0,sfxVolume:0});sound.stopMusic();
  sound.ctx.state='suspended';const current=sound.recoverAfterAd();sound.ctx.finishResume();
  assert.equal(await current,true);assert.equal(sound.session,null);assert.equal(sound.desiredTrack,null);
  assert.equal(sound.musicGain.gain.value,0);assert.equal(sound.sfxGain.gain.value,0);
  sound.cleanup();assert.equal(await sound.recoverAfterAd({reset:true}),false);
});

test('a user gesture retries resume while the first autoplay promise is still blocked', async t => {
  const { sound } = setup(t, 'suspended');
  const autoplay = sound.startMenuMusic();
  assert.equal(sound.ctx.pending.length, 1);
  const gesture = sound.unlock();
  assert.equal(sound.ctx.pending.length, 2, 'Resume must be invoked again inside the gesture');
  sound.ctx.finishResume();
  await Promise.all([autoplay, gesture]);
  assert.equal(sound.ctx.state, 'running');
  assert.equal(sound.session.track, 'menu');
  assert.equal(sound.ctx.sources.length, 1);
});

test('closed contexts recreate buffers correctly; disposal releases sources and forbids later starts', async t => {
  const { sound, fetched } = setup(t); await sound.startMusic(); const old = sound.ctx;
  old.state = 'closed'; await sound.startMusic();
  assert.notEqual(sound.ctx, old); assert.equal(fetched.length, 2);
  sound.cleanup(); await sound.startMenuMusic(); await sound.playBossMusic();
  assert.equal(sound.session, null); assert.equal(sound.sessions.size, 0); assert.equal(sound.buffers.size, 0);
});

test('delayed collection chimes start at their envelope time and dense effects stay bounded', t => {
  const { sound } = setup(t); sound.playCollect(); assert.equal(sound.ctx.sources[1].started, .065);
  for (let i = 0; i < 100; i++) sound.playShoot(); assert.equal(sound.sfxVoices.size, 16);
});

test('transformation cues retain their independent effects mute and bounded voices', t => {
  const { sound } = setup(t); sound.setPreferences({ music: true, sfx: false });
  sound.playTransformationCue('volt', 'activate'); assert.equal(sound.ctx, null);
  sound.setPreferences({ music: false, sfx: true });
  sound.playTransformationCue('volt', 'fold'); sound.playTransformationCue('striker', 'lock'); sound.playTransformationCue('aegis', 'activate');
  assert.equal(sound.ctx.sources.length, 10);
  assert.ok(sound.ctx.sources.every(source => source.started >= sound.ctx.currentTime && source.started <= sound.ctx.currentTime + .12));
  for (let i = 0; i < 100; i++) sound.playTransformationCue('drill', 'activate');
  assert.equal(sound.sfxVoices.size, 16);
});

test('all five capsule pickups combine impact, textured noise and distinct signatures on the effects bus', t => {
  const { sound, fetched, timerCount } = setup(t);
  sound.setPreferences({ music: false, sfx: true, sfxVolume: .37 });
  const signatures = [];
  for (const id of ['striker', 'drill', 'sphere', 'volt', 'aegis']) {
    const before = sound.ctx?.sources.length || 0;
    sound.playTransformationPickup(id);
    const voices = sound.ctx.sources.slice(before);
    assert.ok(voices.length >= 4 && voices.length <= 5);
    assert.ok(voices.some(source => source.kind === 'recording'));
    assert.ok(voices.some(source => source.kind === 'oscillator'));
    signatures.push(JSON.stringify(voices.map(source => [source.type, source.frequency.events, source.frequency.value, source.started, source.stops])));
    for (const source of voices) {
      assert.equal(source.output.output.output, sound.sfxGain);
      assert.ok(source.started >= sound.ctx.currentTime);
      assert.ok(source.stops[0] <= sound.ctx.currentTime + .65);
      assert.ok(source.output.output.gain.events.some(event => event.kind === 'ramp' && event.value > 0 && event.value <= .45));
      source.onended();
      assert.equal(source.disconnected, true);
      assert.equal(source.output.disconnected, true);
      assert.equal(source.output.output.disconnected, true);
    }
    assert.equal(sound.sfxVoices.size, 0);
  }
  assert.equal(new Set(signatures).size, 5);
  assert.equal(sound.sfxGain.gain.value, .37);
  assert.equal(sound.musicGain.gain.value, 0);
  assert.equal(fetched.length, 0);
  assert.equal(timerCount(), 0);
});

test('capsule pickup effects honor mute, zero volume, invalid IDs and disposal without creating voices', t => {
  const { sound } = setup(t);
  for (const preferences of [{ sfx: false }, { sfx: true, sfxVolume: 0 }]) {
    sound.setPreferences(preferences);
    for (const id of ['striker', 'drill', 'sphere', 'volt', 'aegis']) sound.playTransformationPickup(id);
    assert.equal(sound.ctx, null);
  }
  sound.setPreferences({ sfx: true });
  for (const id of [undefined, 'invalid', 'constructor']) sound.playTransformationPickup(id);
  assert.equal(sound.ctx, null);
  sound.playTransformationPickup('sphere');
  const count = sound.ctx.sources.length;
  sound.cleanup(); sound.playTransformationPickup('sphere');
  assert.equal(sound.ctx.sources.length, count);
});

test('repeated capsule pickup effects respect the shared voice ceiling alongside combat audio', t => {
  const { sound } = setup(t);
  sound.playShoot();
  for (let i = 0; i < 100; i++) sound.playTransformationPickup(['sphere', 'volt', 'aegis'][i % 3]);
  assert.equal(sound.sfxVoices.size, 16);
  assert.equal(sound.ctx.sources.length, 16);
  for (const source of sound.ctx.sources) source.onended();
  assert.equal(sound.sfxVoices.size, 0);
  sound.playTransformationPickup('drill');
  assert.equal(sound.sfxVoices.size, 4);
});

test('assembly locks and activation use metal contacts and motor bursts with only short low thumps', t => {
  const { sound } = setup(t);
  for (const cue of ['fold', 'lock', 'activate']) {
    const before = sound.ctx?.sources.length || 0;
    sound.playTransformationCue('sphere', cue);
    const voices = sound.ctx.sources.slice(before);
    assert.ok(voices.some(source => source.kind === 'recording'));
    assert.ok(voices.some(source => source.output.output.gain.events.some(event => event.kind === 'ramp' && event.value >= .22)));
    if (cue === 'activate') {
      assert.equal(voices.length, 5);
      assert.ok(voices.some(source => source.buffer === sound.transformationMechanisms.get('servo')));
      assert.ok(voices.some(source => source.buffer === sound.transformationMechanisms.get('clamp')));
      assert.ok(voices.every(source => source.stops[0] - source.started <= .45));
      for (const voice of voices.filter(source => source.kind === 'oscillator')) {
        assert.ok(voice.stops[0] - voice.started <= .2);
        assert.ok(voice.frequency.events.every(event => event.value <= 150));
      }
    }
    for (const voice of voices) voice.onended();
  }
  sound.setPreferences({ sfx: true, sfxVolume: 0 });
  const count = sound.ctx.sources.length;
  sound.playTransformationCue('sphere', 'activate');
  assert.equal(sound.ctx.sources.length, count);
});

test('vehicle mechanisms have distinct bounded PCM, share cached buffers and reset with the audio context', t => {
  const { sound } = setup(t);
  const signatures = [];
  for (const [id, mechanism] of [['sphere', 'servo'], ['drill', 'ratchet'], ['striker', 'turbine'], ['volt', 'relay'], ['aegis', 'hydraulic']]) {
    sound.playTransformationPickup(id);
    const buffer = sound.transformationMechanisms.get(mechanism);
    const samples = buffer.getChannelData(0);
    assert.equal(buffer.duration, .7);
    assert.ok(samples.some(sample => Math.abs(sample) > .1));
    assert.ok(samples.every(sample => Number.isFinite(sample) && Math.abs(sample) <= 1));
    signatures.push(JSON.stringify([...samples]));
    for (const source of [...sound.sfxVoices]) source.onended();
    sound.playTransformationCue(id, 'fold');
    assert.equal(sound.ctx.sources.at(-2).buffer, buffer);
    for (const source of [...sound.sfxVoices]) source.onended();
  }
  assert.equal(new Set(signatures).size, 5);
  assert.equal(sound.transformationMechanisms.size, 6, 'Five motors and a shared metal clamp');
  const first = sound.transformationMechanisms.get('servo');
  sound.ctx.state = 'closed';
  sound.playTransformationPickup('sphere');
  assert.notEqual(sound.transformationMechanisms.get('servo'), first);
  assert.equal(sound.transformationMechanisms.size, 2);
  sound.cleanup();
  assert.equal(sound.transformationMechanisms.size, 0);
});

test('transformation texture buffer is cached, bounded and recreated with a new audio context', t => {
  const { sound } = setup(t);
  sound.playTransformationPickup('sphere');
  const first = sound.transformationNoise;
  const samples = first.getChannelData(0);
  assert.ok(samples.some(sample => sample !== 0));
  assert.ok(samples.every(sample => Math.abs(sample) <= 1));
  for (const source of [...sound.sfxVoices]) source.onended();
  sound.playTransformationCue('drill', 'lock');
  assert.equal(sound.transformationNoise, first);
  sound.ctx.state = 'closed';
  sound.playTransformationPickup('volt');
  assert.notEqual(sound.transformationNoise, first);
  sound.cleanup();
  assert.equal(sound.transformationNoise, null);
});

test('Boost and Fire use distinct short, quiet control sounds on the effects bus', t => {
  const { sound } = setup(t);
  sound.setPreferences({ music: false, sfx: true, sfxVolume: .37 });
  sound.playControlPress('boost'); sound.playControlPress('fire');
  assert.equal(sound.ctx.sources.length, 2);
  const [boost, fire] = sound.ctx.sources;
  assert.equal(boost.kind, 'recording', 'Rocket ignition uses a noise/rumble buffer instead of a button tone');
  assert.equal(fire.kind, 'oscillator');
  const ignition = boost.buffer.getChannelData(0);
  assert.ok(ignition.some(sample => sample !== 0));
  assert.ok(ignition.every(sample => Math.abs(sample) <= 1));
  for (const source of [boost, fire]) {
    assert.equal(source.output.output.output, sound.sfxGain);
    assert.equal(source.started, sound.ctx.currentTime);
    assert.ok(source.stops[0] - source.started <= .26);
    assert.ok(source.output.output.gain.events.some(event => event.kind === 'ramp' && event.value <= .18));
    source.onended();
    assert.equal(source.disconnected, true);
    assert.equal(source.output.disconnected, true);
    assert.equal(source.output.output.disconnected, true);
  }
  assert.equal(sound.sfxGain.gain.value, .37);
  assert.equal(sound.musicGain.gain.value, 0);
  assert.equal(sound.sfxVoices.size, 0);
});

test('scout lock and beam audio respect effects preferences, disposal and the combat voice ceiling', t => {
  const { sound } = setup(t);
  sound.setPreferences({ sfx: false }); sound.playScoutLock(); sound.playScoutBeam();
  assert.equal(sound.ctx, null);
  sound.setPreferences({ sfx: true, sfxVolume: .37 }); sound.playScoutLock(); sound.playScoutBeam();
  assert.equal(sound.ctx.sources.length, 3);
  assert.equal(sound.sfxGain.gain.value, .37);
  for (const source of sound.ctx.sources) assert.equal(source.output.output.output, sound.sfxGain);
  for (let i = 0; i < 30; i++) { sound.playScoutLock(); sound.playScoutBeam(); }
  assert.equal(sound.sfxVoices.size, 16);
  const count = sound.ctx.sources.length;
  sound.cleanup(); sound.playScoutLock(); sound.playScoutBeam();
  assert.equal(sound.ctx.sources.length, count);
});

test('control sounds obey effects mute and zero volume, stay bounded and cannot play after disposal', t => {
  const { sound } = setup(t);
  sound.setPreferences({ music: true, sfx: false });
  sound.playControlPress('boost'); sound.playControlPress('fire');
  assert.equal(sound.ctx, null);
  sound.setPreferences({ music: true, sfx: true, sfxVolume: 0 });
  sound.playControlPress('boost'); assert.equal(sound.ctx, null);
  sound.setPreferences({ music: true, sfx: true });
  sound.playControlPress('invalid'); assert.equal(sound.ctx, null);
  for (let i = 0; i < 100; i++) sound.playControlPress(i % 2 ? 'boost' : 'fire');
  assert.equal(sound.sfxVoices.size, 16);
  const count = sound.ctx.sources.length;
  sound.cleanup(); sound.playControlPress('boost'); sound.playControlPress('fire');
  assert.equal(sound.ctx.sources.length, count);
});
