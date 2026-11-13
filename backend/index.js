import { Pipelines } from '@google-cloud/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { randomUUID, createHash } from 'node:crypto';
import { DAY, STATS, dayOf, windowFor, createInstance, validateRun, deltaRun, contribute, claim, validateTemplate } from './shared/events.js';
import { validateSave, preserveReceipts, applyGrant, protectServerFields } from './shared/save.js';
import { verifySsv,isConsoleSsvValidation } from './ssv.js';
import { verifyStorePurchase } from './purchases.js';
initializeApp();
const db=getFirestore('events'), auth=getAuth();
const hash=value=>createHash('sha256').update(value).digest('hex');
const playerRef=uid=>db.doc(`players/${uid}`);
const fresh=()=>({revision:0,save:null,instances:[],ads:{},cosmetics:{},updatedAt:0});
const requireId=id=>{if(typeof id!=='string'||!id.length||id.length>200||id.includes('/')) throw new Error('Invalid ID.');return id;};
const meter=(state,key,amount=1)=>{state.metrics??={};state.metrics[key]=(state.metrics[key]||0)+amount;};
const serverResult=state=>({revision:state.revision,save:state.save,instances:state.instances,cosmetics:state.cosmetics,updatedAt:state.updatedAt,ads:state.ads});
const updateSave=(state,data,now)=>{state.save=data;state.revision++;state.updatedAt=now;};
function checkRecent(token) { if(Date.now()/1000-token.auth_time>300) throw new Error('Sign in again to continue.'); }
async function transact(uid,fn) {
 return db.runTransaction(async tx=>{const closed=await tx.get(db.doc(`closedAccounts/${hash(uid)}`));if(closed.exists)throw new Error('Account unavailable.');const ref=playerRef(uid), snap=await tx.get(ref), state=snap.exists?snap.data():fresh();if(state.deleted)throw new Error('Account unavailable.');const result=await fn(state,tx);tx.set(ref,state);return result??serverResult(state);});
}
async function signedLease(uid,state,now) {
 const id=randomUUID();await db.doc(`leases/${id}`).set({uid,start:now,end:now+DAY,instances:state.instances.filter(i=>now>=i.start&&now<i.end).map(i=>i.instanceId)});return {id,start:now,end:now+DAY};
}
export const api=onRequest({region:'europe-west3',cors:true,maxInstances:10,timeoutSeconds:60},async(req,res)=>{
 try {
  if(req.method!=='POST') {res.status(405).json({error:'POST required.'});return;}
  const token=await auth.verifyIdToken((req.headers.authorization||'').replace(/^Bearer /,''),true);
  const uid=token.uid, body=req.body||{}, action=req.path.split('/').filter(Boolean).at(-1), now=Date.now();
  let result;
  if(action==='sync') {
   const registry=(await db.doc('configuration/events').get()).data()||{published:[]};
   result=await transact(uid,state=>{
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
    updateSave(state,preserveReceipts(protectServerFields(save,state.save),[state.save]),now);tx.set(op,{at:now});
   });
  } else if(action==='resolve') {
   const save=validateSave(body.data);
   result=await transact(uid,(state,tx)=>{
    if(state.revision!==body.revision)return {conflict:true,...serverResult(state)};
    tx.set(db.doc(`players/${uid}/backups/${randomUUID()}`),{save:state.save,at:now});
    updateSave(state,preserveReceipts(protectServerFields(save,state.save),[state.save]),now);
   });
  } else if(action==='join') {
   const templates=(await db.doc('configuration/events').get()).data()?.published||[];
   const template=templates.find(t=>t.type==='expedition'&&!t.paused&&now>=t.startsAt&&now<t.endsAt);
   if(!template)throw new Error('Expedition is not available.');
   result=await transact(uid,state=>{if(!state.instances.some(i=>i.type==='expedition'&&i.id===template.id&&i.revision===template.revision)){state.instances.push(createInstance(template,now));meter(state,'enrollments');}});
   result.lease=await signedLease(uid,result,now);result.serverNow=now;
  } else if(action==='flight') {
   const run=validateRun(body), lease=(await db.doc(`leases/${requireId(body.lease)}`).get()).data();
   if(!lease||lease.uid!==uid||now>lease.end+DAY)throw new Error('Offline authorization expired.');
   if(!Array.isArray(body.instances)||body.instances.some(id=>!lease.instances.includes(id)))throw new Error('Invalid event period.');
   result=await transact(uid,async(state,tx)=>{
    const ref=db.doc(`players/${uid}/flights/${run.runId}`), prior=(await tx.get(ref)).data();
    if(prior&&prior.lease!==body.lease)throw new Error('Flight authorization changed.');
    if(run.seconds>Math.min(DAY,(now-lease.start)/1000)+2)throw new Error('Flight duration exceeds authorization.');
    const leaseRef=db.doc(`leases/${body.lease}`), currentLease=(await tx.get(leaseRef)).data();
    const highwater={...run,...Object.fromEntries(STATS.map(key=>[key,Math.max(run[key],prior?.[key]||0)]))};
    const delta=deltaRun(highwater,prior);
    if((currentLease.usedSeconds||0)+delta.seconds>Math.min(DAY,(now-currentLease.start)/1000)+2)throw new Error('Offline flight time exceeds authorization.');
    for(const instance of state.instances) {
     if(!body.instances.includes(instance.instanceId)||now>instance.end+DAY)continue;
     contribute(instance,delta,now);
     if(instance.type==='weekly') instance.fragments+=Math.max(0,Math.floor(highwater.distance/500)-Math.floor((prior?.distance||0)/500))+delta.capsules+2*delta.bosses;
    }
    tx.update(leaseRef,{usedSeconds:(currentLease.usedSeconds||0)+delta.seconds});
    tx.set(ref,{...highwater,lease:body.lease,updatedAt:now});meter(state,'flights',prior?0:1);
   });
  } else if(action==='claim') {
   result=await transact(uid,(state,tx)=>{
    const instance=state.instances.find(i=>i.instanceId===body.instanceId);if(!instance)throw new Error('Event ended.');
    if(instance.claims[body.index])return;
    const reward=claim(instance,body.index,now,state.cosmetics);
    if(reward.cosmetic)state.cosmetics[reward.cosmetic]=true;
    updateSave(state,applyGrant(state.save||{},reward),now);
    tx.set(db.doc(`players/${uid}/grants/${hash(reward.id)}`),{...reward,at:now,boosted:false});meter(state,'claims');
    if(Object.keys(instance.claims).length===instance.rewards.length)meter(state,'completedEvents');
   });
  } else if(action==='adIntent') {
   result=await transact(uid,async(state,tx)=>{
    const instance=state.instances.find(i=>i.instanceId===body.instanceId);if(!instance||now>instance.end+DAY)throw new Error('Event ended.');
    const day=String(dayOf(now)), budget=state.ads[day]||{used:0,fragments:0,reserved:{}};
    budget.reserved=Object.fromEntries(Object.entries(budget.reserved).filter(([,v])=>v.expires>now));
    if(budget.used+Object.keys(budget.reserved).length>=3)throw new Error('Daily event ad limit reached.');
    let credits=0;
    if(body.kind==='fragments') {
     if(instance.type!=='weekly'||now>=instance.end||budget.fragments+Object.values(budget.reserved).filter(v=>v.kind==='fragments').length>=2)throw new Error('Fragment ad limit reached.');
    } else if(body.kind==='credits') {
     const grant=(await tx.get(db.doc(`players/${uid}/grants/${hash(`${instance.instanceId}:${body.index}`)}`))).data();
     if(!grant||grant.boosted||Object.values(budget.reserved).some(v=>v.rewardId===grant.id))throw new Error('Credit bonus unavailable.');credits=grant.baseCredits;
    } else throw new Error('Unknown reward.');
    const id=randomUUID(), expires=now+30*60000, rewardId=`${instance.instanceId}:${body.index}`;
    budget.reserved[id]={expires,kind:body.kind,rewardId};state.ads={...Object.fromEntries(Object.entries(state.ads).filter(([d])=>Number(d)>=Number(day)-2)),[day]:budget};
    tx.set(db.doc(`adIntents/${id}`),{uid,kind:body.kind,instanceId:instance.instanceId,index:body.index??null,credits,day,createdAt:now,expires,fulfilled:false});
    return {id,userId:uid,customData:id,expires};
   });
  } else if(action==='adStatus') {
   const intent=(await db.doc(`adIntents/${requireId(body.id)}`).get()).data();if(!intent||intent.uid!==uid)throw new Error('Unknown ad intent.');result={fulfilled:intent.fulfilled,cancelled:Boolean(intent.cancelled)};
  } else if(action==='cancelAd') {
   const intentRef=db.doc(`adIntents/${requireId(body.id)}`);
   result=await transact(uid,async(state,tx)=>{
    const intent=(await tx.get(intentRef)).data();if(!intent||intent.uid!==uid)throw new Error('Unknown ad intent.');
    if(!intent.fulfilled){if(state.ads[intent.day])delete state.ads[intent.day].reserved[body.id];tx.update(intentRef,{cancelled:true});}
   });
  } else if(action==='purchase') {
   const verified=await verifyStorePurchase(body);
   result=await transact(uid,async(state,tx)=>{
    const ref=db.doc(`purchases/${hash(verified.id)}`);let old=(await tx.get(ref)).data();
    if(old?.ownerDeleted&&!verified.consumable)old=null;
    if(old&&old.uid!==uid&&!state.mergedUids?.includes(old.uid))throw new Error('This purchase belongs to another game account.');
    if(old)return;
    const wallet=JSON.parse(state.save?.neon_glide_wallet_v3||'{"version":3,"balance":0,"transactions":{},"entitlements":{},"legacyPurchases":{}}');
    const alreadyApplied=wallet.transactions?.[body.transactionId]===verified.productId || (verified.productId==='starter_pack' && (wallet.starterCreditsGranted || wallet.legacyPurchases?.starter_pack));
    wallet.transactions??={};wallet.transactions[body.transactionId]=verified.productId;
    wallet.cloudEntitlements??={};if(!verified.consumable)wallet.cloudEntitlements[verified.productId]=true;
    if(!alreadyApplied&&!body.restore)wallet.balance+=verified.credits;
    const previousRevision=state.revision;
    updateSave(state,{...(state.save||{}),neon_glide_wallet_v3:JSON.stringify(wallet)},now);tx.set(ref,{uid,...verified,at:now});return {...serverResult(state),previousRevision};
   });
  } else if(action==='merge') {
   checkRecent(token);const source=await auth.verifyIdToken(body.sourceToken,true);if(source.firebase?.sign_in_provider!=='anonymous')checkRecent(source);
   if(source.uid===uid)throw new Error('Accounts are already linked.');
   // Two independently verified credentials are mandatory; never merge by email.
   const sourceUser=await auth.getUser(source.uid), targetUser=await auth.getUser(uid);
   if(sourceUser.providerData.some(p=>targetUser.providerData.some(q=>q.providerId===p.providerId&&q.uid!==p.uid)))throw new Error('Accounts have incompatible providers.');
   // Identity provider transfer is performed only after the selected save is durable.
   result=await db.runTransaction(async tx=>{
    const [a,b]=await Promise.all([tx.get(playerRef(source.uid)),tx.get(playerRef(uid))]);const origin=a.exists?a.data():fresh(), target=b.exists?b.data():fresh();
    if(origin.mergedInto===uid)return serverResult(target);
    if(origin.deleted||target.deleted||origin.mergedInto)throw new Error('Account unavailable.');
    if(body.sourceRevision!==origin.revision||body.targetRevision!==target.revision)return {conflict:true,source:serverResult(origin),target:serverResult(target)};
    const selected=body.choice==='source'?origin:target;
    const instances=structuredClone(selected.instances);
    for(const other of [...origin.instances,...target.instances]) {
     const existing=instances.find(i=>i.instanceId===other.instanceId);
     if(!existing){instances.push(structuredClone(other));continue;}
     existing.claims={...existing.claims,...other.claims};existing.bonuses={...existing.bonuses,...other.bonuses};
     if(existing.type==='expedition'&&other.card>existing.card){existing.card=other.card;existing.nextDay=other.nextDay;existing.stats=structuredClone(other.stats);}
    }
    const merged={...selected,instances,mergedUids:[...new Set([...(origin.mergedUids||[]),...(target.mergedUids||[]),source.uid])],cosmetics:{...origin.cosmetics,...target.cosmetics}};
    merged.ads=structuredClone(target.ads||{});
    for(const [day,budget] of Object.entries(origin.ads||{})) {const other=merged.ads[day]||{used:0,fragments:0,reserved:{}};merged.ads[day]={used:other.used+budget.used,fragments:other.fragments+budget.fragments,reserved:{...other.reserved,...budget.reserved}};}
    updateSave(merged,preserveReceipts(selected.save||{},[origin.save,target.save]),now);
    tx.set(db.doc(`players/${uid}/backups/${randomUUID()}`),{source:origin,target,at:now});
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
   const jobRef=db.doc(`deletions/${uid}`), previousJob=(await jobRef.get()).data();
   const original=(await playerRef(uid).get()).data()||{};
   const uids=previousJob?.uids||[uid,...(original.mergedUids||[])];
   await jobRef.set({uids,at:now});await db.doc(`closedAccounts/${hash(uid)}`).set({at:now});await playerRef(uid).set({deleted:true,deletedAt:now},{merge:true});
   for(const owner of uids){
    for(const collection of ['leases','adIntents','adTransactions','purchases']){
     const documents=await db.pipeline().collection(collection).where(Pipelines.field('uid').equal(owner)).execute();
     const writer=db.bulkWriter();
     for(const document of documents.results){if(collection==='purchases')writer.set(document.ref,{uid:null,ownerDeleted:true,productId:document.get('productId'),consumable:document.get('consumable'),at:document.get('at')});else writer.delete(document.ref);}
     await writer.close();
    }
    await db.recursiveDelete(playerRef(owner));await db.doc(`accountMerges/${owner}`).delete();
    if(owner!==uid){try{await auth.deleteUser(owner);}catch(error){if(error.code!=='auth/user-not-found')throw error;}}
   }
   await auth.deleteUser(uid);await jobRef.delete();result={deleted:true};
  } else if(action==='adminRead'||action==='adminSave'||action==='adminPublish') {
   if(token.admin!==true){
    if(token.email_verified!==true||token.email!==process.env.BOOTSTRAP_ADMIN_EMAIL){res.status(403).json({error:'Administrator access required.'});return;}
    const bootstrap=db.doc('configuration/adminBootstrap');
    await db.runTransaction(async tx=>{const prior=(await tx.get(bootstrap)).data();if(prior&&prior.uid!==uid)throw new Error('Administrator already assigned.');tx.set(bootstrap,{uid,at:now});});
    await auth.setCustomUserClaims(uid,{admin:true});
   }
   const ref=db.doc('configuration/events');
   if(action==='adminRead') {result=(await ref.get()).data()||{drafts:[],published:[]}; const {AggregateField}=await import('firebase-admin/firestore'); result.metrics=(await db.collection('players').aggregate({participants:AggregateField.count(),enrollments:AggregateField.sum('metrics.enrollments'),claims:AggregateField.sum('metrics.claims'),completedEvents:AggregateField.sum('metrics.completedEvents'),verifiedAds:AggregateField.sum('metrics.verifiedAds')}).get()).data();}
   else {result=await db.runTransaction(async tx=>{
    const registry={drafts:[],published:[],...((await tx.get(ref)).data()||{})};
    if(action==='adminSave'){const template=validateTemplate(body.template);registry.drafts=[...registry.drafts.filter(t=>t.id!==template.id),template];}
    else {const template=registry.drafts.find(t=>t.id===body.id);if(!template)throw new Error('Save a draft first.');
     const existing=registry.published.filter(t=>t.id===template.id);
     if(body.pause){for(const old of existing)old.paused=true;}
     else {
      const active=existing.find(t=>now>=t.startsAt&&now<t.endsAt);
      const startsAt=active&&template.type!=='expedition'?Math.max(template.startsAt,windowFor(template.type,now).end):template.startsAt;
      if(startsAt>=template.endsAt)throw new Error('Schedule must extend beyond the next event period.');
      const revision=Math.max(0,...existing.map(t=>t.revision||0))+1;
      registry.published=registry.published.filter(t=>t.id!==template.id);
      if(active)registry.published.push({...active,endsAt:startsAt});
      registry.published.push({...template,startsAt,revision});
     }}
    tx.set(ref,registry);return registry;
   });}
  } else throw new Error('Unknown action.');
  res.json(result||{});
 } catch(error) {res.status(error.code?.startsWith?.('auth/')?401:400).json({error:error.message||'Request failed.'});}
});
let verifierKeys,keysAt=0;
export const admobSsv=onRequest({region:'europe-west3',maxInstances:5},async(req,res)=>{
 const raw=req.originalUrl.split('?')[1]||'';
 try {
  if(!verifierKeys||Date.now()-keysAt>3600000){const response=await fetch('https://www.gstatic.com/admob/reward/verifier-keys.json');if(!response.ok)throw new Error('Verification unavailable.');verifierKeys=(await response.json()).keys;keysAt=Date.now();}
  const query=verifySsv(raw,verifierKeys,(process.env.EVENT_AD_UNITS||'').split(','));
  // The console's signed transport test must never create an intent or reward.
  // Google's signature is still required; the sample unit cannot grant rewards.
  if(isConsoleSsvValidation(query))return res.status(200).send('Verified test callback; no reward granted.');
  const id=query.get('custom_data');requireId(id);
  const transaction=query.get('transaction_id');requireId(transaction);
  await db.runTransaction(async tx=>{
   const intentRef=db.doc(`adIntents/${id}`),intent=(await tx.get(intentRef)).data();if(!intent)throw new Error('Unknown ad intent.');
   if(intent.fulfilled||intent.cancelled)return;
   if(query.get('user_id')!==intent.uid||Number(query.get('timestamp'))>intent.expires||Number(query.get('timestamp'))<intent.createdAt-60000)throw new Error('Ad intent expired.');
   const replay=db.doc(`adTransactions/${hash(transaction)}`);if((await tx.get(replay)).exists)return;
   const alias=(await tx.get(db.doc(`accountMerges/${intent.uid}`))).data();
   const recipient=alias?.target||intent.uid;
   const ref=playerRef(recipient),snap=await tx.get(ref);if(!snap.exists||snap.data().deleted)throw new Error('Account unavailable.');const state=snap.data();
   const budget=state.ads[intent.day]||{used:0,fragments:0,reserved:{}};
   if(budget.used>=3||(intent.kind==='fragments'&&budget.fragments>=2))throw new Error('Daily limit reached.');
   const instance=state.instances.find(i=>i.instanceId===intent.instanceId);if(!instance)throw new Error('Event expired.');
   if(intent.kind==='fragments') {instance.fragments+=3;budget.fragments++;}
   else {
    const grantRef=db.doc(`players/${recipient}/grants/${hash(`${intent.instanceId}:${intent.index}`)}`), grant=(await tx.get(grantRef)).data();
    if(!grant||grant.boosted)throw new Error('Bonus already delivered.');
    updateSave(state,applyGrant(state.save||{},{id:`ad:${id}`,credits:intent.credits}),Date.now());instance.bonuses[intent.index]=true;tx.update(grantRef,{boosted:true});
   }
   budget.used++;delete budget.reserved[id];state.ads[intent.day]=budget;meter(state,'verifiedAds');
   tx.set(ref,state);tx.update(intentRef,{fulfilled:true,transaction});tx.set(replay,{intentId:id,uid:intent.uid,at:Date.now()});
  });res.status(200).send('OK');
 }catch(error){console.warn('AdMob SSV rejected',{reason:error.message});res.status(400).send(error.message);}
});
