import { isNativeStorePlatform } from '../services/MonetizationService';
import { onlineServicesAllowed } from '../privacy/AudiencePolicy.js';

export default function PurchaseRecovery({ busyProduct, onRestore }) {
  if (!isNativeStorePlatform() || !onlineServicesAllowed()) return null;
  return <details className="premium-recovery">
    <summary>Missing a purchase?</summary>
    <p>Owned items sync automatically. If one is missing, restore using the store account that bought it. The store may ask you to sign in.</p>
    <button type="button" className="premium-restore" onClick={onRestore} disabled={Boolean(busyProduct)}>{busyProduct === 'restore' ? 'Restoring…' : 'Restore purchases'}</button>
  </details>;
}
