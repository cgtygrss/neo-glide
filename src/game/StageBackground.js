import { getStage } from './StageCatalog.js';

// All coordinates are normalized; gradients are cached per canvas, size and destination.
export class StageBackground {
  constructor() { this.cache = null; }
  reset() { this.cache = null; }
  draw(ctx, id, width, height, time = 0, travel = 0, lowPower = false) {
    const stage = getStage(id);
    if (!width || !height) return;
    if (!this.cache || this.cache.ctx !== ctx || this.cache.id !== stage.id || this.cache.width !== width || this.cache.height !== height) {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, stage.colors[0]); gradient.addColorStop(1, stage.colors[1]);
      const haze = ctx.createRadialGradient(width * .72, height * .55, 0, width * .72, height * .55, width * .48);
      haze.addColorStop(0, stage.colors[2] + '55'); haze.addColorStop(1, stage.colors[0] + '00');
      this.cache = { ctx, id: stage.id, width, height, gradient, haze };
    }
    ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0; ctx.fillStyle = this.cache.gradient; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = this.cache.haze; ctx.fillRect(0, 0, width, height);
    ctx.scale(width, height); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const [dark, mid, light] = stage.colors;
    const drift = Math.sin(time * .22) * .012, parallax = travel * .000015;
    ctx.fillStyle = light; ctx.globalAlpha = .55;
    const count = lowPower ? 18 : 36;
    for (let i = 0; i < count; i++) {
      const x = ((i * .61803398875 + .13 - parallax) % 1 + 1) % 1, y = (i * .381966 + .08) % .74;
      const size = i % 9 === 0 ? .0045 : i % 3 === 0 ? .0032 : .0018;
      ctx.fillRect(x, y, size, size * 1.5);
      if (i % 9 === 0 && !lowPower) ctx.fillRect(x - size, y + size * .5, size * 3, .0015);
    }
    ctx.globalAlpha = .35; ctx.strokeStyle = light; ctx.fillStyle = mid; ctx.lineWidth = .006;
    const line = (points, close = false, fill = false) => { ctx.beginPath(); ctx.moveTo(...points[0]); for (const p of points.slice(1)) ctx.lineTo(...p); if (close) ctx.closePath(); if (fill) ctx.fill(); else ctx.stroke(); };
    const ring = (x,y,rx,ry,rotation=0) => { ctx.beginPath(); ctx.ellipse(x,y,rx,ry,rotation,0,Math.PI*2); ctx.stroke(); };
    switch (stage.id) {
      case 'andromeda':
        ctx.globalAlpha=.14; ctx.fillStyle=light; ctx.beginPath(); ctx.arc(.72,.68,.28,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha=.32; ctx.beginPath(); ctx.arc(.72,.68,.22,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha=.22; ctx.fillStyle=dark; ctx.beginPath(); ctx.arc(.76,.72,.18,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha=.45; for(let i=0;i<4;i++) line([[.48+i*.018,.79+i*.035],[.96-i*.02,.79+i*.035]]);
        ctx.globalAlpha=.16; ctx.fillStyle=light; line([[0,.94],[.25,.88],[.5,.94],[.72,.86],[1,.94],[1,1],[0,1]],true,true); break;
      case 'triangulum':
        for(let i=0;i<7;i++) { const x=i*.18-.1, tip=.53+(i%3)*.07;
          ctx.globalAlpha=.3; ctx.fillStyle=mid; line([[x,.99],[x+.08,tip],[x+.16,.99]],true,true);
          ctx.globalAlpha=.22; ctx.fillStyle=light; line([[x+.08,tip],[x+.08,.98],[x+.16,.99]],true,true);
          ctx.globalAlpha=.55; ctx.strokeStyle=light; ctx.lineWidth=.002; line([[x+.02,.94],[x+.08,tip],[x+.12,.8]]);
        } break;
      case 'whirlpool':
        ctx.globalAlpha=.16;ctx.fillStyle=light;ctx.beginPath();ctx.arc(.72,.65,.2,0,Math.PI*2);ctx.fill();
        for(let i=0;i<5;i++) {ctx.globalAlpha=.16+i*.07;ctx.lineWidth=.012-i*.0015;ctx.beginPath();ctx.ellipse(.72,.65,.35-i*.055,.19-i*.027,-.25+i*.12,0,Math.PI*1.6);ctx.stroke();}
        ctx.globalAlpha=.28;ring(.75,.62,.13,.045,-.3);break;
      case 'sunflower':
        ctx.globalAlpha=.14;ctx.fillStyle=light;ctx.beginPath();ctx.arc(.77,.72,.24,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.35;
        ctx.fillStyle=light; ctx.beginPath(); ctx.arc(.77,.72,.15,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha=.22;ctx.fillStyle=dark;ctx.beginPath();ctx.arc(.8,.75,.1,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.35;
        for(let i=0;i<16;i++){const a=i*Math.PI/8+drift;line([[.77+Math.cos(a)*.17,.72+Math.sin(a)*.17],[.77+Math.cos(a)*.26,.72+Math.sin(a)*.26]]);} break;
      case 'black_eye':
        ctx.globalAlpha=.13;ctx.fillStyle=light;ctx.beginPath();ctx.arc(.73,.63,.28,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=dark;ctx.globalAlpha=.85;ctx.beginPath();ctx.arc(.73,.63,.2,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.6;ring(.73,.63,.21,.21);ring(.73,.63,.26,.08,-.25);ctx.globalAlpha=.22;ring(.73,.63,.31,.1,-.25);break;
      case 'sombrero':
        ring(.7,.54,.4,.08,-.12);ring(.7,.54,.32,.05,-.12);ctx.globalAlpha=.15;ctx.fillStyle=light;ctx.beginPath();ctx.arc(.7,.54,.1,0,Math.PI*2);ctx.fill();
        ctx.globalAlpha=.35;ctx.fillStyle=mid;line([[0,1],[.17,.83],[.34,.92],[.55,.76],[.78,.92],[1,.8],[1,1]],true,true);
        ctx.globalAlpha=.2;ctx.strokeStyle=light;line([[0,.97],[.17,.88],[.34,.96],[.55,.82],[.78,.97],[1,.86]]);break;
      case 'cartwheel':
        ctx.globalAlpha=.12;ctx.fillStyle=light;ctx.beginPath();ctx.arc(.73,.6,.3,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.35;
        ring(.73,.6,.28,.28);ring(.73,.6,.18,.18);ring(.73,.6,.08,.08);
        for(let i=0;i<8;i++){const a=i*Math.PI/4+drift;line([[.73+Math.cos(a)*.18,.6+Math.sin(a)*.18],[.73+Math.cos(a)*.28,.6+Math.sin(a)*.28]]);}break;
      case 'centaurus_a':
        ctx.globalAlpha=.17;ctx.fillStyle=light;ctx.beginPath();ctx.arc(.76,.63,.24,0,Math.PI*2);ctx.fill();
        ctx.globalAlpha=.45;ctx.fillStyle=mid;ctx.beginPath();ctx.arc(.76,.63,.17,0,Math.PI*2);ctx.fill();
        ctx.globalAlpha=.26;ctx.strokeStyle=dark;ring(.72,.59,.035,.018);ring(.8,.68,.045,.022);
        ctx.globalAlpha=.55;ctx.fillStyle=dark;line([[0,1],[.12,.73],[.24,.92],[.4,.67],[.58,.94],[.75,.7],[1,1]],true,true);
        ctx.strokeStyle=light;ctx.lineWidth=.01;line([[.12,1],[.21,.84],[.3,.95],[.37,.81],[.46,1]]);line([[.61,1],[.7,.81],[.77,.94],[.84,.85],[.92,1]]);
        ctx.globalAlpha=.28;ctx.lineWidth=.025;line([[.18,1],[.25,.9],[.31,.96]]);break;
      case 'bode':
        for(let i=0;i<4;i++){ctx.globalAlpha=.12;ctx.lineWidth=.055;ctx.beginPath();ctx.moveTo(-.1,.17+i*.07);ctx.bezierCurveTo(.25,.05+drift,.45,.42+i*.06,.85,.18+i*.06);ctx.stroke();
          ctx.globalAlpha=.3;ctx.lineWidth=.008;ctx.beginPath();ctx.moveTo(-.1,.17+i*.07);ctx.bezierCurveTo(.25,.05+drift,.45,.42+i*.06,.85,.18+i*.06);ctx.stroke();}
        ctx.fillStyle=mid;line([[0,1],[.18,.79],[.35,.94],[.55,.76],[.8,.9],[1,.75],[1,1]],true,true);break;
      case 'pinwheel':
        ctx.globalAlpha=.14;ctx.fillStyle=light;ctx.beginPath();ctx.arc(.72,.58,.25,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.4;
        for(let arm=0;arm<3;arm++){ctx.strokeStyle=[light,'#72e5e4','#f69bcf'][arm];ctx.beginPath();for(let i=0;i<28;i++){const a=i*.2+arm*Math.PI*2/3+drift, r=i*.009;const x=.72+Math.cos(a)*r,y=.58+Math.sin(a)*r;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();}break;
      default: ring(.76,.6,.24,.12,-.3);
    }
    ctx.restore();
  }
}
