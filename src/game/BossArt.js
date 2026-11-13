// Cached game-native vector artwork; this module never changes encounter state.
import { bossArrivalView } from './BossEncounters.js';
const INK = '#071422';
const geometry = new Map();
const path = data => { if (!geometry.has(data)) geometry.set(data, new Path2D(data)); return geometry.get(data); };
function shape(ctx, data, color, edge = '#456178', width = 2) {
  const p = path(data); ctx.fillStyle = color; ctx.fill(p);
  ctx.strokeStyle = INK; ctx.lineWidth = width + 3; ctx.stroke(p);
  ctx.strokeStyle = edge; ctx.lineWidth = width; ctx.stroke(p);
}
export function drawBossArt(ctx, enemy, { reducedMotion = false } = {}) {
  ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const lit = enemy.hitFlashTimer > 0 ? '#fff6db' : enemy.color || '#ffc181';
  if (enemy.isBossDrone) {
    shape(ctx,'M-15 0 -7-10 12-7 15 0 12 7 -7 10 -9 3Z','#a68862','#ffcc91',1);
    shape(ctx,'M-5-4 9-2 9 2 -5 4Z','#fff0c5','#fff0c5',1);
  } else if (enemy.id === 'forge') {
    shape(ctx,'M-76-31 -43-48 43-40 73-20 78 20 40 41 -44 48 -76 31 -60 16 -60-16Z','#304c60',lit);
    shape(ctx,'M-62-30 -32-44 43-35 60-22 29-22 -35-16Z','#c19167','#f7d1a0');
    shape(ctx,'M-62 30 -32 44 43 35 60 22 29 22 -35 16Z','#c19167','#f7d1a0');
    shape(ctx,'M-78-12 -42-24 57-17 76 0 57 17 -42 24 -78 12 -64 0Z','#7894a1',lit);
    shape(ctx,'M-56-7 -22-14 29-10 44 0 29 10 -22 14 -56 7Z','#152838','#d0d9ce');
    shape(ctx,'M-17-7 23-5 30 0 23 5 -17 7Z',lit,lit,1);
    for (const y of [-29, 29]) for (const x of [-48, 32]) {
      ctx.fillStyle = '#091624'; ctx.fillRect(x - 8, y - 7, 16, 14);
      ctx.fillStyle = enemy.stage === 2 ? '#ff7b7b' : '#ffcc91'; ctx.fillRect(x - 5, y - 4, 10, 8);
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    for (const x of [-20, -7, 6]) { ctx.beginPath(); ctx.moveTo(x,-38); ctx.lineTo(x-7,-24); ctx.moveTo(x,38); ctx.lineTo(x-7,24); ctx.stroke(); }
  } else {
    ctx.rotate(reducedMotion ? 0 : Math.sin((enemy.attackCount || 0) * .7) * .06);
    shape(ctx,'M0-62 18-31 0-20 -18-31Z','#6f6493',lit);
    shape(ctx,'M0 62 18 31 0 20 -18 31Z','#6f6493',lit);
    shape(ctx,'M-62 0 -31-18 -20 0 -31 18Z','#6f6493',lit);
    shape(ctx,'M62 0 31-18 20 0 31 18Z','#6f6493',lit);
    shape(ctx,'M-43-40 -9-28 27-32 45-11 34 27 10 43 -27 30 -44 9Z','#2d3558','#b5a8e2');
    shape(ctx,'M0-34 34 0 0 34 -34 0Z','#9585b6',lit);
    shape(ctx,'M0-22 22 0 0 22 -22 0Z','#152439','#e2dcff');
    shape(ctx,'M0-13 13 0 0 13 -13 0Z',lit,'#fff3ff',1);
    ctx.strokeStyle = enemy.stage === 2 ? '#ff94cb' : '#cadbff'; ctx.lineWidth = 2;
    for (const sign of [-1,1]) { ctx.beginPath(); ctx.moveTo(sign*46,-21);ctx.lineTo(sign*54,0);ctx.lineTo(sign*46,21);ctx.stroke(); }
  }
  ctx.restore();
}
export function drawBossWarnings(ctx, game) {
  const boss = game.encounter?.boss, warning = boss?.warning;
  if (!warning || boss.markedForDeletion) return;
  const x = boss.x - boss.width / 2, y = boss.y;
  const endY = y + (warning.targetY - y) * x / (x - warning.targetX);
  ctx.save(); ctx.globalCompositeOperation = 'source-over';ctx.shadowBlur=0;ctx.globalAlpha=1;
  ctx.setLineDash([8,7]);ctx.lineWidth=2;ctx.strokeStyle='#ffd595';
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(0,endY);ctx.stroke();ctx.setLineDash([]);
  ctx.strokeStyle=INK;ctx.lineWidth=6;
  ctx.beginPath();ctx.arc(warning.targetX,warning.targetY,16,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle='#ffd595';ctx.lineWidth=2;ctx.stroke();
  if(warning.kind!=='laser') {
    ctx.strokeStyle='#99e6d0';ctx.lineWidth=2;ctx.setLineDash([3,7]);
    for(const yy of [warning.safeY-warning.safeHalf,warning.safeY+warning.safeHalf]) {
      ctx.beginPath();ctx.moveTo(35,yy);ctx.lineTo(warning.targetX+70,yy);ctx.stroke();
    }
  }
  ctx.restore();
}

// Only the right-hand arrival lane is decorated. The player, friendly shots
// and eventual hostile fire are painted above this presentation by Renderer.
export function drawBossArrival(ctx, game, { reducedMotion = false, lowPower = false } = {}) {
  const arrival = bossArrivalView(game);
  if (!arrival) return;
  const { width, height } = game.viewport;
  const progress = arrival.approach, eased = 1 - (1 - progress) ** 3;
  const x = width * .8, y = height * .48;
  ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // A quiet beacon remains visible throughout the advance warning, without
  // flicker, full-screen flashes or a camera shake.
  ctx.strokeStyle = arrival.color; ctx.lineWidth = 2; ctx.globalAlpha = .5;
  for (const sign of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(width - 13, y + sign * 76);
    ctx.lineTo(width - 13, y + sign * 94); ctx.lineTo(width - 34, y + sign * 94); ctx.stroke();
  }
  if (progress > 0) {
    if (arrival.id === 'forge') {
      const shipX = reducedMotion ? x : x + (width * .2 + arrival.width) * (1 - eased);
      const shipY = reducedMotion ? y : y - height * .12 * (1 - eased);
      ctx.translate(shipX, shipY);
      if (!reducedMotion) ctx.rotate(-.12 * (1 - eased));
      if (!reducedMotion) for (const sign of [-1, 1]) {
        ctx.globalAlpha = .7 * (1 - progress);
        ctx.fillStyle = '#ffd69c'; ctx.beginPath();
        ctx.moveTo(63, sign * 29 - 6); ctx.lineTo(138 + (lowPower ? 0 : 22 * (1 - eased)), sign * 29);
        ctx.lineTo(63, sign * 29 + 6); ctx.closePath(); ctx.fill();
      }
      drawBossArt(ctx, { ...arrival, stage: 1 }, { reducedMotion });
    } else {
      ctx.translate(x, y);
      ctx.globalAlpha = reducedMotion ? .3 : .8 * (1 - progress);
      ctx.strokeStyle = arrival.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, 0, reducedMotion ? 78 : 32 + eased * 56, 83, 0, 0, Math.PI * 2); ctx.stroke();
      if (!reducedMotion && !lowPower) {
        ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, 0, 37 + eased * 61, 93, 0, 0, Math.PI * 2); ctx.stroke();
      }
      // Reveal the Sentinel through the gate; its collision target is created
      // only after the animation finishes, at this exact final position.
      if (!reducedMotion) {
        ctx.beginPath(); ctx.rect(-90, -80 * eased, 180, 160 * eased); ctx.clip();
        ctx.rotate((1 - eased) * Math.PI * .35);
      }
      drawBossArt(ctx, { ...arrival, stage: 1, attackCount: 0 }, { reducedMotion });
    }
  }
  ctx.restore();
}
