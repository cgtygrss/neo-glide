import { STAGES } from '../src/game/StageCatalog.js';
import { StageBackground } from '../src/game/StageBackground.js';
import { Renderer } from '../src/game/Renderer.js';
import { Collectible, Projectile, Villain } from '../src/game/Entities.js';

let actors = false;
const scenes = STAGES.map(stage => {
  const card = document.createElement('article'), canvas = document.createElement('canvas');
  canvas.width = 720; canvas.height = 330;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${stage.name} galaxy artwork`);
  const title = document.createElement('h2'); title.textContent = stage.name;
  const description = document.createElement('p'); description.textContent = stage.description;
  card.append(canvas, title, description); document.querySelector('#gallery').append(card);
  return { stage, canvas, art: new StageBackground(), renderer: new Renderer(canvas) };
});
function draw() {
  for (const { stage, canvas, art, renderer } of scenes) {
    art.draw(canvas.getContext('2d'), stage.id, 720, 330, 3, 120);
    if (!actors) continue;
    renderer.drawPlayer({ x:100, y:165, rotation:0, isBoosting:true }, 'default', false, [], false, 0, '');
    renderer.drawCollectibles([new Collectible(235, 168, 50), new Collectible(289, 168, 250), new Collectible(343, 168, 100)]);
    renderer.drawProjectiles([new Projectile(450, 120, -300, 0)]);
    renderer.drawVillain(new Villain(570, 145));
  }
}
document.querySelector('#actors').addEventListener('click', event => {
  actors = !actors; event.currentTarget.setAttribute('aria-pressed', String(actors));
  event.currentTarget.textContent = actors ? 'Hide flight actors' : 'Show flight actors'; draw();
});
draw();
