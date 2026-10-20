import test from "node:test";
import assert from "node:assert/strict";
import { SHIPS, getShip } from "../src/game/ShipCatalog.js";
import { COSMETICS } from "../src/game/CosmeticsCatalog.js";
import { drawShipArt } from "../src/game/ShipArt.js";

let allocations = 0;
globalThis.Path2D = class {
  constructor(d) {
    this.d = d;
    allocations++;
  }
};
class DrawingContext {
  constructor(alpha = 1) {
    this.globalAlpha = alpha;
    this.stack = [];
    this.draws = [];
  }
  save() {
    this.stack.push({ alpha: this.globalAlpha });
  }
  restore() {
    this.globalAlpha = this.stack.pop().alpha;
  }
  translate() {}
  scale() {}
  beginPath() {}
  moveTo() {}
  lineTo() {}
  quadraticCurveTo() {}
  closePath() {}
  arc() {}
  fillRect() { this.draws.push({ alpha: this.globalAlpha, color: this.fillStyle }); }
  fill(path) {
    this.draws.push({ path, alpha: this.globalAlpha, color: this.fillStyle });
  }
  stroke(path) {
    this.draws.push({ path, alpha: this.globalAlpha, color: this.strokeStyle });
  }
}

test("saved ship IDs remain compatible with the new progression prices", () => {
  assert.deepEqual(
    SHIPS.map((ship) => [ship.id, ship.cost]),
    [
      ["default", 0],
      ["interceptor", 60000],
      ["cruiser", 180000],
      ["stealth", 400000],
      ["void_runner", 900000],
      ["plasma_breaker", 1800000],
    ],
  );
  assert.equal(getShip("retired-or-invalid-save-id").id, "default");
});

test("repeated flight frames reuse cached paths across idle and boost", () => {
  const ctx = new DrawingContext();
  drawShipArt(ctx, "interceptor", { boosting: false, time: 0 });
  const warmAllocations = allocations;
  for (let frame = 1; frame <= 120; frame++)
    drawShipArt(ctx, "interceptor", {
      boosting: frame % 2 === 0,
      time: frame / 60,
    });
  assert.equal(allocations, warmAllocations);
  assert.equal(ctx.stack.length, 0);
});

test("every model draws its catalog hull and keeps ghost transparency intact", () => {
  for (const ship of SHIPS) {
    const ctx = new DrawingContext(0.6);
    drawShipArt(ctx, ship.id, { boosting: true, time: 2 });
    const drawnPaths = new Set(ctx.draws.filter((draw) => draw.path).map((draw) => draw.path.d));
    for (const part of ship.parts)
      assert.ok(drawnPaths.has(part.d), `${ship.id}: missing hull part`);
    assert.ok(
      ctx.draws.every((draw) => draw.alpha <= 0.6),
      `${ship.id}: boost must not cancel ghost mode`,
    );
    assert.equal(ctx.globalAlpha, 0.6);
    assert.equal(ctx.stack.length, 0);
  }
});


test("themed plumes retain all hull parts, inherited transparency, and catalog data", () => {
  const catalogBefore = structuredClone(SHIPS);
  for (const ship of SHIPS) for (const cosmetic of COSMETICS) {
    const ctx = new DrawingContext(0.37);
    drawShipArt(ctx, ship.id, { boosting: true, time: 1.25, cosmeticId: cosmetic.id });
    const paths = new Set(ctx.draws.filter((draw) => draw.path).map((draw) => draw.path.d));
    for (const part of ship.parts) assert.ok(paths.has(part.d), `${ship.id}/${cosmetic.id}: missing hull part`);
    assert.ok(ctx.draws.some((draw) => !draw.path), `${ship.id}/${cosmetic.id}: themed plume is drawn`);
    assert.ok(ctx.draws.every((draw) => draw.alpha <= 0.37), `${ship.id}/${cosmetic.id}: inherited transparency`);
    assert.equal(ctx.globalAlpha, 0.37);
    assert.equal(ctx.stack.length, 0);
  }
  assert.deepEqual(SHIPS, catalogBefore, "rendering does not change geometry or ship data");
});
