export const CREDIT_SCALE = 100;
export const COIN_VALUES = [50, 100, 250, 500, 10000];
export const BOSS_REWARD = 10000;
export const LEVEL_REWARD = 10000;
export const MULTIPLIER_MAX_LEVEL = 5;
export const coinMultiplier = (level = 1) => Math.min(2, 1 + .25 * (Math.max(1, Number(level) || 1) - 1));
export const STARTER_CREDITS = 200000;
export const CREDIT_PACKS = { credits_1000: 100000, credits_5500: 550000, credits_15000: 1500000 };
export const SHIP_PRICES = { default: 0, interceptor: 60000, cruiser: 180000, stealth: 400000, void_runner: 900000, plasma_breaker: 1800000 };
export const UPGRADE_PRICES = { battery: 5000, thruster: 7500, magnet: 10000, hull: 25000, multiplier: 50000, shield_gen: 100000 };
export const WEAPON_PRICES = { default: 0, blaster: 75000, cannon: 150000, beam: 300000, wave: 600000, shock: 1250000 };
export const WALLET_KEY = 'neon_glide_currency_v2';
export const ACCOUNT_KEY = 'neon_glide_wallet_v3';
import { STAGES } from './StageCatalog.js';
import { COSMETIC_IDS, COSMETIC_PRODUCT_IDS, getCosmetic } from './CosmeticsCatalog.js';

const wholeCredits = value => Number.isFinite(Number(value)) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(Number(value)))) : 0;
const walletListeners = new Set();
const cosmeticPurchaseLocks = new Set();
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (record, key) => Object.prototype.hasOwnProperty.call(record, key);
const readLegacyPurchases = () => {
  try { const value = JSON.parse(localStorage.getItem('neon_glide_purchases')); return isRecord(value) ? value : {}; } catch { return {}; }
};

function readAccount() {
  const saved = localStorage.getItem(ACCOUNT_KEY);
  if (saved !== null) {
    const account = JSON.parse(saved);
    if (account.version !== 3 || !Number.isSafeInteger(account.balance) || account.balance < 0
      || !isRecord(account.transactions) || !isRecord(account.entitlements) || !isRecord(account.legacyPurchases)
      || (account.creditCosmetics !== undefined && !isRecord(account.creditCosmetics))
      || (account.pendingCosmetics !== undefined && !isRecord(account.pendingCosmetics))
      || (account.creditStages !== undefined && (!isRecord(account.creditStages) || Object.values(account.creditStages).some(value => typeof value !== 'boolean')))
      || (account.equippedStage !== undefined && typeof account.equippedStage !== 'string')) throw new Error('Wallet data could not be read.');
    // v3 stays the persisted shape so existing saves remain readable. Credit
    // cosmetics are intentionally separate from store entitlements.
    return { ...account, creditCosmetics: account.creditCosmetics || {}, pendingCosmetics: account.pendingCosmetics || {}, creditStages: account.creditStages || {}, equippedStage: account.equippedStage || 'default' };
  }
  const current = localStorage.getItem(WALLET_KEY);
  return {
    version: 3,
    balance: current !== null ? wholeCredits(current) : wholeCredits(wholeCredits(localStorage.getItem('neon_glide_currency')) * CREDIT_SCALE),
    transactions: {}, entitlements: {}, creditCosmetics: {}, pendingCosmetics: {}, creditStages: {}, equippedStage: 'default', legacyPurchases: readLegacyPurchases(), starterCreditsGranted: Boolean(readLegacyPurchases().starter_pack),
  };
}

function writeAccount(account) {
  // Balance and transaction IDs must commit together, before StoreKit.finish().
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  for (const listener of walletListeners) listener();
  return account.balance;
}

export function subscribeWallet(listener) {
  walletListeners.add(listener);
  return () => walletListeners.delete(listener);
}

// The original record is kept intact: retrying before the first save cannot scale twice.
export function loadWallet() {
  try { return readAccount().balance; } catch { return 0; }
}

export function saveWallet(amount) {
  return writeAccount({ ...readAccount(), balance: wholeCredits(amount) });
}

// React and purchase deliveries share this synchronous store, so delayed effects
// cannot overwrite a purchase with an earlier render's balance.
export function updateWallet(update) {
  const account = readAccount();
  const amount = typeof update === 'function' ? update(account.balance) : update;
  return writeAccount({ ...account, balance: wholeCredits(amount) });
}

export function getPurchaseFlags() {
  const account = readAccount();
  const flags = { ...account.legacyPurchases, ...account.entitlements };
  if (flags.starter_pack) flags.remove_ads = true;
  return flags;
}

export function getCosmeticOwnership() {
  try {
    const account = readAccount();
    return Object.fromEntries(COSMETIC_IDS.map(id => {
      const productId = `cosmetic_${id}`;
      return [id, Boolean(account.creditCosmetics[id] || account.entitlements[productId] || account.legacyPurchases[productId])];
    }));
  } catch { return {}; }
}

export function getStageOwnership() {
  try { const account = readAccount(); return Object.fromEntries(STAGES.map(stage => [stage.id, stage.id === 'default' || account.creditStages[stage.id] === true])); }
  catch { return { default: true }; }
}
export function getEquippedStage() {
  try { const account = readAccount(); const stage = STAGES.find(item => item.id === account.equippedStage); return stage && (stage.id === 'default' || account.creditStages[stage.id] === true) ? stage.id : 'default'; }
  catch { return 'default'; }
}
export function equipStage(id) {
  const stage = STAGES.find(item => item.id === id);
  if (!stage) throw new Error('Unknown galaxy.');
  const account = readAccount();
  if (id !== 'default' && account.creditStages[id] !== true) throw new Error('Galaxy is locked.');
  if (account.equippedStage === id) return false;
  account.equippedStage = id; writeAccount(account); return true;
}
export function unlockCreditStage(id) {
  const stage = STAGES.find(item => item.id === id);
  if (!stage) throw new Error('Unknown galaxy.');
  const account = readAccount();
  const owned = id === 'default' || account.creditStages[id] === true;
  if (!owned && account.balance < stage.price) throw new Error('Not enough credits.');
  if (!owned) { account.balance -= stage.price; account.creditStages[id] = true; }
  if (!owned || account.equippedStage !== id) { account.equippedStage = id; writeAccount(account); }
  return { unlocked: !owned, balance: account.balance };
}

const validCosmeticProduct = productId => COSMETIC_PRODUCT_IDS.includes(productId);
export function getPendingCosmeticProducts() {
  try {
    const account = readAccount();
    return COSMETIC_PRODUCT_IDS.filter(productId => account.pendingCosmetics[productId] === true);
  } catch { return []; }
}

export function isCosmeticPending(productId) {
  return getPendingCosmeticProducts().includes(productId);
}

// A pending approval is not an entitlement. It is only a durable purchase
// mutex, committed before React can render a pending response.
export function markCosmeticPending(productId) {
  if (!validCosmeticProduct(productId)) throw new Error('Unknown cosmetic.');
  const account = readAccount();
  const cosmeticId = productId.replace('cosmetic_', '');
  if (account.creditCosmetics[cosmeticId] || account.entitlements[productId] || account.legacyPurchases[productId]) return false;
  if (account.pendingCosmetics[productId]) return false;
  account.pendingCosmetics[productId] = true;
  writeAccount(account);
  return true;
}

// Android can authoritatively report pending Play purchases. Omitted data (as
// on StoreKit Ask-to-Buy) deliberately preserves prior durable markers.
export function reconcilePendingCosmetics(productIds) {
  if (productIds === undefined) return getPendingCosmeticProducts();
  if (!Array.isArray(productIds) || productIds.some(productId => !validCosmeticProduct(productId))) {
    throw new Error('Store pending purchase data could not be verified.');
  }
  const account = readAccount();
  account.pendingCosmetics = Object.fromEntries(productIds.filter(productId => {
    const cosmeticId = productId.replace('cosmetic_', '');
    return !account.creditCosmetics[cosmeticId] && !account.entitlements[productId] && !account.legacyPurchases[productId];
  }).map(productId => [productId, true]));
  writeAccount(account);
  return productIds;
}

// Debit and unlock in one committed account record. Repeating an already-owned
// selection is harmless and can never charge credits twice.
export function unlockCreditCosmetic(cosmeticId) {
  const cosmetic = getCosmetic(cosmeticId);
  if (!cosmetic) throw new Error('Unknown cosmetic.');
  const account = readAccount();
  const storeOwned = Boolean(account.entitlements[cosmetic.productId] || account.legacyPurchases[cosmetic.productId]);
  if (storeOwned || account.creditCosmetics[cosmeticId]) return { unlocked: false, balance: account.balance };
  if (cosmeticPurchaseLocks.has(cosmetic.productId)) throw new Error('This cosmetic purchase is in progress.');
  if (account.pendingCosmetics[cosmetic.productId]) throw new Error('This cosmetic purchase is awaiting approval.');
  if (account.balance < cosmetic.creditPrice) throw new Error('Not enough credits.');
  account.balance -= cosmetic.creditPrice;
  account.creditCosmetics[cosmeticId] = true;
  writeAccount(account);
  return { unlocked: true, balance: account.balance };
}

export function syncStoreEntitlements(productIds) {
  const account = readAccount();
  account.entitlements = Object.fromEntries(productIds.filter(id => ['remove_ads', 'starter_pack', ...COSMETIC_PRODUCT_IDS].includes(id)).map(id => [id, true]));
  writeAccount(account);
  return getPurchaseFlags();
}

const STORE_ENTITLEMENT_IDS = new Set(['remove_ads', 'starter_pack', ...COSMETIC_PRODUCT_IDS]);
export function syncStoreSnapshot(productIds, pendingProductIds = undefined) {
  if (!Array.isArray(productIds) || productIds.some(id => typeof id !== 'string' || !STORE_ENTITLEMENT_IDS.has(id))) throw new Error('Store entitlement data could not be verified.');
  if (pendingProductIds !== undefined && (!Array.isArray(pendingProductIds) || pendingProductIds.some(id => !validCosmeticProduct(id)))) throw new Error('Store pending purchase data could not be verified.');
  const account = readAccount();
  account.entitlements = Object.fromEntries(productIds.map(id => [id, true]));
  if (pendingProductIds !== undefined) {
    account.pendingCosmetics = Object.fromEntries(pendingProductIds.filter(productId => {
      const cosmeticId = productId.replace('cosmetic_', '');
      return !account.creditCosmetics[cosmeticId] && !account.entitlements[productId] && !account.legacyPurchases[productId];
    }).map(productId => [productId, true]));
  }
  writeAccount(account);
  return getPurchaseFlags();
}

export function beginCosmeticPurchase(productId) {
  if (!validCosmeticProduct(productId) || cosmeticPurchaseLocks.has(productId)) return false;
  cosmeticPurchaseLocks.add(productId);
  return true;
}

export function endCosmeticPurchase(productId) {
  cosmeticPurchaseLocks.delete(productId);
}

export function grantStoreTransaction(transaction) {
  const { transactionId, productId, verified } = transaction;
  const credits = { remove_ads: 0, starter_pack: STARTER_CREDITS, ...CREDIT_PACKS, ...Object.fromEntries(COSMETIC_PRODUCT_IDS.map(id => [id, 0])) };
  if (verified !== true || typeof transactionId !== 'string' || !/^(\d+|web:\d+:\d+|google:[a-f0-9]{64})$/.test(transactionId)
    || !hasOwn(credits, productId)) throw new Error('Purchase could not be verified.');
  const account = readAccount();
  if (hasOwn(account.transactions, transactionId)) {
    if (account.transactions[transactionId] !== productId) throw new Error('Purchase transaction does not match this product.');
    return { applied: false, balance: account.balance };
  }
  const permanent = ['starter_pack', 'remove_ads', ...COSMETIC_PRODUCT_IDS].includes(productId);
  // A previously owned Starter is an unlock, not another pack of credits.
  const starterAlreadyDelivered = productId === 'starter_pack' && Boolean(account.starterCreditsGranted || account.legacyPurchases.starter_pack);
  account.balance = wholeCredits(account.balance + (starterAlreadyDelivered ? 0 : credits[productId]));
  if (productId === 'starter_pack') account.starterCreditsGranted = true;
  if (COSMETIC_PRODUCT_IDS.includes(productId)) delete account.pendingCosmetics[productId];
  account.transactions[transactionId] = productId;
  if (permanent) account.entitlements[productId] = true;
  writeAccount(account);
  return { applied: true, balance: account.balance };
}

export const runXp = ({ distance = 0, coins = 0, bosses = 0 }) =>
  Math.floor(Math.max(0, distance) / 8) + Math.floor(Math.max(0, coins) * 2 / (CREDIT_SCALE * 10)) + Math.max(0, bosses) * 125;

// This is a separate wallet bonus. Never feed it back into earned credits or progression.
export function claimEarningsBonus(game, snapshot) {
  if (game.phase !== 'ENDED' || !game.gameOver || game.earningsBonusClaimed || snapshot <= 0) return 0;
  const bonus = Math.min(wholeCredits(snapshot), wholeCredits(game.sessionCurrency));
  if (!bonus) return 0;
  game.earningsBonusClaimed = true;
  game.earningsBonus = bonus;
  return bonus;
}

// Credit only newly completed meters at the end of a flight; the high-water
// mark survives a revive and guards repeated or rewound end states.
export function claimDistanceCredits(game) {
  if (!game || game.phase !== 'ENDED' || game.gameOver !== true || !Number.isFinite(game.distance) || game.distance < 0) return 0;
  const target = Math.floor(game.distance) * 10;
  if (!Number.isSafeInteger(target)) return 0;
  const prior = Number.isSafeInteger(game.distanceBonus) && game.distanceBonus >= 0 ? game.distanceBonus : 0;
  const delta = Math.max(0, target - prior);
  game.distanceBonus = prior + delta;
  game.sessionCurrency = (Number.isFinite(game.sessionCurrency) ? game.sessionCurrency : 0) + delta;
  return delta;
}

export function flightEarningsBreakdown(coins = 0, distanceBonus = 0, levelBonus = 0, earningsBonus = 0) {
  const flight = wholeCredits(coins), distance = Math.min(flight, wholeCredits(distanceBonus));
  return { collected: flight - distance, distance, total: flight + wholeCredits(levelBonus) + wholeCredits(earningsBonus) };
}
