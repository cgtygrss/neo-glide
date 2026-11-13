const TAU = Math.PI * 2;
const ink = '#061322';
export const galaxySeed = id => [...id].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 17);
export const galaxyNoise = (seed, index) => {
  const value = Math.sin(seed * .013 + index * 127.1) * 43758.5453;
  return value - Math.floor(value);
};
export const behindGalaxyBody = (bodies, x, y) => bodies.some(body => (x - body.x) ** 2 + (y - body.y) ** 2 < body.radius ** 2);
const alpha = (color, opacity) => `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;

function disc(ctx, x, y, radius, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill();
}
function path(ctx, points, color, width = 1, fill = false) {
  ctx.beginPath(); ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  if (fill) { ctx.closePath(); ctx.fillStyle = color; ctx.fill(); }
  else { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); }
}
function glow(ctx, x, y, radius, color, strength = .5) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, alpha(color, strength));
  gradient.addColorStop(.22, alpha(color, strength * .5));
  gradient.addColorStop(.6, alpha(color, strength * .12));
  gradient.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = gradient; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}
function ellipse(ctx, x, y, rx, ry, color, width = 1, rotation = 0, start = 0, end = TAU) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rotation, start, end);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
function star(ctx, x, y, size, color) {
  glow(ctx, x, y, size * 8, color, .35);
  path(ctx, [[x - size * 2, y], [x + size * 2, y]], alpha(color, .65), .7);
  path(ctx, [[x, y - size * 2], [x, y + size * 2]], alpha(color, .65), .7);
  disc(ctx, x, y, size * .6, '#f1ffff');
}
function planet(ctx, x, y, r, mid, light, seed, low) {
  glow(ctx, x - r * .25, y - r * .2, r * 1.35, light, .17);
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  const body = ctx.createRadialGradient(x - r * .48, y - r * .55, r * .05, x + r * .4, y + r * .3, r * 1.6);
  body.addColorStop(0, light); body.addColorStop(.2, mid); body.addColorStop(.65, '#163043'); body.addColorStop(1, '#050d19');
  ctx.fillStyle = body; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  for (let i = 0; i < (low ? 8 : 22); i++) {
    const yy = y - r + galaxyNoise(seed, i) * r * 2;
    ctx.beginPath(); ctx.moveTo(x - r, yy);
    ctx.bezierCurveTo(x - r * .2, yy - r * .17, x + r * .35, yy + r * .15, x + r, yy - r * .08);
    ctx.strokeStyle = alpha(i % 3 ? light : ink, i % 3 ? .07 : .2);
    ctx.lineWidth = r * (.015 + galaxyNoise(seed, i + 55) * .05); ctx.stroke();
  }
  const shadow = ctx.createLinearGradient(x - r, y - r * .3, x + r, y + r * .4);
  shadow.addColorStop(0, '#02091800'); shadow.addColorStop(.5, '#02091815'); shadow.addColorStop(1, '#020918dd');
  ctx.fillStyle = shadow; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
  ellipse(ctx, x, y, r, r, alpha(light, .52), Math.max(.7, r * .009), 0, Math.PI * .85, Math.PI * 1.8);
}
function spiral(ctx, x, y, radius, colors, seed, low, tilt = -.3, squash = .5) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(1, squash);
  glow(ctx, 0, 0, radius * 1.25, colors[0], .3);
  for (let arm = 0; arm < colors.length; arm++) {
    const points = [];
    for (let i = 0; i <= 48; i++) {
      const fraction = i / 48, angle = fraction * 5.2 + arm * TAU / colors.length;
      points.push([Math.cos(angle) * radius * fraction, Math.sin(angle) * radius * fraction]);
    }
    path(ctx, points, alpha(colors[arm], .05), radius * .18);
    path(ctx, points, alpha(colors[arm], .16), radius * .055);
    path(ctx, points, alpha(colors[arm], .42), radius * .009);
    for (let i = 0; i < (low ? 16 : 45); i++) {
      const fraction = galaxyNoise(seed + arm * 37, i), angle = fraction * 5.2 + arm * TAU / colors.length;
      const jitter = (galaxyNoise(seed, i + 211) - .5) * radius * .075;
      disc(ctx, Math.cos(angle) * radius * fraction + jitter, Math.sin(angle) * radius * fraction + jitter,
        radius * (.002 + galaxyNoise(seed, i + 71) * .004), alpha(colors[arm], .2 + fraction * .4));
    }
  }
  glow(ctx, 0, 0, radius * .3, '#ffe8bc', .65); disc(ctx, 0, 0, radius * .012, '#fff4d4');
  ctx.restore();
}
function ridge(ctx, w, h, seed, color, baseline = .91, amplitude = .15, shards = false) {
  const points = [[-w * .02, h]];
  for (let i = 0; i <= 18; i++) {
    const x = i / 18 * w;
    const peak = shards ? (i % 2 ? galaxyNoise(seed, i) : 1) : galaxyNoise(seed, i);
    points.push([x, h * (baseline - peak * amplitude)]);
  }
  points.push([w * 1.02, h]); path(ctx, points, color, 1, true);
  return points.slice(1, -1);
}
function aurora(ctx, w, h, light, mid, low) {
  for (let curtain = 0; curtain < (low ? 2 : 4); curtain++) {
    const points = [];
    for (let i = 0; i <= 45; i++) {
      const x = i / 45, y = .22 + curtain * .055 + Math.sin(x * 6 + curtain * .35) * .11;
      points.push([x * w, y * h]);
    }
    path(ctx, points, alpha(mid, .16), h * .15);
    path(ctx, points, alpha(light, .18), h * .035);
    path(ctx, points, alpha(light, .45), h * .003);
    for (let i = 0; i < (low ? 12 : 45); i++) {
      const x = i / (low ? 12 : 45), y = .22 + curtain * .055 + Math.sin(x * 6 + curtain * .35) * .11;
      path(ctx, [[x * w, y * h], [x * w + h * .012, (y + .13 + Math.sin(i) * .03) * h]], alpha(light, .1), 1);
    }
  }
}

// Detailed geometry is painted once per destination/size, then composited each frame.
export function drawGalaxyArtwork(ctx, stage, w, h, low = false, opacity = 1) {
  const [dark, mid, light] = stage.colors, seed = galaxySeed(stage.id);
  const compact = w / h < 1.6;
  const x = w * (compact ? .59 : .72), y = h * .46, r = Math.min(h * .31, w * .24);
  const bodies = [];
  const drawPlanet = (...args) => { bodies.push({ x:args[0], y:args[1], radius:args[2] }); planet(ctx, ...args); };
  ctx.save(); ctx.globalAlpha = opacity; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const sky = ctx.createLinearGradient(0, 0, w * .25, h);
  sky.addColorStop(0, '#030b19'); sky.addColorStop(.52, dark); sky.addColorStop(1, '#081522');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  glow(ctx, w * .72, h * .42, w * .55, mid, .65);
  for (let i = 0; i < (low ? 5 : 12); i++) {
    glow(ctx, w * (.28 + galaxyNoise(seed, i) * .8), h * (.14 + galaxyNoise(seed, i + 35) * .68),
      h * (.09 + galaxyNoise(seed, i + 81) * .18), i % 3 ? mid : light, .07);
  }

  switch (stage.scene || stage.id) {
    case 'moonfield': {
      spiral(ctx, w * .78, h * .24, r * 1.1, [mid, light], seed, low, -.35, .25);
      for (let i = 0; i < 4; i++) {
        const xx = w * (.37 + i * .16), yy = h * (.4 + Math.sin(i * 1.9 + .5) * .24);
        const radius = h * (.035 + galaxyNoise(seed, i + 8) * .09);
        drawPlanet(xx, yy, radius, mid, light, seed + i * 23, low);
        if (i === 2) ellipse(ctx, xx, yy, radius * 1.7, radius * .35, alpha(light, .24), h * .003, -.3);
      }
      ridge(ctx, w, h, seed, '#0c1b2a', 1.05, .12); break;
    }
    case 'dustbelt': {
      glow(ctx, w * .67, h * .3, h * .65, light, .2);
      drawPlanet(w * .85, h * .25, h * .075, mid, light, seed, low);
      for (let i = 0; i < (low ? 12 : 24); i++) {
        const xx = w * (.22 + galaxyNoise(seed, i) * .85);
        const yy = h * (.16 + xx / w * .55 + (galaxyNoise(seed, i + 20) - .5) * .4);
        const radius = h * (.009 + galaxyNoise(seed, i + 60) * .035);
        const points = Array.from({ length: 7 }, (_, edge) => {
          const angle = edge / 7 * TAU, size = radius * (.65 + galaxyNoise(seed + i, edge + 90) * .4);
          return [xx + Math.cos(angle) * size, yy + Math.sin(angle) * size * .68];
        });
        path(ctx, points, '#142838', 1, true);
        path(ctx, points.slice(0, 4), alpha(light, .25), Math.max(.6, h * .002));
      }
      // Distant scenery avoids collectible glows and foreground collision cues.
      ellipse(ctx, w * .63, h * .5, w * .52, h * .12, alpha(mid, .13), h * .055, .22);
      break;
    }
    case 'default':
      spiral(ctx, w * (compact ? .58 : .64), h * .38, Math.min(h * .65, w * .46), ['#83bce4', '#b3a0d7', '#76dbd9'], seed, low, -.32, .31);
      drawPlanet(w * .83, h * .71, h * .15, '#345a71', '#9dd9dd', seed, low);
      drawPlanet(w * .47, h * .7, h * .025, '#a97b61', '#efd3a8', seed + 11, true); break;
    case 'andromeda':
      glow(ctx, x - r * .8, y + r * .05, r * 1.8, '#f2b86a', .55);
      ellipse(ctx, x, y, r * 1.55, r * .38, '#e9c58b55', r * .1, -.24);
      drawPlanet(x, y, r, '#bf8655', '#ffe7a3', seed, low);
      ellipse(ctx, x, y, r * 1.55, r * .38, '#ffe0a38a', r * .028, -.24, 0, Math.PI);
      ridge(ctx, w, h, seed, '#101e30', .96, .1); break;
    case 'triangulum': {
      drawPlanet(x, y - h * .07, r * .63, '#447c96', '#d6f8ff', seed, low);
      for (let i = 0; i < (low ? 5 : 10); i++) {
        const xx = w * (.27 + i * .078), base = h * (1.02 - galaxyNoise(seed, i) * .12), top = base - h * (.16 + galaxyNoise(seed, i + 10) * .38), width = h * (.05 + galaxyNoise(seed, i + 20) * .08);
        path(ctx, [[xx - width, base], [xx, top], [xx + width * .3, top + h * .04], [xx + width, base]], '#17384b', 1, true);
        path(ctx, [[xx, top], [xx + width * .3, top + h * .04], [xx + width, base], [xx + width * .12, base]], '#48758b88', 1, true);
        path(ctx, [[xx - width, base], [xx, top], [xx + width * .3, top + h * .04]], '#bef4ff9c', h * .002);
      }
      break;
    }
    case 'whirlpool':
      drawPlanet(x, y, r * 1.05, '#18596c', '#8adacc', seed, low);
      spiral(ctx, x - r * .05, y - r * .05, r * 1.35, ['#72d9d0', '#3f92bd'], seed, low, -.4, .58);
      drawPlanet(x + r * .95, y - r * .8, r * .19, '#538a9b', '#d1f9e7', seed + 21, true);
      ridge(ctx, w, h, seed, '#092434', .98, .09); break;
    case 'sunflower': {
      glow(ctx, x, y, r * 2.1, '#ffad50', .4);
      for (let i = 0; i < (low ? 12 : 24); i++) {
        const angle = i * TAU / (low ? 12 : 24), reach = r * (.8 + galaxyNoise(seed, i) * .45);
        ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
        ctx.beginPath(); ctx.moveTo(r * .5, -r * .04);
        ctx.bezierCurveTo(reach * .9, -r * .5, reach * 1.2, r * .22, r * .56, r * .13);
        ctx.strokeStyle = '#fbb66514'; ctx.lineWidth = r * .12; ctx.stroke();
        ctx.strokeStyle = '#ffd28f70'; ctx.lineWidth = r * .012; ctx.stroke(); ctx.restore();
      }
      glow(ctx, x, y, r * .85, '#ffd790', .6);
      bodies.push({ x, y, radius:r * .58 });
      disc(ctx, x, y, r * .58, '#e9ba72');
      const fire = ctx.createRadialGradient(x - r * .18, y - r * .18, 0, x, y, r * .58);
      fire.addColorStop(0, '#fff0b5'); fire.addColorStop(.6, '#f4c77f'); fire.addColorStop(1, '#bd783d');
      ctx.fillStyle = fire; ctx.beginPath(); ctx.arc(x, y, r * .58, 0, TAU); ctx.fill();
      for (let i = 0; i < (low ? 20 : 65); i++) {
        const angle = galaxyNoise(seed, i + 88) * TAU, radius = Math.sqrt(galaxyNoise(seed, i + 130)) * r * .55;
        disc(ctx, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, r * .009, '#a8602828');
      }
      break;
    }
    case 'petals': {
      const petals = 11;
      glow(ctx, x, y, r * 1.9, light, .35);
      for (let i = 0; i < petals; i++) {
        const angle = i * TAU / petals, reach = .65 + galaxyNoise(seed, i + 51) * .3;
        ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
        glow(ctx, r * reach, 0, r * .65, mid, .5);
        glow(ctx, r * reach, -r * .12, r * .37, light, .2);
        ellipse(ctx, r * .58, 0, r * reach, r * .2, alpha(light, .12), r * .025, .2);
        ctx.restore();
      }
      glow(ctx, x, y, r * .6, '#fbbfcf', .32);
      bodies.push({ x, y, radius:r * .24 });
      disc(ctx, x, y, r * .24, dark);
      for (let i = 0; i < (low ? 15 : 45); i++) {
        const angle = i * 2.4, radius = r * (.55 + galaxyNoise(seed, i) * .55);
        disc(ctx, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, h * .002, '#ebc7d16b');
      }
      break;
    }
    case 'black_eye':
      bodies.push({ x:x + r * .06, y:y - r * .06, radius:r * .83 });
      glow(ctx, x, y, r * 1.8, '#a280b6', .4);
      for (let i = 0; i < 10; i++) ellipse(ctx, x, y, r * (1.18 + i * .048), r * (.22 + i * .014), i % 3 ? '#ffcc9d30' : '#cca6de40', h * .008, -.26);
      disc(ctx, x + r * .06, y - r * .06, r * .83, '#060c1b');
      ellipse(ctx, x + r * .06, y - r * .06, r * .84, r * .84, '#cfabe1a6', h * .006, 0, Math.PI * .87, Math.PI * 1.83);
      glow(ctx, x - r * .66, y - r * .5, r * .38, '#d0acd8', .25);
      ellipse(ctx, x, y, r * 1.48, r * .31, '#ffd3a68c', h * .012, -.26, 0, Math.PI);
      ellipse(ctx, x, y, r * 1.48, r * .31, '#f5e1be9c', h * .002, -.26, 0, Math.PI); break;
    case 'eye': {
      bodies.push({ x, y, radius:r * .68 });
      glow(ctx, x, y, r * 1.8, light, .45);
      for (let i = 0; i < (low ? 26 : 70); i++) {
        const angle = i * TAU / (low ? 26 : 70), length = .85 + galaxyNoise(seed, i) * .25;
        path(ctx, [[x + Math.cos(angle) * r * .65, y + Math.sin(angle) * r * .65], [x + Math.cos(angle) * r * length, y + Math.sin(angle) * r * length]],
          alpha(i % 3 ? light : mid, .16 + galaxyNoise(seed, i + 4) * .3), h * .006);
      }
      ellipse(ctx, x, y, r, r, alpha(light, .28), r * .08);
      disc(ctx, x, y, r * .68, '#030c18');
      ellipse(ctx, x, y, r * 1.38, r * .29, '#94e9d35c', r * .034, -.27);
      ellipse(ctx, x, y, r * 1.52, r * .34, alpha(light, .2), r * .011, -.27);
      break;
    }
    case 'sombrero':
      for (let i = 0; i < 12; i++) ellipse(ctx, x, y, r * (1.2 + i * .065), r * (.24 + i * .014), alpha(i % 3 ? light : mid, .14 + i * .009), h * .006, -.2);
      drawPlanet(x, y, r * .58, '#a97868', '#f6d4ad', seed, low);
      ellipse(ctx, x, y, r * 1.7, r * .35, '#dfb58e66', h * .018, -.2, 0, Math.PI);
      ridge(ctx, w, h, seed, '#201e2b', .94, .13); ridge(ctx, w, h, seed + 6, '#101b2a', 1.03, .14); break;
    case 'cartwheel':
      glow(ctx, x, y, r * 1.6, light, .3);
      for (let i = 0; i < 18; i++) {
        const a = i * TAU / 18;
        ellipse(ctx, x, y, r, r, alpha(i % 3 ? light : '#d6a6ef', .44), r * .035, 0, a + .02, a + TAU / 18 - .055);
        path(ctx, [[x + Math.cos(a) * r * .3, y + Math.sin(a) * r * .3], [x + Math.cos(a + .12) * r * .97, y + Math.sin(a + .12) * r * .97]], alpha(light, .16), h * .002);
        if (!(i % 3)) star(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, h * .005, light);
      }
      drawPlanet(x, y, r * .26, '#62669b', '#c9d9fd', seed, low);
      ellipse(ctx, x, y, r * 1.13, r * 1.13, alpha(mid, .45), h * .003); break;
    case 'centaurus_a': {
      drawPlanet(x, y, r, '#7e392a', '#ed9953', seed, low);
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
      for (let i = 0; i < (low ? 8 : 19); i++) {
        const xx = x - r + galaxyNoise(seed, i) * r * 2, yy = y - r + galaxyNoise(seed, i + 31) * r * 2;
        const points = [[xx, yy], [xx + r * .13, yy + r * .15], [xx - r * .03, yy + r * .3], [xx + r * .2, yy + r * .4]];
        path(ctx, points, '#ff84251a', r * .09); path(ctx, points, '#ffbd6b99', r * .012);
      }
      ctx.restore();
      const peaks = ridge(ctx, w, h, seed, '#201421', .98, .22, true);
      path(ctx, peaks, '#e56e3c55', h * .005); ridge(ctx, w, h, seed + 2, '#091523', 1.06, .13); break;
    }
    case 'bode':
      drawPlanet(x + h * .03, y + h * .2, r * .65, '#2c6868', '#9cdfc1', seed, low);
      aurora(ctx, w, h, '#a8f1c8', '#398d91', low);
      ridge(ctx, w, h, seed, '#14333b', .98, .2, true); ridge(ctx, w, h, seed + 2, '#081d2a', 1.05, .14); break;
    case 'pinwheel':
      spiral(ctx, x, y, r * 1.35, ['#e5a9df', '#8ee5db', '#c4b3f4', '#e9c58f'], seed, low, -.3, .7);
      drawPlanet(w * .41, h * .78, h * .075, '#5c6293', '#c0c7ec', seed + 4, true); break;
    case 'clouds':
      for (let i = 0; i < (low ? 14 : 34); i++) {
        const xx = x - r * 1.5 + galaxyNoise(seed, i) * r * 3, yy = y + Math.sin(i * .7) * r * .7;
        glow(ctx, xx, yy, r * (.2 + galaxyNoise(seed, i + 4) * .5), i % 3 ? light : mid, .14);
      }
      for (let i = 0; i < 3; i++) star(ctx, x - r * .5 + i * r * .48, y + Math.sin(i * 3) * r * .35, h * .011, '#ffdfdb');
      ridge(ctx, w, h, seed, '#1a172c', .94, .2); break;
    case 'cluster':
      for (let i = 0; i < 7; i++) {
        const xx = w * (.43 + i * .065), yy = h * (.36 + Math.sin(i * 1.7) * .16);
        glow(ctx, xx, yy, h * .11, '#8fd1ff', .35); star(ctx, xx, yy, h * (i % 3 ? .006 : .011), light);
        if (i) path(ctx, [[w * (.43 + (i - 1) * .065), h * (.36 + Math.sin((i - 1) * 1.7) * .16)], [xx, yy]], '#b3dbff16', .7);
      }
      path(ctx, ridge(ctx, w, h, seed, '#17324b', .96, .12), '#a3ccdd32', h * .002); break;
    case 'filaments':
    case 'web': {
      const web = stage.scene === 'web', count = low ? 12 : 30;
      glow(ctx, x, y, r, light, .38);
      for (let i = 0; i < count; i++) {
        const a = i * TAU / count, xx = x + Math.cos(a) * r * (1 + galaxyNoise(seed, i) * .3), yy = y + Math.sin(a) * r * .8;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * .1, y + Math.sin(a) * r * .1);
        ctx.bezierCurveTo(x + Math.cos(a + .65) * r * .7, y + Math.sin(a + .65) * r * .7, xx - h * .06, yy + h * .08, xx, yy);
        ctx.strokeStyle = alpha(i % 3 ? light : '#7dd9d0', .13 + galaxyNoise(seed, i + 5) * .25); ctx.lineWidth = h * (web ? .002 : .004); ctx.stroke();
        if (web && !(i % 3)) { star(ctx, xx, yy, h * .005, light); ellipse(ctx, x, y, r * (i / count + .25), r * (i / count + .25) * .75, alpha(light, .08), .8, -.2); }
      }
      if (!web) drawPlanet(x, y, h * .028, '#b0d2ce', '#e4fdf7', seed, true);
      break;
    }
    case 'pillars':
      glow(ctx, x, y - h * .12, r * 1.5, '#f5bf78', .4);
      for (let i = 0; i < 3; i++) {
        const xx = w * (.48 + i * .15), top = h * (.27 + (i % 2) * .17), base = h * 1.04;
        const points = [[xx - h * .1, base], [xx - h * .06, top + h * .21], [xx - h * .1, top + h * .12], [xx - h * .025, top], [xx + h * .065, top + h * .025], [xx + h * .1, top + h * .14], [xx + h * .045, top + h * .22], [xx + h * .14, base]];
        path(ctx, points, '#292333', 1, true); path(ctx, points.slice(1, 6), '#e7b98366', h * .005); star(ctx, xx - h * .025, top, h * .006, '#ffe3a8');
      }
      break;
    case 'sea':
      drawPlanet(x, y - h * .06, r * .72, '#9f6687', '#f9cfdf', seed, low);
      for (let i = 0; i < (low ? 5 : 11); i++) {
        const yy = h * (.62 + i * .035);
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.bezierCurveTo(w * .3, yy - h * .08, w * .7, yy + h * .08, w, yy);
        ctx.strokeStyle = alpha(i % 3 ? mid : light, .17); ctx.lineWidth = h * .025; ctx.stroke();
      }
      ridge(ctx, w, h, seed, '#172138', 1.02, .11); break;
    case 'peaks': {
      drawPlanet(w * .84, h * .25, h * .105, '#477f94', '#e0e6ba', seed, low);
      for (let i = 0; i < 3; i++) {
        const points = ridge(ctx, w, h, seed + i * 9, ['#294c60', '#1b394d', '#0c2234'][i], .96 + i * .07, .32 - i * .035, true);
        path(ctx, points, alpha(light, .2 - i * .05), h * .003);
      }
      break;
    }
    case 'ridge':
      glow(ctx, x, y, r * 1.7, '#e86b88', .4);
      ctx.beginPath(); ctx.moveTo(x - r, h * 1.1); ctx.lineTo(x - r * .65, y + r * .3);
      ctx.bezierCurveTo(x - r * 1.1, y + r * .05, x - r * .7, y - r * .3, x - r * .5, y - r * .4);
      ctx.lineTo(x - r * .7, y - r * .78); ctx.lineTo(x - r * .38, y - r * .62);
      ctx.bezierCurveTo(x + r * .1, y - r * .75, x + r * .28, y - r * .25, x + r * .52, y - r * .05);
      ctx.lineTo(x + r * .21, y + r * .07); ctx.lineTo(x - r * .12, y - r * .12);
      ctx.bezierCurveTo(x - r * .2, y + r * .4, x + r * .48, y + r * .3, x + r * .7, h * 1.1);
      ctx.closePath(); ctx.fillStyle = '#121526'; ctx.fill(); ctx.strokeStyle = '#fca7bd45'; ctx.lineWidth = h * .004; ctx.stroke();
      star(ctx, x + r * .7, y - r * .65, h * .008, light); break;
    case 'stations':
      glow(ctx, x, y, r * 1.7, '#9cbfef', .4); star(ctx, x, y, h * .018, '#e5f6ff');
      ellipse(ctx, x, y, r * 1.25, r * .6, '#9fbdd86b', h * .008, -.3);
      ellipse(ctx, x, y, r * 1.32, r * .64, '#9fbdd826', h * .025, -.3);
      for (let i = 0; i < 5; i++) {
        const a = i * TAU / 5, xx = x + Math.cos(a) * r * 1.18, yy = y + Math.sin(a) * r * .6;
        path(ctx, [[xx - h * .035, yy - h * .02], [xx + h * .035, yy - h * .02], [xx + h * .035, yy + h * .02], [xx - h * .035, yy + h * .02]], '#274758', 1, true);
        path(ctx, [[xx - h * .065, yy], [xx + h * .065, yy]], '#a8cbd5a0', h * .004);
        disc(ctx, xx, yy, h * .004, '#f7d99b');
      }
      break;
    case 'twins':
      glow(ctx, x, y, r * 1.8, '#92d7c3', .2);
      spiral(ctx, w * .58, h * .38, r * .92, ['#80cdc8', '#e0d29e'], seed, low, -.45, .55);
      spiral(ctx, w * .84, h * .65, r * .6, ['#a4c9ed', '#a6ead3'], seed + 31, low, .25, .7); break;
    case 'jets':
      bodies.push({ x, y, radius:h * .027 });
      glow(ctx, x, y, r * 1.6, '#dbbadf', .38);
      for (const direction of [-1, 1]) {
        const points = [[x, y], [x - h * .09, y + direction * h * .7], [x + h * .07, y + direction * h * .7]];
        path(ctx, points, '#9a94db20', 1, true); path(ctx, [[x, y], [x - h * .015, y + direction * h * .6]], '#e1d8fa6b', h * .01);
      }
      spiral(ctx, x, y, r * .7, ['#e0b4b4', '#a3d6de'], seed, low, -.25, .24);
      disc(ctx, x, y, h * .027, '#080d21'); ellipse(ctx, x, y, h * .032, h * .032, '#ffe7c6b3', h * .004); break;
  }

  // Fine cosmic dust belongs to the cached scene, not to the collectible layer.
  for (let i = 0; i < (low ? 45 : 150); i++) {
    const xx = w * galaxyNoise(seed, i + 400), yy = h * galaxyNoise(seed, i + 700);
    if (behindGalaxyBody(bodies, xx, yy)) continue;
    disc(ctx, xx, yy, .3 + galaxyNoise(seed, i + 900) * .7, alpha(light, .08 + galaxyNoise(seed, i + 950) * .15));
  }
  const veil = ctx.createLinearGradient(0, 0, w, 0);
  veil.addColorStop(0, '#041020a6'); veil.addColorStop(.4, '#04102040'); veil.addColorStop(.8, '#04102008'); veil.addColorStop(1, '#04102020');
  ctx.fillStyle = veil; ctx.fillRect(0, 0, w, h);
  const edge = ctx.createLinearGradient(0, 0, 0, h);
  edge.addColorStop(0, '#020a1840'); edge.addColorStop(.35, '#020a1800'); edge.addColorStop(.7, '#020a1800'); edge.addColorStop(1, '#020a18a6');
  ctx.fillStyle = edge; ctx.fillRect(0, 0, w, h);
  ctx.restore();
  return bodies;
}
