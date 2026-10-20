import { grantStoreTransaction, syncStoreSnapshot } from '../game/Economy.js';

// All native delivery paths use this coordinator. StoreKit keeps unfinished
// transactions across launches; the durable wallet ledger makes replay harmless.
export function createStoreDelivery(bridge, onChange = () => {}) {
  const pending = new Map();
  function deliver(transaction) {
    if (!transaction?.verified || !transaction.transactionId) return Promise.reject(new Error('Purchase could not be verified.'));
    const existing = pending.get(transaction.transactionId);
    if (existing) return existing;
    const operation = Promise.resolve().then(async () => {
      const result = grantStoreTransaction(transaction);
      onChange({ type: 'delivery', productId: transaction.productId, applied: result.applied });
      try {
        await bridge.finishTransaction({ transactionId: transaction.transactionId, productId: transaction.productId });
        return { ...result, finishPending: false };
      } catch {
        // Delivery already committed. Retry the acknowledgement on next replay,
        // never present this as a failed purchase that should be bought again.
        return { ...result, finishPending: true };
      }
    }).finally(() => pending.delete(transaction.transactionId));
    pending.set(transaction.transactionId, operation);
    return operation;
  }
  async function replay() {
    const result = await bridge.pendingTransactions();
    for (const transaction of result.transactions || []) await deliver(transaction);
  }
  return { deliver, replay };
}

export function createStoreClient(bridge, onChange = () => {}, onError = () => {}) {
  let listener;
  let reconciliation;
  let entitlementGeneration = 0;
  let requestActive = false;

  function invalidateEntitlementSnapshot() {
    entitlementGeneration++;
  }

  // Deliveries can arrive through a purchase result as well as the native
  // listener. Capture the generation after replay, so replay itself cannot
  // force its reconciliation loop to retry indefinitely.
  const delivery = createStoreDelivery(bridge, change => {
    invalidateEntitlementSnapshot();
    onChange(change);
  });

  function reconcile() {
    if (reconciliation) return reconciliation;
    reconciliation = Promise.resolve().then(async () => {
      while (true) {
        // Process unfinished Starter purchases BEFORE its entitlement snapshot,
        // otherwise an interrupted first purchase could lose the credit portion.
        await delivery.replay();
        const snapshotGeneration = entitlementGeneration;
        const result = await bridge.currentEntitlements();
        if (!result || !Array.isArray(result.productIds) || result.productIds.some(id => typeof id !== 'string')) {
          throw new Error('Store entitlement data could not be verified.');
        }
        // iOS has no durable Ask-to-Buy pending list. Preserve JS markers when
        // omitted; Android supplies this field when Play can report pending.
        if (result.pendingProductIds !== undefined && (!Array.isArray(result.pendingProductIds) || result.pendingProductIds.some(id => typeof id !== 'string'))) {
          throw new Error('Store pending purchase data could not be verified.');
        }
        // A native update can deliver ownership while this request is in
        // flight. Its old snapshot must never clear that committed delivery.
        if (snapshotGeneration !== entitlementGeneration) continue;
        const pendingProductIds = result.pendingProductIds;
        // One atomic write, only after all native data is structurally valid.
        syncStoreSnapshot(result.productIds, pendingProductIds);
        onChange({ type: 'entitlements', pendingProductIds });
        return;
      }
    }).finally(() => { reconciliation = undefined; });
    return reconciliation;
  }

  async function start() {
    if (!listener) {
      listener = Promise.resolve(bridge.addListener('storeUpdate', update => {
        invalidateEntitlementSnapshot();
        const operation = update.transaction ? delivery.deliver(update.transaction) : reconcile();
        void operation.catch(onError);
      })).catch(error => { listener = undefined; throw error; });
    }
    await listener;
    await reconcile();
  }

  async function purchase(productId) {
    if (requestActive) throw new Error('Another store request is still in progress.');
    requestActive = true;
    try {
      await start();
      const result = await bridge.purchase({ productId });
      if (result.status === 'cancelled') return { status: 'cancelled' };
      if (result.status === 'pending') return { status: 'pending' };
      if (result.status === 'owned') {
        // An ownership response can race an unfinished delivery.
        await reconcile();
        return { status: 'owned' };
      }
      if (result.status !== 'purchased' || result.transaction?.productId !== productId) throw new Error('Purchase could not be verified.');
      return { status: 'purchased', ...await delivery.deliver(result.transaction) };
    } finally { requestActive = false; }
  }

  async function restore() {
    if (requestActive) throw new Error('Another store request is still in progress.');
    requestActive = true;
    try {
      await bridge.restorePurchases();
      await start();
    } finally { requestActive = false; }
  }
  return { start, reconcile, purchase, restore };
}
