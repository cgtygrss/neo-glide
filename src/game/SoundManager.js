import { createAudioMix } from './MusicSynth.js';
import { MUSIC_TRACKS, MUSIC_CROSSFADE_SECONDS, MENU_EXIT_SECONDS, FLIGHT_SILENCE_SECONDS, FLIGHT_FADE_IN_SECONDS } from './MusicTracks.js';
import { normalizeSoundPreferences } from './SoundPreferences.js';
import { transformationSoundLayers, createMechanismBuffer } from './TransformationSounds.js';

const needsResume = ctx => ctx.state === 'suspended' || ctx.state === 'interrupted';

export class SoundManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.musicGain = null;
        this.sfxGain = null;
        this.initialized = false;
        this.disposed = false;
        this.isPlayingMusic = false;
        this.desiredTrack = null;
        this.musicError = null;
        this.session = null;
        this.sessions = new Set();
        this.sfxVoices = new Set();
        this.generation = 0;
        this.trackRequest = null;
        this.trackPositions = new Map();
        this.entryTransition = null;
        this.buffers = new Map();
        this.loads = new Map();
        this.lastCollect = -Infinity;
        this.transformationNoise = null;
        this.transformationMechanisms = new Map();
        this.preferences = normalizeSoundPreferences();
        this.adAudioActive = false;
        this.adAudioGeneration = 0;
        this.adRecoveryPending = false;
        this.masterLevel = .65;
    }

    setPreferences(preferences) {
        this.preferences = normalizeSoundPreferences(preferences);
        this.applyPreferences();
    }

    applyPreferences(immediate = false) {
        if (!this.ctx || this.ctx.state === 'closed' || this.disposed) return;
        const now = this.ctx.currentTime;
        for (const [bus, value] of [[this.musicGain, this.preferences.music ? this.preferences.musicVolume : 0], [this.sfxGain, this.preferences.sfx ? this.preferences.sfxVolume : 0]]) {
            bus.gain.cancelScheduledValues(now);
            if (immediate) bus.gain.setValueAtTime(value, now);
            else {
                bus.gain.setValueAtTime(bus.gain.value, now);
                bus.gain.linearRampToValueAtTime(value, now + .04);
            }
        }
    }

    init() {
        if (this.disposed) return false;
        if (this.ctx && this.ctx.state !== 'closed') return true;
        if (this.ctx?.state === 'closed') {
            for (const session of [...this.sessions]) this.disconnectSession(session);
            this.session = null;
            this.isPlayingMusic = false;
            this.entryTransition = null;
            this.sfxVoices.clear();
        }
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return false;
        this.ctx = new AudioContext();
        this.transformationNoise = null;
        this.transformationMechanisms.clear();
        this.buffers = new Map();
        this.loads = new Map();
        Object.assign(this, createAudioMix(this.ctx));
        this.masterLevel = this.masterGain.gain.value;
        if (this.adAudioActive) this.masterGain.gain.value = 0;
        this.applyPreferences(true);
        this.initialized = true;
        this.lastCollect = -Infinity;
        return true;
    }

    async unlock() {
        if (this.adAudioActive) return;
        if (!this.init()) return;
        // Call resume inside the gesture even when an earlier autoplay request
        // is still pending. Joining that request first leaves iOS audio locked.
        if (needsResume(this.ctx)) {
            try { await this.ctx.resume(); } catch { /* Another gesture can retry. */ }
        }
        if (this.disposed || this.adAudioActive) return;
        if (this.adRecoveryPending && this.ctx.state === 'running') this.restoreAdOutput();
        if (this.desiredTrack) return this.startTrack(this.desiredTrack);
    }

    beginAdAudio() {
        if (this.disposed || this.adAudioActive) return;
        this.adAudioActive = true;
        this.adRecoveryPending = true;
        this.adAudioGeneration++;
        this.generation++;
        this.trackRequest = null;
        if (!this.ctx || this.ctx.state === 'closed') return;
        this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
        for (const source of this.sfxVoices) { try { source.stop(); } catch { /* Already ended. */ } }
        this.sfxVoices.clear();
        // Keep the music source/playhead; no old effects should play on return.
        if (this.ctx.state === 'running') void this.ctx.suspend().catch(() => {});
    }

    async recoverAfterAd({ reset = false } = {}) {
        if (this.disposed) return false;
        const token = this.adAudioGeneration;
        this.adAudioActive = false;
        if (!this.ctx || !this.init()) return false;
        const ctx = this.ctx;
        const current = () => !this.disposed && token === this.adAudioGeneration && !this.adAudioActive && this.ctx === ctx;
        try {
            // A WebKit graph can report running while its native output is
            // silent. Cycle it once after native session restoration.
            if (reset && ctx.state === 'running') await ctx.suspend();
            if (!current()) return false;
            if (needsResume(ctx)) await ctx.resume();
            if (!current() || ctx.state !== 'running') return false;
            this.restoreAdOutput();
            if (this.desiredTrack) await this.startTrack(this.desiredTrack);
            return current() && ctx.state === 'running';
        } catch { return false; }
    }

    restoreAdOutput() {
        this.applyPreferences(true);
        this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.masterGain.gain.setValueAtTime(this.masterLevel, this.ctx.currentTime);
        this.adRecoveryPending = false;
    }

    loadBuffer(track, ctx) {
        const buffers = this.buffers, loads = this.loads;
        if (buffers.has(track)) return Promise.resolve(buffers.get(track));
        if (loads.has(track)) return loads.get(track);
        const request = (async () => {
            const response = await fetch(MUSIC_TRACKS[track].url);
            // Capacitor iOS serves media using URLResponse, without an HTTP
            // status. WebKit reports status 0 / ok false even with valid bytes.
            const localIOSMedia = response.status === 0 && window.location?.protocol === 'capacitor:';
            if (!response.ok && !localIOSMedia) throw new Error(`Music recording unavailable: ${track}`);
            const data = await response.arrayBuffer();
            if (!data.byteLength) throw new Error(`Music recording unavailable: ${track}`);
            if (this.disposed || ctx.state === 'closed') return null;
            const buffer = await ctx.decodeAudioData(data);
            if (this.disposed || ctx.state === 'closed') return null;
            buffers.set(track, buffer);
            return buffer;
        })().finally(() => loads.delete(track));
        loads.set(track, request);
        return request;
    }

    preloadGameplay() {
        if (!this.init()) return Promise.resolve([]);
        return Promise.allSettled(['flight', 'boss'].map(track => this.loadBuffer(track, this.ctx)));
    }

    startTrack(track) {
        if (this.disposed || !MUSIC_TRACKS[track]?.loop) return Promise.resolve();
        if (this.adAudioActive) { this.desiredTrack = track; return Promise.resolve(); }
        if (this.desiredTrack === track && this.trackRequest?.track === track && this.ctx?.state !== 'closed') {
            return this.trackRequest.promise;
        }
        if (this.session?.track === track && !this.session.retired && this.ctx?.state !== 'closed') {
            // Cancel an obsolete download while the correct recording is still
            // playing, preserving that source and its playhead.
            if (this.desiredTrack !== track) {
                this.generation++;
                this.desiredTrack = track;
                this.trackRequest = null;
                this.musicError = null;
            }
            return needsResume(this.ctx) ? this.ctx.resume().catch(() => {}) : Promise.resolve();
        }
        const fromMenu = this.desiredTrack === 'menu' || this.session?.track === 'menu';
        const token = ++this.generation;
        this.desiredTrack = track;
        this.musicError = null;
        if (!this.init()) return Promise.resolve();
        const ctx = this.ctx;
        if (track === 'menu') {
            this.entryTransition = null;
            this.trackPositions.clear();
            void this.preloadGameplay();
        } else if (fromMenu) {
            // Stop the menu before loading flight audio. Use the audio clock,
            // not a delayed JS callback that could survive pause or navigation.
            this.entryTransition = { ctx, notBefore: ctx.currentTime + MENU_EXIT_SECONDS + FLIGHT_SILENCE_SECONDS };
            this.trackPositions.clear();
            for (const session of [...this.sessions]) this.retireSession(session, false, MENU_EXIT_SECONDS);
            this.session = null;
            this.isPlayingMusic = false;
        } else if (this.session && this.session.startedAt <= ctx.currentTime) {
            this.entryTransition = null;
        }
        const promise = this.beginTrack(track, ctx, token);
        this.trackRequest = { track, promise };
        void promise.then(() => { if (this.trackRequest?.promise === promise) this.trackRequest = null; });
        return promise;
    }

    async beginTrack(track, ctx, token) {
        try {
            if (needsResume(ctx)) await ctx.resume();
            if (!this.currentRequest(ctx, token, track)) return;
            const buffer = await this.loadBuffer(track, ctx);
            if (!buffer || !this.currentRequest(ctx, token, track)) return;
            const previous = this.session;
            if (track === 'menu' || previous?.track === 'menu') this.trackPositions.clear();
            else if (previous) {
                this.trackPositions.set(previous.track,
                    (previous.offset + Math.max(0, ctx.currentTime + .02 - previous.startedAt)) % previous.source.buffer.duration);
            }
            const entry = this.entryTransition?.ctx === ctx ? this.entryTransition : null;
            this.session = this.createSession(track, buffer, ctx, this.trackPositions.get(track) || 0,
                entry ? Math.max(ctx.currentTime, entry.notBefore) : ctx.currentTime + .02,
                entry ? FLIGHT_FADE_IN_SECONDS : MUSIC_CROSSFADE_SECONDS);
            if (previous) this.retireSession(previous, false, MUSIC_CROSSFADE_SECONDS);
            this.isPlayingMusic = true;
        } catch (error) {
            if (token === this.generation && !this.disposed) this.musicError = error.message;
        }
    }

    currentRequest(ctx, token, track = 'flight') {
        return !this.disposed && token === this.generation && this.ctx === ctx && ctx?.state === 'running' && this.desiredTrack === track;
    }

    createSession(track, buffer, ctx, offset = 0, when = ctx.currentTime + .02, fadeIn = MUSIC_CROSSFADE_SECONDS) {
        const config = MUSIC_TRACKS[track], source = ctx.createBufferSource(), bus = ctx.createGain();
        source.buffer = buffer;
        source.loop = config.loop;
        source.loopStart = 0;
        source.loopEnd = buffer.duration;
        bus.gain.setValueAtTime(0, ctx.currentTime);
        bus.gain.setValueAtTime(0, when);
        bus.gain.linearRampToValueAtTime(config.level, when + fadeIn);
        source.connect(bus); bus.connect(this.musicGain);
        const session = { ctx, track, source, bus, offset, startedAt: when, level: config.level, retired: false, ended: false, disconnected: false };
        this.sessions.add(session);
        source.onended = () => {
            if (session.ended) return;
            session.ended = true;
            this.disconnectSession(session);
            if (this.session === session) { this.session = null; this.isPlayingMusic = false; }
        };
        source.start(when, offset);
        return session;
    }

    disconnectSession(session) {
        if (session.disconnected) return;
        session.disconnected = true;
        session.source.disconnect();
        session.bus.disconnect();
        this.sessions.delete(session);
    }

    retireSession(session, immediate = false, duration = MENU_EXIT_SECONDS) {
        immediate ||= session.ctx.currentTime < session.startedAt;
        const now = session.ctx.currentTime, end = now + (immediate ? 0 : duration);
        if (session.retired && !immediate && session.stopAt <= end) return;
        session.retired = true;
        session.stopAt = end;
        if (session.ctx.state !== 'closed') {
            session.bus.gain.cancelScheduledValues(now);
            session.bus.gain.setValueAtTime(session.bus.gain.value, now);
            session.bus.gain.linearRampToValueAtTime(0, end);
            if (!session.ended) session.source.stop(end);
        }
        if (immediate || session.ended) this.disconnectSession(session);
    }

    startMusic() { return this.startTrack('flight'); }
    startMenuMusic() { return this.startTrack('menu'); }
    playNormalMusic() { return this.startTrack('flight'); }
    playMenuMusic() { return this.startTrack('menu'); }
    playBossMusic() { return this.startTrack('boss'); }

    stopMusic() {
        this.generation++;
        this.desiredTrack = null;
        this.isPlayingMusic = false;
        this.trackRequest = null;
        this.trackPositions.clear();
        this.entryTransition = null;
        for (const session of [...this.sessions]) {
            this.retireSession(session, this.adAudioActive);
        }
        this.session = null;
    }

    prepareSfx() {
        if (this.adAudioActive) return false;
        if (!this.init() || this.ctx.state === 'closed') return false;
        if (needsResume(this.ctx)) void this.ctx.resume().catch(() => {});
        return this.sfxVoices.size < 16;
    }

    registerSfx(source, nodes, stopAt, startAt = this.ctx.currentTime) {
        this.sfxVoices.add(source);
        source.onended = () => {
            source.disconnect();
            nodes.forEach(node => node.disconnect());
            this.sfxVoices.delete(source);
        };
        source.start(startAt);
        source.stop(stopAt);
    }

    playTone(freq, type, duration, startTime = 0) {
        if (!this.prepareSfx()) return;
        const now = this.ctx.currentTime + startTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 2300;
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(.14, now + .008);
        gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
        osc.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
        this.registerSfx(osc, [gain, filter], now + duration + .02, now);
    }

    playTransformationLayers(notes) {
        if (!notes.length || !this.preferences.sfx || this.preferences.sfxVolume === 0 || !this.prepareSfx()) return;
        const now = this.ctx.currentTime;
        for (const note of notes) {
            if (this.sfxVoices.size >= 16) break;
            const start = now + (note.delay || 0);
            const source = ['noise', 'mechanical'].includes(note.type) ? this.ctx.createBufferSource() : this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();
            if (note.type === 'mechanical') {
                if (!this.transformationMechanisms.has(note.mechanism)) this.transformationMechanisms.set(note.mechanism, createMechanismBuffer(this.ctx, note.mechanism));
                source.buffer = this.transformationMechanisms.get(note.mechanism);
            } else if (note.type === 'noise') {
                if (!this.transformationNoise) {
                    const buffer = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * .7), this.ctx.sampleRate);
                    const data = buffer.getChannelData(0);
                    let seed = 71;
                    for (let i = 0; i < data.length; i++) {
                        seed = (seed * 1664525 + 1013904223) >>> 0;
                        data[i] = seed / 2147483648 - 1;
                    }
                    this.transformationNoise = buffer;
                }
                source.buffer = this.transformationNoise;
            } else {
                source.type = note.type;
                source.frequency.setValueAtTime(note.from, start);
                source.frequency.exponentialRampToValueAtTime(note.to, start + note.duration);
            }
            filter.type = note.filter || 'lowpass';
            filter.Q.value = .8;
            filter.frequency.setValueAtTime(note.cutoff, start);
            if (note.cutoffEnd) filter.frequency.exponentialRampToValueAtTime(note.cutoffEnd, start + note.duration);
            const peak = start + (note.attack || .012);
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(note.level, peak);
            if (note.hold) gain.gain.linearRampToValueAtTime(note.level * .7, peak + note.hold);
            gain.gain.exponentialRampToValueAtTime(.0001, start + note.duration);
            source.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
            this.registerSfx(source, [filter, gain], start + note.duration + .02, start);
        }
    }

    playTransformationPickup(id) {
        this.playTransformationLayers(transformationSoundLayers(id, 'pickup'));
    }

    playTransformationCue(id, cue) {
        this.playTransformationLayers(transformationSoundLayers(id, cue));
    }

    playCollect() {
        if (!this.init() || this.ctx.currentTime - this.lastCollect < .075) return;
        this.lastCollect = this.ctx.currentTime;
        this.playTone(660, 'sine', .12);
        this.playTone(880, 'sine', .14, .065);
    }

    playControlPress(control) {
        const cue = {
            boost: { duration: .24, level: .09, type: 'rocket', cutoff: 700 },
            fire: { from: 1100, to: 850, duration: .035, level: .06, type: 'sine', cutoff: 2600 },
        }[control];
        if (!cue || !this.preferences.sfx || this.preferences.sfxVolume === 0 || !this.prepareSfx()) return;
        const now = this.ctx.currentTime;
        const source = cue.type === 'rocket' ? this.ctx.createBufferSource() : this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        if (cue.type === 'rocket') {
            // A soft air push with a little low engine body. The gentle
            // envelope and dark filter keep repeated presses unobtrusive.
            const buffer = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * cue.duration), this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                const time = i / this.ctx.sampleRate;
                const phase = 2 * Math.PI * (72 * time + 45 * time * time);
                data[i] = (Math.random() * 2 - 1) * .5
                    + Math.sin(phase) * .14 + Math.sin(phase * 1.7) * .04;
            }
            source.buffer = buffer;
        } else {
            source.type = cue.type;
            source.frequency.setValueAtTime(cue.from, now);
            source.frequency.exponentialRampToValueAtTime(cue.to, now + cue.duration);
        }
        filter.type = 'lowpass'; filter.frequency.value = cue.cutoff;
        if (cue.type === 'rocket') {
            filter.Q.value = .35;
            filter.frequency.setValueAtTime(400, now);
            filter.frequency.exponentialRampToValueAtTime(cue.cutoff, now + .08);
            filter.frequency.exponentialRampToValueAtTime(250, now + cue.duration);
        }
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(cue.level, now + (cue.type === 'rocket' ? .04 : .003));
        if (cue.type === 'rocket') gain.gain.linearRampToValueAtTime(cue.level * .65, now + .11);
        gain.gain.exponentialRampToValueAtTime(.0001, now + cue.duration);
        source.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
        this.registerSfx(source, [filter, gain], now + cue.duration + .01);
    }

    playScoutLock() {
        this.playTransformationLayers([
            { type: 'mechanical', mechanism: 'relay', duration: .1, level: .17, cutoff: 2400, attack: .002 },
        ]);
    }

    playBossCue(boss, cue) {
        const forge = boss === 'forge';
        const layers = cue === 'incoming'
            ? [{ from: forge ? 100 : 440, to: forge ? 220 : 880, type: forge ? 'triangle' : 'sine', duration: .7, level: .14, cutoff: 1600, attack: .08 },
                { from: forge ? 72 : 660, to: forge ? 55 : 330, type: 'sine', duration: .9, level: .1, cutoff: 1200, attack: .12 }]
            : cue === 'warning'
            ? [{ from: forge ? 180 : 760, to: forge ? 270 : 1100, type: forge ? 'triangle' : 'sine', duration: .26, level: .13, cutoff: 1700, attack: .01 }]
            : cue === 'arrival'
                ? [{ from: forge ? 160 : 540, to: forge ? 70 : 270, type: 'triangle', duration: .5, level: .16, cutoff: 1400, attack: .03 }]
                : [{ from: forge ? 240 : 1200, to: forge ? 65 : 180, type: forge ? 'triangle' : 'sawtooth', duration: .18, level: .14, cutoff: 1900, attack: .006 }];
        this.playTransformationLayers(layers);
    }

    playScoutBeam() {
        this.playTransformationLayers([
            { from: 1100, to: 100, type: 'sawtooth', duration: .14, level: .17, cutoff: 2100, attack: .002 },
            { type: 'noise', duration: .1, level: .2, cutoff: 1700, cutoffEnd: 500, attack: .003 },
        ]);
    }

    playShoot() {
        if (!this.prepareSfx()) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(620, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + .11);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(.22, now + .006);
        gain.gain.exponentialRampToValueAtTime(.0001, now + .14);
        osc.connect(gain); gain.connect(this.sfxGain);
        this.registerSfx(osc, [gain], now + .16);
    }

    playExplosion() {
        if (!this.prepareSfx()) return;
        const size = Math.ceil(this.ctx.sampleRate * .28);
        const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        const now = this.ctx.currentTime;
        noise.buffer = buffer;
        filter.type = 'lowpass'; filter.frequency.value = 900;
        gain.gain.setValueAtTime(0, now);
        // Filtered noise loses much more energy than the tonal effects. Keep
        // its short transient audible above even the loudest music passage.
        gain.gain.linearRampToValueAtTime(.6, now + .008);
        gain.gain.exponentialRampToValueAtTime(.0001, now + .28);
        noise.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
        this.registerSfx(noise, [gain, filter], now + .3);
    }

    cleanup() {
        this.stopMusic();
        this.disposed = true;
        for (const session of [...this.sessions]) this.retireSession(session, true);
        for (const source of this.sfxVoices) source.stop();
        if (this.ctx && this.ctx.state !== 'closed') void this.ctx.close().catch(() => {});
        this.buffers.clear();
        this.loads.clear();
        this.transformationNoise = null;
        this.transformationMechanisms.clear();
        this.initialized = false;
    }
}
