import { scopedStorage } from './RuntimeRealm.js';
const key='neo_glide_local_play_v1';
export function localPlaySelection(storage=globalThis.localStorage) {
 try{const value=JSON.parse(storage?.getItem(key)||'null');return value&&['Production','Sandbox','Xcode'].includes(value.environment)&&typeof value.owner==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(value.owner)?value:null;}catch{return null;}
}
export function selectLocalPlay(owner,environment,profile,storage=localStorage) {
 if(!profile?.data||typeof profile.data!=='object')throw new Error('Previous save is unavailable.');
 const selection={owner,environment};
 if(!['Production','Sandbox','Xcode'].includes(environment)||typeof owner!=='string'||!/^[A-Za-z0-9_-]{1,200}$/.test(owner))throw new Error('Previous save could not be selected.');
 const target=scopedStorage(storage,`Legacy-${environment}`),localOwner=`legacy-${owner}`;
 if(!target.getItem(`neo_glide_profile:${localOwner}`))target.setItem(`neo_glide_profile:${localOwner}`,JSON.stringify({...profile,revision:0,dirty:false}));
 target.setItem('neo_glide_accounts_v1',JSON.stringify({owner:localOwner,guest:localOwner,imported:true,boundGuests:{[localOwner]:owner}}));
 storage.setItem(key,JSON.stringify(selection));
 return `Legacy-${environment}`;
}
export function returnToOnline(storage=localStorage) {storage.removeItem(key);}
