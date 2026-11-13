import { profileStorage, ownerId, activateProfile } from '../src/account/ProfileStorage.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT_KEY, WALLET_KEY, CREDIT_PACKS, STARTER_CREDITS, loadWallet, saveWallet, updateWallet, subscribeWallet, getPurchaseFlags, getCosmeticOwnership, getPendingCosmeticProducts, grantStoreTransaction, markCosmeticPending, reconcilePendingCosmetics, syncStoreEntitlements, syncStoreSnapshot, unlockCreditCosmetic, beginCosmeticPurchase, endCosmeticPurchase } from '../src/game/Economy.js';
import { COSMETICS, ALL_APPEARANCES } from '../src/game/CosmeticsCatalog.js';
import { cosmeticCreditOffer } from '../src/game/GarageOffers.js';
import { createStoreClient, createStoreDelivery, configureStoreAccounts } from '../src/services/StoreDelivery.js';
import { purchaseProduct } from '../src/services/MonetizationService.js';

function storage() {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
  localStorage.setItem('neo_glide_audience_v1', JSON.stringify({ version: 1, group: 'adult' }));
  return values;
}
const transaction = (transactionId = '1', productId = 'credits_1000') => ({ transactionId, productId, verified: true });
function store() {
  const state = { pending: [], entitlements: [], result: { status: 'cancelled' }, finishes: 0, purchases: 0, failFinish: false, restores: 0 };
  const bridge = {
    addListener: async (name, callback) => { state.update = callback; return { remove: async () => {} }; },
    pendingTransactions: async () => ({ transactions: [...state.pending] }),
    currentEntitlements: async () => ({ productIds: [...state.entitlements] }),
    purchase: async () => {
      state.purchases++;
      if (state.result.transaction) state.pending.push(state.result.transaction);
      return state.result;
    },
    finishTransaction: async ({ transactionId }) => {
      state.finishes++;
      assert.ok(JSON.parse(profileStorage.getItem(ACCOUNT_KEY)).transactions[transactionId], 'Finish must follow the durable grant');
      if (state.failFinish) throw new Error('App closed before acknowledgement');
      state.pending = state.pending.filter(item => item.transactionId !== transactionId);
    },
    restorePurchases: async () => { state.restores++; return { productIds: [...state.entitlements] }; },
  };
  return { state, bridge };
}

test('v3 atomically migrates the latest v2 balance without changing legacy ownership or records', () => {
  const data = storage();
  data.set(WALLET_KEY, '82200');
  data.set('neon_glide_currency', '822');
  data.set('neon_glide_purchases', '{"starter_pack":true}');
  data.set('neon_glide_owned_ships', '["default","cruiser"]');
  const setItem = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('Disk full'); };
  assert.throws(() => grantStoreTransaction(transaction()), /Disk full/);
  assert.equal(loadWallet(), 82200);
  assert.equal(profileStorage.getItem(ACCOUNT_KEY), null);
  localStorage.setItem = setItem;
  grantStoreTransaction(transaction());
  assert.equal(loadWallet(), 182200);
  assert.equal(data.get(WALLET_KEY), '82200');
  assert.equal(data.get('neon_glide_currency'), '822');
  assert.equal(data.get('neon_glide_owned_ships'), '["default","cruiser"]');
  assert.equal(getPurchaseFlags().starter_pack, true);
  assert.equal(getPurchaseFlags().remove_ads, true);
  grantStoreTransaction(transaction('2', 'starter_pack'));
  assert.equal(loadWallet(), 182200, 'Legacy Starter ownership must not grant credits again');
});

test('a crash before commit leaves the purchase unfinished; retry delivers once', async () => {
  storage(); const { state, bridge } = store();
  const delivery = createStoreDelivery(bridge);
  state.pending = [transaction()];
  const setItem = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('Interrupted write'); };
  await assert.rejects(delivery.replay(), /Interrupted/);
  assert.equal(state.finishes, 0);
  assert.equal(loadWallet(), 0);
  localStorage.setItem = setItem;
  await createStoreDelivery(bridge).replay();
  assert.equal(loadWallet(), CREDIT_PACKS.credits_1000);
  assert.equal(state.pending.length, 0);
});

test('a crash after commit or failed finish replays without losing coins or duplicating credits', async () => {
  storage(); const { state, bridge } = store();
  state.pending = [transaction()]; state.failFinish = true;
  const delivery = createStoreDelivery(bridge);
  const result = await delivery.deliver(transaction());
  assert.equal(result.finishPending, true);
  assert.equal(loadWallet(), CREDIT_PACKS.credits_1000);
  updateWallet(value => value + 25); // A real pickup between delivery and retry.
  updateWallet(value => value + 500); // A rewarded-ad callback uses the same latest balance.
  state.failFinish = false;
  await createStoreDelivery(bridge).replay();
  assert.equal(loadWallet(), CREDIT_PACKS.credits_1000 + 525);
  assert.equal(state.pending.length, 0);
  saveWallet(loadWallet() - 5000);
  await delivery.deliver(transaction());
  assert.equal(loadWallet(), CREDIT_PACKS.credits_1000 + 525 - 5000, 'Normal wallet saves must preserve the transaction ledger');
});

test('simultaneous purchase-result and update deliveries coalesce by transaction ID', async () => {
  storage(); const { state, bridge } = store();
  const delivery = createStoreDelivery(bridge);
  const first = delivery.deliver(transaction());
  assert.equal(delivery.deliver(transaction()), first);
  await first;
  assert.equal(loadWallet(), CREDIT_PACKS.credits_1000);
  assert.equal(state.finishes, 1);
  await delivery.deliver(transaction('2'));
  assert.equal(loadWallet(), 2 * CREDIT_PACKS.credits_1000, 'A second real consumable transaction is a second pack');
});

test('unverified, unknown or mismatched transactions cannot grant or finish', async () => {
  storage(); const { state, bridge } = store();
  const delivery = createStoreDelivery(bridge);
  await assert.rejects(delivery.deliver({ ...transaction(), verified: false }), /verified/);
  await assert.rejects(delivery.deliver(transaction('1', 'not_a_product')), /verified/);
  await assert.rejects(delivery.deliver(transaction('__proto__')), /verified/);
  assert.equal(loadWallet(), 0); assert.equal(state.finishes, 0);
  await delivery.deliver(transaction());
  await assert.rejects(delivery.deliver(transaction('1', 'credits_5500')), /match/);
  assert.equal(loadWallet(), CREDIT_PACKS.credits_1000);
});

test('cancelled and pending purchases grant nothing; later approved updates deliver safely', async () => {
  storage(); const { state, bridge } = store();
  const client = createStoreClient(bridge);
  assert.equal((await client.purchase('credits_1000')).status, 'cancelled');
  state.result = { status: 'pending' };
  assert.equal((await client.purchase('credits_1000')).status, 'pending');
  assert.equal(loadWallet(), 0); assert.equal(state.finishes, 0);
  state.pending.push(transaction());
  state.update({ transaction: transaction() });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(loadWallet(), CREDIT_PACKS.credits_1000);
  state.result = { status: 'purchased', transaction: transaction('2', 'credits_5500') };
  await assert.rejects(client.purchase('credits_1000'), /verified/);
  assert.equal(loadWallet(), CREDIT_PACKS.credits_1000);
});

test('restore reopens permanent products without credits; unfinished Starter credits still arrive once', async () => {
  storage(); const { state, bridge } = store();
  state.entitlements = ['starter_pack', 'remove_ads'];
  const client = createStoreClient(bridge);
  await client.restore(); await client.restore();
  assert.equal(loadWallet(), 0);
  assert.equal(getPurchaseFlags().starter_pack, true);
  assert.equal(getPurchaseFlags().remove_ads, true);
  // The entitlement snapshot may arrive before an approved unfinished transaction.
  state.pending = [transaction('9', 'starter_pack')];
  await createStoreClient(bridge).start();
  assert.equal(loadWallet(), STARTER_CREDITS);
  await client.restore();
  state.pending = [transaction('9', 'starter_pack')];
  await createStoreClient(bridge).start();
  assert.equal(loadWallet(), STARTER_CREDITS);
  state.result = { status: 'owned' };
  await client.purchase('starter_pack');
  assert.equal(loadWallet(), STARTER_CREDITS);
});

test('automatic ownership refresh unlocks permanent items without a restore sheet or repeated credits', async () => {
  storage(); const { state, bridge } = store();
  state.entitlements = ['starter_pack', 'cosmetic_pearl_comet'];
  bridge.restorePurchases = async () => { state.restores++; throw new Error('Authentication must stay user-initiated'); };
  const client = createStoreClient(bridge);
  await client.start();
  assert.equal(getPurchaseFlags().starter_pack, true);
  assert.equal(getCosmeticOwnership().pearl_comet, true);
  assert.equal(loadWallet(), 0, 'An ownership snapshot must not re-grant Starter credits');
  await Promise.all([client.start(), client.start(), client.start()]);
  await createStoreClient(bridge).start();
  assert.equal(loadWallet(), 0);
  assert.equal(state.restores, 0); assert.equal(state.purchases, 0); assert.equal(state.finishes, 0);
});

test('automatic ownership refresh preserves cached purchases offline and retries without forcing authentication', async () => {
  storage(); const { state, bridge } = store();
  grantStoreTransaction(transaction('10001', 'cosmetic_pearl_comet'));
  saveWallet(12345);
  let online = false, listeners = 0;
  const listen = bridge.addListener;
  bridge.addListener = (...args) => { listeners++; return listen(...args); };
  bridge.currentEntitlements = async () => {
    if (!online) throw new Error('Offline');
    return { productIds: ['cosmetic_pearl_comet', 'cosmetic_void_pilot'] };
  };
  const client = createStoreClient(bridge);
  await assert.rejects(client.start(), /Offline/);
  assert.equal(getCosmeticOwnership().pearl_comet, true);
  assert.equal(loadWallet(), 12345);
  online = true;
  await client.start();
  assert.equal(getCosmeticOwnership().pearl_comet, true);
  assert.equal(getCosmeticOwnership().void_pilot, true);
  assert.equal(loadWallet(), 12345);
  assert.equal(listeners, 1); assert.equal(state.restores, 0); assert.equal(state.purchases, 0);
});

test('wallet subscribers see the committed balance and ordinary updates never use an old render value', () => {
  storage(); const seen = [];
  const stop = subscribeWallet(() => seen.push(loadWallet()));
  saveWallet(500);
  grantStoreTransaction(transaction());
  updateWallet(value => value + 1000);
  stop();
  updateWallet(value => value - 500);
  assert.deepEqual(seen, [500, 100500, 101500]);
  assert.equal(loadWallet(), 101000);
});

test('native entitlement snapshots can revoke new unlocks while keeping pre-existing purchases', () => {
  const data = storage();
  data.set('neon_glide_purchases', '{"remove_ads":true}');
  grantStoreTransaction(transaction('1', 'starter_pack'));
  syncStoreEntitlements([]);
  assert.equal(getPurchaseFlags().remove_ads, true);
  assert.equal(getPurchaseFlags().starter_pack, undefined);
  assert.equal(loadWallet(), STARTER_CREDITS);
});

test('purchase and restore requests share a lock until the active store sheet settles', async () => {
  storage(); const { state, bridge } = store();
  let settle;
  bridge.purchase = () => new Promise(resolve => { settle = resolve; state.purchases++; });
  const client = createStoreClient(bridge);
  const first = client.purchase('credits_1000');
  await new Promise(resolve => setTimeout(resolve, 0));
  await assert.rejects(client.purchase('credits_5500'), /progress/);
  await assert.rejects(client.restore(), /progress/);
  assert.equal(state.purchases, 1);
  settle({ status: 'cancelled' });
  await first;
  await client.restore();
  assert.equal(state.restores, 1);
});

test('a corrupt committed account is never replaced with a legacy balance or an empty transaction ledger', async () => {
  const data = storage(); const { state, bridge } = store();
  data.set(WALLET_KEY, '500');
  profileStorage.setItem(ACCOUNT_KEY, '{broken');
  await assert.rejects(createStoreDelivery(bridge).deliver(transaction()));
  assert.throws(() => updateWallet(value => value + 100));
  assert.equal(profileStorage.getItem(ACCOUNT_KEY), '{broken');
  assert.equal(data.get(WALLET_KEY), '500');
  assert.equal(state.finishes, 0);
});

test('credit cosmetic unlock debits once and remains owned when store rights reconcile away', () => {
  storage(); saveWallet(4300000);
  const expectedBalance = 4300000 - cosmeticCreditOffer(COSMETICS.find(c => c.id === 'void_pilot')).price;
  assert.equal(unlockCreditCosmetic('void_pilot').unlocked, true);
  assert.equal(loadWallet(), expectedBalance);
  assert.equal(unlockCreditCosmetic('void_pilot').unlocked, false);
  assert.equal(loadWallet(), expectedBalance);
  syncStoreEntitlements([]);
  assert.equal(getCosmeticOwnership().void_pilot, true);
});

test('old v3 records without cosmetic fields remain usable without rewriting ownership', () => {
  storage();
  profileStorage.setItem(ACCOUNT_KEY, JSON.stringify({ version: 3, balance: 4200000, transactions: {}, entitlements: {}, legacyPurchases: {} }));
  assert.deepEqual(getCosmeticOwnership(), Object.fromEntries(ALL_APPEARANCES.map(cosmetic => [cosmetic.id, false])));
  assert.deepEqual(getPendingCosmeticProducts(), []);
  assert.equal(unlockCreditCosmetic('void_pilot').unlocked, true);
});

test('cosmetic store delivery is idempotent and transaction IDs allow Android token hashes', () => {
  storage();
  const googleTransactionId = `google:${'a'.repeat(64)}`;
  grantStoreTransaction({ verified: true, transactionId: googleTransactionId, productId: 'cosmetic_void_pilot' });
  assert.equal(getCosmeticOwnership().void_pilot, true);
  assert.equal(loadWallet(), 0);
  assert.equal(grantStoreTransaction({ verified: true, transactionId: googleTransactionId, productId: 'cosmetic_void_pilot' }).applied, false);
});

test('all skins are independent permanent credit unlocks and each debits once', () => {
  const budget = COSMETICS.reduce((sum, skin) => sum + cosmeticCreditOffer(skin).price, 500000);
  storage(); saveWallet(budget);
  for (const {id} of COSMETICS) assert.equal(unlockCreditCosmetic(id).unlocked, true, id);
  assert.equal(loadWallet(), 500000);
  assert.ok(COSMETICS.every(({id}) => getCosmeticOwnership()[id]));
  for (const {id} of COSMETICS) assert.equal(unlockCreditCosmetic(id).unlocked, false);
  assert.equal(loadWallet(), 500000);
});

test('pending cosmetic markers survive restart, block both purchase paths, and Android snapshots resolve them safely', () => {
  storage(); saveWallet(4300000);
  markCosmeticPending('cosmetic_void_pilot');
  assert.deepEqual(getPendingCosmeticProducts(), ['cosmetic_void_pilot']);
  assert.throws(() => unlockCreditCosmetic('void_pilot'), /awaiting/);
  // Existing v3 records are read back with their marker after an app restart.
  const reboot = new Map([[ACCOUNT_KEY, profileStorage.getItem(ACCOUNT_KEY)]]);
  globalThis.localStorage = { getItem: key => reboot.get(key) ?? null, setItem: (key, value) => reboot.set(key, String(value)) };
  assert.deepEqual(getPendingCosmeticProducts(), ['cosmetic_void_pilot']);
  reconcilePendingCosmetics([]);
  assert.deepEqual(getPendingCosmeticProducts(), []);
  assert.equal(unlockCreditCosmetic('void_pilot').unlocked, true);
});

test('store cosmetics grant zero credits and store reconciliation cannot revoke a credit unlock', () => {
  storage(); saveWallet(4300000); unlockCreditCosmetic('void_pilot');
  const balance = loadWallet();
  grantStoreTransaction({ verified: true, transactionId: '7', productId: 'cosmetic_solar_forge' });
  assert.equal(loadWallet(), balance);
  syncStoreEntitlements(['cosmetic_solar_forge']);
  assert.equal(getCosmeticOwnership().solar_forge, true);
  syncStoreEntitlements([]);
  assert.equal(getCosmeticOwnership().solar_forge, false);
  assert.equal(getCosmeticOwnership().void_pilot, true);
});

test('malformed entitlement and pending snapshots preserve prior local ownership and pending markers', async () => {
  storage(); saveWallet(4300000); unlockCreditCosmetic('void_pilot'); markCosmeticPending('cosmetic_solar_forge');
  const bridge = { pendingTransactions: async () => ({ transactions: [] }), currentEntitlements: async () => ({ productIds: [], pendingProductIds: ['bad'] }) };
  await assert.rejects(createStoreClient(bridge).reconcile(), /pending purchase data/);
  assert.equal(getCosmeticOwnership().void_pilot, true);
  assert.deepEqual(getPendingCosmeticProducts(), ['cosmetic_solar_forge']);
});

test('a stale entitlement response cannot clear ownership delivered by a store update', async () => {
  storage(); const { state, bridge } = store();
  let resolveFirstSnapshot;
  let snapshots = 0;
  bridge.currentEntitlements = () => {
    snapshots++;
    if (snapshots === 1) return new Promise(resolve => { resolveFirstSnapshot = resolve; });
    return Promise.resolve({ productIds: ['cosmetic_void_pilot'] });
  };
  const client = createStoreClient(bridge);
  const starting = client.start();
  while (!resolveFirstSnapshot) await new Promise(resolve => setTimeout(resolve, 0));
  state.update({ transaction: transaction('3', 'cosmetic_void_pilot') });
  await new Promise(resolve => setTimeout(resolve, 0));
  resolveFirstSnapshot({ productIds: [] });
  await starting;
  assert.equal(getCosmeticOwnership().void_pilot, true);
  assert.equal(snapshots, 2);
});

test('a stale entitlement response cannot clear ownership delivered by a purchase result', async () => {
  storage(); const { bridge } = store();
  let snapshots = 0;
  let resolveOldSnapshot;
  let resolvePurchase;
  bridge.currentEntitlements = () => {
    snapshots++;
    if (snapshots === 3) return new Promise(resolve => { resolveOldSnapshot = resolve; });
    return Promise.resolve({ productIds: snapshots === 4 ? ['cosmetic_void_pilot'] : [] });
  };
  bridge.purchase = () => new Promise(resolve => { resolvePurchase = resolve; });
  const client = createStoreClient(bridge);
  await client.start();
  const purchasing = client.purchase('cosmetic_void_pilot');
  while (!resolvePurchase) await new Promise(resolve => setTimeout(resolve, 0));
  const reconciling = client.reconcile();
  while (!resolveOldSnapshot) await new Promise(resolve => setTimeout(resolve, 0));
  resolvePurchase({ status: 'purchased', transaction: transaction('4', 'cosmetic_void_pilot') });
  await purchasing;
  resolveOldSnapshot({ productIds: [] });
  await reconciling;
  assert.equal(getCosmeticOwnership().void_pilot, true);
  assert.equal(snapshots, 4);
});

test('a failed atomic cosmetic unlock neither debits nor records ownership', () => {
  storage(); saveWallet(4300000);
  const setItem = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('Interrupted write'); };
  assert.throws(() => unlockCreditCosmetic('void_pilot'), /Interrupted write/);
  localStorage.setItem = setItem;
  assert.equal(loadWallet(), 4300000);
  assert.equal(getCosmeticOwnership().void_pilot, false);
  saveWallet(cosmeticCreditOffer(COSMETICS.find(skin => skin.id === 'solar_forge')).price - 1);
  assert.throws(() => unlockCreditCosmetic('solar_forge'), /Not enough credits/);
  assert.equal(profileStorage.getItem(ACCOUNT_KEY) !== undefined, true);
});

test('a malformed store snapshot cannot revoke an existing store entitlement or pending marker', () => {
  storage();
  syncStoreSnapshot(['cosmetic_solar_forge'], ['cosmetic_void_pilot']);
  assert.throws(() => syncStoreSnapshot(['cosmetic_solar_forge'], ['unknown']), /pending/);
  assert.throws(() => syncStoreSnapshot(['unknown'], []), /entitlement/);
  assert.equal(getCosmeticOwnership().solar_forge, true);
  assert.deepEqual(getPendingCosmeticProducts(), ['cosmetic_void_pilot']);
});

test('release web purchases cannot grant cosmetics and an active store lock blocks credit unlocks', async () => {
  storage(); saveWallet(4300000);
  await assert.rejects(purchaseProduct('cosmetic_void_pilot'), /native App Store or Google Play app/);
  assert.equal(getCosmeticOwnership().void_pilot, false);
  assert.equal(beginCosmeticPurchase('cosmetic_void_pilot'), true);
  assert.throws(() => unlockCreditCosmetic('void_pilot'), /in progress/);
  endCosmeticPurchase('cosmetic_void_pilot');
  assert.equal(getCosmeticOwnership().void_pilot, false);
  assert.equal(loadWallet(), 4300000);
});


test('cosmetic credit tiers are ordered and each unlock charges its listed price', () => {
  const expected = [
    ['copper_horizon', 2000000, 'Classic'], ['arctic_pulse', 2000000, 'Classic'],
    ['cyber_current', 2250000, 'Signature'], ['jade_drift', 2250000, 'Signature'],
    ['rose_circuit', 2250000, 'Elite'], ['solar_forge', 2500000, 'Elite'],
    ['pearl_comet', 2750000, 'Prestige'], ['void_pilot', 3000000, 'Prestige'],
    ['cobalt_storm', 3000000, 'Legendary'], ['prism_voyager', 3250000, 'Legendary'],
  ];
  assert.deepEqual(COSMETICS.slice(0, 10).map(c => [c.id, c.creditPrice, c.tier, c.rank]), expected.map(([id, price, tier], index) => [id, price, tier, index + 1]));
  for (const cosmetic of COSMETICS) {
    const { id } = cosmetic, { price } = cosmeticCreditOffer(cosmetic);
    storage(); saveWallet(price + 123);
    assert.equal(unlockCreditCosmetic(id).unlocked, true);
    assert.equal(loadWallet(), 123, id);
    assert.equal(unlockCreditCosmetic(id).unlocked, false);
    assert.equal(loadWallet(), 123, `${id} remains owned without another charge`);
  }
  for (const [id] of [expected[0], expected.at(-1)]) {
    const price = cosmeticCreditOffer(COSMETICS.find(cosmetic => cosmetic.id === id)).price;
    storage(); saveWallet(price - 1);
    assert.throws(() => unlockCreditCosmetic(id), /Not enough credits/);
    assert.equal(loadWallet(), price - 1);
    assert.equal(getCosmeticOwnership()[id], false);
  }
  const old = storage();
  old.set(ACCOUNT_KEY, JSON.stringify({ version: 3, balance: 10, transactions: {}, entitlements: {}, legacyPurchases: {}, creditCosmetics: { prism_voyager: true } }));
  assert.equal(unlockCreditCosmetic('prism_voyager').unlocked, false);
  assert.equal(loadWallet(), 10);
});


test('late store delivery stays with the purchasing pilot after an account switch', async t => {
  storage(); saveWallet(1000); const original = ownerId();
  let verify; configureStoreAccounts({capture: owner => ({owner}), verify: () => new Promise(resolve => {verify = resolve;})});
  t.after(() => configureStoreAccounts(null));
  const delivery = createStoreDelivery({finishTransaction:async()=>{}});
  const pending = delivery.deliver(transaction('987654'));
  await new Promise(resolve => setImmediate(resolve));
  activateProfile('other-pilot'); saveWallet(250);
  verify(); await pending;
  assert.equal(loadWallet(),250);
  activateProfile(original); assert.equal(loadWallet(),101000);
});


test('event skins have positive prices and event ownership prevents any further charge', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-13T12:00:00Z') });
  for (const cosmetic of COSMETICS.filter(skin => skin.eventReward)) {
    const price = cosmeticCreditOffer(cosmetic).price;
    assert.ok(price > 0);
    storage(); saveWallet(price - 1);
    assert.throws(() => unlockCreditCosmetic(cosmetic.id), /Not enough credits/);
    assert.equal(loadWallet(), price - 1);
    const record = JSON.parse(profileStorage.getItem(ACCOUNT_KEY));
    record.eventCosmetics = {[cosmetic.id]: true};
    profileStorage.setItem(ACCOUNT_KEY, JSON.stringify(record));
    assert.equal(unlockCreditCosmetic(cosmetic.id).unlocked, false);
    assert.equal(markCosmeticPending(cosmetic.productId), false);
    reconcilePendingCosmetics([cosmetic.productId]);
    assert.deepEqual(getPendingCosmeticProducts(), []);
    syncStoreSnapshot([], [cosmetic.productId]);
    assert.deepEqual(getPendingCosmeticProducts(), []);
    assert.equal(loadWallet(), price - 1);
  }
});
