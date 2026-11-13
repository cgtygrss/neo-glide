import { STAGES } from '../src/game/StageCatalog.js';
import { StageBackground } from '../src/game/StageBackground.js';
import { resizeCanvas } from '../src/game/CanvasResolution.js';
import { Renderer } from '../src/game/Renderer.js';
import { Collectible, Projectile, Villain } from '../src/game/Entities.js';
import { REGION_DISTANCE } from '../src/game/StageJourney.js';

const selector = document.querySelector('#stage'), canvas = document.querySelector('#flight');
const ctx = canvas.getContext('2d'), art = new StageBackground(), renderer = new Renderer(canvas);
let distance = 0, playing = false, previous = null;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
for (const stage of STAGES) selector.add(new Option(stage.name, stage.id));
selector.value = 'andromeda';
const cards = Array.from({ length: 4 }, (_, region) => {
  const article = document.createElement('article'), c = document.createElement('canvas'), text = document.createElement('p');
  c.width = 420; c.height = 220; c.setAttribute('role', 'img'); c.setAttribute('aria-label', `Region ${region + 1}`);
  text.textContent = `Region ${region + 1} · ${region * REGION_DISTANCE} m`;
  article.append(c, text); document.querySelector('#regions').append(article);
  return { canvas:c, art:new StageBackground() };
});
function render() {
  art.draw(ctx, selector.value, 844, 390, distance / 45, distance);
  renderer.drawPlayer({ x:100, y:165, rotation:0, isBoosting:true }, 'default', false, [], false, 0, '');
  renderer.drawCollectibles([new Collectible(235,168,50), new Collectible(289,168,250), new Collectible(343,168,100)]);
  renderer.drawProjectiles([new Projectile(450,120,-300,0)]); renderer.drawVillain(new Villain(570,145));
  document.querySelector('#metres').textContent = `${Math.floor(distance)} m`;
  document.querySelector('#distance').value = distance;
}
function route() {
  for (const [region, card] of cards.entries()) {
    card.art.draw(card.canvas.getContext('2d'), selector.value, 420, 220, 0, region * REGION_DISTANCE, true);
    card.canvas.setAttribute('aria-label', `${selector.selectedOptions[0].text} region ${region + 1}`);
  }
}
function resize() { resizeCanvas(canvas,ctx,844,390); render(); }
selector.addEventListener('change', () => { distance=0; art.reset(); route(); render(); });
document.querySelector('#distance').addEventListener('input', event => { distance=Number(event.target.value); render(); });
document.querySelector('#play').addEventListener('click', event => {
  playing=!playing; previous=null; event.currentTarget.setAttribute('aria-pressed', String(playing));
  event.currentTarget.textContent=playing ? 'Pause journey' : 'Play journey';
});
function tick(now) {
  if (playing && !document.hidden && !reducedMotion) {
    distance=(distance + (previous === null ? 0 : Math.min(.05,(now-previous)/1000)) * 90) % (REGION_DISTANCE * 4); render();
  }
  previous = document.hidden ? null : now; requestAnimationFrame(tick);
}
window.addEventListener('resize',resize); resize(); route(); requestAnimationFrame(tick);
