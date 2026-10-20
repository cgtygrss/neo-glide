export function canSimulateWebPurchase({ platform, isNative, isDevelopment }) {
  return platform === 'web' && !isNative && isDevelopment === true;
}

export function isStoreProductAvailable({ platform, isNative, isDevelopment }) {
  return isNative || canSimulateWebPurchase({ platform, isNative, isDevelopment });
}

// StoreKit cannot report a declined Ask-to-Buy request. Keep its durable marker
// as a mutex, but let the player ask StoreKit again. Play reports pending state
// authoritatively, so its marker remains blocked until the next Play refresh.
export function canRetryPendingPurchase({ platform, isPending, isOwned = false }) {
  return platform === 'ios' && isPending && !isOwned;
}

export function storeFooterMessage({ platform, isNative, isDevelopment }) {
  if (isNative && platform === 'ios') return 'Purchases are processed by the App Store.';
  if (isNative && platform === 'android') return 'Purchases are processed by Google Play.';
  if (canSimulateWebPurchase({ platform, isNative, isDevelopment })) return 'Development preview uses simulated test purchases only.';
  return 'Purchases are available in the native App Store or Google Play app.';
}
