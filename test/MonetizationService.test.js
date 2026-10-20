import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTS, productsForPlatform, purchaseProduct } from '../src/services/MonetizationService.js';
import { COSMETIC_PRODUCT_IDS } from '../src/game/CosmeticsCatalog.js';

test('ten permanent cosmetics join equipment and credit packs; legacy ad removal is never a new purchase', async () => {
  assert.deepEqual(PRODUCTS.map(product => product.id), ['starter_pack', 'credits_1000', 'credits_5500', 'credits_15000', ...COSMETIC_PRODUCT_IDS]);
  assert.equal(COSMETIC_PRODUCT_IDS.length, 10);
  const expected = { copper_horizon: '$2.99', arctic_pulse: '$3.49', cyber_current: '$3.99', jade_drift: '$4.49', rose_circuit: '$4.99', solar_forge: '$5.99', pearl_comet: '$6.99', void_pilot: '$7.99', cobalt_storm: '$8.99', prism_voyager: '$9.99' };
  const cosmetics = PRODUCTS.filter(product => product.cosmeticId);
  assert.deepEqual(Object.fromEntries(cosmetics.map(product => [product.cosmeticId, product.price])), expected);
  assert.ok(cosmetics.every(product => product.type === 'non_consumable'));
  assert.equal(PRODUCTS.some(product => /ad.free|removes.*ads|forced ads/i.test(product.description)), false);
  await assert.rejects(purchaseProduct('remove_ads'), /Unknown product/);
});

test('Android store exposes cosmetics only while iOS and web retain the full catalog', () => {
  assert.deepEqual(productsForPlatform('android').map(product => product.id), COSMETIC_PRODUCT_IDS);
  assert.equal(productsForPlatform('ios').length, PRODUCTS.length);
  assert.equal(productsForPlatform('web').length, PRODUCTS.length);
});
