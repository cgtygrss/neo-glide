import test from 'node:test';
import assert from 'node:assert/strict';
import { ShipFlightDemo, FLIGHT_DEMO_BOUNDS } from '../src/game/ShipFlightDemo.js';

test('a local ship demo repeatedly boosts and glides within its visible bounds', () => {
  for (const level of [1, 3, 10]) {
    const demo=new ShipFlightDemo(level), phases=new Set();
    let top=Infinity,bottom=-Infinity;
    for(let frame=0;frame<60*60;frame++) {
      demo.advance(1/60);
      phases.add(demo.player.isBoosting);
      top=Math.min(top,demo.player.y);bottom=Math.max(bottom,demo.player.y);
      assert.ok(demo.player.y>=FLIGHT_DEMO_BOUNDS.top && demo.player.y<=FLIGHT_DEMO_BOUNDS.bottom);
      assert.ok(Number.isFinite(demo.player.rotation));
    }
    assert.equal(phases.size,2);
    assert.ok(bottom-top>25);
    assert.ok(demo.scroll>7000);
  }
});

test('demo timing is independent of display refresh and pause does not advance it', () => {
  const demos=[30,60,120].map(fps=>{
    const demo=new ShipFlightDemo();for(let frame=0;frame<fps*8;frame++)demo.advance(1/fps);return demo;
  });
  for(const demo of demos) {
    assert.ok(Math.abs(demo.player.y-demos[0].player.y)<1e-7);
    assert.ok(Math.abs(demo.scroll-demos[0].scroll)<1e-7);
    const before={y:demo.player.y,velocity:demo.player.velocity,scroll:demo.scroll};
    demo.advance(0);
    assert.deepEqual({y:demo.player.y,velocity:demo.player.velocity,scroll:demo.scroll},before);
  }
});
