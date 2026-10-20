import { CREDIT_PACKS, STARTER_CREDITS } from '../game/Economy';
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Check, Coins, Eye, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import { PRODUCTS, getStorePlatform, getStoreProducts, isNativeStorePlatform, subscribeStore, refreshStoreProducts } from '../services/MonetizationService';
import { canRetryPendingPurchase, storeFooterMessage } from '../services/StorePolicy';
import ShopPreviewCanvas from './ShopPreviewCanvas';
import { getCosmetic } from '../game/CosmeticsCatalog';
import { getCosmeticOwnership } from '../game/Economy';
import './RealMoneyStore.css';

const PRODUCT_DETAILS = {
  starter_pack: {
    label: 'Your next adventure, equipped',
    inclusions: ['Interceptor ship', 'Solar Blaster', `${STARTER_CREDITS.toLocaleString()} credits`],
    note: 'Includes the ship, weapon and credits. Rewarded ads remain optional for every pilot.',
  },
  credits_1000: {
    label: 'A little head start',
    inclusions: [`${CREDIT_PACKS.credits_1000.toLocaleString()} credits`, 'Spend in the Garage'],
    note: `Adds exactly ${CREDIT_PACKS.credits_1000.toLocaleString()} credits to your balance. Choose your own upgrades, ships or weapons.`,
  },
  credits_5500: {
    label: 'More room to explore',
    inclusions: [`${CREDIT_PACKS.credits_5500.toLocaleString()} credits total`, `Includes ${(CREDIT_PACKS.credits_5500 - 5 * CREDIT_PACKS.credits_1000).toLocaleString()} bonus credits`],
    note: `Adds exactly ${CREDIT_PACKS.credits_5500.toLocaleString()} credits to your balance, including ${(CREDIT_PACKS.credits_5500 - 5 * CREDIT_PACKS.credits_1000).toLocaleString()} bonus credits.`,
  },
  credits_15000: {
    label: 'Big plans for your ship',
    inclusions: [`${CREDIT_PACKS.credits_15000.toLocaleString()} credits`, 'Spend in the Garage'],
    note: `Adds exactly ${CREDIT_PACKS.credits_15000.toLocaleString()} credits to your balance. Pick the equipment that suits your flying style.`,
  },
};

export default function RealMoneyStore({ purchases = {}, pendingProducts = [], busyProduct, message, onPurchase, onRestore }) {
  const products = useSyncExternalStore(subscribeStore, getStoreProducts);
  const [storeError, setStoreError] = useState('');
  const [selectedId, setSelectedId] = useState(PRODUCTS[0].id);
  const selected = products.find(product => product.id === selectedId) || products[0];
  const cosmetic = getCosmetic(selected.cosmeticId);
  const details = PRODUCT_DETAILS[selected.id] || (cosmetic && { label: 'Permanent ship cosmetic', inclusions: ['Applies to every ship hull', 'Tints every friendly weapon shot', 'Animated engine trail'], note: 'Choose it in the Garage after purchase. Cosmetics never change stats or hitboxes.' });
  const cosmeticOwnership = getCosmeticOwnership();
  const isOwned = product => product.type === 'non_consumable' && Boolean(product.cosmeticId ? cosmeticOwnership[product.cosmeticId] : purchases[product.id]);
  const reloadProducts = () => {
    setStoreError('');
    void refreshStoreProducts().catch(() => setStoreError('Store products could not be loaded. Please try again.'));
  };
  useEffect(() => {
    void refreshStoreProducts().catch(() => setStoreError('Store products could not be loaded. Please try again.'));
  }, []);

  const purchaseAction = (product, featured = false) => {
    const owned = isOwned(product), pending = pendingProducts.includes(product.id);
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
      <div className="premium-intro">
        <span className="premium-intro-icon"><Sparkles size={19} /></span>
        <div><h3>A little extra for your journey</h3><p>Explore every pack before you choose.</p></div>
      </div>
      <section className="premium-spotlight" aria-label={`Preview: ${selected.name}`}>
        <div className="premium-stage">
          <ShopPreviewCanvas key={selected.id} kind={selected.cosmeticId ? 'cosmetic' : 'product'} itemId={selected.cosmeticId || selected.id} ship="default" upgrades={{}} pilotLevel={1} />
          <span className="premium-stage-label"><Eye size={13} /> Product preview</span>
        </div>
        <div key={selected.id} className="premium-feature-details selection-reveal">
          <span className="premium-eyebrow">{details.label}</span>
          <h3>{selected.name}</h3>
          <p className="premium-description">{selected.description}</p>
          <ul className="premium-inclusions" aria-label="Included in this purchase">
            {details.inclusions.map(inclusion => <li key={inclusion}><Check size={12} />{inclusion}</li>)}
          </ul>
          <p className="premium-note">{details.note}</p>
          {purchaseAction(selected, true)}
        </div>
      </section>
      <div className="premium-catalog-heading"><h3>Find your next boost</h3><span>{products.length} things to explore</span></div>
      <div className="premium-product-grid">
        {products.map(product => {
          const selectedCard = product.id === selected.id;
          return (
            <article key={product.id} className={`premium-product-card ${selectedCard ? 'is-selected' : ''}`}>
              <button
                type="button"
                className="premium-preview-button"
                onClick={() => setSelectedId(product.id)}
                aria-label={`Preview ${product.name}`}
                aria-pressed={selectedCard}
              >
                <span className="premium-card-visual"><ShopPreviewCanvas kind={product.cosmeticId ? 'cosmetic' : 'product'} itemId={product.cosmeticId || product.id} ship="default" upgrades={{}} pilotLevel={1} compact /></span>
                <span className="premium-preview-label">{selectedCard ? <Check size={13} /> : <Eye size={13} />}{selectedCard ? 'Previewing' : 'Preview'}</span>
              </button>
              <div className="premium-card-details">
                <h4>{product.name}</h4>
                <p>{product.cosmeticId ? 'Permanent hull, trail and shot tint' : product.id === 'starter_pack' ? 'Ship + weapon + credits' : product.id === 'credits_5500' ? `Includes ${(CREDIT_PACKS.credits_5500 - 5 * CREDIT_PACKS.credits_1000).toLocaleString()} bonus credits` : <><Coins size={12} />{product.credits.toLocaleString()} credits for your Garage</>}</p>
                {purchaseAction(product)}
              </div>
            </article>
          );
        })}
      </div>
      <footer className="premium-footer">
        <p><ShieldCheck size={16} /><span>{storeFooterMessage({ platform: getStorePlatform(), isNative: isNativeStorePlatform(), isDevelopment: import.meta.env?.DEV === true })}</span></p>
        <button type="button" onClick={onRestore} disabled={Boolean(busyProduct)} className="premium-restore"><RotateCcw size={16} />Restore purchases</button>
      </footer>
      {message && <p className="premium-message" role="status">{message}</p>}
      {storeError && <p className="premium-message" role="status">{storeError} <button type="button" onClick={reloadProducts}>Retry</button></p>}
    </div>
  );
}
