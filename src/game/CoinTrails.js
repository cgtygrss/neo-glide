import { Collectible } from './Entities.js';
import { coinMultiplier } from './Economy.js';

const GAPS = [1100, 1400, 1200, 1500];
const SHAPES = [[0, 0, 0, 0, 0], [1, .5, 0, -.5, -1], [0, -.7, -1, -.7, 0], [-1, -.5, 0, .5, 1]];
export const createCoinTrailState = () => ({ travel: 0, nextAt: 300, index: 0 });

export function trailValues(index) {
  const number = index + 1;
  if (number % 12 === 0) return [250, 500, 10000, 500, 250];
  if (number % 4 === 0) return [100, 250, 500, 250, 100];
  return [50, 100, 250, 100, 50];
}

export function buildCoinTrail(index, width, height, overshoot = 0, obstacles = []) {
  const values = trailValues(index);
  const shape = SHAPES[index % SHAPES.length];
  // Leave room for the maximum 100px edge obstacles and the largest coin.
  const margin = Math.min(140, height / 2);
  const center = height / 2;
  const amplitude = Math.max(0, Math.min(30, (height - margin * 2) / 2));
  for (const shift of [0, -amplitude / 2, amplitude / 2]) {
    const coins = values.map((value, i) => new Collectible(
      width + 36 + i * 54 - overshoot,
      Math.max(margin, Math.min(height - margin, center + shape[i] * amplitude + shift)), value,
    ));
    const blocked = coins.some(coin => obstacles.some(obs => !obs.markedForDeletion &&
      coin.x + coin.radius + 20 > obs.x && coin.x - coin.radius - 20 < obs.x + obs.width &&
      coin.y + coin.radius + 20 > obs.y && coin.y - coin.radius - 20 < obs.y + obs.height));
    if (!blocked) return coins;
  }
  return [];
}

export function advanceCoinTrails(state, scrollDistance, width, height, obstacles = []) {
  state.travel += Math.max(0, scrollDistance);
  if (state.travel < state.nextAt) return [];
  const overshoot = state.travel - state.nextAt;
  const coins = buildCoinTrail(state.index, width, height, overshoot, obstacles);
  if (!coins.length) {
    state.nextAt = state.travel + 80;
    return [];
  }
  state.nextAt += GAPS[state.index % GAPS.length];
  state.index++;
  return coins;
}

export function collectCoin(game, coin, multiplierLevel = 1) {
  if (coin.markedForDeletion) return 0;
  coin.markedForDeletion = true;
  game.combo = (game.combo || 0) + 1;
  game.comboTimer = 2.2;
  const comboMultiplier = Math.min(2, 1 + Math.floor(game.combo / 10) * .25);
  const amount = Math.floor(coin.value * coinMultiplier(multiplierLevel) * comboMultiplier);
  game.sessionCurrency = (game.sessionCurrency || 0) + amount;
  return amount;
}
