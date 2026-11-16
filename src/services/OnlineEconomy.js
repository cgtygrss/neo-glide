import { callServer,identity } from '../account/FirebaseClient.js';
import { ownerId } from '../account/ProfileStorage.js';
import { accountStorage } from '../account/RuntimeRealm.js';
import { applyEconomyResponse } from '../account/EconomySync.js';
import { newId } from '../account/Id.js';
import { notifyWalletChanged } from '../game/Economy.js';
const pending=new Map();
function integrate(owner,result) {
 applyEconomyResponse(owner,result);
 if(owner===ownerId()){notifyWalletChanged();window.dispatchEvent(new Event('neo-account-save-updated'));}
 return result;
}
export function spendOnline(kind,id,expectedPrice) {
 const owner=ownerId(),storageKey=`neo_glide_economy_pending:${owner}`,key=JSON.stringify([kind,id,expectedPrice]);
 const inFlightKey=`${owner}:${key}`;if(pending.has(inFlightKey))return pending.get(inFlightKey);
 const saved=JSON.parse(accountStorage.getItem(storageKey)||'{}'),operationId=saved[key]||newId();saved[key]=operationId;accountStorage.setItem(storageKey,JSON.stringify(saved));
 const clear=()=>{const latest=JSON.parse(accountStorage.getItem(storageKey)||'{}');if(latest[key]===operationId)delete latest[key];accountStorage.setItem(storageKey,JSON.stringify(latest));};
 const token=identity.token();
 const request=token.then(value=>{if(!value)throw new Error('Connect your account before spending credits.');return callServer('spend',{kind,id,expectedPrice,operationId},value);}).then(result=>{integrate(owner,result);clear();return result;}).catch(error=>{if(error.status>=400&&error.status<500&&error.status!==429)clear();throw error;}).finally(()=>pending.delete(inFlightKey));
 pending.set(inFlightKey,request);return request;
}
export async function claimCareerOnline(id) {const owner=ownerId(),token=await identity.token();if(!token)throw new Error('Connect your account before claiming rewards.');return integrate(owner,await callServer('careerClaim',{id},token));}
