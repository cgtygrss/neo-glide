import React from 'react';
import { cosmeticCreditOffer, offerDeadline } from '../game/GarageOffers';
import useOfferClock from './useOfferClock';

export default function CosmeticOfferNote({ cosmetic, owned, ownedCosmetics = {} }) {
  const offer = cosmeticCreditOffer(cosmetic, useOfferClock(), ownedCosmetics);
  if (owned || (!offer.discountPercent && !offer.skinCredit)) return null;
  return <div className="cosmetic-offer-note">
    {offer.discountPercent > 0 && <><strong>Today's set · {offer.discountPercent}% off with credits</strong><del>{offer.originalPrice.toLocaleString()} credits</del><small>Save {offer.savings.toLocaleString()} credits · Ends {offerDeadline(offer.endsAt)}. Store currency price is separate.</small></>}
    {offer.skinCredit > 0 && <small>Your skin is included · {offer.skinCredit.toLocaleString()} credits deducted from the credit unlock price.</small>}
  </div>;
}
