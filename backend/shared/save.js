export const SAVE_KEYS=['neon_glide_wallet_v3','neon_glide_pilot_profile_v2','neon_glide_upgrades','neon_glide_owned_ships','neon_glide_equipped_ship','neon_glide_owned_weapons','neon_glide_equipped_weapon','neon_glide_equipped_cosmetic','neon_glide_learned_controls'];
export function validateSave(data) {
  if(!data || typeof data!=='object' || Array.isArray(data) || JSON.stringify(data).length>400000) throw new Error('Invalid save.');
  const clean={};
  for(const key of SAVE_KEYS) if(data[key]!==undefined) {
    if(typeof data[key]!=='string') throw new Error('Invalid save field.');
    const literal=key.includes('equipped_');
    const value=literal?data[key]:JSON.parse(data[key]);
    if(literal && (value.length>80 || !/^[a-z0-9_]*$/.test(value))) throw new Error('Invalid equipment.');
    if(key==='neon_glide_wallet_v3' && (!Number.isSafeInteger(value.balance)||value.balance<0||value.version!==3)) throw new Error('Invalid wallet.');
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
  if(!wallet.eventReceipts[grant.id]) { wallet.balance+=grant.credits; wallet.eventReceipts[grant.id]=true; if(grant.cosmetic) wallet.eventCosmetics[grant.cosmetic]=true; }
  next.neon_glide_wallet_v3=JSON.stringify(wallet); return next;
}

export function protectServerFields(incoming, authoritative) {
 const result=structuredClone(incoming);
 if(!result.neon_glide_wallet_v3)return result;
 const wallet=JSON.parse(result.neon_glide_wallet_v3), before=JSON.parse(authoritative?.neon_glide_wallet_v3||'{}');
 for(const key of ['eventReceipts','eventCosmetics','cloudEntitlements','entitlements','legacyPurchases'])wallet[key]=before[key]||{};
 result.neon_glide_wallet_v3=JSON.stringify(wallet);return result;
}
