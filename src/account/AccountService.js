import { accountStorage } from './RuntimeRealm.js';
import { newId } from './Id.js';
import { notifyWalletChanged } from '../game/Economy.js';
import { identity, callServer } from './FirebaseClient.js';
import { eraseLocalAccount, initializeProfiles, ownerId, getLocalProfile, putLocalProfile, activateProfile, onProfileWrite, summarize } from './ProfileStorage.js';
import { flushEventFlights } from '../services/EventFlightQueue.js';
import { onlineServicesAllowed, requireAdultServices } from '../privacy/AudiencePolicy.js';
import { applyEconomyResponse } from './EconomySync.js';
const subscribers=new Set();
let state={user:null,status:'local',message:'',generation:0,conflict:null,busy:false,appVerification:null},started,locked=false,timer,syncing,pending,pendingActivation;
const emit=patch=>{state={...state,...patch};for(const fn of subscribers)fn();};
const switchLocal=(uid,profile)=>{if(profile)putLocalProfile(uid,profile);activateProfile(uid);emit({generation:state.generation+1});};
export const subscribeAccount=fn=>{subscribers.add(fn);return()=>subscribers.delete(fn);};
export const accountSnapshot=()=>state;
async function refreshPlayerIdentity(uid) {
 try {
  const profile=await identity.playerProfile();
  if(state.user?.uid===uid && profile?.name)emit({user:{...state.user,platformName:profile.name,platformProvider:profile.provider}});
 }catch{/* A platform profile is optional; it must never block play or cloud saves. */}
}
export const setAccountLocked=value=>{const wasLocked=locked;locked=value;if(!locked&&pendingActivation){const user=pendingActivation;pendingActivation=null;activateUser(user);}if(wasLocked&&!locked)void syncAccount();};
function activateUser(user){const meta=initializeProfiles(),source=getLocalProfile();if(!meta.boundGuests?.[ownerId()]&&ownerId()===meta.guest){putLocalProfile(user.uid,{...source,importedFrom:ownerId()});meta.legacyBoundTo??=user.uid;meta.boundGuests={...(meta.boundGuests||{}),[ownerId()]:user.uid};accountStorage.setItem('neo_glide_accounts_v1',JSON.stringify(meta));}switchLocal(user.uid);}

export const currentAccountId=()=>ownerId();
function profileChanged(owner) {
 if(owner!==ownerId())return;
 clearTimeout(timer);timer=setTimeout(()=>{void syncAccount();},2000);
}
onProfileWrite(profileChanged);
export function startAccount() {
 if(!onlineServicesAllowed())return Promise.resolve();
 if(started)return started;
 initializeProfiles();
 started=(async()=>{
  try {
   let user=await identity.restore();
   if(!user){
    try{const auto=await identity.auto();user=auto?.user||null;}catch{/* Decline never prevents play. */}
    if(!user)user=await identity.guest();
   }
   // Never attach an existing device save to an unrelated returning identity.
   if(!locked)activateUser(user);else pendingActivation=user;
   emit({user,status:'pending'});void refreshPlayerIdentity(user.uid);await syncAccount();
  }catch(error){started=null;emit({status:'offline',message:error.message});}
 })();
 return started;
}
async function syncEventFlights() {
 const uid=ownerId();if(state.user?.uid!==uid)return;
 const token=await identity.token();
 return flushEventFlights({uid,isCurrent:()=>uid===ownerId()&&state.user?.uid===uid,send:flight=>callServer('flight',flight,token)});
}
export async function syncAccount() {
 if(!onlineServicesAllowed())return;
 if(syncing)return syncing;
 if(!state.user||state.conflict)return;
 const uid=ownerId();if(uid!==state.user.uid)return;
 syncing=(async()=>{
  try {
   emit({status:'syncing',message:''});
   await syncEventFlights();
   if(uid!==ownerId())return;
   const cloud=await callServer('sync');
   if(uid!==ownerId())return;
   if(cloud.economyVersion===1){applyEconomyResponse(uid,cloud);notifyWalletChanged();window.dispatchEvent(new Event('neo-account-save-updated'));}
   const latest=getLocalProfile(uid);
   // Flight ownership blocks profile replacement and account activation, but
   // matching-revision progress can still upload automatically during play.
   if(latest.dirty && cloud.save && cloud.revision!==latest.revision) {
    if(locked){emit({status:'pending'});return;}
    pending={kind:'sync',uid,local:latest,cloud};emit({status:'conflict',conflict:{local:summarize(latest),cloud:summarize({data:cloud.save,updatedAt:cloud.updatedAt})}});return;
   }
   let deferred=false;
   if(latest.dirty||!cloud.save) {
    const saved=await callServer('save',{data:latest.data,revision:cloud.revision,operationId:newId()});
    if(uid!==ownerId())return;
    if(saved.conflict){if(locked){emit({status:'pending'});return;}pending={kind:'sync',uid,local:latest,cloud:saved};emit({status:'conflict',conflict:{local:summarize(latest),cloud:summarize({data:saved.save,updatedAt:saved.updatedAt})}});return;}
    // Writes made while the request was in flight stay dirty for the next sync.
    const after=getLocalProfile(uid), changed=JSON.stringify(after.data)!==JSON.stringify(latest.data);
    if(saved.economyVersion===1)applyEconomyResponse(uid,saved);
    else putLocalProfile(uid,{...after,data:changed?after.data:saved.save,revision:saved.revision,dirty:changed});
   } else if(cloud.revision!==latest.revision) {
    if(locked)deferred=true;
    else {putLocalProfile(uid,{data:cloud.save,revision:cloud.revision,dirty:false,updatedAt:cloud.updatedAt});notifyWalletChanged();window.dispatchEvent(new Event('neo-account-save-updated'));}
   }
   if(uid!==ownerId())return;
   accountStorage.setItem(`neo_glide_events:${uid}`,JSON.stringify({...cloud,receivedAt:Date.now()}));
   emit({status:deferred?'pending':'synced',appVerification:cloud.appVerification||null});window.dispatchEvent(new Event('neo-events-updated'));
  }catch(error){emit({status:'offline',message:error.message});}
  finally{syncing=null;}
 })();return syncing;
}
export async function connectAccount(provider='google',mode='link') {
 requireAdultServices();
 if(locked||state.busy)throw new Error('Finish your flight before changing accounts.');
 emit({busy:true,message:''});
 try {
  await syncAccount();if(state.conflict)throw new Error('Choose a save before changing accounts.');
  const sourceUid=ownerId(),local=getLocalProfile(sourceUid),sourceToken=await identity.token().catch(()=>null);
  if(!sourceToken&&mode==='link'&&!sourceUid.startsWith('guest-')&&!state.user?.anonymous)throw new Error('Reconnect your current account before linking another one.');
  const candidate=await identity.begin(provider), cloud=await callServer('sync',{},candidate.token);
  if(candidate.user.uid===sourceUid){const user=await identity.commit();emit({user,message:'This account is already connected.'});void refreshPlayerIdentity(user.uid);return;}
  const merging=mode==='link'&&Boolean(sourceToken);
  pending={kind:'connect',sourceUid,sourceToken,local,candidate,cloud,merging,mode};
  if(mode==='link'&&cloud.save&&Object.keys(local.data).length){emit({conflict:{local:summarize(local),cloud:summarize({data:cloud.save,updatedAt:cloud.updatedAt})}});return;}
  await finishConnection(mode==='link'?(cloud.save?'cloud':'local'):'cloud');
 }catch(error){emit({message:error.message});throw error;}finally{emit({busy:false});}
}
async function finishConnection(choice) {
 if(locked)throw new Error('Finish your flight before changing accounts.');
 const p=pending;let cloud=p.cloud;
 if(p.merging) {
  cloud=await callServer('merge',{sourceToken:p.sourceToken,sourceRevision:p.local.revision,targetRevision:p.cloud.revision,choice:choice==='local'?'source':'target'},p.candidate.token);
 }else if(choice==='local'){cloud=await callServer(cloud.save?'resolve':'save',{data:p.local.data,revision:cloud.revision,operationId:newId()},p.candidate.token);}
 if(cloud.conflict)throw new Error('The save changed on another device. Reconnect and choose again.');
 const user=await identity.commit();const meta=initializeProfiles();if(p.merging){meta.accountAliases={...(meta.accountAliases||{}),[p.sourceUid]:user.uid};if(meta.legacyBoundTo===p.sourceUid)meta.legacyBoundTo=user.uid;accountStorage.setItem('neo_glide_accounts_v1',JSON.stringify(meta));}switchLocal(user.uid,{data:cloud.save||{},revision:cloud.revision,economyVersion:cloud.economyVersion,dirty:false,updatedAt:cloud.updatedAt});pending=null;emit({user,conflict:null,status:'synced'});void refreshPlayerIdentity(user.uid);await syncAccount();
}
export async function resolveConflict(choice) {
 if(!pending||locked||state.busy)return;
 emit({busy:true});
 try {
  if(pending.kind==='connect')await finishConnection(choice);
  else {
   const p=pending;accountStorage.setItem(`neo_glide_backup:${p.uid}:${Date.now()}`,JSON.stringify(p));
   const result=choice==='local'?await callServer('resolve',{data:p.local.data,revision:p.cloud.revision}):p.cloud;
   if(result.conflict)throw new Error('Cloud save changed. Retry sync.');
   putLocalProfile(p.uid,{data:result.save,revision:result.revision,economyVersion:result.economyVersion,dirty:false,updatedAt:result.updatedAt});pending=null;emit({conflict:null,generation:state.generation+1,status:'synced'});
  }
 }catch(error){emit({message:error.message});}finally{emit({busy:false});}
}
export async function deleteAccount() {
 if(locked||state.busy)throw new Error('Finish the current operation first.');
 emit({busy:true});try{
 const uid=ownerId();await callServer('deleteAccount');await identity.clear();
 eraseLocalAccount(uid);
 const meta=initializeProfiles();
 switchLocal(meta.guest,{data:{},revision:0,dirty:false});emit({user:null,status:'local'});started=null;void startAccount();
 }finally{emit({busy:false});}
}
