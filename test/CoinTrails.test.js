import test from 'node:test';
import assert from 'node:assert/strict';
import { Collectible } from '../src/game/Entities.js';
import { createCoinTrailState, trailValues, buildCoinTrail, advanceCoinTrails, collectCoin } from '../src/game/CoinTrails.js';

function simulate(fps, slow = 1) {
  const state = createCoinTrailState(), coins = [];
  const speed = 320 * slow;
  let remaining = 6145;
  while (remaining > 1e-7) {
    const scroll = Math.min(speed / fps, remaining);
    for (const coin of coins) coin.update(scroll / speed, speed);
    coins.push(...advanceCoinTrails(state, scroll, 844, 390));
    remaining -= scroll;
  }
  return { state, coins };
}

test('coin trails keep their sequence, spacing and positions across frame rates and Time Slow', () => {
  const reference = simulate(60);
  for (const [fps, slow] of [[30, 1], [120, 1], [60, .5]]) {
    const actual = simulate(fps, slow);
    assert.equal(actual.state.index, reference.state.index);
    assert.deepEqual(actual.coins.map(c => c.value), reference.coins.map(c => c.value));
    actual.coins.forEach((coin, i) => {
      assert.ok(Math.abs(coin.x - reference.coins[i].x) < .00001);
      assert.equal(coin.y, reference.coins[i].y);
    });
  }
  const state = createCoinTrailState();
  assert.deepEqual(advanceCoinTrails(state, 299, 844, 390), []);
  const coins = advanceCoinTrails(state, 1, 844, 390);
  assert.equal(coins.length, 5);
  assert.equal(coins[1].x - coins[0].x, 54);
  assert.deepEqual(advanceCoinTrails(state, 0, 844, 390), []);
  assert.ok(state.nextAt - state.travel - 216 >= 800);
  assert.deepEqual(createCoinTrailState(), { travel: 0, nextAt: 300, index: 0 });
});

test('small coin trails reserve a single 10000-credit prize for every twelfth trail', () => {
  const firstForty = Array.from({ length: 40 }, (_, i) => trailValues(i));
  assert.deepEqual(firstForty[0], [50, 100, 250, 100, 50]);
  assert.deepEqual(firstForty[3], [100, 250, 500, 250, 100]);
  assert.deepEqual(firstForty[11], [250, 500, 10000, 500, 250]);
  for (const [i, values] of firstForty.entries()) {
    assert.equal(values.filter(value => value === 10000).length, (i + 1) % 12 === 0 ? 1 : 0);
    assert.equal(values.reduce((a, b) => a + b), (i + 1) % 12 === 0 ? 11500 : (i + 1) % 4 === 0 ? 1200 : 550);
  }
  assert.deepEqual([...new Set(firstForty.flat())].sort((a,b) => a-b), [50, 100, 250, 500, 10000]);
});

test('patterns stay clear of maximum edge obstacles and defer a blocked corridor', () => {
  for (const [width, height] of [[844, 390], [640, 280], [390, 844], [1280, 720]]) {
    for (let i = 0; i < 40; i++) {
      const obstacles = [{ x: width, y: 0, width: 400, height: 100 }, { x: width, y: height - 100, width: 400, height: 100 }];
      const coins = buildCoinTrail(i, width, height, 0, obstacles);
      assert.equal(coins.length, 5);
      for (const coin of coins) {
        assert.ok(coin.y - coin.radius - 20 > 100);
        assert.ok(coin.y + coin.radius + 20 < height - 100);
      }
    }
  }
  const state = createCoinTrailState();
  const blocked = [{ x: 800, y: 0, width: 400, height: 390 }];
  assert.deepEqual(advanceCoinTrails(state, 300, 844, 390, blocked), []);
  assert.equal(state.index, 0);
  assert.equal(advanceCoinTrails(state, 80, 844, 390).length, 5);
});

test('face value, purchased multiplier and combo are paid exactly once', () => {
  for (const value of [50, 100, 250, 500, 10000]) {
    const game = { combo: 9, sessionCurrency: 20 };
    const coin = new Collectible(100, 150, value);
    const amount = Math.floor(value * 1.5 * 1.25);
    assert.equal(collectCoin(game, coin, 3), amount);
    assert.equal(game.sessionCurrency, 20 + amount);
    assert.equal(game.combo, 10);
    assert.equal(collectCoin(game, coin, 3), 0);
    assert.equal(game.sessionCurrency, 20 + amount);
    assert.equal(game.combo, 10);
  }
  assert.equal(new Collectible(0, 0).value, 50);
  assert.equal(new Collectible(0, 0, -100).value, 50);
});

test('scrolling preserves authored heights and magnet displacement', () => {
  const coin = new Collectible(200, 150, 10000);
  coin.y -= 23;
  coin.x -= 17;
  coin.update(.1, 320);
  assert.equal(coin.y, 127);
  assert.equal(coin.x, 151);
});


test('long combo earnings cap at twice the face value before purchased multipliers', () => {
 const game={combo:999,sessionCurrency:0};
 assert.equal(collectCoin(game,new Collectible(100,150,10000),3),30000);
 assert.equal(collectCoin(game,new Collectible(100,150,10000),1000),40000);
});

test('twelve fully collected trails respect the payout cap even with maximum upgrades and combos', () => {
  const game = { combo: 999, sessionCurrency: 0 };
  const values = Array.from({ length: 12 }, (_, i) => trailValues(i)).flat();
  assert.equal(values.reduce((sum, value) => sum + value, 0), 18850);
  for (const value of values) collectCoin(game, new Collectible(0, 0, value), 1000);
  assert.equal(game.sessionCurrency, 75400);
});
