import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT_KEY, WALLET_KEY, CREDIT_PACKS, STARTER_CREDITS, loadWallet, saveWallet, updateWallet, subscribeWallet, getPurchaseFlags, getCosmeticOwnership, getPendingCosmeticProducts, grantStoreTransaction, markCosmeticPending, reconcilePendingCosmetics, syncStoreEntitlements, syncStoreSnapshot, unlockCreditCosmetic, beginCosmeticPurchase, endCosmeticPurchase } from '../src/game/Economy.js';
import { COSMETICS } from '../src/game/CosmeticsCatalog.js';
import { createStoreClient, createStoreDelivery } from '../src/services/StoreDelivery.js';
import { purchaseProduct } from '../src/services/MonetizationService.js';

function storage() {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
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
      assert.ok(JSON.parse(localStorage.getItem(ACCOUNT_KEY)).transactions[transactionId], 'Finish must follow the durable grant');
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
  assert.equal(data.has(ACCOUNT_KEY), false);
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
  data.set(ACCOUNT_KEY, '{broken');
  await assert.rejects(createStoreDelivery(bridge).deliver(transaction()));
  assert.throws(() => updateWallet(value => value + 100));
  assert.equal(data.get(ACCOUNT_KEY), '{broken');
  assert.equal(data.get(WALLET_KEY), '500');
  assert.equal(state.finishes, 0);
});

test('credit cosmetic unlock debits once and remains owned when store rights reconcile away', () => {
  storage(); saveWallet(4300000);
  assert.equal(unlockCreditCosmetic('void_pilot').unlocked, true);
  assert.equal(loadWallet(), 100000);
  assert.equal(unlockCreditCosmetic('void_pilot').unlocked, false);
  assert.equal(loadWallet(), 100000);
  syncStoreEntitlements([]);
  assert.equal(getCosmeticOwnership().void_pilot, true);
});

test('old v3 records without cosmetic fields remain usable without rewriting ownership', () => {
  const data = storage();
  data.set(ACCOUNT_KEY, JSON.stringify({ version: 3, balance: 4200000, transactions: {}, entitlements: {}, legacyPurchases: {} }));
  assert.deepEqual(getCosmeticOwnership(), Object.fromEntries(['void_pilot', 'solar_forge', 'arctic_pulse', 'cyber_current', 'rose_circuit', 'jade_drift', 'pearl_comet', 'cobalt_storm', 'copper_horizon', 'prism_voyager'].map(id => [id, false])));
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

test('all ten credit cosmetics are independent permanent unlocks and each debits once', () => {
  storage(); saveWallet(31_600_000);
  const ids = ['void_pilot', 'solar_forge', 'arctic_pulse', 'cyber_current', 'rose_circuit', 'jade_drift', 'pearl_comet', 'cobalt_storm', 'copper_horizon', 'prism_voyager'];
  for (const id of ids) assert.equal(unlockCreditCosmetic(id).unlocked, true, id);
  assert.equal(loadWallet(), 500000);
  assert.ok(ids.every(id => getCosmeticOwnership()[id]));
  assert.equal(unlockCreditCosmetic('void_pilot').unlocked, false);
  assert.equal(loadWallet(), 500000);
});

test('pending cosmetic markers survive restart, block both purchase paths, and Android snapshots resolve them safely', () => {
  const data = storage(); saveWallet(4300000);
  markCosmeticPending('cosmetic_void_pilot');
  assert.deepEqual(getPendingCosmeticProducts(), ['cosmetic_void_pilot']);
  assert.throws(() => unlockCreditCosmetic('void_pilot'), /awaiting/);
  // Existing v3 records are read back with their marker after an app restart.
  const reboot = new Map([[ACCOUNT_KEY, data.get(ACCOUNT_KEY)]]);
  globalThis.localStorage = { getItem: key => reboot.get(key) ?? null, setItem: (key, value) => reboot.set(key, String(value)) };
  assert.deepEqual(getPendingCosmeticProducts(), ['cosmetic_void_pilot']);
  reconcilePendingCosmetics([]);
  assert.deepEqual(getPendingCosmeticProducts(), []);
  assert.equal(unlockCreditCosmetic('void_pilot').unlocked, true);
});

test('store cosmetics grant zero credits and store reconciliation cannot revoke a credit unlock', () => {
  storage(); saveWallet(4300000); unlockCreditCosmetic('void_pilot');
  grantStoreTransaction({ verified: true, transactionId: '7', productId: 'cosmetic_solar_forge' });
  assert.equal(loadWallet(), 100000);
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
  const data = storage(); saveWallet(4300000);
  const setItem = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('Interrupted write'); };
  assert.throws(() => unlockCreditCosmetic('void_pilot'), /Interrupted write/);
  localStorage.setItem = setItem;
  assert.equal(loadWallet(), 4300000);
  assert.equal(getCosmeticOwnership().void_pilot, false);
  saveWallet(1199999);
  assert.throws(() => unlockCreditCosmetic('solar_forge'), /Not enough credits/);
  assert.equal(data.get(ACCOUNT_KEY) !== undefined, true);
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
    ['copper_horizon', 1200000, 'Classic'], ['arctic_pulse', 1500000, 'Classic'],
    ['cyber_current', 1800000, 'Signature'], ['jade_drift', 2200000, 'Signature'],
    ['rose_circuit', 2600000, 'Elite'], ['solar_forge', 3000000, 'Elite'],
    ['pearl_comet', 3600000, 'Prestige'], ['void_pilot', 4200000, 'Prestige'],
    ['cobalt_storm', 5000000, 'Legendary'], ['prism_voyager', 6000000, 'Legendary'],
  ];
  assert.deepEqual(COSMETICS.map(c => [c.id, c.creditPrice, c.tier, c.rank]), expected.map(([id, price, tier], index) => [id, price, tier, index + 1]));
  for (const [id, price] of expected) {
    storage(); saveWallet(price + 123);
    assert.equal(unlockCreditCosmetic(id).unlocked, true);
    assert.equal(loadWallet(), 123, id);
    assert.equal(unlockCreditCosmetic(id).unlocked, false);
    assert.equal(loadWallet(), 123, `${id} remains owned without another charge`);
  }
  for (const [id, price] of [expected[0], expected.at(-1)]) {
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
