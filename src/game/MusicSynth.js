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
