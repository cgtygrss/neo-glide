import { Capacitor, registerPlugin } from '@capacitor/core';
import { beginCosmeticPurchase, CREDIT_PACKS, endCosmeticPurchase, STARTER_CREDITS, getPurchaseFlags, getCosmeticOwnership, grantStoreTransaction, isCosmeticPending, markCosmeticPending } from '../game/Economy.js';
import { COSMETICS } from '../game/CosmeticsCatalog.js';
import { initializeAdMob, isNativeAdMobAvailable, showAdMobRewardedAd } from './AdMobService.js';
import { createStoreClient } from './StoreDelivery.js';
import { canRetryPendingPurchase, canSimulateWebPurchase, isStoreProductAvailable } from './StorePolicy.js';

export const PRODUCTS = [
  { id: 'starter_pack', name: 'Starter Pack', price: '$4.99', description: `${STARTER_CREDITS.toLocaleString()} credits, Interceptor and Solar Blaster.`, type: 'non_consumable', credits: STARTER_CREDITS },
  { id: 'credits_1000', name: `${CREDIT_PACKS.credits_1000.toLocaleString()} Credits`, price: '$0.99', description: 'A quick boost for your next upgrade.', type: 'consumable', credits: CREDIT_PACKS.credits_1000 },
  { id: 'credits_5500', name: `${CREDIT_PACKS.credits_5500.toLocaleString()} Credits`, price: '$3.99', description: `Includes ${(CREDIT_PACKS.credits_5500 - 5 * CREDIT_PACKS.credits_1000).toLocaleString()} bonus credits.`, type: 'consumable', credits: CREDIT_PACKS.credits_5500 },
  { id: 'credits_15000', name: `${CREDIT_PACKS.credits_15000.toLocaleString()} Credits`, price: '$7.99', description: 'Best value for experienced pilots.', type: 'consumable', credits: CREDIT_PACKS.credits_15000 },
  ...COSMETICS.map(cosmetic => ({ id: cosmetic.productId, name: cosmetic.name, price: cosmetic.price, description: cosmetic.description, type: 'non_consumable', cosmeticId: cosmetic.id })),
];

const EVENTS_KEY = 'neon_glide_monetization_events';

const isNative = () => Capacitor.isNativePlatform();
export const getStorePlatform = () => Capacitor.getPlatform();
export const isNativeStorePlatform = () => isNative();
const isDevelopment = () => import.meta.env?.DEV === true;
export const productsForPlatform = platform => platform === 'android' ? PRODUCTS.filter(product => product.cosmeticId) : PRODUCTS;
const supportedProducts = () => productsForPlatform(getStorePlatform());
const nativeBridge = () => window.NeoGlideMonetization;
const hasNativeStore = () => isNative() && ['ios', 'android'].includes(getStorePlatform());
const appleStore = registerPlugin('NeoGlideStore');
const storeSubscribers = new Set();
const notifyStore = change => { for (const listener of storeSubscribers) listener(change); };
const storeClient = createStoreClient(appleStore, notifyStore, error => trackMonetizationEvent('store_delivery_retry_needed', { message: error.message }));
const webStoreAvailable = () => !isNative() && isStoreProductAvailable({ platform: getStorePlatform(), isNative: false, isDevelopment: isDevelopment() });
let storeProducts = supportedProducts().map(product => ({ ...product, price: webStoreAvailable() ? product.price : '', available: webStoreAvailable() }));
let catalogRequest;
let webTransaction = 0;

export function subscribeStore(listener) { storeSubscribers.add(listener); return () => storeSubscribers.delete(listener); }
export const getStoreProducts = () => storeProducts;

export async function refreshStoreProducts() {
  if (!hasNativeStore()) {
    const available = webStoreAvailable();
    storeProducts = supportedProducts().map(product => ({ ...product, price: available ? product.price : '', available }));
    notifyStore();
    return storeProducts;
  }
  if (catalogRequest) return catalogRequest;
  catalogRequest = Promise.resolve().then(async () => {
    const response = await appleStore.products();
    storeProducts = supportedProducts().map(product => {
      const nativeProduct = response.products?.find(item => item.id === product.id && typeof item.displayPrice === 'string' && item.displayPrice);
      return { ...product, price: nativeProduct?.displayPrice || '', available: Boolean(nativeProduct) };
    });
    notifyStore();
    return storeProducts;
  }).catch(error => {
    storeProducts = supportedProducts().map(product => ({ ...product, price: '', available: false }));
    notifyStore();
    throw error;
  }).finally(() => { catalogRequest = undefined; });
  return catalogRequest;
}

export async function refreshStorePurchases() {
  if (hasNativeStore()) await storeClient.start();
  notifyStore();
}

export function getPurchases() {
  try { return getPurchaseFlags(); } catch { return {}; }
}

export function trackMonetizationEvent(name, data = {}) {
  try {
    const events = JSON.parse(localStorage.getItem(EVENTS_KEY)) || [];
    events.push({ name, data, timestamp: new Date().toISOString() });
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events.slice(-200)));
  } catch {
    // Analytics must never interrupt gameplay.
  }
}

export async function showRewardedAd(placement) {
  trackMonetizationEvent('rewarded_ad_requested', { placement });
  const bridge = nativeBridge();

  if (bridge?.showRewardedAd) {
    const result = await bridge.showRewardedAd({ placement });
    if (result?.rewarded) trackMonetizationEvent('rewarded_ad_earned', { placement });
    return Boolean(result?.rewarded);
  }

  if (isNativeAdMobAvailable()) {
    const rewarded = await showAdMobRewardedAd();
    if (rewarded) trackMonetizationEvent('rewarded_ad_earned', { placement, provider: 'admob' });
    return rewarded;
  }

  await new Promise(resolve => setTimeout(resolve, 500));
  trackMonetizationEvent('rewarded_ad_earned', { placement, testMode: true });
  return true;
}

export async function initializeMonetization() {
  if (hasNativeStore()) {
    void refreshStorePurchases().catch(error => trackMonetizationEvent('store_initialization_failed', { message: error.message }));
    void refreshStoreProducts().catch(error => trackMonetizationEvent('store_products_failed', { message: error.message }));
  }
  if (!isNativeAdMobAvailable()) return;
  try {
    const status = await initializeAdMob();
    trackMonetizationEvent('admob_initialized', status);
    return status;
  } catch (error) {
    trackMonetizationEvent('admob_initialization_failed', { message: error.message });
    return null;
  }
}

export async function purchaseProduct(productId) {
  const product = supportedProducts().find(item => item.id === productId);
  if (!product) throw new Error('Unknown product.');
  if (product.cosmeticId && getCosmeticOwnership()[product.cosmeticId]) {
    return { ...product, status: 'owned' };
  }
  const platform = getStorePlatform();
  const isOwned = product.cosmeticId && Boolean(getCosmeticOwnership()[product.cosmeticId]);
  if (product.cosmeticId && isCosmeticPending(productId) && !canRetryPendingPurchase({ platform, isPending: true, isOwned })) {
    throw new Error('This cosmetic purchase is awaiting approval.');
  }

  if (product.cosmeticId && !beginCosmeticPurchase(productId)) throw new Error('This cosmetic purchase is in progress.');
  trackMonetizationEvent('purchase_started', { productId });
  try {
    let result;
    if (hasNativeStore()) {
      const products = await refreshStoreProducts();
      if (!products.find(item => item.id === productId)?.available) throw new Error('This product is currently unavailable in the store.');
      result = await storeClient.purchase(productId);
      if (product.cosmeticId && result.status === 'pending') markCosmeticPending(productId);
    } else if (!canSimulateWebPurchase({ platform, isNative: isNative(), isDevelopment: isDevelopment() })) {
      throw new Error('Store purchases are available in the native App Store or Google Play app.');
    } else {
      await new Promise(resolve => setTimeout(resolve, 350));
      grantStoreTransaction({ verified: true, transactionId: `web:${Date.now()}:${++webTransaction}`, productId });
      result = { status: 'purchased' };
      notifyStore();
    }
    trackMonetizationEvent(`purchase_${result.status}`, { productId, testMode: !isNative() });
    return { ...product, ...result };
  } finally {
    if (product.cosmeticId) endCosmeticPurchase(productId);
  }
}

export async function restorePurchases() {
  if (hasNativeStore()) await storeClient.restore();
  else if (isNative()) throw new Error('Purchase restoration is not configured for this platform.');
  trackMonetizationEvent('purchases_restored');
  return getPurchases();
}
