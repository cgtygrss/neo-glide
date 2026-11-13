import { SoundManager } from '../src/game/SoundManager.js';
import { TRANSFORMATIONS, transformationEntryCues } from '../src/game/TransformationCatalog.js';

const sound = new SoundManager();
sound.setPreferences({ music: true, sfx: true });
const status = document.querySelector('#status');
const names = { menu: 'Menu', flight: 'Flight', boss: 'Villain encounter' };
let previewFrame = 0;
for (const model of TRANSFORMATIONS) {
  const button = document.createElement('button');
  button.textContent = `Play full ${model.name} transformation`;
  button.addEventListener('click', async () => {
    try {
      await sound.unlock();
      cancelAnimationFrame(previewFrame);
      sound.playTransformationPickup(model.id);
      const cues = transformationEntryCues({ reducedMotion: false });
      const started = performance.now();
      let next = 0;
      status.textContent = `${model.name}: pickup → assembly locks → activation`;
      const advance = now => {
        const seconds = (now - started) / 1000;
        while (next < cues.length && seconds >= cues[next][0]) sound.playTransformationCue(model.id, cues[next++][1]);
        if (seconds < 1.8) previewFrame = requestAnimationFrame(advance);
        else status.textContent = `${model.name} full transformation played.`;
      };
      previewFrame = requestAnimationFrame(advance);
    } catch { status.textContent = 'Audio unavailable. Click again to retry.'; }
  });
  document.querySelector('#capsule-effects').append(button);
}
document.querySelector('#stop').addEventListener('click', () => {
  cancelAnimationFrame(previewFrame);
  sound.stopMusic();
  status.textContent = 'Music stopped.';
});
document.querySelector('#effects').addEventListener('click', () => {
  sound.playCollect();
  sound.playShoot();
  status.textContent = 'Collection and weapon effects over the quiet soundtrack.';
});
for (const button of document.querySelectorAll('[data-play]')) {
  button.addEventListener('click', async () => {
    button.disabled = true;
    const track = button.dataset.play;
    status.textContent = 'Loading recording…';
    try {
      await sound.startTrack(track);
      if (sound.musicError) throw new Error(sound.musicError);
      if (!sound.session) throw new Error('Click Play again to enable audio.');
      status.textContent = `${names[track]} music · ${sound.session.source.buffer.duration.toFixed(2)} second loop · music ${Math.round(sound.preferences.musicVolume * 100)}%, effects ${Math.round(sound.preferences.sfxVolume * 100)}%.`;
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });
}
window.addEventListener('pagehide', () => { cancelAnimationFrame(previewFrame); sound.cleanup(); }, { once: true });
