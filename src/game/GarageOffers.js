import { COSMETIC_PRICING, COSMETIC_MINIMUM_CREDITS } from '../../backend/shared/store-catalog.js';
import { skinCreditCost } from './SkinPricing.js';

// One daily credit offer across every surface and the wallet debit path.
// Ownership, catalog ordering and store availability never redraw the offer.
export const DAILY_SET_DISCOUNT_PERCENT = 20;

export function dailySetOffer(now = Date.now()) {
  if (!Number.isFinite(now)) return null;
  const selected = dailyPicks(Object.values(COSMETIC_PRICING), 1, now)[0];
  const { startsAt, refreshesAt } = garageRotationWindow(now);
  return { cosmeticId: selected.id, startsAt, endsAt: refreshesAt };
}

export function cosmeticCreditOffer(cosmetic, now = Date.now(), ownership = {}) {
  const originalPrice = cosmetic.creditPrice;
  const daily = dailySetOffer(now), active = Boolean(cosmetic.kind !== 'skin' && daily && daily.cosmeticId === cosmetic.id);
  // Regular prices are multiples of 250,000; 20% off gives clean 50,000 steps.
  const discountedPrice = active ? Math.max(COSMETIC_MINIMUM_CREDITS, Math.floor(originalPrice * (100 - DAILY_SET_DISCOUNT_PERCENT) / 100)) : originalPrice;
  const skinCredit = cosmetic.kind !== 'skin' && ownership[`skin_${cosmetic.id}`]
    ? skinCreditCost(originalPrice) : 0;
  const price = Math.max(0, discountedPrice - skinCredit);
  return { price, originalPrice, discountPercent: active ? Math.round((originalPrice - discountedPrice) / originalPrice * 100) : 0,
    skinCredit, savings: originalPrice - discountedPrice, endsAt: active ? daily.endsAt : null };
}

export function garageRotationWindow(now = Date.now()) {
  const date = new Date(now);
  const year = date.getFullYear(), month = date.getMonth(), day = date.getDate();
  // Calendar days, rather than elapsed 24h blocks, handle local midnight and DST.
  return { day: Math.floor(Date.UTC(year, month, day) / 86_400_000), startsAt: new Date(year, month, day).getTime(),
    refreshesAt: new Date(year, month, day + 1).getTime() };
}

export function nextGarageRefresh(now = Date.now()) {
  return garageRotationWindow(now).refreshesAt;
}

const spotlightOrder = id => {
  let hash = 2166136261;
  for (const letter of `garage-daily:${id}`) hash = Math.imul(hash ^ letter.charCodeAt(0), 16777619);
  return hash >>> 0;
};

function dailyPicks(items, count, now) {
  if (!items.length) return [];
  // One stable mixed ring: no fresh random draws on a rerender, reopen, purchase
  // or store-price refresh. Every item gets a turn, regardless of catalog order.
  const ring = [...items].sort((a, b) => spotlightOrder(a.id) - spotlightOrder(b.id) || a.id.localeCompare(b.id));
  const stride = Math.min(count, Math.ceil(ring.length / 2));
  const offset = ((garageRotationWindow(now).day * stride) % ring.length + ring.length) % ring.length;
  return Array.from({ length: Math.min(count, ring.length) }, (_, i) => ring[(offset + i) % ring.length]);
}

export function garageSpotlights(cosmetics, now = Date.now()) {
  if (!cosmetics.length) return [];
  const daily = dailySetOffer(now);
  const hero = cosmetics.find(cosmetic => cosmetic.id === daily?.cosmeticId) || dailyPicks(cosmetics, 1, now)[0];
  return [hero, ...dailyPicks(cosmetics.filter(cosmetic => cosmetic.id !== hero.id), 1, now)];
}

export function garageCreditPack(products, now = Date.now()) {
  return dailyPicks(products.filter(product => product.type === 'consumable' && product.credits > 0), 1, now)[0];
}

export const offerDeadline = timestamp => new Intl.DateTimeFormat(undefined, {
  month:'short', day:'numeric', hour:'numeric', minute:'2-digit',
}).format(new Date(timestamp));
