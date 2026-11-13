import { useEffect, useSyncExternalStore } from 'react';
import App from '../App.jsx';
import { configureStoreAccounts } from '../services/StoreDelivery';
import { saveWallet, loadWallet, notifyWalletChanged } from '../game/Economy';
import { saveProfile, loadProfile } from '../services/ProgressionService';
import { identity, callServer } from './FirebaseClient';
import { getLocalProfile, putLocalProfile } from './ProfileStorage';
import { startAccount, subscribeAccount, accountSnapshot, currentAccountId, syncAccount } from './AccountService';
import { startAutomaticSync } from './AutomaticSync.js';
import { onlineServicesAllowed } from '../privacy/AudiencePolicy.js';

function integrateOwnership(owner, result) {
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
 }
};
export default function AccountRuntime({ startupComplete = true }) {
 const account = useSyncExternalStore(subscribeAccount, accountSnapshot);
 useEffect(() => {
  configureStoreAccounts(storeAccounts);
  saveWallet(loadWallet());
  saveProfile(loadProfile());
  if (!onlineServicesAllowed()) return;
  return startAutomaticSync({
   window, document, navigator,
   sync: () => {
    const account = accountSnapshot();
    if (account.busy || account.conflict) return;
    return account.user ? syncAccount() : startAccount();
   }
  });
 }, []);
 return <App key={account.generation} startupComplete={startupComplete}/>;
}
