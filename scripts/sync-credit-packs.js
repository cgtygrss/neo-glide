import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { CREDIT_PACK_CATALOG, usdPrice } from '../backend/shared/store-catalog.js';

const root = new URL('../', import.meta.url);
const swiftPath = new URL('ios/App/App/AppDelegate.swift', root);
const swift = await readFile(swiftPath, 'utf8');
const productIDs = ['remove_ads', 'starter_pack', ...CREDIT_PACK_CATALOG.map(pack => pack.id)];
await writeFile(swiftPath, swift.replace(/private (?:let|var) productIDs: Set<String>[^\n]+/,
  `private var productIDs: Set<String> { cosmeticIDs.union([${productIDs.map(id => JSON.stringify(id)).join(', ')}]) }`));

const fixturePath = new URL('ios/StoreKitTests/NeoGlide.storekit', root);
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
let nextID = Math.max(...fixture.products.map(product => Number(product.internalID))) + 1;
const packs = CREDIT_PACK_CATALOG.map(pack => ({
  displayPrice: (pack.usdCents / 100).toFixed(2), familyShareable: false,
  internalID: fixture.products.find(product => product.productID === pack.id)?.internalID || String(nextID++),
  localizations: [{ description: `${pack.credits.toLocaleString('en-US')} credits to spend in the Garage.`, displayName: `${pack.credits.toLocaleString('en-US')} Credits`, locale: 'en_US' }],
  productID: pack.id, referenceName: `${pack.credits.toLocaleString('en-US')} Credits`, type: 'Consumable',
}));
fixture.products = [...fixture.products.filter(product => !product.productID.startsWith('credits_')), ...packs];
await writeFile(fixturePath, JSON.stringify(fixture, null, 2) + '\n');

const metadata = new URL('release/1.3.0/metadata/', root);
await mkdir(metadata, { recursive: true });
const previous = JSON.parse(await readFile(new URL('release/1.2.0/metadata/iap-review.json', root), 'utf8'));
const current = await readFile(new URL('credit-packs.json', metadata), 'utf8')
  .then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return { products: [] }; throw error; });
const manifest = {
  status: 'Implementation and local StoreKit targets. App Store Connect status is recorded separately.',
  baseStorefront: 'USA',
  products: CREDIT_PACK_CATALOG.map(pack => ({
    productId: pack.id, name: `${pack.credits.toLocaleString('en-US')} Credits`, type: 'consumable', credits: pack.credits,
    usdPrice: usdPrice(pack.usdCents), appleId: current.products.find(product => product.productId === pack.id)?.appleId
      || previous.find(product => product.productId === pack.id)?.appleId || null,
    description: `${pack.credits.toLocaleString('en-US')} credits to spend in the Garage.`,
    reviewNotes: `Consumable game credits. Open Garage > Store and browse to ${pack.credits.toLocaleString('en-US')} Credits. Each verified purchase delivers exactly ${pack.credits.toLocaleString('en-US')} credits once. Cancellation or pending approval delivers nothing. Existing transaction IDs are idempotent.`,
  })),
};
await writeFile(new URL('credit-packs.json', metadata), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(new URL('credit-pack-prices.csv', metadata), ['product_id,credits,usd_price', ...manifest.products.map(pack => `${pack.productId},${pack.credits},${pack.usdPrice.slice(1)}`)].join('\n') + '\n');
process.stdout.write(`Synced ${packs.length} credit packs across iOS, local StoreKit and release metadata.\n`);
