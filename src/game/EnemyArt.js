// Top-down spacecraft: bevelled plates, recessed mechanics and lit canopies.
// Canonical hull sizes match the existing enemies; decoration never sets stats.
const models = {
  SCOUT: { width: 80, height: 60, accent: '#ee8c82', engine: '#ed9b78', core: '#fff2d5',
    plates: ['#a67b7c', '#63414b', '#282936'],
    parts: [
      ['dark', 'M -20 -8 L -5 -28 L 25 -25 L 32 -17 L 18 -10 L 19 10 L 32 17 L 25 25 L -5 28 L -20 8 Z'],
      ['armor', 'M -18 -10 L -4 -26 L 24 -23 L 26 -18 L 5 -10 Z'],
      ['shade', 'M -18 10 L -4 26 L 24 23 L 26 18 L 5 10 Z'],
      ['plate', 'M -8 -20 L 2 -24 L 21 -22 L 15 -18 L 0 -16 Z'],
      ['plate', 'M -8 20 L 2 24 L 21 22 L 15 18 L 0 16 Z'],
      ['dark', 'M 13 -22 L 31 -21 L 35 -17 L 35 -11 L 13 -10 Z M 13 22 L 31 21 L 35 17 L 35 11 L 13 10 Z'],
      ['steel', 'M 16 -20 L 31 -19 L 32 -14 L 16 -13 Z M 16 20 L 31 19 L 32 14 L 16 13 Z'],
      ['armor', 'M -34 -7 L -15 -15 L 20 -12 L 29 -5 L 29 5 L 20 12 L -15 15 L -34 7 Z'],
      ['shade', 'M -33 3 L -12 7 L 24 5 L 20 12 L -15 15 L -34 7 Z'],
      ['plate', 'M -26 -6 L -13 -12 L 17 -10 L 22 -5 L -8 -4 Z'],
      ['dark', 'M -39 -4 L -20 -5 L -17 5 L -39 4 Z'],
      ['steel', 'M -39 -2.5 L -20 -3 L -20 1 L -39 2.5 Z'],
      ['glass', 'M -13 -5 L -3 -10 L 10 -7 L 13 -1 L 5 5 L -10 4 Z'],
      ['highlight', 'M -11 -5 L -3 -8 L 8 -6 L -2 -5 Z'],
    ], engines: [[34, -16, 4], [34, 16, 4]],
    seams: ['M -17 -13 L -4 -19 L 14 -16 M -17 13 L -4 19 L 14 16', 'M 18 -8 L 18 8 M -24 -5 L -24 4 M -29 -4 L -29 4'],
    vents: [[19,-6],[23,-4],[19,5],[23,3]], rivets: [[-7,-23],[19,-21],[-7,23],[19,21]],
  },
  SPEEDSTER: { width: 60, height: 40, accent: '#c7b9fa', engine: '#ab9ff1', core: '#eff5ff',
    plates: ['#8b8eaa', '#48445f', '#202734'],
    parts: [
      ['dark', 'M -22 -3 L 15 -19 L 27 -18 L 17 -6 L 23 0 L 17 6 L 27 18 L 15 19 L -22 3 Z'],
      ['plate', 'M -18 -4 L 15 -18 L 23 -17 L 9 -7 L -5 -3 Z'],
      ['shade', 'M -18 4 L 15 18 L 23 17 L 9 7 L -5 3 Z'],
      ['steel', 'M 8 -11 L 20 -15 L 16 -9 L 8 -7 Z M 8 11 L 20 15 L 16 9 L 8 7 Z'],
      ['dark', 'M 10 -9 L 26 -8 L 29 -5 L 26 -3 L 10 -3 Z M 10 9 L 26 8 L 29 5 L 26 3 L 10 3 Z'],
      ['armor', 'M -30 0 L -12 -7 L 11 -6 L 22 0 L 11 6 L -12 7 Z'],
      ['shade', 'M -30 0 L -8 1 L 21 0 L 11 6 L -12 7 Z'],
      ['plate', 'M -24 -1 L -9 -5 L 9 -4 L 13 -1 L -9 -1 Z'],
      ['glass', 'M -15 -2 L -7 -5 L 2 -3 L 6 0 L -3 3 L -12 2 Z'],
      ['highlight', 'M -13 -2 L -7 -4 L 0 -2 L -6 -1 Z'],
      ['dark', 'M -7 -8 L 0 -11 L 7 -10 L 2 -7 Z M -7 8 L 0 11 L 7 10 L 2 7 Z'],
    ], engines: [[26, -5, 2.7], [26, 5, 2.7]],
    seams: ['M -5 -8 L 13 -15 M -5 8 L 13 15', 'M 9 -4 L 11 0 L 9 4'],
    vents: [[12,-3],[15,-2],[12,3],[15,2]], rivets: [[17,-16],[17,16]],
  },
  JUGGERNAUT: { width: 100, height: 80, accent: '#e4b786', engine: '#eeb177', core: '#fff1d3',
    plates: ['#aaa18a', '#626659', '#303a39'],
    parts: [
      ['dark', 'M -39 -28 L -24 -38 L 33 -36 L 47 -25 L 49 -12 L 43 0 L 49 12 L 47 25 L 33 36 L -24 38 L -39 28 Z'],
      ['armor', 'M -37 -26 L -22 -35 L 29 -33 L 42 -25 L 40 -13 L -31 -13 Z'],
      ['shade', 'M -37 26 L -22 35 L 29 33 L 42 25 L 40 13 L -31 13 Z'],
      ['plate', 'M -30 -26 L -20 -32 L 12 -31 L 17 -21 L -28 -20 Z'],
      ['plate', 'M -30 26 L -20 32 L 12 31 L 17 21 L -28 20 Z'],
      ['steel', 'M -33 -24 L -25 -29 L -23 -18 L -32 -17 Z M -33 24 L -25 29 L -23 18 L -32 17 Z'],
      ['dark', 'M 23 -31 L 41 -29 L 48 -23 L 48 -14 L 23 -15 Z M 23 31 L 41 29 L 48 23 L 48 14 L 23 15 Z'],
      ['steel', 'M 27 -28 L 40 -26 L 44 -22 L 44 -18 L 27 -18 Z M 27 28 L 40 26 L 44 22 L 44 18 L 27 18 Z'],
      ['armor', 'M -34 -17 L 14 -19 L 34 -11 L 37 0 L 34 11 L 14 19 L -34 17 L -45 10 L -45 -10 Z'],
      ['shade', 'M -43 4 L 16 8 L 34 4 L 34 11 L 14 19 L -34 17 L -45 10 Z'],
      ['plate', 'M -39 -10 L -31 -14 L 7 -15 L 16 -8 L 6 -3 L -35 -3 Z'],
      ['dark', 'M -50 -7 L -18 -8 L -12 -4 L -12 4 L -18 8 L -50 7 Z'],
      ['steel', 'M -49 -4 L -18 -5 L -17 0 L -49 2 Z'],
      ['plate', 'M -45 -5 L -40 -5 L -40 5 L -45 5 Z'],
      ['dark', 'M -9 -13 L 10 -15 L 20 -8 L 22 7 L 13 14 L -8 12 L -14 5 L -14 -6 Z'],
      ['armor', 'M -8 -11 L 9 -13 L 17 -7 L 19 5 L 11 11 L -7 9 L -11 4 L -11 -5 Z'],
      ['glass', 'M -5 -7 L 5 -9 L 10 -5 L 10 0 L -5 0 Z'],
      ['highlight', 'M -4 -6 L 5 -7 L 7 -5 L -4 -4 Z'],
    ], engines: [[46, -22, 5.3], [46, 22, 5.3]],
    seams: ['M -20 -30 L -18 -20 M -5 -31 L -3 -21 M 12 -31 L 15 -22 M -20 30 L -18 20 M -5 31 L -3 21 M 12 31 L 15 22', 'M -34 -11 L -32 -4 M -34 11 L -32 5 M 24 -9 L 29 -5 L 29 5 L 24 9'],
    vents: [[24,-5],[28,-3],[24,5],[28,3]], rivets: [[-26,-31],[18,-29],[-26,31],[18,29],[-34,-11],[-34,11]],
  },
};

const paths = new Map(), materials = new WeakMap();
function artFor(type) {
  const model = models[type] || models.SCOUT;
  if (!paths.has(model)) paths.set(model, {
    ...model, parts: model.parts.map(([material, data]) => ({ material, path: new Path2D(data) })),
    seams: model.seams.map(data => new Path2D(data)),
    plume: new Path2D('M 0 -1 Q 2 -1.2 4 0 Q 2 1.2 0 1 Z'),
  });
  return paths.get(model);
}

function paletteFor(ctx, model) {
  let cache = materials.get(ctx);
  if (!cache) { cache = new Map(); materials.set(ctx, cache); }
  if (!cache.has(model)) {
    const gradient = (colors, top = -model.height / 2, bottom = model.height / 2) => {
      const paint = ctx.createLinearGradient(0, top, 0, bottom);
      colors.forEach((color, index) => paint.addColorStop(index / (colors.length - 1), color));
      return paint;
    };
    cache.set(model, { dark: '#101a24', armor: gradient(['#a2adb3', '#697580', '#26313d']),
      plate: gradient(model.plates), shade: '#29333e', steel: gradient(['#c6cfd1', '#737f89', '#303d48']),
      glass: gradient(['#94c3cc', '#376171', '#0c2234'], -10, 8), highlight: '#c3e3df' });
  }
  return cache.get(model);
}

export function drawEnemyArt(ctx, enemy, { lowPower = false } = {}) {
  const art = artFor(enemy.type), palette = paletteFor(ctx, art);
  const time = (enemy.oscillation || 0) / 2;
  ctx.save();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
  ctx.scale(enemy.width / art.width, enemy.height / art.height);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const [x, y, size] of art.engines) {
    ctx.save(); ctx.translate(x, y);
    const thrust = enemy.dashState === 'DASHING' ? 1.6 : 1;
    const length = size * (lowPower ? 1 : 1.05 + .05 * Math.sin(time * 19 + y)) * thrust;
    ctx.scale(length, size * .8);
    ctx.fillStyle = art.engine; ctx.fill(art.plume);
    ctx.scale(.65, .46); ctx.fillStyle = art.core; ctx.fill(art.plume);
    ctx.restore();
  }
  for (const part of art.parts) {
    ctx.strokeStyle = '#0b141e'; ctx.lineWidth = 1.7; ctx.stroke(part.path);
    ctx.fillStyle = enemy.hitFlashTimer > 0 && part.material !== 'glass' ? '#e8eef0' : palette[part.material];
    ctx.fill(part.path);
    ctx.lineWidth = .45; ctx.strokeStyle = part.material === 'shade' ? '#46515c' : '#a6b1b17a'; ctx.stroke(part.path);
  }
  for (const [x,y,size] of art.engines) {
    ctx.fillStyle = '#101922'; ctx.fillRect(x-1.5,y-size*.65,1.6,size*1.3);
    ctx.fillStyle = art.core; ctx.fillRect(x-.2,y-size*.4,.8,size*.8);
  }
  // Panel joins and recessed vents remain legible at the real 60–100px size.
  ctx.lineWidth = .8; ctx.strokeStyle = '#111b25';
  for (const seam of art.seams) ctx.stroke(seam);
  ctx.fillStyle = '#111c25';
  for (const [x, y] of art.vents) ctx.fillRect(x, y - 1, 1.5, 2);
  if (!lowPower) {
    ctx.fillStyle = '#bac2bf';
    for (const [x, y] of art.rivets) { ctx.beginPath(); ctx.arc(x, y, .7, 0, Math.PI * 2); ctx.fill(); }
  }
  if (enemy.type === 'SCOUT' || !enemy.type) {
    ctx.fillStyle = '#101722'; ctx.beginPath(); ctx.arc(-36, 0, 3.7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = enemy.scoutAim?.locked ? '#fff1d8' : '#f28f85';
    ctx.beginPath(); ctx.arc(-37, 0, enemy.attackWarning > 0 ? 2.4 : 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = art.accent; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-5,-18); ctx.lineTo(5,-19); ctx.moveTo(-5,18); ctx.lineTo(5,19); ctx.stroke();
  } else if (enemy.type === 'SPEEDSTER') {
    ctx.strokeStyle = art.accent; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(5,-13); ctx.lineTo(14,-16); ctx.moveTo(5,13); ctx.lineTo(14,16); ctx.stroke();
  } else {
    ctx.fillStyle = '#111821'; ctx.fillRect(-50,-5,3,10);
    ctx.fillStyle = art.engine; ctx.fillRect(-49,-2,1.6,4);
    ctx.strokeStyle = art.accent; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(-29,-23); ctx.lineTo(-23,-25); ctx.moveTo(-29,23); ctx.lineTo(-23,25); ctx.stroke();
  }
  ctx.restore();
}
