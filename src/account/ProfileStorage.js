import { accountStorage, scopedStorage } from './RuntimeRealm.js';
import { localPlaySelection,returnToOnline } from './LocalPlayMode.js';
import { newId } from './Id.js';
// Compatibility facade: only player data is scoped; audio/privacy remain device preferences.
export const PLAYER_KEYS = ['neon_glide_wallet_v3','neon_glide_currency_v2','neon_glide_currency','neon_glide_purchases','neon_glide_pilot_profile_v2','neon_glide_pilot_profile','neon_glide_upgrades','neon_glide_owned_ships','neon_glide_equipped_ship','neon_glide_owned_weapons','neon_glide_equipped_weapon','neon_glide_equipped_cosmetic','neon_glide_learned_controls'];
const META='neo_glide_accounts_v1';
let changes=()=>{}, forcedOwner;
export function initializeProfiles(storage=accountStorage) {
  const current=JSON.parse(storage.getItem(META)||'null');
  if(current) return current;
  const owner=`guest-${newId()}`;
  const legacy=Object.fromEntries(PLAYER_KEYS.filter(k=>storage.getItem(k)!==null).map(k=>[k,storage.getItem(k)]));
  // Back up first, migrate once, then commit the pointer. Never delete old saves.
  storage.setItem('neo_glide_legacy_backup_v1',JSON.stringify(legacy));
  storage.setItem(`neo_glide_profile:${owner}`,JSON.stringify({data:legacy,revision:0,dirty:true,updatedAt:Date.now()}));
  const meta={owner,guest:owner,imported:true};
  storage.setItem(META,JSON.stringify(meta));
  return meta;
}
export function activeOwnerId() { return initializeProfiles().owner; }
export function ownerId() { return forcedOwner || activeOwnerId(); }
export function resolveProfileOwner(owner) {
 const meta=initializeProfiles(),visited=new Set();
 while(!visited.has(owner)&&visited.size<32){
  visited.add(owner);const next=meta.accountAliases?.[owner]||meta.boundGuests?.[owner];
  if(!next)break;owner=next;
 }
 return owner;
}
export function withProfile(owner,action) { const previous=forcedOwner; forcedOwner=owner; try { return action(); } finally { forcedOwner=previous; } }
export function getLocalProfile(owner=ownerId()) {
  return JSON.parse(accountStorage.getItem(`neo_glide_profile:${owner}`)||'{"data":{},"revision":0,"dirty":false}');
}
export function putLocalProfile(owner,profile) {
  accountStorage.setItem(`neo_glide_profile:${owner}`,JSON.stringify(profile));
}
export function activateProfile(owner) {
  const meta=initializeProfiles(); meta.owner=owner; accountStorage.setItem(META,JSON.stringify(meta));
}
export function onProfileWrite(callback) { changes=callback; }
export const profileStorage={
  getItem(key) { if (!accountStorage.getItem(META)) return accountStorage.getItem(key); return getLocalProfile().data[key]??null; },
  setItem(key,value) {
    if(!PLAYER_KEYS.includes(key)) throw new Error('Not player data.');
    const owner=ownerId(), profile=getLocalProfile(owner);
    if(profile.data[key]===String(value)) return;
    profile.data[key]=String(value); profile.dirty=true; profile.updatedAt=Date.now();
    putLocalProfile(owner,profile); changes(owner);
  },
  removeItem(key) { const owner=ownerId(), profile=getLocalProfile(owner); delete profile.data[key]; profile.dirty=true; putLocalProfile(owner,profile); changes(owner); }
};
export function summarize(profile) {
  const read=(key,fallback)=>{try{return JSON.parse(profile.data[key]||'null')||fallback;}catch{return fallback;}};
  return {level:read('neon_glide_pilot_profile_v2',{}).level||1,credits:read('neon_glide_wallet_v3',{}).balance||0,ships:read('neon_glide_owned_ships',['default']).length,updatedAt:profile.updatedAt||0};
}

export function eraseLocalAccount(uid) {
 const environments=['Production','Sandbox','Xcode','Legacy-Production','Legacy-Sandbox','Legacy-Xcode'],owners=new Set([uid]);
 const metadata=environments.map(environment=>JSON.parse(scopedStorage(localStorage,environment).getItem(META)||'null')).filter(Boolean);
 for(let pass=0;pass<32;pass++)for(const meta of metadata)for(const [source,target] of Object.entries({...meta.accountAliases,...meta.boundGuests}))if(owners.has(target))owners.add(source);
 for(const environment of environments) {
  const storage=scopedStorage(localStorage,environment),meta=JSON.parse(storage.getItem(META)||'null');
  if(!meta)continue;
  for(const owner of owners)for(const key of [`neo_glide_profile:${owner}`,`neo_glide_events:${owner}`,`neo_glide_flights:${owner}`,`neo_glide_pending_ad:${owner}`,`neo_glide_pre_economy_v1:${owner}`,`neo_glide_economy_pending:${owner}`])storage.removeItem(key);
  for(let index=storage.length-1;index>=0;index--){const key=storage.key(index);if([...owners].some(owner=>key.startsWith(`neo_glide_backup:${owner}:`)))storage.removeItem(key);}
  if(owners.has(meta.legacyBoundTo)){for(const key of PLAYER_KEYS)storage.removeItem(key);storage.removeItem('neo_glide_legacy_backup_v1');delete meta.legacyBoundTo;}
  const purchases=JSON.parse(storage.getItem('neo_glide_store_owners_v1')||'{}');
  for(const [transaction,owner] of Object.entries(purchases))if(owners.has(owner))delete purchases[transaction];
  storage.setItem('neo_glide_store_owners_v1',JSON.stringify(purchases));
  for(const field of ['accountAliases','boundGuests'])if(meta[field])meta[field]=Object.fromEntries(Object.entries(meta[field]).filter(([source,target])=>!owners.has(source)&&!owners.has(target)));
  if(owners.has(meta.owner)||owners.has(meta.guest)){meta.guest=`guest-${newId()}`;meta.owner=meta.guest;}
  storage.setItem(META,JSON.stringify(meta));
 }
 if(owners.has(localPlaySelection()?.owner))returnToOnline();
}
