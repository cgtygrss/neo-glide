import { newId } from '../account/Id.js';
import { notifyWalletChanged } from '../game/Economy.js';
import { callServer } from '../account/FirebaseClient.js';
import { currentAccountId, syncAccount, accountSnapshot } from '../account/AccountService.js';
export { syncEventFlights } from '../account/AccountService.js';
import { getLocalProfile, putLocalProfile } from '../account/ProfileStorage.js';
import { showRewardedAd } from './MonetizationService.js';
import { onlineServicesAllowed } from '../privacy/AudiencePolicy.js';
const key=uid=>`neo_glide_events:${uid}`;
export function eventsSnapshot(uid=currentAccountId()) {if(!onlineServicesAllowed())return null;try{return JSON.parse(localStorage.getItem(key(uid))||'null');}catch{return null;}}
export function beginEventFlight() {
 const uid=currentAccountId(),snapshot=eventsSnapshot(uid),runId=newId();
 const elapsed=snapshot?Math.max(0,Date.now()-snapshot.receivedAt):Infinity;
 const serverTime=(snapshot?.serverNow||0)+elapsed;
 return {runId,owner:uid,lease:snapshot?.lease?.id||'',instances:snapshot&&serverTime<snapshot.lease.end?snapshot.instances.filter(i=>serverTime>=i.start&&serverTime<i.end).map(i=>i.instanceId):[],seconds:0,coins:0,capsules:0};
}
export function queueEventFlight(game) {
 const flight=game.eventFlight;if(!flight?.lease||!flight.instances.length)return;
 const queueKey=`neo_glide_flights:${flight.owner}`,queue=JSON.parse(localStorage.getItem(queueKey)||'[]');
 const summary={...flight,distance:Math.floor(game.distance||0),bosses:game.bossesDefeated||0};
 const index=queue.findIndex(x=>x.runId===summary.runId);if(index<0)queue.push(summary);else queue[index]=summary;
 localStorage.setItem(queueKey,JSON.stringify(queue));
}
export async function refreshEvents() {await syncAccount();return eventsSnapshot();}
function applyResponse(uid,result) {
 if(uid!==currentAccountId())return;
 const local=getLocalProfile(uid);
 putLocalProfile(uid,{...local,data:result.save||local.data,revision:result.revision,dirty:false,updatedAt:result.updatedAt});
 const before=eventsSnapshot(uid)||{};localStorage.setItem(key(uid),JSON.stringify({...before,...result,receivedAt:Date.now()}));
 notifyWalletChanged();window.dispatchEvent(new Event('neo-events-updated'));
}
export async function joinExpedition() {await syncAccount();if(accountSnapshot().conflict)throw new Error('Resolve your save conflict first.');const uid=currentAccountId();const result=await callServer('join');applyResponse(uid,result);return result;}
export async function claimEventReward(instanceId,index) {await syncAccount();if(accountSnapshot().conflict)throw new Error('Resolve your save conflict first.');const uid=currentAccountId();const result=await callServer('claim',{instanceId,index});applyResponse(uid,result);return result;}
export async function eventAd(instanceId,kind,index) {
 await syncAccount();if(accountSnapshot().conflict)throw new Error('Resolve your save conflict first.');
 const uid=currentAccountId(),intent=await callServer('adIntent',{instanceId,kind,index});
 let rewarded;
 try{rewarded=await showRewardedAd('event_bonus',{userId:intent.userId,customData:intent.customData});}catch(error){await callServer('cancelAd',{id:intent.id}).catch(()=>{});throw error;}
 if(!rewarded)await callServer('cancelAd',{id:intent.id}).catch(()=>{});
 if(uid!==currentAccountId())return;
 if(!rewarded)throw new Error('Ad closed. Your normal reward is safe.');
 localStorage.setItem(`neo_glide_pending_ad:${uid}`,JSON.stringify(intent));
 // The client reward callback never mints credits. Only signed SSV does.
 for(let attempt=0;attempt<4;attempt++){await new Promise(resolve=>setTimeout(resolve,1500));await syncAccount();const status=await callServer('adStatus',{id:intent.id});if(status.fulfilled){localStorage.removeItem(`neo_glide_pending_ad:${uid}`);return 'Bonus delivered.';}}
 return 'Reward verification pending. Your bonus will arrive automatically.';
}
