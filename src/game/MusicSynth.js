import { midiFrequency } from './MusicScore.js';
import { MUSIC_VOLUME, SFX_VOLUME } from './MusicTracks.js';

export function createAudioMix(ctx) {
  const masterGain = ctx.createGain();
  masterGain.gain.value = .65;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.knee.value = 18;
  limiter.ratio.value = 3;
  limiter.attack.value = .008;
  limiter.release.value = .18;
  masterGain.connect(limiter);
  limiter.connect(ctx.destination);
  const musicGain = ctx.createGain();
  musicGain.gain.value = MUSIC_VOLUME;
  musicGain.connect(masterGain);
  const sfxGain = ctx.createGain();
  sfxGain.gain.value = SFX_VOLUME;
  sfxGain.connect(masterGain);
  return { masterGain, musicGain, sfxGain };
}

const TIMBRES = {
  lead: { type: 'custom', harmonics: [0, 1, .16, .08, .025], level: .125, attack: .008, release: .055, cutoff: 3200, sustain: .6 },
  danger: { type: 'custom', harmonics: [0, 1, .08, .5, .04, .2], level: .15, attack: .012, release: .075, cutoff: 1350, sustain: .55 },
  bass: { type: 'sawtooth', level: .19, attack: .004, release: .045, cutoff: 620, sweep: 1850, sustain: .48 },
  chord: { type: 'custom', harmonics: [0, 1, .2, .1, .04], level: .05, attack: .006, release: .045, cutoff: 2200, sweep: 3200, sustain: .28 },
};
const DRUMS = {
  kick: { type: 'sine', level: .44, frequency: 155, target: 48, cutoff: 1600, release: .035 },
  tom: { type: 'sine', level: .23, frequency: 240, target: 100, cutoff: 2200, release: .045 },
  clap: { type: 'noise', level: .22, cutoff: 1700, filter: 'bandpass', release: .035 },
  hat: { type: 'noise', level: .08, cutoff: 7200, filter: 'highpass', release: .018 },
};
const contextAssets = new WeakMap();
function assets(ctx) {
  if (!contextAssets.has(ctx)) contextAssets.set(ctx, { waves: new Map(), noise: null });
  return contextAssets.get(ctx);
}
function noiseBuffer(ctx) {
  const cache = assets(ctx);
  if (!cache.noise) {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .5), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 17;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = seed / 2147483648 - 1;
    }
    cache.noise = buffer;
  }
  return cache.noise;
}
function setTimbre(ctx, source, instrument, timbre) {
  if (timbre.type !== 'custom') { source.type = timbre.type; return; }
  const waves = assets(ctx).waves;
  if (!waves.has(instrument)) {
    waves.set(instrument, ctx.createPeriodicWave(new Float32Array(timbre.harmonics.length), new Float32Array(timbre.harmonics)));
  }
  source.setPeriodicWave(waves.get(instrument));
}

// Live play and the listening preview share the exact voices and mix. Voices
// use one source each, cached waveforms/noise, and bounded, short releases.
export function scheduleMusicEvent(ctx, output, event, when, secondsPerBeat, onEnded = () => {}) {
  const drum = DRUMS[event.instrument];
  const timbre = drum || TIMBRES[event.instrument] || TIMBRES.lead;
  const duration = Math.max(.035, event.duration * secondsPerBeat);
  const source = drum?.type === 'noise' ? ctx.createBufferSource() : ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = drum?.filter || 'lowpass';
  filter.Q.value = drum ? .65 : .5;
  filter.frequency.setValueAtTime(timbre.sweep || timbre.cutoff, when);
  if (timbre.sweep) filter.frequency.exponentialRampToValueAtTime(timbre.cutoff, when + duration);
  const level = timbre.level * event.velocity;
  if (drum?.type === 'noise') source.buffer = noiseBuffer(ctx);
  else if (drum) {
    source.type = drum.type;
    source.frequency.setValueAtTime(drum.frequency, when);
    source.frequency.exponentialRampToValueAtTime(drum.target, when + Math.min(duration, .075));
  } else {
    setTimbre(ctx, source, event.instrument, timbre);
    source.frequency.setValueAtTime(midiFrequency(event.midi), when);
  }

  const peak = when + Math.min(drum ? .002 : timbre.attack, duration * .3);
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(level, peak);
  if (event.instrument === 'clap') {
    // Three close transients give a handclap its snap instead of a dull hiss.
    for (const [offset, amount] of [[.009, .22], [.014, .9], [.022, .25], [.028, .75]]) {
      gain.gain.linearRampToValueAtTime(level * amount, when + Math.min(offset, duration * .8));
    }
  }
  gain.gain.exponentialRampToValueAtTime(Math.max(.0001, level * (drum ? .06 : timbre.sustain)), when + duration);
  gain.gain.exponentialRampToValueAtTime(.0001, when + duration + timbre.release);
  source.connect(filter); filter.connect(gain); gain.connect(output);
  let ended = false;
  const voice = {
    source,
    stop(at = ctx.currentTime) { if (!ended) source.stop(Math.max(ctx.currentTime, at)); },
    disconnect() { source.disconnect(); filter.disconnect(); gain.disconnect(); },
  };
  source.onended = () => {
    if (ended) return;
    ended = true;
    voice.disconnect();
    onEnded(voice);
  };
  source.start(when);
  source.stop(when + duration + timbre.release + .02);
  return voice;
}
