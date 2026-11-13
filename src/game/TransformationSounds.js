const profiles = {
  striker: { mechanism: 'turbine', duration: .44, cutoff: 1500 },
  drill: { mechanism: 'ratchet', duration: .55, cutoff: 2100 },
  sphere: { mechanism: 'servo', duration: .48, cutoff: 1700 },
  volt: { mechanism: 'relay', duration: .31, cutoff: 2900 },
  aegis: { mechanism: 'hydraulic', duration: .52, cutoff: 1100 },
};

// Mechanical textures, contact transients and short low impacts. No sustained
// musical notes/chords: each vehicle gets a different actuator mechanism.
export function transformationSoundLayers(id, cue = 'pickup') {
  const profile = Object.hasOwn(profiles, id) ? profiles[id] : null;
  if (!profile) return [];
  const motor = { type: 'mechanical', mechanism: profile.mechanism, cutoff: profile.cutoff };
  const clamp = { type: 'mechanical', mechanism: 'clamp', filter: 'bandpass', cutoff: 2400 };
  if (cue === 'pickup') return [
    { from: 130, to: 55, type: 'triangle', duration: .16, level: .3, cutoff: 900, attack: .003 },
    { ...motor, duration: profile.duration, level: .34, attack: .012, hold: .1 },
    { type: 'noise', duration: .16, delay: .02, level: .22, cutoff: 1600, cutoffEnd: 550, filter: 'bandpass', attack: .004 },
    { ...clamp, duration: .10, delay: .12, level: .3, attack: .002 },
  ];
  if (cue === 'fold') return [
    { ...motor, duration: .23, level: .3, attack: .006, hold: .04 },
    { type: 'noise', duration: .12, level: .22, cutoff: 900, cutoffEnd: 400, filter: 'bandpass', attack: .003 },
  ];
  if (cue === 'lock') return [
    { ...clamp, duration: .12, level: .44, attack: .001 },
    { ...clamp, cutoff: 1500, duration: .08, delay: .035, level: .24, attack: .001 },
    { from: 140, to: 65, type: 'triangle', duration: .07, level: .22, cutoff: 900, attack: .002 },
  ];
  if (cue === 'activate') return [
    { ...clamp, duration: .19, level: .45, cutoff: 1900, attack: .002 },
    { ...motor, duration: .42, delay: .025, level: .32, attack: .009, hold: .06 },
    { type: 'noise', duration: .18, level: .24, cutoff: 1800, cutoffEnd: 500, attack: .003 },
    { from: 150, to: 60, type: 'triangle', duration: .18, level: .32, cutoff: 900, attack: .003 },
    { ...clamp, duration: .09, delay: .12, level: .18, cutoff: 3000, attack: .001 },
  ];
  return [];
}

// Cached PCM excitation gives the mechanisms a physical, irregular texture.
// Inharmonic contact modes make metal clicks; pulse trains make gears/relays.
export function createMechanismBuffer(ctx, mechanism) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .7), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 89;
  for (let i = 0; i < data.length; i++) {
    const t = i / ctx.sampleRate;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    const rate = mechanism === 'relay' ? 28 : mechanism === 'ratchet' ? 18 : 42;
    const turns = rate * t + (mechanism === 'ratchet' ? 28 : 12) * t * t;
    const age = (turns % 1) / (rate + (mechanism === 'ratchet' ? 56 : 24) * t);
    const contact = Math.exp(-age * 260) * (noise * .7 + Math.sin(2 * Math.PI * 1171 * age) * .4);
    let sample;
    if (mechanism === 'clamp') {
      sample = noise * .65 * Math.exp(-t * 85) + Math.exp(-t * 32) * (
        Math.sin(2 * Math.PI * 730 * t) * .4 + Math.sin(2 * Math.PI * 1171 * t) * .3 + Math.sin(2 * Math.PI * 2039 * t) * .2);
    } else if (mechanism === 'hydraulic') {
      sample = noise * .52 + Math.sin(2 * Math.PI * (48 * t + 12 * t * t)) * .18 + contact * .12;
    } else if (mechanism === 'relay') {
      sample = contact * .9 + noise * .08;
    } else {
      const motor = 2 * Math.PI * ((mechanism === 'turbine' ? 72 : 55) * t + 95 * t * t);
      sample = Math.sin(motor) * .24 + Math.sin(motor * 2.37) * .12
        + contact * (mechanism === 'ratchet' ? .7 : .32) + noise * .12;
    }
    data[i] = Math.max(-1, Math.min(1, sample));
  }
  return buffer;
}
