import { createMusicScore, BOSS_ENTRANCE } from './MusicScore.js';
import { createAudioMix, scheduleMusicEvent } from './MusicSynth.js';
import { normalizeSoundPreferences } from './SoundPreferences.js';

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
        this.session = null;
        this.sessions = new Set();
        this.sfxVoices = new Set();
        this.generation = 0;
        this.musicTimer = null;
        this.lastCollect = -Infinity;
        this.preferences = normalizeSoundPreferences();
    }

    setPreferences(preferences) {
        this.preferences = normalizeSoundPreferences(preferences);
        this.applyPreferences();
    }

    applyPreferences(immediate = false) {
        if (!this.ctx || this.ctx.state === 'closed' || this.disposed) return;
        const now = this.ctx.currentTime;
        for (const [bus, value] of [[this.musicGain, this.preferences.music ? .65 : 0], [this.sfxGain, this.preferences.sfx ? .55 : 0]]) {
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
            this.stopScheduler();
            for (const session of [...this.sessions]) this.disconnectSession(session);
            this.session = null;
            this.sfxVoices.clear();
        }
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return false;
        this.ctx = new AudioContext();
        Object.assign(this, createAudioMix(this.ctx));
        this.applyPreferences(true);
        this.initialized = true;
        this.lastCollect = -Infinity;
        return true;
    }

    async unlock() {
        if (!this.init()) return;
        // Track selection owns resume/generation guards; a gesture reconciles its latest intent.
        if (this.desiredTrack) return this.startTrack(this.desiredTrack);
        if (needsResume(this.ctx)) {
            try { await this.ctx.resume(); } catch { /* Another gesture can retry. */ }
        }
    }

    async startTrack(track, { entrance = false } = {}) {
        if (this.disposed) return;
        if (this.desiredTrack === track && this.session && this.ctx?.state !== 'closed') {
            if (needsResume(this.ctx)) {
                try { await this.ctx.resume(); } catch { /* Leave the requested track available for unlock. */ }
            }
            return;
        }
        const token = ++this.generation;
        this.desiredTrack = track;
        this.isPlayingMusic = true;
        this.stopScheduler();
        if (this.session) this.retireSession(this.session);
        this.session = null;
        if (!this.init()) return;
        const ctx = this.ctx;
        if (needsResume(ctx)) {
            try { await ctx.resume(); } catch { return; }
        }
        if (this.disposed || token !== this.generation || this.desiredTrack !== track || this.ctx !== ctx || ctx.state !== 'running') return;
        const score = createMusicScore(track);
        const bus = ctx.createGain();
        bus.gain.setValueAtTime(0, ctx.currentTime);
        bus.gain.linearRampToValueAtTime(track === 'menu' ? .8 : 1, ctx.currentTime + .22);
        bus.connect(this.musicGain);
        const session = { ctx, score, bus, voices: new Set(), origin: ctx.currentTime + .04, index: 0, cycle: 0, retired: false };
        this.session = session;
        this.sessions.add(session);
        if (track === 'boss' && entrance) {
            for (const event of BOSS_ENTRANCE) this.scheduleSessionEvent(session, event, session.origin + event.beat * 60 / score.bpm);
        }
        this.scheduleAhead(session);
        this.musicTimer = setInterval(() => this.scheduleAhead(session), 25);
    }

    scheduleAhead(session) {
        if (this.disposed || session !== this.session || session.retired || session.ctx.state !== 'running') return;
        const { ctx, score } = session;
        const beatSeconds = 60 / score.bpm;
        const beatNow = (ctx.currentTime - session.origin) / beatSeconds;
        const { events, beats } = score;
        const absoluteBeat = () => session.cycle * beats + events[session.index].beat;
        // Reposition after a stalled/background timer: never play a backlog of missed notes.
        if (absoluteBeat() < beatNow - .12 / beatSeconds) {
            session.cycle = Math.max(0, Math.floor(beatNow / beats));
            const localBeat = beatNow - session.cycle * beats;
            session.index = events.findIndex(event => event.beat >= localBeat);
            if (session.index < 0) { session.index = 0; session.cycle++; }
        }
        const horizon = ctx.currentTime + .12;
        while (session.origin + absoluteBeat() * beatSeconds < horizon) {
            const event = events[session.index];
            const when = Math.max(ctx.currentTime, session.origin + absoluteBeat() * beatSeconds);
            this.scheduleSessionEvent(session, event, when);
            session.index++;
            if (session.index === events.length) { session.index = 0; session.cycle++; }
        }
    }

    scheduleSessionEvent(session, event, when) {
        const voice = scheduleMusicEvent(session.ctx, session.bus, event, when, 60 / session.score.bpm, ended => {
            session.voices.delete(ended);
            if (session.retired && session.voices.size === 0) this.disconnectSession(session);
        });
        session.voices.add(voice);
    }

    stopScheduler() {
        if (this.musicTimer !== null) clearInterval(this.musicTimer);
        this.musicTimer = null;
    }

    disconnectSession(session) {
        session.bus.disconnect();
        this.sessions.delete(session);
    }

    retireSession(session, immediate = false) {
        if (session.retired && !immediate) return;
        session.retired = true;
        const now = session.ctx.currentTime;
        const end = now + (immediate ? 0 : .2);
        session.bus.gain.cancelScheduledValues(now);
        session.bus.gain.setValueAtTime(session.bus.gain.value, now);
        session.bus.gain.linearRampToValueAtTime(0, end);
        for (const voice of session.voices) voice.stop(end);
        if (immediate || session.voices.size === 0) this.disconnectSession(session);
    }

    startMusic() { return this.startTrack('flight'); }
    startMenuMusic() { return this.startTrack('menu'); }
    playNormalMusic() { return this.startTrack('flight'); }
    playMenuMusic() { return this.startTrack('menu'); }
    playBossMusic(options) { return this.startTrack('boss', options); }

    stopMusic() {
        this.generation++;
        this.desiredTrack = null;
        this.isPlayingMusic = false;
        this.stopScheduler();
        if (this.session) this.retireSession(this.session);
        this.session = null;
    }

    prepareSfx() {
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

    // Short cues follow simulation milestones; no delayed animation timers survive a pause/reset.
    playTransformationCue(id, cue) {
        if (!this.preferences.sfx) return;
        const pitch = { striker: 196, volt: 330, drill: 147, sphere: 262, aegis: 220 }[id] || 220;
        if (cue === 'fold') this.playTone(pitch, 'sine', .10);
        if (cue === 'lock') this.playTone(pitch * 1.5, 'triangle', .055);
        if (cue === 'activate') {
            this.playTone(pitch * 2, 'triangle', .12);
            this.playTone(pitch * 3, 'sine', .14);
        }
    }

    playCollect() {
        if (!this.init() || this.ctx.currentTime - this.lastCollect < .075) return;
        this.lastCollect = this.ctx.currentTime;
        this.playTone(660, 'sine', .12);
        this.playTone(880, 'sine', .14, .065);
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
        gain.gain.linearRampToValueAtTime(.16, now + .006);
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
        gain.gain.linearRampToValueAtTime(.25, now + .008);
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
        this.initialized = false;
    }
}
