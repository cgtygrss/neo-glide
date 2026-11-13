import { STARTER_CREDITS } from '../game/Economy';
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Check, Eye, Sparkles } from 'lucide-react';
import { getStorePlatform, getStoreProducts, isNativeStorePlatform, subscribeStore, refreshStoreProducts } from '../services/MonetizationService';
import { sortStoreProducts } from '../game/CatalogSorting';
import { canRetryPendingPurchase, storeFooterMessage } from '../services/StorePolicy';
import ShopPreviewCanvas from './ShopPreviewCanvas';
import { getCosmetic } from '../game/CosmeticsCatalog';
import { getCosmeticOwnership } from '../game/Economy';
import './RealMoneyStore.css';
import CatalogCarousel from './CatalogCarousel';
import CatalogDetails from './CatalogDetails';
import CosmeticPurchaseOptions from './CosmeticPurchaseOptions';
import CosmeticOfferNote from './CosmeticOfferNote';
import CosmeticKitDetails from './CosmeticKitDetails';
import { onlineServicesAllowed } from '../privacy/AudiencePolicy.js';

const PRODUCT_DETAILS = {
  starter_pack: {
    label: 'Your next adventure, equipped',
    inclusions: ['Interceptor ship', 'Solar Blaster', `${STARTER_CREDITS.toLocaleString()} credits`],
    note: 'Includes the ship, weapon and credits. Rewarded ads remain optional for every pilot.',
  },
};


export default function RealMoneyStore({ initialProductId, currency = 0, onCreditUnlock, purchases = {}, pendingProducts = [], busyProduct, message, onPurchase, onRestore }) {
  const nativeProducts = useSyncExternalStore(subscribeStore, getStoreProducts);
  const products = sortStoreProducts(nativeProducts);
  const [storeError, setStoreError] = useState('');
  const [selectedId, setSelectedId] = useState(initialProductId || null);
  const selected = products.find(product => product.id === selectedId) || products[0];
  const cosmetic = getCosmetic(selected.cosmeticId);
  const details = PRODUCT_DETAILS[selected.id] || (selected.type === 'consumable' ? {
    label: selected.credits <= 100000 ? 'A little head start' : selected.credits >= 1000000 ? 'Big plans for your ship' : 'More room to explore',
    inclusions: [`${selected.credits.toLocaleString()} credits`, 'Spend in the Garage'],
    note: `Adds exactly ${selected.credits.toLocaleString()} credits to your balance. Choose your own ships, equipment or visual kits.`,
  } : cosmetic && { label: cosmetic.signature || 'Complete visual kit', inclusions: [...(cosmetic.features || []), 'One visual kit for your entire fleet'], note: 'Unlock with credits or a one-time store purchase. Yours permanently on every ship.' });
  const cosmeticOwnership = getCosmeticOwnership();
  const isOwned = product => product.type === 'non_consumable' && Boolean(product.cosmeticId ? cosmeticOwnership[product.cosmeticId] : purchases[product.id]);
  const reloadProducts = () => {
    setStoreError('');
    void refreshStoreProducts().catch(() => setStoreError('Store products could not be loaded. Please try again.'));
  };
  useEffect(() => {
    void refreshStoreProducts().catch(() => setStoreError('Store products could not be loaded. Please try again.'));
  }, []);

  if (!onlineServicesAllowed()) return <section className="shop-preview-note" aria-label="Family play store"><h2>Play and earn</h2><p>Real-money purchases are unavailable in family play. Earn credits in ordinary flights to unlock ships, equipment and visual kits.</p></section>;

  const purchaseAction = (product, featured = false) => {
    const owned = isOwned(product), pending = pendingProducts.includes(product.id);
    if (product.cosmeticId) return <CosmeticPurchaseOptions cosmetic={getCosmetic(product.cosmeticId)} storeProduct={product} currency={currency}
      owned={owned} ownedCosmetics={cosmeticOwnership} pending={pending} busyProduct={busyProduct} onCreditUnlock={onCreditUnlock} onPurchase={onPurchase}/>;
    return (
      <button
        type="button"
        className={`arcade-button ${owned ? 'secondary' : 'primary'} premium-buy ${featured ? 'premium-buy-featured' : ''}`}
        disabled={owned || (pending && !canRetryPendingPurchase({ platform: getStorePlatform(), isPending: pending, isOwned: owned })) || !product.available || Boolean(busyProduct)}
        onClick={() => onPurchase(product.id)}
        aria-label={owned ? `${product.name} owned` : !product.available ? `${product.name} unavailable` : `Buy ${product.name} for ${product.price}`}
      >
        {owned ? <><Check size={17} /> Owned</> : pending ? canRetryPendingPurchase({ platform: getStorePlatform(), isPending: pending, isOwned: owned }) ? 'Check / retry purchase' : 'Approval pending' : busyProduct === product.id ? 'Processing…' : !product.available ? 'Unavailable' : <><span>Buy</span><strong>{product.price}</strong></>}
      </button>
    );
  };

  return (
    <div className="premium-store">
      <CatalogCarousel items={products} selectedId={selected.id} onSelect={setSelectedId} label="Store products" itemLabel="product" accent={cosmetic?.colors.accent || '#edc98e'}>
      <section className="premium-spotlight" aria-label={`Preview: ${selected.name}`}>
        <div className="premium-stage">
          <ShopPreviewCanvas key={selected.id} kind={selected.cosmeticId ? 'cosmetic' : 'product'} itemId={selected.cosmeticId || selected.id} ship="default" upgrades={{}} pilotLevel={1} />
          <span className="premium-stage-label"><Eye size={13} /> Product preview</span>
        </div>
        <CatalogDetails key={selected.id} className="premium-feature-details selection-reveal" actions={<>
          {purchaseAction(selected, true)}
          {message && <p className="premium-message" role="status">{message}</p>}
          {storeError && <p className="premium-message" role="status">{storeError} <button type="button" onClick={reloadProducts}>Retry</button></p>}
        </>}>
          <span className="premium-eyebrow">{cosmetic?.showpiece && <Sparkles size={13}/>} {cosmetic?.showpiece ? `Showpiece · ${details.label}` : details.label}</span>
          <h3>{selected.name}</h3>
          {cosmetic && <CosmeticOfferNote cosmetic={cosmetic} owned={isOwned(selected)} ownedCosmetics={cosmeticOwnership}/>}
          {cosmetic && <CosmeticKitDetails cosmetic={cosmetic}/>}
          <p className="premium-description">{selected.description}</p>
          {!cosmetic && <ul className="premium-inclusions" aria-label="Included in this purchase">
            {details.inclusions.map(inclusion => <li key={inclusion}><Check size={12} />{inclusion}</li>)}
          </ul>}
          <p className="premium-note">{details.note}</p>
          <p className="shop-preview-note">{storeFooterMessage({ platform: getStorePlatform(), isNative: isNativeStorePlatform(), isDevelopment: import.meta.env?.DEV === true })}</p>
          {isNativeStorePlatform() && <details className="premium-recovery">
            <summary>Missing a purchase?</summary>
            <p>Owned items sync automatically. If one is missing, restore using the store account that bought it. The store may ask you to sign in.</p>
            <button type="button" className="premium-restore" onClick={onRestore} disabled={Boolean(busyProduct)}>{busyProduct === 'restore' ? 'Restoring…' : 'Restore purchases'}</button>
          </details>}
        </CatalogDetails>
      </section>
      </CatalogCarousel>
    </div>
  );
}
