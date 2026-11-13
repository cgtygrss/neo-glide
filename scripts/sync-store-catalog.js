import { readFile, writeFile } from 'node:fs/promises';
import { COSMETIC_PRODUCT_IDS, COSMETIC_CREDIT_REFERENCE, CREDIT_PACK_CATALOG, SKIN_PRICE_ROUNDING, COSMETIC_MINIMUM_CREDITS, COSMETIC_SET_CREDIT_OFFSET } from '../backend/shared/store-catalog.js';
import './sync-credit-packs.js';
import { COSMETICS } from '../src/game/CosmeticsCatalog.js';

const root = new URL('../', import.meta.url);
const swiftPath = new URL('ios/App/App/AppDelegate.swift', root);
let swift = await readFile(swiftPath, 'utf8');
swift = swift.replace(/private let cosmeticIDs: Set<String> = \[[^\n]+\]/, `private let cosmeticIDs: Set<String> = [${COSMETIC_PRODUCT_IDS.map(id => `"${id}"`).join(', ')}]`);
swift = swift.replace(/private (?:let|var) productIDs: Set<String>[^\n]+/, `private var productIDs: Set<String> { cosmeticIDs.union([${['remove_ads', 'starter_pack', ...CREDIT_PACK_CATALOG.map(pack => pack.id)].map(id => JSON.stringify(id)).join(', ')}]) }`);
swift = swift.replace(/private let saleProductIDs: Set<String> = \[[^\n]+\]/, 'private var saleProductIDs: Set<String> { productIDs.subtracting(["remove_ads"]) }');
swift = swift.replace(/private let permanentIDs: Set<String> = \[[^\n]+\]/, 'private var permanentIDs: Set<String> { cosmeticIDs.union(["remove_ads", "starter_pack"]) }');
await writeFile(swiftPath, swift);

const javaPath = new URL('android/app/src/main/java/com/cgtygrss/neoglide/NeoGlideStorePlugin.java', root);
const java = await readFile(javaPath, 'utf8');
await writeFile(javaPath, java.replace(/(private static final Set<String> PRODUCT_IDS = Collections.unmodifiableSet\(new LinkedHashSet<>\(Arrays.asList\()\s*[\s\S]*?(\n {4}\)\)\);)/,
  `$1\n${COSMETIC_PRODUCT_IDS.map(id => `        "${id}"`).join(',\n')}$2`));

const fixturePath = new URL('ios/StoreKitTests/NeoGlide.storekit', root);
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
let nextInternalId = Math.max(...fixture.products.map(product => Number(product.internalID))) + 1;
const fixtureSkins = COSMETICS.map(cosmetic => ({
  displayPrice: (cosmetic.usdCents / 100).toFixed(2), familyShareable: false,
  internalID: fixture.products.find(product => product.productID === cosmetic.productId)?.internalID || String(nextInternalId++),
  localizations: [{description: cosmetic.description, displayName: cosmetic.name, locale: 'en_US'}],
  productID: cosmetic.productId, referenceName: cosmetic.name, type: 'NonConsumable',
}));
fixture.products = [...fixture.products.filter(product => !product.productID.startsWith('cosmetic_')), ...fixtureSkins];
await writeFile(fixturePath, JSON.stringify(fixture, null, 2) + '\n');

const reviewPath = new URL('release/1.3.0/metadata/iap-review.json', root);
const existing = JSON.parse(await readFile(reviewPath, 'utf8').catch(error => {
  if (error.code !== 'ENOENT') throw error;
  return readFile(new URL('release/1.2.0/metadata/iap-review.json', root), 'utf8');
}));
const reviews = COSMETICS.map(cosmetic => ({
  ...existing.find(item => item.productId === cosmetic.productId),
  productId: cosmetic.productId, name: cosmetic.name, price: cosmetic.price,
  reviewNotes: `Permanent cosmetic visual kit. Open Garage > Cosmetics > ${cosmetic.name}. ${cosmetic.description} Unlock once with ${cosmetic.creditPrice.toLocaleString('en-US')} earned credits or a native store purchase. ${cosmetic.eventReward ? 'Also earnable from Events. ' : ''}Applies across all ships without changing flight stats. Restore purchases is available in Garage > Store.`,
}));
// Current pack metadata keeps the 1.3 review notes and prices in agreement.
const creditReviews = JSON.parse(await readFile(new URL('release/1.3.0/metadata/credit-packs.json', root), 'utf8')).products;
await writeFile(reviewPath, JSON.stringify([
  ...reviews,
  ...creditReviews.map(({ usdPrice, ...item }) => ({ ...item, price: usdPrice })),
  ...existing.filter(item => !item.productId.startsWith('cosmetic_') && !item.productId.startsWith('credits_')),
], null, 2) + '\n');

const manifest = {
  status: 'Local configuration targets; console registration and pricing must be verified before release.',
  pricingReference: COSMETIC_CREDIT_REFERENCE,
  creditRounding: { direction: 'down', step: SKIN_PRICE_ROUNDING },
  creditPricing: { minimumCosmeticCredits: COSMETIC_MINIMUM_CREDITS, setCreditOffset: COSMETIC_SET_CREDIT_OFFSET,
    standaloneSkin: { shareOfSet: .6, direction: 'down', step: SKIN_PRICE_ROUNDING }, dailySetDiscountPercent: 20 },
  products: reviews.map(item => ({
    productId: item.productId, name: item.name, type: 'non_consumable',
    usdPrice: item.price, creditPrice: COSMETICS.find(cosmetic => cosmetic.productId === item.productId).creditPrice,
    appleId: item.appleId || null, appleAction: item.appleId ? 'verify_existing_product_and_price' : 'create_product_and_set_price',
    googlePlayAction: 'verify_or_create_product_and_set_price',
  })),
};
await writeFile(new URL('release/1.3.0/metadata/store-catalog.json', root), JSON.stringify(manifest, null, 2) + '\n');
const rows = ['product_id,name,type,usd_price,credits'];
for (const item of manifest.products) rows.push([item.productId, item.name, item.type, item.usdPrice.slice(1), item.creditPrice].join(','));
await writeFile(new URL('release/1.3.0/metadata/store-prices.csv', root), rows.join('\n') + '\n');
process.stdout.write(`Synced ${COSMETIC_PRODUCT_IDS.length} skin products across native catalogs and release metadata.\n`);
