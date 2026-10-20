import { getTransformation, TRANSFORMATION_ASSEMBLIES, transformationProgress, transformationCapsuleClosure } from './TransformationCatalog.js';
import { getCosmetic } from './CosmeticsCatalog.js';
import { drawShipArt } from './ShipArt.js';

const INK = '#06121f';
const polygon = (ctx, points) => { ctx.beginPath(); ctx.moveTo(...points[0]); for (const point of points.slice(1)) ctx.lineTo(...point); ctx.closePath(); };
function plate(ctx, points, fill, edge = '#e8f8ff') {
  polygon(ctx, points); ctx.fillStyle = fill; ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke(); ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = 1.6; ctx.stroke();
}
function line(ctx, points, color, width = 2) {
  ctx.beginPath(); ctx.moveTo(...points[0]); for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
export function drawTransformationCapsule(ctx, capsule, reducedMotion = false) {
  if (!capsule) return;
  const time = reducedMotion ? 0 : capsule.age;
  ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
  ctx.translate(capsule.x, capsule.y);
  ctx.strokeStyle = '#8bf1ed55'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(0, 0, 33 + Math.sin(time * 4) * 2, 0, Math.PI * 2); ctx.stroke();
  plate(ctx, [[0,-28],[24,-14],[24,14],[0,28],[-24,14],[-24,-14]], '#183e55', '#b4fff1');
  ctx.save(); ctx.rotate(time * .65);
  line(ctx, [[-12,0],[0,-12],[12,0],[0,12],[-12,0]], '#f7dc91', 3); ctx.restore();
  ctx.fillStyle = '#edfff8'; ctx.fillRect(-3, -3, 6, 6);
  ctx.font = '800 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#071c2c'; ctx.fillRect(-27, 29, 54, 15);
  ctx.fillStyle = '#b4fff1'; ctx.fillText('MORPH', 0, 40); ctx.restore();
}
// Midpoint displacement produces uneven leaders and fine branching streamers.
// Geometry is deterministic between discharge ticks; drawing never changes physics.
function lightningPath(from, to, depth, roughness, random) {
  let points = [from, to];
  for (let level = 0; level < depth; level++) {
    const next = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const a = points[i-1], b = points[i], dx = b[0]-a[0], dy = b[1]-a[1];
      const distance = Math.hypot(dx,dy) || 1;
      const offset = (random()-.5)*roughness;
      const fraction = .38+random()*.24;
      next.push([a[0]+dx*fraction-dy/distance*offset, a[1]+dy*fraction+dx/distance*offset],b);
    }
    points = next; roughness *= .54;
  }
  return points;
}
export function drawVoltLightning(ctx, age, lowPower = false, reducedMotion = false) {
  const from = -Math.min(420,20+age*900), to = 18, length = to-from;
  let seed = 7411+(reducedMotion ? 0 : Math.floor(age*12))*173;
  const random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
  const leader = lightningPath([from,0],[to,0],lowPower ? 5 : 6,Math.min(46,length*.2),random);
  const branches = [];
  for(let i=0;i<(lowPower ? 3 : 6);i++) {
    const index = Math.floor(leader.length*(.15+random()*.65));
    const start = leader[index], side = random()<.5 ? -1 : 1;
    const reach = Math.min(80,length*.3)*(.35+random()*.65);
    const end = [start[0]+reach*(.3+random()*.6),start[1]+side*reach*(.35+random()*.65)];
    branches.push(lightningPath(start,end,lowPower ? 3 : 4,reach*.3,random));
  }
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.globalCompositeOperation='screen';
  const alpha = ctx.globalAlpha;
  // Light scattered around the hot channel, followed by an overexposed white core.
  ctx.shadowColor='#809eff';ctx.shadowBlur=lowPower ? 5 : 16;
  ctx.globalAlpha=alpha*.16;line(ctx,leader,'#697dff',lowPower ? 8 : 13);
  ctx.shadowBlur=0;ctx.globalAlpha=alpha*.45;line(ctx,leader,'#9ebaff',3.8);
  ctx.globalAlpha=alpha;line(ctx,leader,'#f5f8ff',1.35);
  for(let i=0;i<branches.length;i++) {
    const branch=branches[i];
    ctx.globalAlpha=alpha*(.25+i%3*.08);line(ctx,branch,'#a6baff',2);
    ctx.globalAlpha=alpha*(.55+i%2*.15);line(ctx,branch,'#e6edff',.55);
    if(!lowPower && i%2===0) {
      const root=branch[Math.floor(branch.length*.55)],end=branch.at(-1);
      const twig=lightningPath(root,[end[0]-6,end[1]*1.25],3,7,random);
      ctx.globalAlpha=alpha*.35;line(ctx,twig,'#b9caff',.45);
    }
  }
  ctx.restore();
}
const unit = value => Math.max(0, Math.min(1, value));
const smooth = value => { const p = unit(value); return p * p * (3 - 2 * p); };
const lerp = (a, b, p) => a + (b - a) * p;
export function transformationOpacity(form) {
  if (form.phase === 'ACTIVE' || (!form.reducedMotion && form.phase === 'ENTERING')) return 1;
  const progress = transformationProgress(form);
  return form.phase === 'ENTERING' ? progress : 1 - progress;
}

// A single set of vector parts draws both the assembled vehicle and its transition.
function drawPart(ctx, form, id, draw) {
  const spec = TRANSFORMATION_ASSEMBLIES[form.id].find(part => part.id === id);
  if (!spec || form.phase === 'ACTIVE' || form.reducedMotion) { draw(); return; }
  const entering = form.phase === 'ENTERING';
  const p = entering ? unit((form.transitionTime - spec.start) / spec.duration) : transformationProgress(form);
  if (entering && p <= 0) return;
  const offset = entering ? (1 - p) ** 3 - Math.sin(p * Math.PI) * .065 : p * p * .7;
  ctx.save();
  ctx.translate(spec.x * offset, spec.y * offset);
  ctx.rotate(spec.rotation * offset);
  ctx.globalAlpha *= entering ? smooth(p * 4) : 1;
  draw();
  ctx.restore();
}
function sparks(ctx, count, progress, color, radius) {
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  for (let i = 0; i < count; i++) {
    const a = i * Math.PI * 2 / count + .23;
    const r = radius + progress * 32 + (i % 3) * 5;
    line(ctx, [[Math.cos(a) * r, Math.sin(a) * r], [Math.cos(a) * (r + 4), Math.sin(a) * (r + 4)]], color, 1);
  }
}

export function transformationCinematicPose(form, width, height) {
  const t = form.transitionTime;
  const arrive = smooth(t / .25), depart = smooth((t - 1.35) / .25);
  const focus = arrive * (1 - depart);
  // Reserve space for HUD above and controls below, including short landscape viewports.
  const scale = Math.max(.5, Math.min(3.4, (width - 28) / 245, (height - 90) / 245));
  return { x: lerp(form.x, width * .5, focus), y: lerp(form.y, height * .44, focus), scale: lerp(1, scale, focus), dim: focus * .78 };
}

// The selected ship is enclosed as its feature-specific capsule and equipment assemble.
export function drawTransformationCinematic(ctx, game, width, height, lowPower = false) {
  const form = game.transformation;
  if (!form || form.phase !== 'ENTERING' || form.reducedMotion) return;
  const pose = transformationCinematicPose(form, width, height);
  const t = form.transitionTime, arrival = smooth(t / .25), departure = smooth((t - 1.35) / .25);
  const accent = getCosmetic(game.cosmeticId)?.colors.accent || getTransformation(form.id).color;
  ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
  ctx.fillStyle = `rgba(2, 8, 22, ${pose.dim})`; ctx.fillRect(0, 0, width, height);
  ctx.translate(pose.x, pose.y); ctx.scale(pose.scale, pose.scale);
  if (t < 1.35) {
    ctx.save(); ctx.globalAlpha = arrival * (1 - departure) * .4;
    ctx.strokeStyle = accent; ctx.lineWidth = .7;
    for (let i = 0; i < (lowPower ? 1 : 3); i++) {
      ctx.beginPath(); ctx.arc(0, 0, 44 + i * 12, t * .8 + i * 2, t * .8 + i * 2 + 1.4); ctx.stroke();
    }
    ctx.restore();
  }
  drawTransformationVehicle(ctx, { ...form, x: 0, y: 0, trail: [] }, game.cosmeticId, lowPower, false, game.shipType);
  if (t >= 1.1 && t < 1.35) {
    const p = (t - 1.1) / .25;
    ctx.save(); ctx.globalAlpha = Math.sin(p * Math.PI) * .7;
    ctx.strokeStyle = accent; ctx.lineWidth = form.id === 'aegis' ? 2 : 1;
    ctx.beginPath(); ctx.arc(0, 0, 25 + p * 32, 0, Math.PI * 2); ctx.stroke();
    sparks(ctx, lowPower ? 6 : 14, p, accent, 30);
    if (form.id === 'volt') line(ctx, [[32,-19], [39,-9], [34,0], [40,9], [32,19]], '#ffffff', 2);
    ctx.restore();
  }
  ctx.restore();
}
// The selected ship stays inside the capsule and is revealed again as the shell opens.
function drawTransformationShip(ctx, form, shipType, cosmeticId, lowPower, reducedMotion) {
  const closure = transformationCapsuleClosure(form);
  ctx.save(); ctx.globalAlpha = 1 - closure * .92;
  ctx.translate(-20 + closure * 10, 0);
  ctx.scale(1 - closure * .24, 1 - closure * .24);
  if (form.phase === 'ENTERING' && !form.reducedMotion) ctx.rotate((form.origin?.rotation || 0) * (1 - smooth(form.transitionTime / .25)) * Math.PI / 180);
  ctx.scale(.18, .18); ctx.translate(-160, -120);
  drawShipArt(ctx, shipType, { time: reducedMotion ? 0 : form.phase === 'ENTERING' ? Math.max(0, form.transitionTime - 1.1) : form.elapsed + .5, cosmeticId, lowPower });
  ctx.restore();
}

const CAPSULES = {
  striker: { top: [[-34,0],[-27,-13],[5,-18],[27,-10],[40,0]], body: '#845b49', shade: '#493a45' },
  volt: { top: [[-33,0],[-24,-11],[0,-16],[24,-9],[40,0]], body: '#89712e', shade: '#504328' },
  drill: { top: [[-35,0],[-29,-14],[15,-16],[31,-9],[35,0]], body: '#447789', shade: '#274759' },
  sphere: { top: [[-32,0],[-28,-13],[-13,-23],[13,-23],[28,-13],[32,0]], body: '#59466e', shade: '#322e4e' },
  aegis: { top: [[-33,0],[-27,-17],[12,-21],[31,-10],[35,0]], body: '#385b90', shade: '#263d66' },
};
function drawTransformationEnclosure(ctx, form, accent, core, time, lowPower) {
  const capsule = CAPSULES[form.id], closure = transformationCapsuleClosure(form);
  drawPart(ctx,form,'capsuleTop',()=>plate(ctx,capsule.top,capsule.body,accent));
  drawPart(ctx,form,'capsuleBottom',()=>plate(ctx,capsule.top.map(([x,y])=>[x,-y]),capsule.shade,accent));
  if (closure <= 0) return;
  ctx.save();ctx.globalAlpha *= closure;
  // A small equipment window and bright insignia keep the ability as the focal point.
  plate(ctx,[[-18,-6],[-10,-10],[9,-9],[20,0],[9,9],[-10,10],[-18,6]],'#0a1728',accent);
  for(const side of [-1,1]) line(ctx,[[-26,side*6],[-22,side*10],[-13,side*14]],accent,1);
  if(form.id === 'striker') {
    line(ctx,[[-8,0],[8,0]],core,2);line(ctx,[[0,-6],[0,6]],core,2);
    ctx.strokeStyle=accent;ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.stroke();
  } else if(form.id === 'volt') {
    polygon(ctx,[[-3,-7],[-10,1],[-2,0],[-4,7],[9,-2],[2,-1],[5,-7]]);ctx.fillStyle=core;ctx.fill();
    if(!lowPower) for(const side of [-1,1]) line(ctx,[[9,side*13],[17,side*(9+Math.sin(time*12))],[23,side*13]],accent,1.5);
  } else if(form.id === 'drill') {
    ctx.strokeStyle=core;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.stroke();
    line(ctx,[[-5,-Math.sin(time*18)*5],[5,Math.sin(time*18)*5]],accent,1.5);
    for(const x of [18,23,28]) line(ctx,[[x,-8],[x+3,0],[x,8]],accent,1.5);
  } else if(form.id === 'sphere') {
    line(ctx,[[-9,-2],[-3,-7],[3,-2]],core,2);line(ctx,[[-3,2],[3,7],[9,2]],core,2);
    if(!lowPower) {ctx.strokeStyle=accent;ctx.lineWidth=.8;ctx.beginPath();ctx.arc(0,0,13,time,time+Math.PI*1.3);ctx.stroke();}
  } else {
    plate(ctx,[[-7,-6],[7,-6],[6,3],[0,8],[-6,3]],'#91bcff',core);
    line(ctx,[[-3,0],[0,3],[4,-2]],'#21365c',1.5);
  }
  ctx.restore();
}

export function drawTransformationVehicle(ctx, form, cosmeticId = '', lowPower = false, reducedMotion = false, shipType = 'default') {
  const model = getTransformation(form.id), cosmetic = getCosmetic(cosmeticId);
  const accent = cosmetic?.colors.accent || model.color, core = cosmetic?.colors.core || '#fff3cc';
  const time = reducedMotion ? 0 : form.phase === 'ENTERING' ? Math.max(0, form.transitionTime - 1.1) : form.elapsed + (form.reducedMotion ? 0 : .5);
  ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const opacity = transformationOpacity(form) * (form.phase === 'ENTERING' && !form.reducedMotion ? smooth(form.transitionTime / .25) : 1);
  ctx.globalAlpha = opacity;
  if (form.trail.length) {
    const stride = lowPower ? 3 : 1;
    for (let i = stride; i < form.trail.length; i += stride) {
      const previous = form.trail[i - stride], point = form.trail[i];
      ctx.globalAlpha = opacity * .3 * i / form.trail.length;
      line(ctx, [[previous.x,previous.y],[point.x,point.y]], accent, form.id === 'drill' ? 6 : 10);
    }
    ctx.globalAlpha = opacity;
  }
  if (form.pulse > 0 && !['volt', 'aegis', 'striker'].includes(form.id)) {
    ctx.globalAlpha = opacity * form.pulse / .32;
    ctx.strokeStyle = accent; ctx.lineWidth = 4; ctx.beginPath();
    if (form.id === 'drill') {
      ctx.moveTo(form.x - 45, form.y - 28); ctx.lineTo(form.x + 65, form.y - 28);
      ctx.moveTo(form.x - 45, form.y + 28); ctx.lineTo(form.x + 65, form.y + 28);
    } else ctx.arc(form.x, form.y, 38 + (1 - form.pulse / .32) * 125, 0, Math.PI * 2);
    ctx.stroke(); ctx.globalAlpha = opacity;
  }
  ctx.translate(form.x, form.y);
  const part = (id, draw) => drawPart(ctx, form, id, draw);
  const hull = () => {
    drawTransformationShip(ctx, form, shipType, cosmeticId, lowPower, reducedMotion);
    drawTransformationEnclosure(ctx, form, accent, core, time, lowPower);
  };
  if (form.id === 'striker') {
    for (const side of [-1, 1]) {
      part(side < 0 ? 'wingTop' : 'wingBottom', () => plate(ctx, [[-24,side*13],[-37,side*35],[-7,side*29],[12,side*17]], '#704c48', accent));
      part(side < 0 ? 'boosterTop' : 'boosterBottom', () => {
        plate(ctx,[[-32,side*18-4],[-13,side*18-4],[-8,side*18],[-13,side*18+4],[-32,side*18+4]],'#343e59',accent);
        if(form.phase !== 'ENTERING' || form.transitionTime >= 1.1) line(ctx,[[-34,side*18],[-44-Math.sin(time*18)*3,side*18]],core,3);
      });
    }
    hull();
    for(const y of [-24,24]) part(y < 0 ? 'rackTop' : 'rackBottom', () => {
      plate(ctx,[[-8,y-4],[16,y-4],[24,y],[16,y+4],[-8,y+4]],'#343e59',accent);
      line(ctx,[[-1,y],[16,y]],core,1.5);
    });
    part('nose',()=> {
      for (const y of [-11,11]) {
        line(ctx,[[14,y*.65],[27,y]],accent,2);
        plate(ctx,[[27,y-2],[43,y-2],[49,y],[43,y+2],[27,y+2]],'#704c48',accent);
      }
    });
    if(form.pulse>0) for(const y of [-24,0,24]) line(ctx,[[43,y],[52+form.pulse*40,y]],core,3);
  } else if (form.id === 'volt') {
    for (const side of [-1,1]) part(side < 0 ? 'wingTop' : 'wingBottom',()=> {
      const flex = Math.sin(time*10)*2;
      plate(ctx,[[-22,side*14],[-35,side*(31+flex)],[-9,side*25],[10,side*16]],'#63512c',accent);
      line(ctx,[[-27,side*25],[-14,side*22],[-8,side*18]],core,1.5);
    });
    hull();
    for (const side of [-1,1]) part(side < 0 ? 'nodeTop' : 'nodeBottom',()=> {
      const y = side*20;
      line(ctx,[[1,side*11],[14,y]],accent,2);
      plate(ctx,[[14,y-4],[29,y-4],[35,y],[29,y+4],[14,y+4]],'#63512c',accent);
      ctx.fillStyle=core;ctx.beginPath();ctx.arc(30,y,2.5,0,Math.PI*2);ctx.fill();
    });
  } else if (form.id === 'drill') {
    const drilling = form.dashRemaining > 0, spin = Math.sin(time*(drilling ? 50 : 18));
    for (const y of [-24,24]) part(y < 0 ? 'turbineTop' : 'turbineBottom',()=> {
      line(ctx,[[-16,Math.sign(y)*13],[-16,y]],accent,3);
      plate(ctx,[[-31,y-5],[5,y-5],[13,y],[5,y+5],[-31,y+5]],'#355b72',accent);
      if(form.phase !== 'ENTERING' || form.transitionTime >= 1.1) line(ctx,[[-32,y],[-(drilling ? 52 : 42),y]],drilling ? core : accent,3);
    });
    hull();
    part('mount',()=> {
      for(const side of [-1,1]) plate(ctx,[[15,side*7],[30,side*12],[34,side*9],[22,side*4]],'#446e86',accent);
    });
    for(let i=0;i<3;i++) part(`bit${i}`,()=> {
      const x=30+i*10, height=12-i*3;
      plate(ctx,i===2 ? [[x,-height],[x+10,0],[x,height]] : [[x,-height],[x+10,-height+3],[x+10,height-3],[x,height]],drilling ? '#e6fff8' : '#9ebecb',accent);
      line(ctx,[[x+2,-height+2],[x+6,spin*(height-2)],[x+2,height-2]],'#234b65',1.5);
    });
  } else if (form.id === 'aegis') {
    // Perimeter armour reinforces the capsule without covering its shield insignia.
    for(let i=0;i<6;i++) part(`panel${i}`,()=> {
      const a=i*Math.PI/3-Math.PI/2, b=a+Math.PI/3;
      plate(ctx,[[Math.cos(a)*42,Math.sin(a)*32],[Math.cos(b)*42,Math.sin(b)*32],
        [Math.cos(b)*49,Math.sin(b)*39],[Math.cos(a)*49,Math.sin(a)*39]],'#294b78',accent);
    });
    for(let i=0;i<3;i++) part(`satellite${i}`,()=> {
      const a=time*1.7+i*Math.PI*2/3, x=Math.cos(a)*55,y=Math.sin(a)*46;
      plate(ctx,[[x-3,y-3],[x+3,y-3],[x+3,y+3],[x-3,y+3]],'#516e9b',accent);
    });
    hull();
    if(form.shieldRemaining>0) {
      const points=Array.from({length:6},(_,i)=>{const a=i*Math.PI/3+Math.PI/6;return [Math.cos(a)*63,Math.sin(a)*53];});
      polygon(ctx,points);ctx.strokeStyle=INK;ctx.lineWidth=6;ctx.stroke();ctx.strokeStyle=accent;ctx.lineWidth=2;ctx.stroke();
      if(!lowPower){ctx.beginPath();ctx.arc(0,0,66,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,form.shieldRemaining/2));ctx.stroke();}
    }
  } else {
    // Storm Sphere surrounds the enclosed ship with polarity emitters and an electrical field.
    for(let i=0;i<6;i++) part(`shell${i}`,()=> {
      const a=i*Math.PI/3+.12,b=a+.5;
      plate(ctx,[[Math.cos(a)*37,Math.sin(a)*30],[Math.cos(b)*37,Math.sin(b)*30],
        [Math.cos(b)*43,Math.sin(b)*36],[Math.cos(a)*43,Math.sin(a)*36]],'#27354e',accent);
    });
    for(let i=0;i<3;i++) part(`ring${i}`,()=> {
      ctx.save();ctx.scale(1,.82);ctx.rotate(time*.8);
      const a=i*Math.PI*2/3;
      ctx.strokeStyle=accent;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,47,a,a+1.15);ctx.stroke();ctx.restore();
    });
    hull();
    for(const side of [-1,1]) part(side < 0 ? 'emitterTop' : 'emitterBottom',()=> {
      const y=side*22;
      line(ctx,[[-10,side*13],[-10,y]],accent,2);
      plate(ctx,[[-14,y-3],[2,y-3],[8,y],[2,y+3],[-14,y+3]],'#27354e',accent);
      line(ctx,[[-8,y],[-4,y-3],[0,y+2],[4,y-1]],core,1);
    });
    ctx.globalAlpha*=smooth(form.phase === 'ENTERING' ? form.transitionTime/.25 : 1);
    line(ctx,[[-5,form.gravity*48],[0,form.gravity*53],[5,form.gravity*48]],accent,2);
  }
  if(form.phase === 'EXITING' && form.exitReason === 'collision' && !reducedMotion) {
    const p=transformationProgress(form);
    ctx.save();ctx.globalAlpha*=Math.sin(p*Math.PI);sparks(ctx,lowPower ? 6 : 12,p,core,30);ctx.restore();
  }
  ctx.restore();
}
