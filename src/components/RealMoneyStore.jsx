import { useEffect, useState, useSyncExternalStore } from 'react';
import { Check, Eye } from 'lucide-react';
import { getStorePlatform, getStoreProducts, isNativeStorePlatform, subscribeStore, refreshStoreProducts } from '../services/MonetizationService';
import { sortStoreProducts } from '../game/CatalogSorting';
import { canRetryPendingPurchase, storeFooterMessage } from '../services/StorePolicy';
import ShopPreviewCanvas from './ShopPreviewCanvas';
import './RealMoneyStore.css';
import CatalogCarousel from './CatalogCarousel';
import CatalogDetails from './CatalogDetails';
import PurchaseRecovery from './PurchaseRecovery';
import { onlineServicesAllowed } from '../privacy/AudiencePolicy.js';

export default function RealMoneyStore({ initialProductId, pendingProducts = [], busyProduct, message, onPurchase, onRestore }) {
  const nativeProducts = useSyncExternalStore(subscribeStore, getStoreProducts);
  const products = sortStoreProducts(nativeProducts.filter(product => product.type === 'consumable' && !product.cosmeticId));
  const [storeError, setStoreError] = useState('');
  const [selectedId, setSelectedId] = useState(initialProductId || null);
  const selected = products.find(product => product.id === selectedId) || products[0];
  const details = selected && {
    label: selected.credits <= 100000 ? 'A little head start' : selected.credits >= 1000000 ? 'Big plans for your ship' : 'More room to explore',
    inclusions: [`${selected.credits.toLocaleString()} credits`, 'Spend in the Garage'],
    note: `Adds exactly ${selected.credits.toLocaleString()} credits to your balance. Choose your own ships, equipment or visual kits.`,
  };
  const reloadProducts = () => {
    setStoreError('');
    void refreshStoreProducts().catch(() => setStoreError('Store products could not be loaded. Please try again.'));
  };
  useEffect(() => {
    void refreshStoreProducts().catch(() => setStoreError('Store products could not be loaded. Please try again.'));
  }, []);

  if (!onlineServicesAllowed()) return <section className="shop-preview-note" aria-label="Family play store"><h2>Play and earn</h2><p>Real-money purchases are unavailable in family play. Earn credits in ordinary flights to unlock ships, equipment and visual kits.</p></section>;
  if (!selected) return <section className="shop-preview-note" aria-label="Credit packs unavailable"><h2>Credit packs unavailable</h2><p>Credit packs are unavailable on this platform. Earn credits in ordinary flights.</p></section>;

  const purchaseAction = (product, featured = false) => {
    const pending = pendingProducts.includes(product.id);
    return (
      <button
        type="button"
        className={`arcade-button primary premium-buy ${featured ? 'premium-buy-featured' : ''}`}
        disabled={(pending && !canRetryPendingPurchase({ platform: getStorePlatform(), isPending: pending, isOwned: false })) || !product.available || Boolean(busyProduct)}
        onClick={() => onPurchase(product.id)}
        aria-label={!product.available ? `${product.name} unavailable` : `Buy ${product.name} for ${product.price}`}
      >
        {pending ? canRetryPendingPurchase({ platform: getStorePlatform(), isPending: pending, isOwned: false }) ? 'Check / retry purchase' : 'Approval pending' : busyProduct === product.id ? 'Processing…' : !product.available ? 'Unavailable' : <><span>Buy</span><strong>{product.price}</strong></>}
      </button>
    );
  };

  return (
    <div className="premium-store">
      <CatalogCarousel items={products} selectedId={selected.id} onSelect={setSelectedId} label="Credit packs" itemLabel="credit pack" accent="#edc98e">
      <section className="premium-spotlight" aria-label={`Preview: ${selected.name}`}>
        <div className="premium-stage">
          <ShopPreviewCanvas key={selected.id} kind="product" itemId={selected.id} ship="default" upgrades={{}} pilotLevel={1} />
          <span className="premium-stage-label"><Eye size={13} /> Product preview</span>
        </div>
        <CatalogDetails key={selected.id} className="premium-feature-details selection-reveal" actions={<>
          {purchaseAction(selected, true)}
          {message && <p className="premium-message" role="status">{message}</p>}
          {storeError && <p className="premium-message" role="status">{storeError} <button type="button" onClick={reloadProducts}>Retry</button></p>}
        </>}>
          <span className="premium-eyebrow">{details.label}</span>
          <h3>{selected.name}</h3>
          <p className="premium-description">{selected.description}</p>
          <ul className="premium-inclusions" aria-label="Included in this purchase">
            {details.inclusions.map(inclusion => <li key={inclusion}><Check size={12} />{inclusion}</li>)}
          </ul>
          <p className="premium-note">{details.note}</p>
          <p className="shop-preview-note">{storeFooterMessage({ platform: getStorePlatform(), isNative: isNativeStorePlatform(), isDevelopment: import.meta.env?.DEV === true })}</p>
          <PurchaseRecovery busyProduct={busyProduct} onRestore={onRestore}/>
        </CatalogDetails>
      </section>
      </CatalogCarousel>
    </div>
  );
}
