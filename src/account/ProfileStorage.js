import { newId } from './Id.js';
// Compatibility facade: only player data is scoped; audio/privacy remain device preferences.
export const PLAYER_KEYS = ['neon_glide_wallet_v3','neon_glide_currency_v2','neon_glide_currency','neon_glide_purchases','neon_glide_pilot_profile_v2','neon_glide_pilot_profile','neon_glide_upgrades','neon_glide_owned_ships','neon_glide_equipped_ship','neon_glide_owned_weapons','neon_glide_equipped_weapon','neon_glide_equipped_cosmetic','neon_glide_learned_controls'];
const META='neo_glide_accounts_v1';
let changes=()=>{}, forcedOwner;
export function initializeProfiles(storage=localStorage) {
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
export function withProfile(owner,action) { const previous=forcedOwner; forcedOwner=owner; try { return action(); } finally { forcedOwner=previous; } }
export function getLocalProfile(owner=ownerId()) {
  return JSON.parse(localStorage.getItem(`neo_glide_profile:${owner}`)||'{"data":{},"revision":0,"dirty":false}');
}
export function putLocalProfile(owner,profile) {
  localStorage.setItem(`neo_glide_profile:${owner}`,JSON.stringify(profile));
}
export function activateProfile(owner) {
  const meta=initializeProfiles(); meta.owner=owner; localStorage.setItem(META,JSON.stringify(meta));
}
export function onProfileWrite(callback) { changes=callback; }
export const profileStorage={
  getItem(key) { if (!localStorage.getItem(META)) return localStorage.getItem(key); return getLocalProfile().data[key]??null; },
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
