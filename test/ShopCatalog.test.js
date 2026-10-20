import test from 'node:test';
import assert from 'node:assert/strict';
import { UPGRADES, WEAPONS, upgradeOffer, weaponDetails } from '../src/game/ShopCatalog.js';
import { PlayerProjectile, Player } from '../src/game/Entities.js';

test('every upgrade preview matches the existing purchase result, price and gameplay formulas', () => {
  for (const item of UPGRADES) for (const stored of [undefined, 2, 5]) {
    const upgrades = stored === undefined ? {} : {[item.id]:stored};
    const offer = upgradeOffer(item.id,upgrades,'cruiser',11);
    const next = item.id === 'multiplier' && stored >= 5 ? stored : (stored || 1) + 1;
    assert.equal(offer.nextLevel,next);
    assert.equal(offer.cost,Math.floor(item.cost*1.5**((stored||1)-1)));
    const actualNext = {
      battery:100+(next-1)*20+20,
      thruster:Math.abs(new Player(next).lift),
      magnet:50+next*20,
      hull:100+(next-1)*20+40+40,
      multiplier:Math.min(2, 1 + .25 * (next - 1)),
      shield_gen:next,
    };
    assert.equal(offer.after,actualNext[item.id]);
  }
  assert.equal(upgradeOffer('shield_gen',{}).before,0);
  assert.equal(upgradeOffer('shield_gen',{}).after,2);
  assert.equal(upgradeOffer('battery',{},'default',2).beforeLabel,'10.2s');
});

test('all six weapon previews use real damage, speed and ammo without modifying saved inputs', () => {
  const inputs = Object.freeze({ battery:2, hull:3 });
  for(const item of WEAPONS) {
    const actual=new PlayerProjectile(0,0,item.id), preview=weaponDetails(item.id);
    assert.equal(preview.damage,actual.damage);
    assert.equal(preview.speed,actual.speed);
    assert.equal(preview.ammo,1);
  }
  for(const item of UPGRADES) upgradeOffer(item.id,inputs,'default',3);
  assert.deepEqual(inputs,{battery:2,hull:3});
});

test('maximum multiplier offers stop selling upgrades and preserve old saved levels', () => {
  for (const level of [5, 12, 100]) {
    const upgrades = Object.freeze({ multiplier: level });
    const offer = upgradeOffer('multiplier', upgrades);
    assert.equal(offer.maxed, true);
    assert.equal(offer.nextLevel, level);
    assert.equal(offer.beforeLabel, '2×');
    assert.equal(offer.afterLabel, '2×');
    assert.equal(upgrades.multiplier, level);
  }
  const offer = upgradeOffer('multiplier', { multiplier: 4 });
  assert.equal(offer.maxed, false);
  assert.equal(offer.afterLabel, '2×');
});
