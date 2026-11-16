import { RequestError } from './errors.js';
import { creditWallet } from './online-economy.js';
export const SAVE_KEYS=['neon_glide_wallet_v3','neon_glide_pilot_profile_v2','neon_glide_upgrades','neon_glide_owned_ships','neon_glide_equipped_ship','neon_glide_owned_weapons','neon_glide_equipped_weapon','neon_glide_equipped_cosmetic','neon_glide_learned_controls'];
export function validateSave(data) {
  if(!data || typeof data!=='object' || Array.isArray(data) || JSON.stringify(data).length>400000) throw new RequestError('Invalid save.');
  const clean={};
  for(const key of SAVE_KEYS) if(data[key]!==undefined) {
    if(typeof data[key]!=='string') throw new RequestError('Invalid save field.');
    const literal=key.includes('equipped_');
    const value=literal?data[key]:JSON.parse(data[key]);
    if(!literal)validateStructure(value);
    if(literal && (value.length>80 || !/^[a-z0-9_]*$/.test(value))) throw new RequestError('Invalid equipment.');
    if(key==='neon_glide_wallet_v3') { validateWallet(value); }
    clean[key]=data[key];
  }
  return clean;
}
// Receipts survive save selection, so restoring an older balance cannot reissue a grant.
export function preserveReceipts(selected,others) {
  const result=structuredClone(selected), wallet=JSON.parse(result.neon_glide_wallet_v3||'{"version":3,"balance":0,"transactions":{},"entitlements":{},"legacyPurchases":{}}');
  for(const other of others) {
    const source=JSON.parse(other?.neon_glide_wallet_v3||'{}');
    for(const field of ['transactions','eventReceipts','cloudEntitlements','eventCosmetics']) wallet[field]={...(wallet[field]||{}),...(source[field]||{})};
  }
  result.neon_glide_wallet_v3=JSON.stringify(wallet); return result;
}
export function applyGrant(data,grant) {
  const next=structuredClone(data), wallet=JSON.parse(next.neon_glide_wallet_v3||'{"version":3,"balance":0,"transactions":{},"entitlements":{},"legacyPurchases":{}}');
  wallet.eventReceipts??={}; wallet.eventCosmetics??={};
  if(!wallet.eventReceipts[grant.id]) { creditWallet(wallet,grant.credits); wallet.eventReceipts[grant.id]=true; if(grant.cosmetic) wallet.eventCosmetics[grant.cosmetic]=true; }
  // Durable claims, ad intents and transaction records enforce long-term replay
  // protection. The displayed wallet retains only a bounded recent receipt set.
  wallet.eventReceipts=Object.fromEntries(Object.entries(wallet.eventReceipts).slice(-128));
  next.neon_glide_wallet_v3=JSON.stringify(wallet); return next;
}

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const reserved = new Set(['__proto__', 'constructor', 'prototype']);
function validateWallet(wallet) {
 if (!isRecord(wallet) || wallet.version !== 3 || !Number.isSafeInteger(wallet.balance) || wallet.balance < 0) throw new RequestError('Invalid wallet.');
 if(wallet.debt!==undefined&&(!Number.isSafeInteger(wallet.debt)||wallet.debt<0))throw new RequestError('Invalid wallet.');
 for (const key of ['transactions', 'eventReceipts', 'eventCosmetics', 'cloudEntitlements', 'entitlements', 'legacyPurchases', 'creditCosmetics', 'pendingCosmetics', 'creditStages', 'creditShips', 'creditWeapons']) {
  if (wallet[key] === undefined) continue;
  const map = wallet[key];
  const idPattern=key==='transactions'?/^[A-Za-z0-9:._-]{1,200}$/:/^[A-Za-z0-9:_-]{1,200}$/;
  if (!isRecord(map) || Object.keys(map).length > 2048 || Object.entries(map).some(([id, value]) => reserved.has(id) || !idPattern.test(id) || (key === 'transactions' ? typeof value !== 'string' || !/^[a-z0-9_]{1,80}$/.test(value) : typeof value !== 'boolean'))) throw new RequestError('Invalid wallet ledger.');
 }
 if (wallet.equippedStage !== undefined && (typeof wallet.equippedStage !== 'string' || !/^[a-z0-9_]{1,80}$/.test(wallet.equippedStage))) throw new RequestError('Invalid equipment.');
 if (wallet.starterCreditsGranted !== undefined && typeof wallet.starterCreditsGranted !== 'boolean') throw new RequestError('Invalid wallet field.');
 if (Object.keys(wallet).some(key => !['version', 'balance', 'debt', 'transactions', 'eventReceipts', 'eventCosmetics', 'cloudEntitlements', 'entitlements', 'legacyPurchases', 'creditCosmetics', 'pendingCosmetics', 'creditStages', 'creditShips', 'creditWeapons', 'equippedStage', 'starterCreditsGranted'].includes(key))) throw new RequestError('Invalid wallet field.');
}

function validateStructure(value) {
 const pending = [[value, 0]];
 let nodes = 0;
 while (pending.length) {
  const [item, depth] = pending.pop();
  if (++nodes > 12000 || depth > 12) throw new RequestError('Save structure exceeds limits.');
  if (item && typeof item === 'object') for (const [key, child] of Object.entries(item)) {
   if (reserved.has(key)) throw new RequestError('Invalid save key.');
   pending.push([child, depth + 1]);
  }
 }
}

export function equivalentSave(a, b) {
 if (!a || !b) return a === b;
 const normalize = value => {
  if (Array.isArray(value)) return value.map(normalize);
  if (isRecord(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalize(value[key])]));
  return value;
 };
 const decode = save => Object.fromEntries(Object.entries(save).map(([key, value]) => [key, key.includes('equipped_') ? value : JSON.parse(value)]));
 return JSON.stringify(normalize(decode(a))) === JSON.stringify(normalize(decode(b)));
}
