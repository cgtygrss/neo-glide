import { useEffect, useState, useSyncExternalStore } from 'react';
import App from '../App.jsx';
import { configureStoreAccounts } from '../services/StoreDelivery';
import { saveWallet, loadWallet, notifyWalletChanged } from '../game/Economy';
import { saveProfile, loadProfile } from '../services/ProgressionService';
import { identity, callServer } from './FirebaseClient';
import { getLocalProfile, putLocalProfile } from './ProfileStorage';
import { startAccount, subscribeAccount, accountSnapshot, currentAccountId, syncAccount } from './AccountService';
import { startAutomaticSync } from './AutomaticSync.js';
import { onlineServicesAllowed } from '../privacy/AudiencePolicy.js';
import { initializeRuntimeEnvironment } from './RuntimeEnvironment.js';
import { isTestRealm, runtimeRealm } from './RuntimeRealm.js';
import { applyEconomyResponse } from './EconomySync.js';

function integrateOwnership(owner, result) {
 if(result.economyVersion===1){applyEconomyResponse(owner,result);if(owner===currentAccountId()){notifyWalletChanged();window.dispatchEvent(new Event('neo-account-save-updated'));}return;}
 const local = getLocalProfile(owner);
 const wallet = JSON.parse(local.data.neon_glide_wallet_v3 || '{}');
 const remote = JSON.parse(result.save?.neon_glide_wallet_v3 || '{}');
 if (wallet.version === 3) {
  wallet.cloudEntitlements = remote.cloudEntitlements || {};
  local.data.neon_glide_wallet_v3 = JSON.stringify(wallet);
 }
 // Only advance our base revision if this purchase was the next operation.
 // An unrelated device's changes must still produce a save conflict.
 const revision = result.previousRevision === local.revision ? result.revision : local.revision;
 putLocalProfile(owner, { ...local, revision, dirty: true });
 if (owner === currentAccountId()) notifyWalletChanged();
}
const storeAccounts = {
 capture: owner => ({ owner, token: owner === currentAccountId() ? identity.token() : Promise.resolve(null) }),
 async verify(transaction, context) {
  const token = await context.token;
  if (!token) throw new Error('Return to the purchasing account to finish delivery.');
  await syncAccount();
  const result = await callServer('purchase', { ...transaction, platform: identity.platform }, token);
  integrateOwnership(context.owner, result);
  return {authoritative:true,applied:result.purchaseApplied===true,balance:JSON.parse(result.save.neon_glide_wallet_v3).balance};
 },
 async reconcile(snapshot, context) {
  const token = await context.token;
  if (!token) return;
  for (const transaction of snapshot.transactions || []) {
   try {
    const result = await callServer('purchase', { ...transaction, platform: identity.platform, restore: true }, token);
    integrateOwnership(context.owner, result);
   } catch (error) {
    if (!error.message.includes('another game account')) throw error;
   }
  }
  const result = await callServer('reconcilePurchases', { revocations: snapshot.revocations || [] }, token);
  integrateOwnership(context.owner, result);
 }
};
function BoundAccountRuntime({ startupComplete = true }) {
 const account = useSyncExternalStore(subscribeAccount, accountSnapshot);
 useEffect(() => {
  configureStoreAccounts(storeAccounts);
  saveWallet(loadWallet());
  saveProfile(loadProfile());
  if (!onlineServicesAllowed() || runtimeRealm() === 'Xcode') return;
  return startAutomaticSync({
   window, document, navigator,
   sync: () => {
    const account = accountSnapshot();
    if (account.busy || account.conflict) return;
    return account.user ? syncAccount() : startAccount();
   }
  });
 }, []);
 return <>{isTestRealm()&&<div role="status" className="test-environment-note">{runtimeRealm() === 'Xcode' ? 'Simulator preview · Local save' : <>Test play — separate from the live game. Device verification: {account.appVerification==='verified'?'Verified':account.appVerification==='missing'?'Missing':'Waiting'}.</>}</div>}<App key={account.generation} startupComplete={startupComplete}/></>;
}
export default function AccountRuntime(props) {
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true;initializeRuntimeEnvironment().then(()=>{if(active)setReady(true);}).catch(()=>{if(active)setError('App environment could not be verified. Reconnect and try again; your saved progress is unchanged.');});return()=>{active=false;};},[attempt]);
 if(!ready)return <section className="privacy-loading" role="status">{error ? <div className="runtime-card"><h1>Connection check unavailable</h1><p>{error}</p><button type="button" onClick={()=>{setError('');setAttempt(value=>value+1);}}>Retry</button></div> : 'Preparing your saved game…'}</section>;
 return <BoundAccountRuntime {...props}/>;
}
