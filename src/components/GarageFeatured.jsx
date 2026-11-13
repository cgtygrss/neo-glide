import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { ArrowRight, Check, Coins, Sparkles, Wind, Crosshair } from 'lucide-react';
import ShipPreview from './ShipPreview';
import { garageSpotlights, garageCreditPack, garageRotationWindow, cosmeticCreditOffer, offerDeadline } from '../game/GarageOffers';
import { getStoreProducts, refreshStoreProducts, subscribeStore } from '../services/MonetizationService';
import useOfferClock from './useOfferClock';
import './GarageFeatured.css';
import { getCosmetic } from '../game/CosmeticsCatalog';
import { onlineServicesAllowed } from '../privacy/AudiencePolicy.js';

function Price({ cosmetic, product, owned, ownership, pending, now }) {
  const offer = cosmeticCreditOffer(cosmetic, now, ownership);
  if (owned) return <span className="feature-state"><Check size={14}/>In your collection</span>;
  if (pending) return <span className="feature-state">Approval pending</span>;
  return <span className="feature-price">
    {offer.discountPercent > 0 && <del aria-label={`Regular price ${offer.originalPrice.toLocaleString()} credits`}>{offer.originalPrice.toLocaleString()}</del>}
    <strong><Coins size={14}/>{offer.price.toLocaleString()} <small>credits</small></strong>
    <span className="feature-cash">{!onlineServicesAllowed() ? 'Earn with flight credits' : cosmetic.kind === 'skin' ? 'Permanent · Every ship' : offer.skinCredit ? 'Owned skin deducted' : product?.available ? `or ${product.price} · one-time` : 'Store price unavailable'}</span>
  </span>;
}

export default function GarageFeatured(props) {
  const products = useSyncExternalStore(subscribeStore, getStoreProducts);
  const [status, setStatus] = useState('loading');
  const now = useOfferClock();
  const refresh = () => {
    setStatus('loading');
    void refreshStoreProducts().then(() => setStatus('ready'), () => setStatus('error'));
  };
  useEffect(() => {
    let active = true;
    void refreshStoreProducts().then(() => { if (active) setStatus('ready'); }, () => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, []);
  return <GarageFeaturedView {...props} products={products} status={status} now={now} onRetry={refresh}/>;
}

export function GarageFeaturedView({ cosmetics, ownedCosmetics, pendingProducts, ship, onCosmetic, onProduct, onBrowse, onBrowseSets = onBrowse, products, status, now, onRetry }) {
  const [hero, companionSet] = garageSpotlights(cosmetics, now);
  const companion = companionSet && getCosmetic(`skin_${companionSet.id}`);
  if (!hero) return <div className="garage-featured is-empty"><Sparkles size={30}/><h3>Your next adventure starts here.</h3><p>Explore ships, equipment and galaxy destinations.</p><button type="button" className="arcade-button primary" onClick={onBrowse}>Explore the Garage<ArrowRight size={18}/></button></div>;
  const offer = cosmeticCreditOffer(hero, now, ownedCosmetics), owned = Boolean(ownedCosmetics[hero.id]);
  const productFor = cosmetic => products.find(product => product.id === cosmetic.productId);
  const pending = cosmetic => pendingProducts.includes(cosmetic.kind === 'skin' ? getCosmetic(cosmetic.setId).productId : cosmetic.productId);
  const creditPack = garageCreditPack(products, now);
  const companionCard = cosmetic => cosmetic && <button type="button" className={`feature-tile feature-cosmetic motif-${cosmetic.motif || 'classic'}`} style={{ '--feature-accent': cosmetic.colors.accent }} onClick={() => onCosmetic(cosmetic.id)} aria-label={`Explore ${cosmetic.name} standalone skin`}>
    <span className="feature-tile-art"><ShipPreview ship={ship} cosmeticId={cosmetic.id}/></span>
    <span className="feature-tile-copy"><span className="feature-kicker">FEATURED SKIN</span><strong className="feature-product-name">{cosmetic.name}</strong><span className="feature-tile-signature">Ship appearance only</span>
      <Price cosmetic={cosmetic} owned={ownedCosmetics[cosmetic.id]} ownership={ownedCosmetics} pending={pending(cosmetic)} now={now}/>
    </span><ArrowRight className="feature-tile-arrow" size={18}/>
  </button>;
  return <div className="garage-featured">
    <div className="feature-intro"><div><span className="feature-kicker">THE DAILY EDIT</span><h3>Today's showcase.</h3></div><button type="button" className="feature-browse" onClick={onBrowseSets}>Sets & skins<ArrowRight size={16}/></button></div>
    <div className="feature-grid">
      <article className="feature-hero" style={{ '--feature-accent': hero.colors.accent }} aria-label={`${hero.name} daily skin set`}>
        <div className="feature-hero-art"><span className="feature-orbit" aria-hidden="true"/><span className="feature-hero-tag">{owned ? "DAILY SET · IN YOUR COLLECTION" : offer.discountPercent ? `DAILY SET · ${offer.discountPercent}% OFF CREDITS` : 'COMPLETE SKIN SET'}</span><ShipPreview ship={ship} cosmeticId={hero.id} boosting/><span className="feature-edition"><span aria-hidden="true"/>COMPLETE SET / {String(hero.rank).padStart(2,'0')}</span></div>
        <div className="feature-hero-copy"><span className="feature-kicker">{hero.signature}</span><h3>{hero.name}</h3>
          <div className="feature-set-includes" aria-label="Included in this skin set"><span><Sparkles size={13}/>Ship design</span><span><Wind size={13}/>Engine trail</span><span><Crosshair size={13}/>Shot effects</span></div>
          <span className="feature-set-ownership">One unlock · Every ship · Yours permanently</span>
          <div className="feature-hero-footer"><Price cosmetic={hero} product={productFor(hero)} owned={owned} ownership={ownedCosmetics} pending={pending(hero)} now={now}/><button type="button" className="feature-primary" onClick={() => onCosmetic(hero.id)}>View full set<ArrowRight size={18}/></button></div>
        </div>
      </article>
      <div className="feature-side">
        {companionCard(companion)}
        {!onlineServicesAllowed() ? <div className="feature-tile feature-credit"><span className="feature-credit-art" aria-hidden="true"><span><Coins size={42}/></span></span><span className="feature-tile-copy"><span className="feature-kicker">FLY & EARN</span><strong className="feature-product-name">Your next unlock</strong><span className="feature-tile-signature">Collect credits in ordinary flights. No purchase or ad needed.</span></span></div> : creditPack ? <button type="button" className="feature-tile feature-credit" onClick={() => onProduct(creditPack.id)} aria-label={`Explore ${creditPack.name} pack`}>
          <span className="feature-credit-art" aria-hidden="true"><span><Coins size={42}/></span><Coins size={23}/><Coins size={18}/></span>
          <span className="feature-tile-copy"><span className="feature-kicker">CREDIT PACK</span><strong className="feature-product-name">{creditPack.credits.toLocaleString()}<small>credits</small></strong><span className="feature-tile-signature">Your next Garage unlock.</span><strong className="feature-pack-price">{creditPack.available ? creditPack.price : 'Store price unavailable'}<span>View pack<ArrowRight size={14}/></span></strong></span>
        </button> : <div className="feature-tile feature-credit" aria-label="Credit packs unavailable"><span className="feature-credit-art" aria-hidden="true"><span><Coins size={42}/></span></span><span className="feature-tile-copy"><span className="feature-kicker">CREDIT PACK</span><strong className="feature-product-name">Credits</strong><span className="feature-tile-signature">Credit packs are unavailable on this platform.</span></span></div>}
      </div>
    </div>
    <div className="feature-footer" role="status" aria-live="polite">{onlineServicesAllowed() ? <><span className="feature-refresh">New picks at {offerDeadline(garageRotationWindow(now).refreshesAt)}.{offer.endsAt && <span>Today's credit offer ends then.</span>}</span>{status === 'loading' ? <span>Updating store prices…</span> : status === 'error' ? <button type="button" onClick={onRetry}>Prices unavailable · Retry</button> : <span>One set · One skin · One credit pack</span>}</> : <span>Family play · Earn credits through flights</span>}</div>
  </div>;
}
