import { Villain, SpeedsterVillain, JuggernautVillain } from '../src/game/Entities.js';
import { Renderer } from '../src/game/Renderer.js';

const canvas = document.querySelector('canvas'), renderer = new Renderer(canvas), ctx = renderer.ctx;
const ships = [new Villain(0,0), new SpeedsterVillain(0,0), new JuggernautVillain(0,0)];
const names = ['SCOUT / PRECISION HUNTER','SPEEDSTER / INTERCEPTOR','JUGGERNAUT / ARMORED GUNSHIP'];
const roles = ['Long-range optical emitter','Swept wings / twin high-output engines','Segmented armor / heavy cannon'];
const state = document.querySelector('select'), lowPower = document.querySelector('#low-power');
let frame, last = performance.now();
function draw(now) {
  const dt = Math.min(.05, Math.max(0,(now-last)/1000)); last = now;
  ctx.fillStyle = '#101e2d'; ctx.fillRect(0,0,1000,520);
  for (let i=0;i<3;i++) {
    const x = 166+i*334;
    ctx.fillStyle = i%2 ? '#152535' : '#132232'; ctx.fillRect(i*334+1,1,332,518);
    ctx.strokeStyle = '#25394b'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(i*334+20,330); ctx.lineTo(i*334+314,330); ctx.stroke();
    ctx.textAlign = 'center'; ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#d1b598';
    ctx.fillText(names[i],x,40);
    ctx.font = '11px sans-serif'; ctx.fillStyle = '#94aabb'; ctx.fillText(roles[i],x,62);
    const ship = ships[i];
    ship.oscillation += dt*2;
    ship.attackWarning = state.value === 'charge' ? .75 : 0;
    ship.hitFlashTimer = state.value === 'hit' ? .1 : 0;
    ship.dashState = state.value === 'dash' && i===1 ? 'DASHING' : 'IDLE';
    renderer.lowPowerMode = lowPower.checked;
    for (const [scale,y] of [[2.3,205],[1,418]]) {
      ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale);
      renderer.drawVillain(ship); ctx.restore();
    }
    ctx.font = '10px sans-serif'; ctx.fillStyle = '#8ca2b4';
    ctx.fillText(`${ship.width} × ${ship.height} px hull`,x,486);
  }
  document.querySelector('output').textContent = `${state.selectedOptions[0].textContent}${lowPower.checked?' · Low power':''} · 3 distinct hulls · Gameplay dimensions preserved`;
  frame = requestAnimationFrame(draw);
}
frame = requestAnimationFrame(draw);
window.addEventListener('pagehide',()=>cancelAnimationFrame(frame),{once:true});
