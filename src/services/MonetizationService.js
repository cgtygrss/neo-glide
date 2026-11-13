import { CREDIT_PACK_CATALOG, usdPrice } from '../../backend/shared/store-catalog.js';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { beginCosmeticPurchase, endCosmeticPurchase, STARTER_CREDITS, getPurchaseFlags, getCosmeticOwnership, grantStoreTransaction, isCosmeticPending, markCosmeticPending } from '../game/Economy.js';
import { COSMETICS } from '../game/CosmeticsCatalog.js';
import { initializeAdMob, isNativeAdMobAvailable, showAdMobRewardedAd } from './AdMobService.js';
import { createStoreClient } from './StoreDelivery.js';
import { canRetryPendingPurchase, canSimulateWebPurchase, isStoreProductAvailable } from './StorePolicy.js';
import { displayPriceAmount } from '../game/CatalogSorting.js';
import { withAdAudioRecovery } from './AdAudioRecovery.js';
import { onlineServicesAllowed, requireAdultServices } from '../privacy/AudiencePolicy.js';

export const PRODUCTS = [
  { id: 'starter_pack', name: 'Starter Pack', price: '$4.99', description: `${STARTER_CREDITS.toLocaleString()} credits, Interceptor and Solar Blaster.`, type: 'non_consumable', credits: STARTER_CREDITS },
  ...CREDIT_PACK_CATALOG.map(pack => ({ id: pack.id, name: `${pack.credits.toLocaleString()} Credits`, price: usdPrice(pack.usdCents),
    description: `${pack.credits.toLocaleString()} credits for ships, equipment and visual kits.`, type: 'consumable', credits: pack.credits })),
  ...COSMETICS.map(cosmetic => ({ id: cosmetic.productId, name: `${cosmetic.name} Skin Set`, price: cosmetic.price, description: cosmetic.description, type: 'non_consumable', cosmeticId: cosmetic.id })),
];

const EVENTS_KEY = 'neon_glide_monetization_events';

const isNative = () => Capacitor.isNativePlatform();
export const getStorePlatform = () => Capacitor.getPlatform();
export const isNativeStorePlatform = () => isNative();
const isDevelopment = () => import.meta.env?.DEV === true;
export const productsForPlatform = platform => platform === 'android' ? PRODUCTS.filter(product => product.cosmeticId) : PRODUCTS;
const supportedProducts = () => productsForPlatform(getStorePlatform());
const nativeBridge = () => window.NeoGlideMonetization;
const hasNativeStore = () => onlineServicesAllowed() && isNative() && ['ios', 'android'].includes(getStorePlatform());
const appleStore = registerPlugin('NeoGlideStore');
const storeSubscribers = new Set();
const notifyStore = change => { for (const listener of storeSubscribers) listener(change); };
const storeClient = createStoreClient(appleStore, notifyStore, error => trackMonetizationEvent('store_delivery_retry_needed', { message: error.message }));
const webStoreAvailable = () => onlineServicesAllowed() && !isNative() && isStoreProductAvailable({ platform: getStorePlatform(), isNative: false, isDevelopment: isDevelopment() });
const catalogProduct = (product, available) => ({ ...product, priceAmount: displayPriceAmount(product.price), price: available ? product.price : '', available });
let storeProducts = supportedProducts().map(product => catalogProduct(product, webStoreAvailable()));
let catalogRequest;
let webTransaction = 0;

export function subscribeStore(listener) { storeSubscribers.add(listener); return () => storeSubscribers.delete(listener); }
export const getStoreProducts = () => storeProducts;

export async function refreshStoreProducts() {
  if (!hasNativeStore()) {
    const available = webStoreAvailable();
    storeProducts = supportedProducts().map(product => catalogProduct(product, available));
    notifyStore();
    return storeProducts;
  }
  if (catalogRequest) return catalogRequest;
  catalogRequest = Promise.resolve().then(async () => {
    const response = await appleStore.products();
    storeProducts = supportedProducts().map(product => {
      const nativeProduct = response.products?.find(item => item.id === product.id && typeof item.displayPrice === 'string' && item.displayPrice);
      const nativeAmount = displayPriceAmount(nativeProduct?.priceAmount ?? nativeProduct?.displayPrice);
      return { ...catalogProduct(product, false), price: nativeProduct?.displayPrice || '', priceAmount: Number.isFinite(nativeAmount) ? nativeAmount : displayPriceAmount(product.price), available: Boolean(nativeProduct) };
    });
    notifyStore();
    return storeProducts;
  }).catch(error => {
    storeProducts = supportedProducts().map(product => catalogProduct(product, false));
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

export async function showRewardedAd(placement, ssv) {
  requireAdultServices();
  trackMonetizationEvent('rewarded_ad_requested', { placement });
  const bridge = nativeBridge();
  if (ssv && !isNativeAdMobAvailable()) throw new Error('Event reward ads are available in the mobile app.');

  if (!ssv && bridge?.showRewardedAd) {
    const result = await withAdAudioRecovery(() => bridge.showRewardedAd({ placement }));
    if (result?.rewarded) trackMonetizationEvent('rewarded_ad_earned', { placement });
    return Boolean(result?.rewarded);
  }

  if (isNativeAdMobAvailable()) {
    try {
      const rewarded = await showAdMobRewardedAd(ssv);
      if (rewarded) trackMonetizationEvent('rewarded_ad_earned', { placement, provider: 'admob' });
      return rewarded;
    } catch (error) {
      trackMonetizationEvent('rewarded_ad_failed', { placement, provider: 'admob', message: error.message, nativeCode: error.nativeCode ?? null });
      throw new Error('No ad is available right now. Please try again shortly.', { cause: error });
    }
  }

  await new Promise(resolve => setTimeout(resolve, 500));
  trackMonetizationEvent('rewarded_ad_earned', { placement, testMode: true });
  return true;
}

export async function initializeMonetization() {
  if (!onlineServicesAllowed()) return;
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
  requireAdultServices();
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
  requireAdultServices();
  if (hasNativeStore()) await storeClient.restore();
  else if (isNative()) throw new Error('Purchase restoration is not configured for this platform.');
  trackMonetizationEvent('purchases_restored');
  return getPurchases();
}
