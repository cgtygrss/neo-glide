import test from 'node:test';
import assert from 'node:assert/strict';
import { COSMETICS, SKINS, getCosmetic, getCosmeticEffects, getCosmeticPalette } from '../src/game/CosmeticsCatalog.js';
import { getCosmeticDesign, getCosmeticSurface } from '../src/game/CosmeticDesigns.js';
import { SHIPS } from '../src/game/ShipCatalog.js';
import { cosmeticCreditOffer, dailySetOffer, garageRotationWindow } from '../src/game/GarageOffers.js';
import { ACCOUNT_KEY, saveWallet, loadWallet, getCosmeticOwnership, unlockCreditCosmetic, markCosmeticPending, beginCosmeticPurchase, endCosmeticPurchase, grantStoreTransaction, syncStoreSnapshot } from '../src/game/Economy.js';
import { profileStorage, initializeProfiles, activateProfile } from '../src/account/ProfileStorage.js';
import { validateSave, protectServerFields } from '../backend/shared/save.js';
import { advanceCosmeticTrail, createCosmeticTrailState, drawCosmeticTrail } from '../src/game/CosmeticTrails.js';
import { drawCosmeticShot, drawCosmeticMuzzle, drawCosmeticMark } from '../src/game/CosmeticEffects.js';

function storage() {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
}

test('standalone skins keep every ship silhouette but retain standard engines and fire', () => {
  assert.equal(SKINS.length, COSMETICS.length);
  for (const skin of SKINS) {
    const set = getCosmetic(skin.setId);
    assert.equal(skin.productId, null, 'credit unlock cannot be mistaken for a native store SKU');
    assert.deepEqual(skin.features, [set.features[0]]);
    assert.equal(getCosmeticDesign(skin.id), getCosmeticDesign(set.id));
    assert.equal(getCosmeticSurface(skin.id), getCosmeticSurface(set.id));
    assert.equal(getCosmeticEffects(skin.id), null);
    assert.equal(getCosmeticEffects(set.id), set);
    for (const ship of SHIPS) {
      const palette = getCosmeticPalette(ship.palette, skin.id);
      for (const field of ['engine', 'core', 'shot']) assert.equal(palette[field], ship.palette[field]);
      assert.equal(palette.body, set.colors.body);
    }
    const offer = cosmeticCreditOffer(skin);
    assert.ok(offer.price > 0 && offer.price < set.creditPrice * .8);
    assert.equal(offer.price % 50000, 0);
    assert.equal(offer.discountPercent, 0);
  }
});

test('every new cosmetic purchase starts at one million, including all daily rotations', () => {
  assert.equal(Math.min(...SKINS.map(skin => skin.creditPrice)), 1000000);
  assert.equal(Math.min(...COSMETICS.map(set => set.creditPrice)), 1750000);
  for (let day = 0; day < COSMETICS.length; day++) {
    const now = new Date(2026,10,10+day,12).getTime();
    for (const cosmetic of [...SKINS, ...COSMETICS]) {
      const offer = cosmeticCreditOffer(cosmetic, now);
      assert.ok(offer.price >= 1000000, `${cosmetic.id}: a new unlock cannot fall below the price floor`);
      if (cosmetic.kind === 'skin') assert.equal(offer.price % 250000, 0);
    }
  }
  // A completion payment may be smaller because the player already owns the
  // appearance. Preserve that credit rather than charging for the skin again.
  const skin = SKINS[0], set = getCosmetic(skin.setId);
  const now = new Date(2026,10,10,12).getTime();
  const completion = cosmeticCreditOffer(set, now, { [skin.id]: true });
  assert.equal(completion.price + skin.creditPrice, cosmeticCreditOffer(set, now).price);
});

test('buying a standalone appearance persists once without granting any complete set', () => {
  for (const skin of SKINS) {
    storage(); saveWallet(skin.creditPrice + 17);
    assert.equal(unlockCreditCosmetic(skin.id, { expectedPrice: skin.creditPrice }).unlocked, true);
    assert.equal(loadWallet(), 17);
    assert.equal(getCosmeticOwnership()[skin.id], true);
    assert.equal(getCosmeticOwnership()[skin.setId], false);
    assert.equal(unlockCreditCosmetic(skin.id).unlocked, false);
    assert.equal(loadWallet(), 17);
    syncStoreSnapshot([]);
    assert.equal(getCosmeticOwnership()[skin.id], true, 'native refresh never removes credit skin');
    assert.throws(() => grantStoreTransaction({ verified: true, transactionId: '999', productId: skin.id }));
  }
});

test('all existing set ownership sources also include the skin without charging again', () => {
  for (const source of ['creditCosmetics', 'eventCosmetics', 'cloudEntitlements', 'entitlements', 'legacyPurchases']) {
    storage(); saveWallet(100);
    const skin = SKINS[0], set = getCosmetic(skin.setId);
    const account = JSON.parse(profileStorage.getItem(ACCOUNT_KEY));
    account[source] = { [['creditCosmetics','eventCosmetics'].includes(source) ? set.id : set.productId]: true };
    profileStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
    assert.equal(getCosmeticOwnership()[set.id], true);
    assert.equal(getCosmeticOwnership()[skin.id], true);
    assert.equal(unlockCreditCosmetic(skin.id).unlocked, false);
    assert.equal(loadWallet(), 100);
  }
});

test('credit set completion deducts an owned skin on regular and daily offers, then cannot debit twice', t => {
  for (const daily of [false, true]) {
    const now = new Date(2026,10,10,12).getTime();
    t.mock.method(Date, 'now', () => now);
    for (const skin of SKINS) {
      const set = getCosmetic(skin.setId);
      if ((dailySetOffer(now).cosmeticId === set.id) !== daily) continue;
      storage(); saveWallet(set.creditPrice);
      const fullPrice = cosmeticCreditOffer(set, now).price;
      unlockCreditCosmetic(skin.id);
      const offer = cosmeticCreditOffer(set, now, getCosmeticOwnership());
      assert.equal(offer.price + skin.creditPrice, fullPrice);
      assert.equal(offer.skinCredit, skin.creditPrice);
      assert.throws(() => unlockCreditCosmetic(set.id, { expectedPrice: fullPrice }), /offer has changed/);
      assert.equal(unlockCreditCosmetic(set.id, { expectedPrice: offer.price }).unlocked, true);
      assert.equal(loadWallet(), set.creditPrice - fullPrice);
      assert.equal(getCosmeticOwnership()[set.id], true);
      assert.equal(unlockCreditCosmetic(set.id).unlocked, false);
    }
  }
});

test('pending or in-progress full-set purchases block overlapping standalone credit debits', () => {
  const skin = SKINS[0], set = getCosmetic(skin.setId);
  storage(); saveWallet(set.creditPrice);
  assert.equal(beginCosmeticPurchase(set.productId), true);
  try { assert.throws(() => unlockCreditCosmetic(skin.id), /in progress/); }
  finally { endCosmeticPurchase(set.productId); }
  markCosmeticPending(set.productId);
  assert.throws(() => unlockCreditCosmetic(skin.id), /awaiting approval/);
  assert.equal(loadWallet(), set.creditPrice);
  assert.equal(getCosmeticOwnership()[skin.id], false);
});

test('insufficient funds and midnight stale set quotes leave wallet and standalone ownership intact', t => {
  let now = new Date(2026,10,10,12).getTime();
  t.mock.method(Date, 'now', () => now);
  const set = getCosmetic(dailySetOffer(now).cosmeticId), skin = getCosmetic(`skin_${set.id}`);
  storage(); saveWallet(skin.creditPrice - 1);
  assert.throws(() => unlockCreditCosmetic(skin.id), /Not enough/);
  assert.equal(getCosmeticOwnership()[skin.id], false);
  saveWallet(set.creditPrice); unlockCreditCosmetic(skin.id);
  const before = profileStorage.getItem(ACCOUNT_KEY), quote = cosmeticCreditOffer(set, now, getCosmeticOwnership());
  now = garageRotationWindow(now).refreshesAt;
  assert.throws(() => unlockCreditCosmetic(set.id, { expectedPrice: quote.price }), /offer has changed/);
  assert.equal(profileStorage.getItem(ACCOUNT_KEY), before);
});

test('skin-only rendering clears a previous set wake and cannot draw signature effects', () => {
  const state = createCosmeticTrailState(), game = { phase: 'FLYING', shipType: 'default', speed: 200, distance: 1, player: { x: 100, y: 100 } };
  advanceCosmeticTrail(state, { game, cosmetic: COSMETICS[0], deltaTime: 1/30 });
  assert.ok(state.points.length);
  advanceCosmeticTrail(state, { game, cosmetic: SKINS[0], deltaTime: 1/30 });
  assert.deepEqual(state.points, []);
  const forbiddenContext = new Proxy({}, { get() { throw new Error('A skin attempted to draw a signature effect'); } });
  for (const skin of SKINS) {
    drawCosmeticTrail(forbiddenContext, [{},{}], skin, skin.colors);
    drawCosmeticShot(forbiddenContext, skin);
    drawCosmeticMuzzle(forbiddenContext, skin, .05);
    drawCosmeticMark(forbiddenContext, skin, skin.colors, 0,0,1);
  }
});

test('skin unlock and equipment survive account-scoped storage and existing server save validation', () => {
  storage(); initializeProfiles();
  const skin = SKINS[0]; saveWallet(skin.creditPrice); unlockCreditCosmetic(skin.id);
  profileStorage.setItem('neon_glide_equipped_cosmetic', skin.id);
  const data = { [ACCOUNT_KEY]: profileStorage.getItem(ACCOUNT_KEY), neon_glide_equipped_cosmetic: skin.id };
  const clean = protectServerFields(validateSave(data), data);
  assert.equal(JSON.parse(clean[ACCOUNT_KEY]).creditCosmetics[skin.id], true);
  assert.equal(clean.neon_glide_equipped_cosmetic, skin.id);
  const owner = JSON.parse(localStorage.getItem('neo_glide_accounts_v1')).owner;
  activateProfile('another-pilot');
  assert.equal(Boolean(getCosmeticOwnership()[skin.id]), false);
  activateProfile(owner);
  assert.equal(getCosmeticOwnership()[skin.id], true);
  assert.equal(profileStorage.getItem('neon_glide_equipped_cosmetic'), skin.id);
});
