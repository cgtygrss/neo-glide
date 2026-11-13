import { COSMETIC_MINIMUM_CREDITS, SKIN_PRICE_ROUNDING } from '../../backend/shared/store-catalog.js';

// Standalone appearances use 60% of the regular set, rounded down to 250k
// pack steps with a 1m floor. Reuse this value when completing the same set.
export const skinCreditCost = setCreditPrice => Math.max(COSMETIC_MINIMUM_CREDITS,
  Math.floor(setCreditPrice * .6 / SKIN_PRICE_ROUNDING) * SKIN_PRICE_ROUNDING);
