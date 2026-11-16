import { protectEconomicSave } from '../../backend/shared/online-economy.js';
import { getLocalProfile,putLocalProfile } from './ProfileStorage.js';
import { accountStorage } from './RuntimeRealm.js';

export function mergeEconomyData(local,remote,preservePreferences=true) {
 let result;
 try{result=preservePreferences?protectEconomicSave(local,remote):structuredClone(remote);}catch{result=structuredClone(remote);}
 const wallet=JSON.parse(result.neon_glide_wallet_v3);
 try{wallet.pendingCosmetics=JSON.parse(local.neon_glide_wallet_v3||'{}').pendingCosmetics||{};}catch{wallet.pendingCosmetics={};}
 result.neon_glide_wallet_v3=JSON.stringify(wallet);return result;
}
export function applyEconomyResponse(owner,result) {
 if(result.economyVersion!==1)return getLocalProfile(owner);
 const local=getLocalProfile(owner);
 if(local.economyVersion===1&&result.revision<local.revision)return local;
 if(local.economyVersion!==1&&Object.keys(local.data||{}).length){
  const key=`neo_glide_pre_economy_v1:${owner}`;if(!accountStorage.getItem(key))accountStorage.setItem(key,JSON.stringify(local));
 }
 const data=mergeEconomyData(local.data,result.save,Boolean(local.dirty));
 const next={...local,data,revision:result.revision,economyVersion:1,legacyArchiveAvailable:local.legacyArchiveAvailable||result.legacyAvailable,dirty:JSON.stringify(protectEconomicSave(data,result.save))!==JSON.stringify(result.save),updatedAt:result.updatedAt};
 putLocalProfile(owner,next);return next;
}
