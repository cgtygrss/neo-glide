// Shared by the game and receipt verifier. USD cents are the base storefront
// targets; native stores supply the customer's localized purchase price.
export const STARTER_CREDITS = 200000;
export const CREDIT_PACK_CATALOG = Object.freeze([
  Object.freeze({ id: 'credits_50000', credits: 50000, usdCents: 49 }),
  Object.freeze({ id: 'credits_1000', credits: 100000, usdCents: 79 }),
  Object.freeze({ id: 'credits_250000', credits: 250000, usdCents: 149 }),
  Object.freeze({ id: 'credits_5500', credits: 550000, usdCents: 299 }),
  Object.freeze({ id: 'credits_1000000', credits: 1000000, usdCents: 449 }),
  Object.freeze({ id: 'credits_15000', credits: 1500000, usdCents: 599 }),
]);
export const CREDIT_PACKS = Object.freeze(Object.fromEntries(CREDIT_PACK_CATALOG.map(pack => [pack.id, pack.credits])));
export const SKIN_PRICE_ROUNDING = CREDIT_PACKS.credits_250000;
export const COSMETIC_MINIMUM_CREDITS = 1000000;
export const COSMETIC_SET_CREDIT_OFFSET = 1500000;
export const BEST_VALUE_CREDIT_PACK = CREDIT_PACK_CATALOG.reduce((best, pack) => pack.credits * best.usdCents > best.credits * pack.usdCents ? pack : best);
// Keep the existing tier differences, rebased for the million-credit skin floor.
// Native currency prices and purchased credit pack quantities are independent.
export const COSMETIC_CREDIT_REFERENCE = Object.freeze({ id: 'credits_15000', credits: 1500000, usdCents: 799 });
export function roundCosmeticCreditCost(credits) {
  if (!Number.isFinite(credits) || credits <= 0) throw new Error('Invalid cosmetic credit cost.');
  return Math.max(SKIN_PRICE_ROUNDING, Math.floor(credits / SKIN_PRICE_ROUNDING) * SKIN_PRICE_ROUNDING);
}
export function roundUpgradeCreditCost(credits) {
  if (!Number.isFinite(credits) || credits <= 0) throw new Error('Invalid upgrade credit cost.');
  const step = credits >= SKIN_PRICE_ROUNDING ? CREDIT_PACKS.credits_50000 : credits >= CREDIT_PACKS.credits_50000 ? 5000 : 500;
  return Math.max(step, Math.floor(credits / step) * step);
}
export function skinCreditsForPrice(usdCents) {
  if (!Number.isSafeInteger(usdCents) || usdCents <= 0) throw new Error('Invalid skin price.');
  const referencePrice = usdCents * COSMETIC_CREDIT_REFERENCE.credits / COSMETIC_CREDIT_REFERENCE.usdCents;
  const previousPrice = Math.round(referencePrice / 10000) * 10000;
  return roundCosmeticCreditCost(previousPrice) + COSMETIC_SET_CREDIT_OFFSET;
}
export const usdPrice = cents => `$${(cents / 100).toFixed(2)}`;

const skinPriceCents = {
  copper_horizon: 299, arctic_pulse: 349, cyber_current: 399, jade_drift: 449,
  rose_circuit: 499, solar_forge: 599, pearl_comet: 699, void_pilot: 799,
  cobalt_storm: 899, prism_voyager: 999,
  mint_condition: 199, scarlet_comet: 299, amber_signal: 249, lunar_silver: 299,
  ocean_depth: 349, lavender_dream: 399, toxic_bloom: 349, desert_mirage: 399,
  ruby_eclipse: 499, glacier_blue: 499, saffron_sky: 449, midnight_gold: 549,
  coral_reef: 449, ultraviolet: 599, nebula_circuit: 499, aurora_pathfinder: 599,
};
export const COSMETIC_PRICING = Object.freeze(Object.fromEntries(Object.entries(skinPriceCents).map(([id, usdCents]) => [id, Object.freeze({
  id, productId: `cosmetic_${id}`, usdCents, price: usdPrice(usdCents), creditPrice: skinCreditsForPrice(usdCents),
})])));
export const COSMETIC_PRODUCT_IDS = Object.freeze(Object.values(COSMETIC_PRICING).map(item => item.productId));
