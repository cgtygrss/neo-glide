import React from 'react';
import { Check, Coins } from 'lucide-react';
import { getStorePlatform } from '../services/MonetizationService';
import { canRetryPendingPurchase } from '../services/StorePolicy';
import { cosmeticCreditOffer } from '../game/GarageOffers';
import useOfferClock from './useOfferClock';
import { onlineServicesAllowed } from '../privacy/AudiencePolicy.js';

// Existing complete sets share ownership across credit and native purchases.
// Standalone appearances are separate credit unlocks, also included in a set.
export default function CosmeticPurchaseOptions({ cosmetic, storeProduct, currency, owned, ownedCosmetics = {}, equipped = false, pending = false, busyProduct, onCreditUnlock, onPurchase, onEquip }) {
  const offer = cosmeticCreditOffer(cosmetic, useOfferClock(), ownedCosmetics);
  const skinOnly = cosmetic.kind === 'skin';
  if (owned) return <button type="button" className={`arcade-button ${equipped || !onEquip ? 'secondary' : 'primary'}`} disabled={equipped || !onEquip}
    onClick={() => onEquip(cosmetic.id, 'cosmetic')}><Check size={16}/>{equipped ? 'Active' : onEquip ? 'Equip cosmetic' : 'Owned'}</button>;
  if (pending) {
    if (skinOnly) return <button type="button" className="arcade-button secondary" disabled>Set purchase approval pending</button>;
    const canRetry = canRetryPendingPurchase({ platform: getStorePlatform(), isPending: true, isOwned: false });
    return <button type="button" className="arcade-button secondary" disabled={!canRetry || Boolean(busyProduct)} onClick={() => onPurchase(cosmetic.productId)}>{canRetry ? 'Check / retry purchase' : 'Approval pending'}</button>;
  }
  return <div className={`cosmetic-actions${skinOnly ? ' single' : ''}`} role="group" aria-label={`Purchase options for ${cosmetic.name}`}>
    <button type="button" className="cosmetic-action credit" disabled={currency < offer.price || Boolean(busyProduct)}
      aria-label={`Unlock ${cosmetic.name} for ${offer.price.toLocaleString()} credits${offer.discountPercent ? `, ${offer.discountPercent}% off credits` : ''}`}
      onClick={() => onCreditUnlock(cosmetic.id, offer.price, 'cosmetic')}>
      <span>{skinOnly ? 'Unlock skin' : offer.skinCredit ? 'Complete set' : 'Unlock set'} <Coins size={15}/></span><strong>{offer.price.toLocaleString()}</strong><small>{offer.skinCredit ? 'owned skin deducted' : offer.discountPercent ? `${offer.discountPercent}% off credits` : 'credits'}</small>
    </button>
    {!skinOnly && onlineServicesAllowed() && <button type="button" className="cosmetic-action cash" disabled={!storeProduct?.available || Boolean(busyProduct)}
      aria-label={storeProduct?.available ? `Buy ${cosmetic.name} for ${storeProduct.price}, one-time purchase` : `${cosmetic.name} store purchase unavailable`}
      onClick={() => onPurchase(cosmetic.productId)}>
      <span>Buy set</span><strong>{storeProduct?.available ? storeProduct.price : 'Unavailable'}</strong><small>{offer.skinCredit ? 'full set · no credit deduction' : 'one-time · every ship'}</small>
    </button>}
  </div>;
}
