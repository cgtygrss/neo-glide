import test from 'node:test';
import assert from 'node:assert/strict';
import { drawEnemyArt } from '../src/game/EnemyArt.js';
import { Renderer } from '../src/game/Renderer.js';
import { Villain, SpeedsterVillain, JuggernautVillain } from '../src/game/Entities.js';

let allocations=0;
globalThis.Path2D=class { constructor(data) { this.data=data; allocations++; } };
class Context {
  constructor() { this.globalAlpha=.3; this.globalCompositeOperation='lighter'; this.shadowBlur=12; this.stack=[]; this.draws=[]; this.gradients=0; }
  save() { this.stack.push({globalAlpha:this.globalAlpha,globalCompositeOperation:this.globalCompositeOperation,shadowBlur:this.shadowBlur}); }
  restore() { Object.assign(this,this.stack.pop()); }
  createLinearGradient() { this.gradients++; return {addColorStop(){}}; }
  fill(path) { this.draws.push({path,color:this.fillStyle,alpha:this.globalAlpha,blend:this.globalCompositeOperation,blur:this.shadowBlur}); }
  stroke() {} scale() {} translate() {} beginPath() {} arc() {} moveTo() {} lineTo() {}
  fillRect() { this.fill(); }
}
const ships=()=>[new Villain(400,200),new SpeedsterVillain(400,200),new JuggernautVillain(400,200)];

test('detailed enemy hulls remain opaque, fit existing hull sizes and never mutate gameplay state',()=>{
  const signatures=[];
  for (const enemy of ships()) {
    const ctx=new Context(), original=structuredClone(enemy);
    drawEnemyArt(ctx,enemy);
    assert.deepEqual({...enemy},original);
    assert.ok(ctx.draws.length>15 && ctx.draws.length<90);
    assert.ok(ctx.draws.every(draw=>draw.alpha===1 && draw.blend==='source-over' && draw.blur===0));
    assert.equal(ctx.stack.length,0); assert.equal(ctx.globalAlpha,.3); assert.equal(ctx.globalCompositeOperation,'lighter'); assert.equal(ctx.shadowBlur,12);
    const paths=ctx.draws.filter(draw=>draw.path).map(draw=>draw.path.data);
    signatures.push(JSON.stringify(paths));
    for (const data of paths) {
      const coordinates=data.match(/-?\d*\.?\d+/g).map(Number);
      for (let i=0;i<coordinates.length;i+=2) {
        assert.ok(Math.abs(coordinates[i])<=enemy.width/2);
        assert.ok(Math.abs(coordinates[i+1])<=enemy.height/2);
      }
    }
  }
  assert.equal(new Set(signatures).size,3);
});

test('warm enemy rendering reuses geometry and gradients during flight, charge, hit and low-power frames',()=>{
  const ctx=new Context(), enemies=ships();
  for (const enemy of enemies) drawEnemyArt(ctx,enemy);
  const warmPaths=allocations, warmGradients=ctx.gradients;
  for (let frame=0;frame<120;frame++) for (const enemy of enemies) {
    enemy.oscillation=frame/30; enemy.attackWarning=frame%2?.8:0; enemy.hitFlashTimer=frame%3?.1:0;
    enemy.dashState=frame%2?'DASHING':'IDLE';
    drawEnemyArt(ctx,enemy,{lowPower:frame%2===0});
  }
  assert.equal(allocations,warmPaths); assert.equal(ctx.gradients,warmGradients);
  const other=new Context(); drawEnemyArt(other,enemies[0]);
  assert.ok(other.gradients>0,'Paint belongs to its canvas context');
  assert.equal(allocations,warmPaths,'Paths are reusable across canvases');
});

test('the integrated enemy renderer preserves effects state and draws the complete hull and health bar',()=>{
  const renderer=Object.create(Renderer.prototype);
  renderer.ctx=new Context();
  for (const enemy of ships()) {
    enemy.attackWarning=.8;
    const original=structuredClone(enemy);
    renderer.drawVillain(enemy);
    assert.deepEqual({...enemy},original);
  }
  assert.ok(renderer.ctx.draws.every(draw=>draw.alpha===1 && draw.blend==='source-over' && draw.blur===0));
  assert.equal(renderer.ctx.globalAlpha,.3); assert.equal(renderer.ctx.stack.length,0);
});
