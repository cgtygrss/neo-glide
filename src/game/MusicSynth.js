import { midiFrequency } from './MusicScore.js';

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
  musicGain.gain.value = .65;
  musicGain.connect(masterGain);
  const sfxGain = ctx.createGain();
  sfxGain.gain.value = .55;
  sfxGain.connect(masterGain);
  return { masterGain, musicGain, sfxGain };
}

const TIMBRES = {
  lead: { type: 'triangle', level: .18, attack: .009, release: .085, cutoff: 2300 },
  pad: { type: 'sine', level: .045, attack: .18, release: .2, cutoff: 1100 },
  bass: { type: 'triangle', level: .18, attack: .01, release: .06, cutoff: 850 },
  pluck: { type: 'triangle', level: .085, attack: .006, release: .07, cutoff: 1900 },
  bell: { type: 'sine', level: .09, attack: .012, release: .28, cutoff: 2200 },
};
const noiseBuffers = new WeakMap();
function noiseBuffer(ctx) {
  if (!noiseBuffers.has(ctx)) {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .3), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Deterministic soft percussion makes preview and runtime use the same sound.
    let seed = 17;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = seed / 2147483648 - 1;
    }
    noiseBuffers.set(ctx, buffer);
  }
  return noiseBuffers.get(ctx);
}

// Shared by live scheduling and the offline listening preview.
export function scheduleMusicEvent(ctx, output, event, when, secondsPerBeat, onEnded = () => {}) {
  const percussion = ['kick', 'tap', 'tick', 'tom'].includes(event.instrument);
  const timbre = TIMBRES[event.instrument] || TIMBRES.lead;
  const duration = Math.max(.04, event.duration * secondsPerBeat);
  const release = percussion ? .04 : timbre.release;
  const source = event.instrument === 'tap' || event.instrument === 'tick' ? ctx.createBufferSource() : ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = event.instrument === 'tap' || event.instrument === 'tick' ? 'bandpass' : 'lowpass';
  filter.Q.value = percussion ? .7 : .4;
  filter.frequency.value = percussion ? (event.instrument === 'tick' ? 3200 : event.instrument === 'tap' ? 1500 : 900) : timbre.cutoff;
  let level = timbre.level * event.velocity;
  if (event.instrument === 'tap' || event.instrument === 'tick') {
    source.buffer = noiseBuffer(ctx);
    level = (event.instrument === 'tick' ? .07 : .15) * event.velocity;
  } else if (event.instrument === 'kick' || event.instrument === 'tom') {
    source.type = 'sine';
    source.frequency.setValueAtTime(event.instrument === 'tom' ? 180 : 125, when);
    source.frequency.exponentialRampToValueAtTime(event.instrument === 'tom' ? 75 : 45, when + duration);
    level = (event.instrument === 'tom' ? .18 : .28) * event.velocity;
  } else {
    source.type = timbre.type;
    source.frequency.setValueAtTime(midiFrequency(event.midi), when);
  }
  const attack = percussion ? .008 : timbre.attack;
  const peak = when + Math.min(attack, duration * .3);
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(level, peak);
  gain.gain.exponentialRampToValueAtTime(Math.max(.0001, level * (event.instrument === 'pad' ? .75 : .35)), when + duration);
  gain.gain.exponentialRampToValueAtTime(.0001, when + duration + release);
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
  source.stop(when + duration + release + .02);
  return voice;
}
