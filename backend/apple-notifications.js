import { Environment, SignedDataVerifier, VerificationException, VerificationStatus } from '@apple/app-store-server-library';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { RequestError } from './shared/errors.js';
import { reconcileEntitlements } from './shared/entitlements.js';
import { COSMETIC_PRODUCT_IDS,CREDIT_PACKS,STARTER_CREDITS } from './shared/store-catalog.js';
import { walletOf,creditWallet,debitRefund,reverseSpend,reconcileGiftEquipment } from './shared/online-economy.js';

const hash = value => createHash('sha256').update(value).digest('hex');
const verifiers = new Map();
const supported = new Set([...COSMETIC_PRODUCT_IDS, ...Object.keys(CREDIT_PACKS),'starter_pack', 'remove_ads']);
function verifier(environment) {
  if(environment===Environment.PRODUCTION&&(!Number.isSafeInteger(Number(process.env.APPLE_APP_ID))||Number(process.env.APPLE_APP_ID)<=0))throw new RequestError('Verification unavailable.',503,'verification-unavailable');
  if (!verifiers.has(environment)) verifiers.set(environment, new SignedDataVerifier(
    [readFileSync(new URL('./certificates/AppleRootCA-G3.cer', import.meta.url))], true, environment,
    process.env.APPLE_BUNDLE_ID || 'com.cgtygrssgame.neonglide',
    environment === Environment.PRODUCTION ? Number(process.env.APPLE_APP_ID) : undefined
  ));
  return verifiers.get(environment);
}
async function checkedVerification(decode, payload) {
  try {return await decode(payload);}
  catch(error) {
    if(error instanceof VerificationException)throw new RequestError(
      error.status===VerificationStatus.RETRYABLE_VERIFICATION_FAILURE?'Verification unavailable.':'Invalid Apple signature.',
      error.status===VerificationStatus.RETRYABLE_VERIFICATION_FAILURE?503:400,
      error.status===VerificationStatus.RETRYABLE_VERIFICATION_FAILURE?'verification-unavailable':'invalid-signature'
    );
    throw error;
  }
}

export async function verifyAppleNotification(signedPayload, options = {}) {
  if (typeof signedPayload !== 'string' || signedPayload.length < 1 || signedPayload.length > 65536) throw new RequestError('Invalid notification.');
  const environment = options.environment || Environment.PRODUCTION;
  const decode = options.decode || (value => verifier(environment).verifyAndDecodeNotification(value));
  const notification = await checkedVerification(decode,signedPayload);
  if (typeof notification.notificationUUID !== 'string' || notification.notificationUUID.length > 200 || !Number.isSafeInteger(notification.signedDate) || notification.signedDate <= 0 || notification.signedDate > Date.now() + 300000) throw new RequestError('Invalid notification metadata.');
  if (notification.notificationType === 'TEST') return { test: true };
  if (!['REFUND', 'REVOKE', 'REFUND_REVERSED'].includes(notification.notificationType)) return { ignored: true };
  if (notification.data?.environment !== environment || typeof notification.data.signedTransactionInfo !== 'string') throw new RequestError('Invalid notification environment.');
  const decodeTransaction = options.decodeTransaction || (value => verifier(environment).verifyAndDecodeTransaction(value));
  const receipt = await checkedVerification(decodeTransaction,notification.data.signedTransactionInfo);
  if (receipt.environment !== environment || typeof receipt.transactionId !== 'string' || !/^\d{1,40}$/.test(receipt.transactionId)) throw new RequestError('Invalid notification transaction.');
  if (!supported.has(receipt.productId)) return { ignored: true };
  const revoked = notification.notificationType !== 'REFUND_REVERSED';
  if (revoked !== Boolean(receipt.revocationDate)) throw new RequestError('Invalid revocation state.');
  return { id: `apple:${environment}:${receipt.transactionId}`, productId: receipt.productId,
    environment, revoked, signedAt: notification.signedDate, notificationId: notification.notificationUUID };
}

// All writes below depend on a verified Apple event. The buyer's client is not
// involved. Unknown purchases get a tombstone before an old proof can be used.
export async function applyAppleNotification(db, event, now = Date.now()) {
  if (event.test || event.ignored) return;
  if (!supported.has(event.productId)) return;
  const consumable=Object.hasOwn(CREDIT_PACKS,event.productId);
  const credits=event.productId==='starter_pack'?STARTER_CREDITS:(consumable?CREDIT_PACKS[event.productId]:0);
  const notificationRef = db.doc(`appleNotifications/${hash(event.notificationId)}`);
  const purchaseRef = db.doc(`purchases/${hash(event.id)}`);
  await db.runTransaction(async tx => {
    const [notification, purchase] = await Promise.all([tx.get(notificationRef), tx.get(purchaseRef)]);
    if (notification.exists) return;
    const old = purchase.data();
    if (old?.productId && old.productId !== event.productId) throw new RequestError('Notification product mismatch.');
    if ((old?.storeStatusAt || 0) > event.signedAt || ((old?.storeStatusAt || 0) === event.signedAt && old?.revoked && !event.revoked)) return;
    let owner = old?.uid;
    const visited = new Set();
    while (owner) {
      if (visited.has(owner) || visited.size >= 16) throw new RequestError('Invalid account alias.');
      visited.add(owner);
      const alias = (await tx.get(db.doc(`accountMerges/${owner}`))).data();
      if (!alias?.target) break;
      owner = alias.target;
    }
    let state, playerRef, purchases = [],spends=[];
    if (owner) {
      playerRef = db.doc(`players/${owner}`);
      const [player, closed] = await Promise.all([tx.get(playerRef), tx.get(db.doc(`closedAccounts/${hash(owner)}`))]);
      state = player.data();
      if (closed.exists || state?.deleted) state = null;
      if (state) for (const uid of new Set([owner, ...(state.mergedUids || [])])) {
        const records = await tx.get(db.collection('purchases').where('uid', '==', uid));
        purchases.push(...records.docs.map(record => ({ ...record.data(), revoked: record.id === purchaseRef.id ? event.revoked : record.data().revoked })));
      }
      if(state?.economyVersion===1&&state.economyId&&event.revoked&&credits)for(const uid of new Set([owner,...(state.economySpendOwners||[])])){
        if(spends.length>=1000)break;
        spends.push(...(await tx.get(db.collection(`players/${uid}/economyOperations`).where('economyId','==',state.economyId).where('reversed','==',false).orderBy('revision','desc').limit(1000-spends.length))).docs);
      }
      spends.sort((a,b)=>b.data().at-a.data().at||b.data().revision-a.data().revision);
    }
    let next=state?reconcileEntitlements(state.save||{},purchases,event.environment):null;
    const credited=old?.creditGrantVersion===1?(old.creditedEconomyId===state?.economyId?(old.creditedCredits||0):0):(state?.economyMigrationReceipts?.includes(hash(event.id))?credits:0);
    let restoredCredits=old?.creditedCredits||0;
    let restored=false;
    if(state?.economyVersion===1&&credits){
      const wallet=walletOf(next);
      if(event.revoked&&!old?.financialRevoked&&credited){
        debitRefund(wallet,credited);next.neon_glide_wallet_v3=JSON.stringify(wallet);
        for(const spend of spends){
          const operation=spend.data();if(operation.reversed||!operation.charged)continue;
          if(walletOf(next).debt===0)break;
          next=reverseSpend(next,operation);tx.update(spend.ref,{reversed:true,reversedAt:now,refundId:hash(event.id)});
        }
      }else if(!event.revoked&&old?.revoked&&(credited||!old?.creditGrantVersion)){
        restoredCredits=credited||credits;creditWallet(wallet,restoredCredits);next.neon_glide_wallet_v3=JSON.stringify(wallet);
        restored=true;
      }
    }
    if(state?.economyVersion===1)next=reconcileGiftEquipment(next);
    // Every transaction read precedes every write, including on merged accounts.
    tx.set(purchaseRef, { ...old, id: event.id, productId: event.productId, environment: event.environment,
      consumable, uid: old?.uid || null, at: old?.at || now, revoked: event.revoked,financialRevoked:event.revoked,
      ...(restored?{creditGrantVersion:1,creditedEconomyId:state.economyId,creditedCredits:restoredCredits}:{}),
      storeStatusAt: event.signedAt, revokedAt: event.revoked ? now : null });
    tx.set(notificationRef, { at: now, expiresAt: new Date(now + 90 * 86400000) });
    if (state) {
      if (JSON.stringify(next) !== JSON.stringify(state.save)) {
        tx.set(playerRef, { ...state, save: next, revision: state.revision + 1, updatedAt: now });
      }
    }
  });
}
