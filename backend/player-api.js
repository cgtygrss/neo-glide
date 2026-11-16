import { applyAppleNotification } from './apple-notifications.js';
import { ECONOMY_VERSION,initialOnlineSave,protectEconomicSave,spendCredits,applyFlightEarnings,claimCareerReward,creditWallet,walletOf,reconcileGiftEquipment } from './shared/online-economy.js';
import { validateRequest, enforceRequestBudget,requireUid } from './request-security.js';
import { RequestError, publicError } from './shared/errors.js';
import { verifyAppRequest } from './app-check.js';
import { getAppCheck } from 'firebase-admin/app-check';
import { randomUUID, createHash } from 'node:crypto';
import { DAY, STATS, accumulateFlightUsage, chargeFlightClock, dayOf, windowFor, createInstance, validateRun, deltaRun, contribute, claim, validateTemplate } from './shared/events.js';
import { validateSave, preserveReceipts, applyGrant, equivalentSave } from './shared/save.js';
import { verifyStorePurchase, googlePurchaseRevoked } from './purchases.js';
import { verifyAppleReceipt } from './apple-receipts.js';
import { reconcileEntitlements } from './shared/entitlements.js';
export function createPlayerApi({db,auth,purchaseEnvironment='Production',deletionDatabases=[db],deletionDb=db,registryDb=deletionDb}) {
const playerRef=uid=>db.doc(`players/${uid}`);
const hash=value=>createHash('sha256').update(value).digest('hex');

const fresh=()=>({revision:0,save:null,instances:[],ads:{},cosmetics:{},updatedAt:0});
const requireId=id=>{if(typeof id!=='string'||!id.length||id.length>200||id.includes('/')) throw new RequestError('Invalid ID.');return id;};
const meter=(state,key,amount=1)=>{state.metrics??={};state.metrics[key]=(state.metrics[key]||0)+amount;};
const serverResult=state=>({environment:purchaseEnvironment,economyVersion:state.economyVersion||0,legacyAvailable:Boolean(state.legacyAvailable),revision:state.revision,save:state.save,instances:state.instances,cosmetics:state.cosmetics,updatedAt:state.updatedAt,ads:state.ads});
const updateSave=(state,data,now)=>{state.save=data;state.revision++;state.updatedAt=now;};
function checkRecent(token) { if(Date.now()/1000-token.auth_time>300) throw new RequestError('Sign in again to continue.'); }
async function migrateState(state,tx,uid,now) {
 if(state.economyVersion===ECONOMY_VERSION)return null;
 const receipts=[];
 for(const owner of new Set([uid,...(state.mergedUids||[])]))receipts.push(...(await tx.get(db.collection('purchases').where('uid','==',owner))).docs.map(doc=>doc.data()));
 const backup=state.save?{save:structuredClone(state.save),at:now,kind:'pre-economy-v1',environment:purchaseEnvironment}:null;
 state.legacyAvailable=Boolean(backup);
 state.save=initialOnlineSave(state.save,receipts,purchaseEnvironment);state.economyVersion=ECONOMY_VERSION;state.economyCreatedAt=now;
 state.economyMigrationReceipts=receipts.filter(purchase=>!purchase.revoked&&!purchase.ownerDeleted&&purchase.environment===purchaseEnvironment).map(purchase=>hash(purchase.id));
 state.economySpendOwners=[uid];
 state.economyId=hash(`${purchaseEnvironment}:${uid}:economy-v1`);
 state.instances=[];state.cosmetics={};state.flightUsage={};state.flightSecondsUsed=0;state.flightClockStart=now;
 state.revision++;state.updatedAt=now;
 return backup;
}
async function transact(uid,fn) {
 return db.runTransaction(async tx=>{
  const closed=await tx.get(db.doc(`closedAccounts/${hash(uid)}`));if(closed.exists)throw new RequestError('Account unavailable.');
  const ref=playerRef(uid),snap=await tx.get(ref),state=snap.exists?snap.data():fresh();if(state.deleted)throw new RequestError('Account unavailable.');
  const backup=await migrateState(state,tx,uid,Date.now());
  const result=await fn(state,tx);
  if(backup)tx.set(db.doc(`players/${uid}/backups/pre-economy-v1`),backup);
  tx.set(ref,state);return result??serverResult(state);
 });
}
async function signedLease(uid,state,now) {
 const instances=state.instances.filter(i=>now>=i.start&&now<i.end).map(i=>i.instanceId).sort();
 const id=hash(`${uid}:${dayOf(now)}:${state.economyVersion}:${instances.join(',')}`),ref=db.doc(`leases/${id}`);
 return db.runTransaction(async tx=>{
  if((await tx.get(db.doc(`closedAccounts/${hash(uid)}`))).exists)throw new RequestError('Account unavailable.');
  const previous=(await tx.get(ref)).data();
  if(previous&&previous.end>now&&previous.economyVersion===state.economyVersion)return {id,start:previous.start,end:previous.end};
  const lease={uid,start:now,end:now+DAY,economyVersion:state.economyVersion,instances,expiresAt:new Date(now+3*DAY)};
  tx.set(ref,lease);return {id,start:lease.start,end:lease.end};
 });
}
return async(req,res)=>{
 try {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST') {res.status(405).json({error:'POST required.'});return;}
  const {action,body}=validateRequest(req);
  const adminAction=['adminRead','adminSave','adminPublish'].includes(action);
  if(!adminAction)await verifyAppRequest(req,token=>getAppCheck().verifyToken(token),{action});
  const authorization=req.headers.authorization;
  if(typeof authorization!=='string'||authorization.length>16384||!/^Bearer [A-Za-z0-9_.-]+$/.test(authorization))throw new RequestError('Sign in again to continue.',401,'unauthenticated');
  const token=await auth.verifyIdToken(authorization.slice(7),true);
  if(adminAction&&token.admin!==true&&!(token.email_verified===true&&token.email===process.env.BOOTSTRAP_ADMIN_EMAIL))throw new RequestError('Administrator access required.',403,'permission-denied');
  const uid=requireUid(token.uid),now=Date.now();
  if(body.owner!==undefined&&body.owner!==uid)throw new RequestError('Invalid flight owner.');
  await enforceRequestBudget(deletionDb,uid,action,now);
  if(purchaseEnvironment==='Sandbox'&&(action.startsWith('admin')||['merge','adIntent','adStatus','cancelAd'].includes(action)))throw new RequestError('This action is unavailable in test play.',403,'test-environment-restriction');
  if(body.economyProtocol!==ECONOMY_VERSION&&!action.startsWith('admin')&&action!=='deleteAccount'){
   if(action!=='sync')throw new RequestError('Update the app to use online progress.',426,'economy-update-required');
   const state=(await playerRef(uid).get()).data()||fresh();
   if(state.deleted||(await db.doc(`closedAccounts/${hash(uid)}`).get()).exists)throw new RequestError('Account unavailable.');
   res.json({...serverResult(state),economyUpgradeRequired:true,instances:[],lease:{id:'',start:now,end:now},serverNow:now});return;
  }
  let result;
  if(action==='sync') {
   const registry=(await registryDb.doc('configuration/events').get()).data()||{published:[]};
   result=await transact(uid,state=>{
    state.flightClockStart??=now;
    state.instances=state.instances.filter(i=>now<=i.end+DAY);
    for(const template of registry.published||[]) {
     if(template.type==='expedition'||template.paused||now<template.startsAt||now>=template.endsAt)continue;
     if(template.minVersion && (body.version||'0.0.0').localeCompare(template.minVersion,undefined,{numeric:true})<0)continue;
     const instance=createInstance(template,now);
     // Published revisions cannot replace an already-enrolled period.
     if(!state.instances.some(i=>i.type===instance.type&&i.start===instance.start)) {state.instances.push(instance);meter(state,'enrollments');}
    }
    return {...serverResult(state),availableExpedition:(registry.published||[]).find(t=>t.type==='expedition'&&!t.paused&&now>=t.startsAt&&now<t.endsAt)||null};
   });
   result.serverNow=now; result.lease=await signedLease(uid,result,now);
  } else if(action==='save') {
   const save=validateSave(body.data);requireId(body.operationId);
   result=await transact(uid,async(state,tx)=>{
    const op=db.doc(`players/${uid}/operations/${body.operationId}`);if((await tx.get(op)).exists)return serverResult(state);
    if(state.revision!==body.revision) return {conflict:true,...serverResult(state)};
    const next=protectEconomicSave(save,state.save);
    if(equivalentSave(next,state.save))return serverResult(state);
    updateSave(state,next,now);tx.set(op,{at:now,expiresAt:new Date(now+30*DAY)});
   });
  } else if(action==='resolve') {
   const save=validateSave(body.data);
   result=await transact(uid,async(state,tx)=>{
    if(state.revision!==body.revision)return {conflict:true,...serverResult(state)};
    const next=protectEconomicSave(save,state.save);
    if(equivalentSave(next,state.save))return serverResult(state);
    const backups=await tx.get(db.collection(`players/${uid}/backups`).orderBy('at','desc').limit(100));
    const backup=db.doc(`players/${uid}/backups/resolve-${state.revision%4}`);
    const keep=new Set(backups.docs.filter(old=>old.id!=='pre-economy-v1'&&old.ref.path!==backup.path).slice(0,3).map(old=>old.ref.path));
    for(const old of backups.docs)if(old.id!=='pre-economy-v1'&&old.ref.path!==backup.path&&!keep.has(old.ref.path))tx.delete(old.ref);
    tx.set(backup,{save:state.save,at:now,expiresAt:new Date(now+7*DAY)});
    updateSave(state,next,now);
   });
  } else if(action==='join') {
   const templates=(await registryDb.doc('configuration/events').get()).data()?.published||[];
   const template=templates.find(t=>t.type==='expedition'&&!t.paused&&now>=t.startsAt&&now<t.endsAt);
   if(!template)throw new RequestError('Expedition is not available.');
   result=await transact(uid,state=>{state.flightClockStart??=now;if(!state.instances.some(i=>i.type==='expedition'&&i.id===template.id&&i.revision===template.revision)){state.instances.push(createInstance(template,now));meter(state,'enrollments');}});
   result.lease=await signedLease(uid,result,now);result.serverNow=now;
  } else if(action==='legacySave') {
   const state=(await playerRef(uid).get()).data();if(state?.deleted||(await db.doc(`closedAccounts/${hash(uid)}`).get()).exists)throw new RequestError('Account unavailable.');
   const backup=(await db.doc(`players/${uid}/backups/pre-economy-v1`).get()).data();
   if(!backup?.save)throw new RequestError('Previous save is unavailable.',404,'not-found');
   result={data:backup.save,environment:purchaseEnvironment};
  } else if(action==='spend') {
   const fingerprint=hash(JSON.stringify([body.kind,body.id,body.expectedPrice]));
   result=await transact(uid,async(state,tx)=>{
    const ref=db.doc(`players/${uid}/economyOperations/${body.operationId}`),prior=(await tx.get(ref)).data();
    if(prior){if(prior.fingerprint!==fingerprint)throw new RequestError('Operation ID was already used.',409,'operation-mismatch');return;}
    const spent=spendCredits(state.save,body,now);const previousRevision=state.revision;
    if(spent.charged||JSON.stringify(spent.save)!==JSON.stringify(state.save))updateSave(state,spent.save,now);
    if(spent.charged)tx.set(ref,{economyId:state.economyId,kind:body.kind,id:body.id,charged:spent.charged,previousValue:spent.previousValue??null,revision:state.revision,fingerprint,at:now,reversed:false});
    return {...serverResult(state),charged:spent.charged,previousRevision};
   });
  } else if(action==='careerClaim') {
   result=await transact(uid,state=>{const claimed=claimCareerReward(state.save,body.id);const previousRevision=state.revision;if(claimed.reward)updateSave(state,claimed.save,now);return {...serverResult(state),reward:claimed.reward,previousRevision};});
  } else if(action==='flight') {
   const run=validateRun(body), lease=(await db.doc(`leases/${requireId(body.lease)}`).get()).data();
   if(!lease||lease.uid!==uid||now>lease.end+DAY)throw new RequestError('Offline authorization expired.');
   if(!Array.isArray(body.instances)||body.instances.some(id=>!lease.instances.includes(id)))throw new RequestError('Invalid event period.');
   result=await transact(uid,async(state,tx)=>{
    if(lease.economyVersion!==ECONOMY_VERSION)throw new RequestError('Offline authorization expired.');
    const ref=db.doc(`players/${uid}/flights/${run.runId}`), prior=(await tx.get(ref)).data();
    if(prior&&prior.lease!==body.lease)throw new RequestError('Flight authorization changed.');
    if(run.seconds>Math.min(DAY,(now-lease.start)/1000)+2)throw new RequestError('Flight duration exceeds authorization.');
    const leaseRef=db.doc(`leases/${body.lease}`), currentLease=(await tx.get(leaseRef)).data();
    const highwater={...run,...Object.fromEntries(STATS.map(key=>[key,Math.max(run[key],prior?.[key]||0)]))};
    const delta=deltaRun(highwater,prior);
    if(STATS.every(key=>delta[key]===0))return serverResult(state);
    if((currentLease.usedSeconds||0)+delta.seconds>Math.min(DAY,(now-currentLease.start)/1000)+2)throw new RequestError('Offline flight time exceeds authorization.');
    state.flightClockStart=Math.min(state.flightClockStart||lease.start,lease.start);
    state.flightSecondsUsed=chargeFlightClock(state.flightSecondsUsed,delta.seconds,state.flightClockStart,now);
    state.flightUsage=accumulateFlightUsage(state.flightUsage,delta,lease,now,state.flightClockStart);
    for(const instance of state.instances) {
     if(!body.instances.includes(instance.instanceId)||now>instance.end+DAY)continue;
     contribute(instance,delta,now);
     if(instance.type==='weekly') instance.fragments+=Math.max(0,Math.floor(highwater.distance/500)-Math.floor((prior?.distance||0)/500))+delta.capsules+2*delta.bosses;
    }
    updateSave(state,applyFlightEarnings(state.save,highwater,prior),now);
    tx.update(leaseRef,{usedSeconds:(currentLease.usedSeconds||0)+delta.seconds});
    tx.set(ref,{...highwater,lease:body.lease,updatedAt:now,expiresAt:new Date(now+3*DAY)});meter(state,'flights',prior?0:1);
   });
  } else if(action==='claim') {
   result=await transact(uid,(state,tx)=>{
    const instance=state.instances.find(i=>i.instanceId===body.instanceId);if(!instance)throw new RequestError('Event ended.');
    if(instance.claims[body.index])return;
    const reward=claim(instance,body.index,now,state.cosmetics);
    if(reward.cosmetic)state.cosmetics[reward.cosmetic]=true;
    updateSave(state,applyGrant(state.save||{},reward),now);
    tx.set(db.doc(`players/${uid}/grants/${hash(reward.id)}`),{...reward,at:now,boosted:false});meter(state,'claims');
    if(Object.keys(instance.claims).length===instance.rewards.length)meter(state,'completedEvents');
   });
  } else if(action==='adIntent') {
   result=await transact(uid,async(state,tx)=>{
    const instance=state.instances.find(i=>i.instanceId===body.instanceId);if(!instance||now>instance.end+DAY)throw new RequestError('Event ended.');
    const day=String(dayOf(now)), budget=state.ads[day]||{used:0,fragments:0,reserved:{}};
    budget.reserved=Object.fromEntries(Object.entries(budget.reserved).filter(([,v])=>v.expires>now));
    if(budget.used+Object.keys(budget.reserved).length>=3)throw new RequestError('Daily event ad limit reached.');
    let credits=0;
    if(body.kind==='fragments') {
     if(instance.type!=='weekly'||now>=instance.end||budget.fragments+Object.values(budget.reserved).filter(v=>v.kind==='fragments').length>=2)throw new RequestError('Fragment ad limit reached.');
    } else if(body.kind==='credits') {
     const grant=(await tx.get(db.doc(`players/${uid}/grants/${hash(`${instance.instanceId}:${body.index}`)}`))).data();
     if(!grant||grant.boosted||Object.values(budget.reserved).some(v=>v.rewardId===grant.id))throw new RequestError('Credit bonus unavailable.');credits=grant.baseCredits;
    } else throw new RequestError('Unknown reward.');
    const id=randomUUID(), expires=now+30*60000, rewardId=`${instance.instanceId}:${body.index}`;
    budget.reserved[id]={expires,kind:body.kind,rewardId};state.ads={...Object.fromEntries(Object.entries(state.ads).filter(([d])=>Number(d)>=Number(day)-2)),[day]:budget};
    tx.set(db.doc(`adIntents/${id}`),{uid,kind:body.kind,instanceId:instance.instanceId,index:body.index??null,credits,day,createdAt:now,economyVersion:state.economyVersion,expires,expiresAt:new Date(expires+DAY),fulfilled:false});
    return {id,userId:uid,customData:id,expires};
   });
  } else if(action==='adStatus') {
   const intent=(await db.doc(`adIntents/${requireId(body.id)}`).get()).data();if(!intent||intent.uid!==uid)throw new RequestError('Unknown ad intent.');result={fulfilled:intent.fulfilled,cancelled:Boolean(intent.cancelled)};
  } else if(action==='cancelAd') {
   const intentRef=db.doc(`adIntents/${requireId(body.id)}`);
   result=await transact(uid,async(state,tx)=>{
    const intent=(await tx.get(intentRef)).data();if(!intent||intent.uid!==uid)throw new RequestError('Unknown ad intent.');
    if(!intent.fulfilled){if(state.ads[intent.day])delete state.ads[intent.day].reserved[body.id];tx.update(intentRef,{cancelled:true});}
   });
  } else if(action==='purchase') {
   const verified=await verifyStorePurchase(body,{environment:purchaseEnvironment});
   result=await transact(uid,async(state,tx)=>{
    const ref=db.doc(`purchases/${hash(verified.id)}`);let old=(await tx.get(ref)).data();const deletedReceipt=Boolean(old?.ownerDeleted);const status=old?.storeStatusAt?{storeStatusAt:old.storeStatusAt,revoked:false}:{};
    if(old?.revoked)throw new RequestError('This purchase has been revoked.');
    if(old&&old.uid===null&&!old.ownerDeleted)old=null;
    if(old?.ownerDeleted&&!verified.consumable)old=null;
    if(old&&old.uid!==uid&&!state.mergedUids?.includes(old.uid))throw new RequestError('This purchase belongs to another game account.');
    if(old){
     if(!verified.consumable){const wallet=walletOf(state.save);if(!wallet.cloudEntitlements[verified.productId]){wallet.cloudEntitlements[verified.productId]=true;const previousRevision=state.revision;updateSave(state,{...state.save,neon_glide_wallet_v3:JSON.stringify(wallet)},now);tx.set(ref,{...old,...verified});return {...serverResult(state),previousRevision,purchaseApplied:false};}}
     return {...serverResult(state),purchaseApplied:false};
    }
    const wallet=JSON.parse(state.save?.neon_glide_wallet_v3||'{"version":3,"balance":0,"transactions":{},"entitlements":{},"legacyPurchases":{}}');
    const alreadyApplied=wallet.transactions?.[body.transactionId]===verified.productId || (verified.productId==='starter_pack' && (deletedReceipt||wallet.starterCreditsGranted || wallet.legacyPurchases?.starter_pack));
    // The durable purchases collection is the receipt ledger. Keep the client
    // wallet small; it is never used to authorize a replay in the online model.
    wallet.transactions={};
    wallet.cloudEntitlements??={};if(!verified.consumable)wallet.cloudEntitlements[verified.productId]=true;
    if(!alreadyApplied)creditWallet(wallet,verified.credits);
    if(verified.productId==='starter_pack')wallet.starterCreditsGranted=true;
    const previousRevision=state.revision;
    const next={...(state.save||{}),neon_glide_wallet_v3:JSON.stringify(wallet)};
    if(verified.productId==='starter_pack'){next.neon_glide_owned_ships=JSON.stringify([...new Set([...JSON.parse(next.neon_glide_owned_ships||'["default"]'),'interceptor'])]);next.neon_glide_owned_weapons=JSON.stringify([...new Set([...JSON.parse(next.neon_glide_owned_weapons||'["default"]'),'blaster'])]);}
    updateSave(state,next,now);tx.set(ref,{uid,...verified,...status,creditGrantVersion:1,creditedEconomyId:state.economyId,creditedCredits:alreadyApplied?0:verified.credits,at:now});return {...serverResult(state),previousRevision,purchaseApplied:!alreadyApplied};
   });
  } else if(action==='reconcilePurchases') {
   if(!Array.isArray(body.revocations)||body.revocations.length>200)throw new RequestError('Invalid revocation records.');
   const revoked=new Set();
   const uniqueProofs=[...new Map(body.revocations.map(proof=>[proof.signedTransaction,proof])).values()];
   for(const proof of uniqueProofs) {
    const receipt=await verifyAppleReceipt(proof,{allowRevoked:true,environment:purchaseEnvironment});
    if(!receipt.revocationDate)throw new RequestError('Missing signed revocation.');
    const id=`apple:${receipt.environment}:${receipt.transactionId}`;
    await applyAppleNotification(db,{id,productId:receipt.productId,environment:receipt.environment,revoked:true,signedAt:receipt.signedDate||receipt.revocationDate,notificationId:`client-proof:${hash(proof.signedTransaction)}`});
    revoked.add(id);
   }
   // Read only receipts owned by this account (including verified account merges).
   const owner=(await playerRef(uid).get()).data();
   const owners=[...new Set([uid,...(owner?.mergedUids||[])])];
   for(const id of owners) {
    const records=await db.collection('purchases').where('uid','==',id).get();
    for(const record of records.docs) {
     const purchase=record.data();
     if(!purchase.consumable&&!purchase.revoked&&purchase.id.startsWith('google:') &&
        await googlePurchaseRevoked({productId:purchase.productId,purchaseToken:purchase.id.slice(7)}))revoked.add(purchase.id);
    }
   }
   result=await transact(uid,async(state,tx)=>{
    const records=[];
    for(const id of [uid,...(state.mergedUids||[])]) {
     records.push(...(await tx.get(db.collection('purchases').where('uid','==',id))).docs);
    }
    const purchases=records.map(record=>({...record.data(),revoked:record.data().revoked||revoked.has(record.data().id)}));
    const previousRevision=state.revision;
    const next=reconcileGiftEquipment(reconcileEntitlements(state.save||{},purchases,purchaseEnvironment));
    if(JSON.stringify(next)!==JSON.stringify(state.save))updateSave(state,next,now);
    for(const record of records)if(revoked.has(record.data().id))tx.update(record.ref,{revoked:true,revokedAt:now});
    return {...serverResult(state),previousRevision};
   });
  } else if(action==='merge') {
   checkRecent(token);const source=await auth.verifyIdToken(body.sourceToken,true);requireUid(source.uid);if(source.firebase?.sign_in_provider!=='anonymous')checkRecent(source);
   if(source.uid===uid)throw new RequestError('Accounts are already linked.');
   // Two independently verified credentials are mandatory; never merge by email.
   const sourceUser=await auth.getUser(source.uid), targetUser=await auth.getUser(uid);
   if(sourceUser.providerData.some(p=>targetUser.providerData.some(q=>q.providerId===p.providerId&&q.uid!==p.uid)))throw new RequestError('Accounts have incompatible providers.');
   // Identity provider transfer is performed only after the selected save is durable.
   result=await db.runTransaction(async tx=>{
    const [a,b]=await Promise.all([tx.get(playerRef(source.uid)),tx.get(playerRef(uid))]);const origin=a.exists?a.data():fresh(), target=b.exists?b.data():fresh();
    if(origin.mergedInto===uid)return serverResult(target);
    if(origin.deleted||target.deleted||origin.mergedInto)throw new RequestError('Account unavailable.');
    const closed=await Promise.all([tx.get(db.doc(`closedAccounts/${hash(source.uid)}`)),tx.get(db.doc(`closedAccounts/${hash(uid)}`))]);if(closed.some(record=>record.exists))throw new RequestError('Account unavailable.');
    const originBackup=await migrateState(origin,tx,source.uid,now),targetBackup=await migrateState(target,tx,uid,now);
    if(body.sourceRevision!==origin.revision||body.targetRevision!==target.revision)return {conflict:true,source:serverResult(origin),target:serverResult(target)};
    if(new Set([...(origin.mergedUids||[]),...(target.mergedUids||[]),source.uid]).size>16)throw new RequestError('Account merge limit reached.');
    const selected=body.choice==='source'?origin:target;
    const instances=structuredClone(selected.instances);
    for(const other of [...origin.instances,...target.instances]) {
     const existing=instances.find(i=>i.instanceId===other.instanceId);
     if(!existing){instances.push(structuredClone(other));continue;}
     existing.claims={...existing.claims,...other.claims};existing.bonuses={...existing.bonuses,...other.bonuses};
     if(existing.type==='expedition'&&other.card>existing.card){existing.card=other.card;existing.nextDay=other.nextDay;existing.stats=structuredClone(other.stats);}
    }
    const merged={...selected,instances,mergedUids:[...new Set([...(origin.mergedUids||[]),...(target.mergedUids||[]),source.uid])],cosmetics:{...origin.cosmetics,...target.cosmetics}};
    merged.economyMigrationReceipts=[...(selected.economyMigrationReceipts||[])];
    merged.economySpendOwners=[...new Set([uid,...(selected.economySpendOwners||[body.choice==='source'?source.uid:uid])])];
    merged.flightClockStart=Math.min(origin.flightClockStart||now,target.flightClockStart||now);
    merged.flightSecondsUsed=(origin.flightSecondsUsed||0)+(target.flightSecondsUsed||0);
    merged.flightUsage={};
    for(const state of [origin,target])for(const [day,stats] of Object.entries(state.flightUsage||{})){const total=merged.flightUsage[day]||Object.fromEntries(STATS.map(key=>[key,0]));merged.flightUsage[day]=Object.fromEntries(STATS.map(key=>[key,total[key]+stats[key]]));}
    merged.ads=structuredClone(target.ads||{});
    for(const [day,budget] of Object.entries(origin.ads||{})) {const other=merged.ads[day]||{used:0,fragments:0,reserved:{}};merged.ads[day]={used:other.used+budget.used,fragments:other.fragments+budget.fragments,reserved:{...other.reserved,...budget.reserved}};}
    const mergedSave=preserveReceipts(selected.save||{},[origin.save,target.save]),wallet=walletOf(mergedSave),selectedBalance=wallet.balance;
    wallet.balance=0;wallet.debt=(walletOf(origin.save).debt||0)+(walletOf(target.save).debt||0);creditWallet(wallet,selectedBalance);mergedSave.neon_glide_wallet_v3=JSON.stringify(wallet);
    updateSave(merged,reconcileGiftEquipment(mergedSave),now);
    if(originBackup)tx.set(db.doc(`players/${source.uid}/backups/pre-economy-v1`),originBackup);
    if(targetBackup)tx.set(db.doc(`players/${uid}/backups/pre-economy-v1`),targetBackup);
    tx.set(db.doc(`players/${uid}/backups/merge-${target.revision%4}`),{source:origin,target,at:now,expiresAt:new Date(now+7*DAY)});
    tx.set(playerRef(uid),merged);tx.set(playerRef(source.uid),{...origin,mergedInto:uid,deleted:true});
    tx.set(db.doc(`accountMerges/${source.uid}`),{target:uid,providers:sourceUser.providerData.map(p=>({providerId:p.providerId,uid:p.uid,...(p.displayName?{displayName:p.displayName}:{}),...(p.email?{email:p.email}:{})})),stage:'saved',at:now});
    return serverResult(merged);
   });
   if(!result.conflict) {
    // Admin SDK transfers providers without deleting the source auth user first.
    const journal=(await db.doc(`accountMerges/${source.uid}`).get()).data();
    const providers=journal.providers;
    if(sourceUser.providerData.length)await auth.updateUser(source.uid,{providersToUnlink:sourceUser.providerData.map(p=>p.providerId)});
    for(const p of providers){const current=await auth.getUser(uid);if(!current.providerData.some(q=>q.providerId===p.providerId&&q.uid===p.uid))await auth.updateUser(uid,{providerToLink:{providerId:p.providerId,uid:p.uid,...(p.displayName?{displayName:p.displayName}:{}),...(p.email?{email:p.email}:{})}});}
    const grants=await db.collection(`players/${source.uid}/grants`).get();
    for(const item of grants.docs){const destination=db.doc(`players/${uid}/grants/${item.id}`);await db.runTransaction(async tx=>{const existing=(await tx.get(destination)).data();tx.set(destination,{...item.data(),...(existing||{}),boosted:Boolean(existing?.boosted||item.data().boosted)});});}
    await auth.revokeRefreshTokens(source.uid);await db.doc(`accountMerges/${source.uid}`).update({stage:'linked'});
   }
  } else if(action==='deleteAccount') {
   checkRecent(token);
   const jobRef=deletionDb.doc(`deletions/${uid}`),previousJob=(await jobRef.get()).data();
   const owners=new Set(previousJob?.uids||[uid]);
   for(const scope of deletionDatabases){const original=(await scope.doc(`players/${uid}`).get()).data();for(const owner of original?.mergedUids||[])owners.add(owner);}
   const uids=[...owners];
   await jobRef.set({uids,at:now});
   for(const scope of deletionDatabases){
    for(const owner of uids){
     await scope.doc(`closedAccounts/${hash(owner)}`).set({at:now});
     await scope.doc(`players/${owner}`).set({deleted:true,deletedAt:now},{merge:true});
    }
   }
   for(const scope of deletionDatabases)for(const owner of uids){
    for(const collection of ['leases','adIntents','adTransactions','purchases']){
     const documents=await scope.collection(collection).where('uid','==',owner).get();
     const writer=scope.bulkWriter();
     for(const document of documents.docs){
      if(collection==='purchases'){
       const receipt=document.data();delete receipt.uid;
       writer.set(document.ref,{...receipt,uid:null,ownerDeleted:true,revoked:Boolean(receipt.revoked)});
      }else writer.delete(document.ref);
     }
     await writer.close();
    }
    await scope.doc(`requestBudgets/${owner}`).delete();
    await scope.recursiveDelete(scope.doc(`players/${owner}`));await scope.doc(`accountMerges/${owner}`).delete();
   }
   for(const owner of uids)if(owner!==uid){try{await auth.deleteUser(owner);}catch(error){if(error.code!=='auth/user-not-found')throw error;}}
   await auth.deleteUser(uid);await jobRef.delete();result={deleted:true};
  } else if(action==='adminRead'||action==='adminSave'||action==='adminPublish') {
   if(token.admin!==true){
    if(token.email_verified!==true||token.email!==process.env.BOOTSTRAP_ADMIN_EMAIL){res.status(403).json({error:'Administrator access required.'});return;}
    const bootstrap=db.doc('configuration/adminBootstrap');
    await db.runTransaction(async tx=>{const prior=(await tx.get(bootstrap)).data();if(prior&&prior.uid!==uid)throw new RequestError('Administrator already assigned.');tx.set(bootstrap,{uid,at:now});});
    await auth.setCustomUserClaims(uid,{admin:true});
   }
   const ref=registryDb.doc('configuration/events');
   if(action==='adminRead') {result=(await ref.get()).data()||{drafts:[],published:[]}; const {AggregateField}=await import('firebase-admin/firestore'); result.metrics=(await db.collection('players').aggregate({participants:AggregateField.count(),enrollments:AggregateField.sum('metrics.enrollments'),claims:AggregateField.sum('metrics.claims'),completedEvents:AggregateField.sum('metrics.completedEvents'),verifiedAds:AggregateField.sum('metrics.verifiedAds')}).get()).data();}
   else {result=await db.runTransaction(async tx=>{
    const registry={drafts:[],published:[],...((await tx.get(ref)).data()||{})};
    if(action==='adminSave'){const template=validateTemplate(body.template);registry.drafts=[...registry.drafts.filter(t=>t.id!==template.id),template];}
    else {const template=registry.drafts.find(t=>t.id===body.id);if(!template)throw new RequestError('Save a draft first.');
     const existing=registry.published.filter(t=>t.id===template.id);
     if(body.pause){for(const old of existing)old.paused=true;}
     else {
      const active=existing.find(t=>now>=t.startsAt&&now<t.endsAt);
      const startsAt=active&&template.type!=='expedition'?Math.max(template.startsAt,windowFor(template.type,now).end):template.startsAt;
      if(startsAt>=template.endsAt)throw new RequestError('Schedule must extend beyond the next event period.');
      const revision=Math.max(0,...existing.map(t=>t.revision||0))+1;
      registry.published=registry.published.filter(t=>t.id!==template.id);
      if(active)registry.published.push({...active,endsAt:startsAt});
      registry.published.push({...template,startsAt,revision});
     }}
    tx.set(ref,registry);return registry;
   });}
  } else throw new RequestError('Unknown action.');
  res.json(result||{});
 } catch(error) {const failure=publicError(error);if(failure.status===429)res.setHeader('Retry-After','60');res.status(failure.status).json(failure.body);}
};
}
