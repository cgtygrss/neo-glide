import test from 'node:test';
import assert from 'node:assert/strict';
import { displayPriceAmount, sortCatalogByPrice, sortStoreProducts } from '../src/game/CatalogSorting.js';
import { COSMETICS, cosmeticsInCollection } from '../src/game/CosmeticsCatalog.js';
import { UPGRADES, upgradeOffer } from '../src/game/ShopCatalog.js';
import { getStoreProducts } from '../src/services/MonetizationService.js';

test('localized store prices sort numerically across decimal and grouping formats', () => {
  for (const [label, amount] of [['$9.99', 9.99], ['₺129,99', 129.99], ['1.299,99 TL', 1299.99], ['$1,299.99', 1299.99], ['1\u202f299,99 €', 1299.99], ['¥1,299', 1299], ['٩٫٩٩ ر.س', 9.99], ['۱۲۹٫۹۹', 129.99], [0, 0], ['$0.00', 0]]) {
    assert.equal(displayPriceAmount(label), amount, String(label));
  }
  for (const missing of ['', null, undefined, 'Unavailable', NaN]) assert.equal(displayPriceAmount(missing), Infinity);
});

test('store amounts take priority over labels, credit styles have their own ascending group, and ties stay stable', () => {
  const products = Object.freeze([
    Object.freeze({ id: 'credit-high', acquisition: 'credits', creditPrice: 1000 }),
    Object.freeze({ id: 'expensive', price: '₺9,99', priceAmount: 10 }),
    Object.freeze({ id: 'cheap', price: '₺99,99', priceAmount: 2 }),
    Object.freeze({ id: 'same-price', price: '$2.00' }),
    Object.freeze({ id: 'credit-low', acquisition: 'credits', creditPrice: 100 }),
    Object.freeze({ id: 'unknown', price: '' }),
  ]);
  assert.deepEqual(sortStoreProducts(products).map(item => item.id), ['cheap', 'same-price', 'expensive', 'unknown', 'credit-low', 'credit-high']);
  assert.equal(products[0].id, 'credit-high');
});

test('collections use credit prices and upgrade order follows the current purchase level', () => {
  const styles = sortCatalogByPrice(COSMETICS);
  assert.equal(styles[0].id, 'mint_condition');
  assert.equal(styles.at(-1).id, 'prism_voyager');
  const showpieces = sortCatalogByPrice(cosmeticsInCollection(COSMETICS, 'showpieces'));
  assert.deepEqual(showpieces.map(item => item.id), ['pearl_comet', 'void_pilot', 'cobalt_storm', 'prism_voyager']);
  const upgrades = Object.freeze({ battery: 6 });
  const items = sortCatalogByPrice(UPGRADES, item => upgradeOffer(item.id, upgrades).cost);
  assert.ok(items.findIndex(item => item.id === 'battery') > items.findIndex(item => item.id === 'hull'));
  assert.equal(UPGRADES[0].id, 'battery', 'canonical catalog remains unchanged');
});

test('unavailable products retain numeric catalog prices rather than sorting as free items', () => {
  const products = getStoreProducts();
  assert.ok(products.every(product => Number.isFinite(product.priceAmount) && product.priceAmount > 0));
  const sorted = sortStoreProducts(products);
  assert.equal(sorted[0].id, 'credits_50000');
  assert.equal(sorted.at(-1).id, 'cosmetic_prism_voyager');
});
