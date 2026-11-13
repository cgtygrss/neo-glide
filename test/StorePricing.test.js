import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BEST_VALUE_CREDIT_PACK, COSMETIC_CREDIT_REFERENCE, CREDIT_PACK_CATALOG, COSMETIC_PRICING, COSMETIC_PRODUCT_IDS, SKIN_PRICE_ROUNDING, COSMETIC_SET_CREDIT_OFFSET, skinCreditsForPrice } from '../backend/shared/store-catalog.js';
import { COSMETICS } from '../src/game/CosmeticsCatalog.js';
import { PRODUCTS } from '../src/services/MonetizationService.js';
import { ACCOUNT_KEY, loadWallet, saveWallet, getCosmeticOwnership, markCosmeticPending, unlockCreditCosmetic, grantStoreTransaction, syncStoreSnapshot } from '../src/game/Economy.js';
import { profileStorage } from '../src/account/ProfileStorage.js';

test('set prices preserve tier differences with the new credit offset and pack-sized rounding', () => {
  assert.deepEqual(BEST_VALUE_CREDIT_PACK, {id: 'credits_15000', credits: 1500000, usdCents: 599});
  for (const pack of CREDIT_PACK_CATALOG) {
    assert.ok(BEST_VALUE_CREDIT_PACK.credits / BEST_VALUE_CREDIT_PACK.usdCents >= pack.credits / pack.usdCents);
    const product = PRODUCTS.find(item => item.id === pack.id);
    assert.equal(product.credits, pack.credits);
    assert.equal(product.price, `$${(pack.usdCents / 100).toFixed(2)}`);
  }
  assert.equal(skinCreditsForPrice(799), 3000000);
  const samePrice = new Map();
  for (const skin of COSMETICS) {
    assert.deepEqual(COSMETIC_PRICING[skin.id].productId, skin.productId);
    assert.equal(skin.creditPrice, skinCreditsForPrice(skin.usdCents));
    const referencePrice = Math.round(skin.usdCents * COSMETIC_CREDIT_REFERENCE.credits / COSMETIC_CREDIT_REFERENCE.usdCents / 10000) * 10000;
    const tierPrice = skin.creditPrice - COSMETIC_SET_CREDIT_OFFSET;
    assert.ok(tierPrice <= referencePrice);
    assert.ok(referencePrice - tierPrice < SKIN_PRICE_ROUNDING);
    assert.equal(skin.creditPrice % 250000, 0);
    if (samePrice.has(skin.usdCents)) assert.equal(skin.creditPrice, samePrice.get(skin.usdCents));
    samePrice.set(skin.usdCents, skin.creditPrice);
  }
  const sorted = [...COSMETICS].sort((a, b) => a.usdCents - b.usdCents);
  assert.ok(sorted.every((skin, index) => !index || skin.creditPrice >= sorted[index - 1].creditPrice));
  for (const invalid of [0, -1, NaN, Infinity, 1.2, '799']) assert.throws(() => skinCreditsForPrice(invalid));
});

test('six credit options get cheaper per credit while legacy SKU quantities stay unchanged', async () => {
  assert.deepEqual(CREDIT_PACK_CATALOG.map(pack => [pack.credits,pack.usdCents]), [[50000,49],[100000,79],[250000,149],[550000,299],[1000000,449],[1500000,599]]);
  assert.deepEqual(['credits_1000','credits_5500','credits_15000'].map(id => CREDIT_PACK_CATALOG.find(pack => pack.id === id).credits),[100000,550000,1500000]);
  assert.equal(new Set(CREDIT_PACK_CATALOG.map(pack => pack.id)).size,6);
  for(let i=1;i<CREDIT_PACK_CATALOG.length;i++) {
    const previous=CREDIT_PACK_CATALOG[i-1], current=CREDIT_PACK_CATALOG[i];
    assert.ok(current.credits>previous.credits && current.usdCents>previous.usdCents);
    assert.ok(current.credits*previous.usdCents>previous.credits*current.usdCents,'Larger packs improve value');
  }
  const fixture=JSON.parse(await readFile(new URL('../ios/StoreKitTests/NeoGlide.storekit',import.meta.url),'utf8'));
  const swift=await readFile(new URL('../ios/App/App/AppDelegate.swift',import.meta.url),'utf8');
  const allowed=swift.match(/private var productIDs[^\n]+/)[0];
  const reviews=JSON.parse(await readFile(new URL('../release/1.3.0/metadata/iap-review.json',import.meta.url),'utf8'));
  for(const pack of CREDIT_PACK_CATALOG) {
    assert.ok(allowed.includes(`"${pack.id}"`));
    const product=fixture.products.find(item=>item.productID===pack.id);
    assert.equal(product.type,'Consumable');assert.equal(product.displayPrice,(pack.usdCents/100).toFixed(2));
    const review=reviews.find(item=>item.productId===pack.id);
    assert.equal(review.price,`$${(pack.usdCents/100).toFixed(2)}`);
    assert.ok(review.appleId);
  }
});

test('every verified credit pack delivers its exact quantity once, including repeated independent purchases',()=>{
  for(const [index,pack] of CREDIT_PACK_CATALOG.entries()) {
    const values=new Map();globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};
    saveWallet(77);
    const receipt={transactionId:String(9000+index*2),productId:pack.id,verified:true};
    assert.equal(grantStoreTransaction(receipt).applied,true);assert.equal(grantStoreTransaction(receipt).applied,false);
    assert.equal(loadWallet(),77+pack.credits);
    assert.equal(grantStoreTransaction({...receipt,transactionId:String(9001+index*2)}).applied,true);
    assert.equal(loadWallet(),77+2*pack.credits);
  }
});

test('all skin IDs match iOS, Android and the release price manifest', async () => {
  const swift = await readFile(new URL('../ios/App/App/AppDelegate.swift', import.meta.url), 'utf8');
  const java = await readFile(new URL('../android/app/src/main/java/com/cgtygrss/neoglide/NeoGlideStorePlugin.java', import.meta.url), 'utf8');
  const manifest = JSON.parse(await readFile(new URL('../release/1.3.0/metadata/store-catalog.json', import.meta.url), 'utf8'));
  const fixture = JSON.parse(await readFile(new URL('../ios/StoreKitTests/NeoGlide.storekit', import.meta.url), 'utf8'));
  const idsFrom = value => [...value.matchAll(/"(cosmetic_[a-z_]+)"/g)].map(match => match[1]).sort();
  const expected = [...COSMETIC_PRODUCT_IDS].sort();
  assert.equal(expected.length, 26);
  assert.deepEqual(idsFrom(swift.match(/private let cosmeticIDs[^\n]+/)[0]), expected);
  assert.deepEqual(idsFrom(java.match(/private static final Set<String> PRODUCT_IDS[\s\S]*?\)\)\);/)[0]), expected);
  assert.deepEqual(manifest.products.map(product => product.productId).sort(), expected);
  assert.deepEqual(fixture.products.filter(product => product.productID.startsWith('cosmetic_')).map(product => product.productID).sort(), expected);
  assert.equal(new Set(fixture.products.map(product => product.internalID)).size, fixture.products.length);
  for (const skin of COSMETICS) {
    const product = manifest.products.find(product => product.productId === skin.productId);
    assert.equal(product.creditPrice, skin.creditPrice);
    assert.equal(product.usdPrice, skin.price);
    assert.equal(fixture.products.find(product => product.productID === skin.productId).displayPrice, (skin.usdCents / 100).toFixed(2));
  }
});

test('every skin blocks credits during store approval, grants once, and shares one ownership state', () => {
  for (const [index, skin] of COSMETICS.entries()) {
    const values = new Map();
    globalThis.localStorage = {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value))};
    saveWallet(skin.creditPrice + 77);
    assert.equal(markCosmeticPending(skin.productId), true);
    assert.throws(() => unlockCreditCosmetic(skin.id), /awaiting approval/);
    const receipt = {transactionId: String(8000 + index), productId: skin.productId, verified: true};
    assert.equal(grantStoreTransaction(receipt).applied, true);
    assert.equal(grantStoreTransaction(receipt).applied, false);
    assert.equal(getCosmeticOwnership()[skin.id], true);
    assert.equal(unlockCreditCosmetic(skin.id).unlocked, false);
    assert.equal(markCosmeticPending(skin.productId), false);
    assert.equal(loadWallet(), skin.creditPrice + 77);
    syncStoreSnapshot([skin.productId], []);
    assert.equal(unlockCreditCosmetic(skin.id).unlocked, false);
    assert.equal(loadWallet(), skin.creditPrice + 77);
    // Account-backed native restores keep their verified rights in the cloud
    // field even when the device's entitlement snapshot is empty.
    const record = JSON.parse(profileStorage.getItem(ACCOUNT_KEY));
    record.entitlements = {};
    record.cloudEntitlements = {[skin.productId]: true};
    profileStorage.setItem(ACCOUNT_KEY, JSON.stringify(record));
    syncStoreSnapshot([], [skin.productId]);
    assert.equal(getCosmeticOwnership()[skin.id], true);
    assert.equal(unlockCreditCosmetic(skin.id).unlocked, false);
    assert.equal(markCosmeticPending(skin.productId), false);
    assert.equal(loadWallet(), skin.creditPrice + 77);
  }
});
