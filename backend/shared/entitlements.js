// Ownership is rebuilt from server-owned purchase records, never from a
// client-provided list of missing products. A separate receipt for the same
// product (including another platform) remains valid after one is refunded.
export function reconcileEntitlements(save, purchases) {
 const next=structuredClone(save);
 if(!next.neon_glide_wallet_v3)return next;
 const wallet=JSON.parse(next.neon_glide_wallet_v3);
 wallet.cloudEntitlements=Object.fromEntries(purchases
  .filter(p=>!p.consumable&&!p.revoked&&!p.ownerDeleted)
  .map(p=>[p.productId,true]));
 next.neon_glide_wallet_v3=JSON.stringify(wallet);
 return next;
}
