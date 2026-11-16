import { verifyAppleNotification, applyAppleNotification } from './apple-notifications.js';
import { RequestError, publicError } from './shared/errors.js';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { createHash } from 'node:crypto';
import { applyGrant } from './shared/save.js';
import { verifySsv,isConsoleSsvValidation,validateSsvEnvelope,createVerifierKeyCache } from './ssv.js';
import { createPlayerApi } from './player-api.js';
import { sandboxDatabase } from './realms.js';
initializeApp();
const db=getFirestore('events'), auth=getAuth();
const hash=value=>createHash('sha256').update(value).digest('hex');
const playerRef=uid=>db.doc(`players/${uid}`);
const requireId=id=>{if(typeof id!=='string'||!id.length||id.length>200||id.includes('/')) throw new RequestError('Invalid ID.');return id;};
const meter=(state,key,amount=1)=>{state.metrics??={};state.metrics[key]=(state.metrics[key]||0)+amount;};
const updateSave=(state,data,now)=>{state.save=data;state.revision++;state.updatedAt=now;};
const sandbox=sandboxDatabase(db);
const options={region:'europe-west3',cors:true,maxInstances:10,timeoutSeconds:60};
export const api=onRequest(options,createPlayerApi({db,auth,deletionDatabases:[db,sandbox]}));
export const apiSandbox=onRequest(options,createPlayerApi({db:sandbox,auth,purchaseEnvironment:'Sandbox',deletionDatabases:[db,sandbox],deletionDb:db}));
const verifierKeys=createVerifierKeyCache((...args)=>fetch(...args));
export const admobSsv=onRequest({region:'europe-west3',maxInstances:5},async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).send('GET required.');
 const raw=req.originalUrl.split('?')[1]||'';
 try {
  validateSsvEnvelope(raw);
  const query=verifySsv(raw,await verifierKeys(),(process.env.EVENT_AD_UNITS||'').split(','));
  // The console's signed transport test must never create an intent or reward.
  // Google's signature is still required; the sample unit cannot grant rewards.
  if(isConsoleSsvValidation(query))return res.status(200).send('Verified test callback; no reward granted.');
  const id=query.get('custom_data');requireId(id);
  const transaction=query.get('transaction_id');requireId(transaction);
  await db.runTransaction(async tx=>{
   const intentRef=db.doc(`adIntents/${id}`),intent=(await tx.get(intentRef)).data();if(!intent)throw new RequestError('Unknown ad intent.');
   if(intent.fulfilled||intent.cancelled)return;
   if(query.get('user_id')!==intent.uid||Number(query.get('timestamp'))>intent.expires||Number(query.get('timestamp'))<intent.createdAt-60000)throw new RequestError('Ad intent expired.');
   const replay=db.doc(`adTransactions/${hash(transaction)}`);if((await tx.get(replay)).exists)return;
   const alias=(await tx.get(db.doc(`accountMerges/${intent.uid}`))).data();
   const recipient=alias?.target||intent.uid;
   const ref=playerRef(recipient),snap=await tx.get(ref);if(!snap.exists||snap.data().deleted)throw new RequestError('Account unavailable.');const state=snap.data();
   if(state.economyVersion===1&&intent.economyVersion!==1)throw new RequestError('Ad intent expired.');
   const budget=state.ads[intent.day]||{used:0,fragments:0,reserved:{}};
   if(budget.used>=3||(intent.kind==='fragments'&&budget.fragments>=2))throw new RequestError('Daily limit reached.');
   const instance=state.instances.find(i=>i.instanceId===intent.instanceId);if(!instance)throw new RequestError('Event expired.');
   if(intent.kind==='fragments') {instance.fragments+=3;budget.fragments++;}
   else {
    const grantRef=db.doc(`players/${recipient}/grants/${hash(`${intent.instanceId}:${intent.index}`)}`), grant=(await tx.get(grantRef)).data();
    if(!grant||grant.boosted)throw new RequestError('Bonus already delivered.');
    updateSave(state,applyGrant(state.save||{},{id:`ad:${id}`,credits:intent.credits}),Date.now());instance.bonuses[intent.index]=true;tx.update(grantRef,{boosted:true});
   }
   budget.used++;delete budget.reserved[id];state.ads[intent.day]=budget;meter(state,'verifiedAds');
   tx.set(ref,state);tx.update(intentRef,{fulfilled:true,transaction});tx.set(replay,{intentId:id,uid:intent.uid,at:Date.now()});
  });res.status(200).send('OK');
 }catch(error){const failure=publicError(error);res.status(failure.status).send(failure.body.error);}
});


function notificationHandler(database,environment){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).send('POST required.');
 try {
  if(!req.body||typeof req.body!=='object'||Array.isArray(req.body)||Object.keys(req.body).some(key=>key!=='signedPayload')||Buffer.byteLength(JSON.stringify(req.body))>70*1024)throw new RequestError('Invalid notification.');
  const event=await verifyAppleNotification(req.body.signedPayload,{environment});
  await applyAppleNotification(database,event);
  return res.status(200).send('OK');
 } catch(error) {
  const failure=publicError(error);
  // Signature/shape failures are rejected; transient verifier/store failures must
  // be retried by Apple instead of being acknowledged as delivered.
  const status=error instanceof RequestError?failure.status:503;
  return res.status(status).send(failure.body.error);
 }
};}
const notificationOptions={region:'europe-west3',maxInstances:3,timeoutSeconds:30};
export const appStoreNotifications=onRequest(notificationOptions,notificationHandler(db,'Production'));
export const appStoreSandboxNotifications=onRequest(notificationOptions,notificationHandler(sandbox,'Sandbox'));
