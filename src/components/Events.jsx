import { useEffect, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, Gift, Radio, Sparkles, UserRound, Sun, Orbit, Compass, Clock3 } from 'lucide-react';
import { eventsSnapshot, refreshEvents, joinExpedition, claimEventReward, eventAd } from '../services/EventsService';
import { accountSnapshot, subscribeAccount } from '../account/AccountService';
import { ready, dayOf } from '../../backend/shared/events';
import { EVENT_COSMETICS } from '../game/CosmeticsCatalog';
import ShipPreview from './ShipPreview';
import './Events.css';
import { onlineServicesAllowed } from '../privacy/AudiencePolicy.js';

const labels = { seconds: 'seconds in flight', distance: 'metres travelled', coins: 'flight credits collected', capsules: 'transformation capsules', bosses: 'bosses defeated', fragments: 'capsule fragments' };
const eventIcons = { daily: Sun, weekly: Orbit, expedition: Compass };

export default function Events({ onClose, onAccount, ownedCosmetics = {}, onEquip, previewState }) {
  const account = useSyncExternalStore(subscribeAccount, accountSnapshot);
  const [snapshot, setSnapshot] = useState(() => previewState || eventsSnapshot());
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [clock, setClock] = useState(Date.now());
  useEffect(() => {
    if (previewState) return;
    const update = () => setSnapshot(eventsSnapshot());
    window.addEventListener('neo-events-updated', update);
    void refreshEvents().then(update).catch(error => setMessage(error.message));
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => { window.removeEventListener('neo-events-updated', update); clearInterval(timer); };
  }, [previewState]);
  const run = async action => {
    if (previewState) { setMessage('Preview only — play the game to earn these rewards.'); return; }
    setBusy(true); setMessage('');
    try { const result = await action(); if (typeof result === 'string') setMessage(result); setSnapshot(eventsSnapshot()); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  const now = (snapshot?.serverNow || clock) + Math.max(0, clock - (snapshot?.receivedAt || clock));
  const collection = EVENT_COSMETICS.filter(cosmetic => ownedCosmetics[cosmetic.id]);
  const instances = snapshot?.instances || [];
  if (!previewState && !onlineServicesAllowed()) return <section className="mission-screen menu-screen" aria-label="Family play events"><button className="icon-button" onClick={onClose}>Back</button><h1>Local adventures</h1><p>Online events are unavailable in family play. Your ordinary flights, ships and earned-credit unlocks are ready to play.</p></section>;
  return <section className="mission-screen events-screen menu-screen" aria-label="Events">
    <div className="menu-panel">
      <header className="menu-header">
        <button className="icon-button" aria-label="Back to home" onClick={onClose}><ArrowLeft size={21}/></button>
        <div className="menu-heading"><h1>Events</h1><p>Something special beyond the next flight.</p></div>
        <button className="menu-header-action" aria-label="Account" onClick={onAccount}><UserRound size={18}/><span>Account</span></button>
      </header>
      <div className="mission-body menu-body custom-scrollbar" tabIndex={0} aria-label="Event details">
        <div className={`mission-heading ${!instances.length && !snapshot?.availableExpedition ? 'is-empty' : ''}`}><div><span className="menu-eyebrow">{previewState ? 'DEVELOPMENT PREVIEW' : 'FLY. COLLECT. EXPLORE.'}</span><h2>Across the galaxy</h2><p>Every flight takes you closer to something special.</p></div><span className="event-sync"><Radio size={16}/>{account.status === 'syncing' && !previewState ? 'Syncing…' : 'Auto sync'}</span></div>
        <p className="mission-status" role="status"><span className="event-signal-dot" aria-hidden="true"/>{message || (account.conflict && !previewState ? 'Choose your save in Account to resume automatic sync.' : account.status === 'offline' && !previewState ? 'Your progress is saved on this device. Sync will retry automatically when online.' : !snapshot ? 'Discovering events automatically when online…' : now > snapshot.lease?.end ? 'Offline event access will renew automatically when online.' : 'Progress syncs automatically every minute. Ads are always optional.')}</p>
        {collection.length > 0 && <section className="event-collection-section"><div className="menu-section-heading"><h3>Your discoveries</h3><span>{collection.length} collected</span></div><div className="event-collection">{collection.map(cosmetic => <button key={cosmetic.id} onClick={() => onEquip(cosmetic.id)}><ShipPreview ship="default" cosmeticId={cosmetic.id}/><span>Equip {cosmetic.name}</span></button>)}</div></section>}
        <div className="mission-grid">{instances.map(instance => {
          const remaining = Math.max(0, instance.end - now), hours = Math.ceil(remaining / 3600000), card = instance.card || 0;
          const Icon = eventIcons[instance.type] || Sparkles;
          return <article className={`mission-card ${instance.type}`} key={instance.instanceId}>
            <div className="mission-card-heading"><span className="menu-feature-icon"><Icon size={22}/></span><div><span className="eyebrow">{instance.type === 'daily' ? 'DAILY MISSIONS' : instance.type === 'weekly' ? 'WEEKLY HUNT' : '14-DAY EXPEDITION'}</span><p className="mission-countdown"><Clock3 size={12}/>{remaining ? `${hours} hours remaining` : 'Ended · final reward collection'}</p></div></div>
            <h2>{instance.title}</h2>
            {instance.cosmetic && <div className="mission-prize"><ShipPreview ship="default" cosmeticId={instance.cosmetic} boosting/><span><Sparkles size={14}/>{instance.cosmetic === 'nebula_circuit' ? 'Nebula Circuit' : 'Aurora Pathfinder'}<small>Permanent ship appearance · duplicate: 25,000 credits</small></span></div>}
            {(instance.type === 'expedition' ? [instance.goals[Math.min(card, 6)]] : instance.goals).map((goal, row) => {
              const index = instance.type === 'expedition' ? Math.min(card, 6) : row;
              const value = instance.type === 'weekly' ? instance.fragments : instance.stats[goal.stat] || 0;
              const claimed = Boolean(instance.claims[index]);
              return <div className="mission-goal" key={index}>
                <div><strong>{instance.type === 'expedition' ? `Day ${Math.min(card + 1, 7)} / 7 · ` : ''}{goal.target.toLocaleString()} {labels[goal.stat]}</strong><span>{Math.floor(value).toLocaleString()} / {goal.target.toLocaleString()}</span></div>
                <progress aria-label={`${goal.target.toLocaleString()} ${labels[goal.stat]}`} value={Math.min(value, goal.target)} max={goal.target}/>
                {goal.secondary && <small>Also {instance.stats[goal.secondary.stat] || 0} / {goal.secondary.target} {labels[goal.secondary.stat]}</small>}
                <div className="mission-reward"><span><Gift size={14}/>{instance.rewards[index].toLocaleString()} credits</span><button disabled={busy || !ready(instance, index, now)} onClick={() => run(() => claimEventReward(instance.instanceId, index))}>{claimed ? 'Claimed' : 'Claim'}</button></div>
                {claimed && !instance.bonuses[index] && <button className="mission-ad" disabled={busy} onClick={() => run(() => eventAd(instance.instanceId, 'credits', index))}>Watch ad · +{instance.rewards[index].toLocaleString()} credits</button>}
              </div>;
            })}
            {instance.type === 'daily' && <button disabled={busy || !ready(instance, 3, now)} onClick={() => run(() => claimEventReward(instance.instanceId, 3))}>{instance.claims[3] ? 'Daily bonus claimed' : 'Claim all-missions bonus · 5,000'}</button>}
            {instance.type === 'daily' && instance.claims[3] && !instance.bonuses[3] && <button className="mission-ad" disabled={busy} onClick={() => run(() => eventAd(instance.instanceId, 'credits', 3))}>Watch ad · +{instance.rewards[3].toLocaleString()} credits</button>}
            {instance.type === 'weekly' && <button className="mission-ad" disabled={busy || !remaining} onClick={() => run(() => eventAd(instance.instanceId, 'fragments'))}>Watch ad · +3 fragments (max 2/day)</button>}
            {instance.type === 'expedition' && card < 7 && dayOf(now) < instance.nextDay && <p>Next card opens tomorrow. Your progress is safe.</p>}
          </article>;
        })}
          {snapshot?.availableExpedition && !instances.some(instance => instance.type === 'expedition') && <article className="mission-card expedition"><span className="menu-feature-icon"><Compass size={28}/></span><h2>Galaxy Expedition</h2><p>Seven completed days, fourteen days to explore. Earn Aurora Pathfinder.</p><button disabled={busy} onClick={() => run(joinExpedition)}>Begin expedition</button></article>}
          {!instances.length && !snapshot?.availableExpedition && <article className="mission-card events-empty"><div className="events-empty-art" aria-hidden="true"><span/><Radio size={42}/></div><span className="menu-eyebrow">THE NEXT DISCOVERY</span><h2>A new signal is coming</h2><p>Upcoming events will appear here when published. Your regular flights are ready to play.</p><button onClick={onClose}>Return to hangar<ArrowLeft size={16}/></button></article>}
        </div>
        {instances.length > 0 && <p className="mission-footer">{Math.max(0, 3 - (snapshot?.ads?.[String(dayOf(now))]?.used || 0))} / 3 event ad bonuses remaining today (UTC). Normal rewards never require an ad.</p>}
      </div>
    </div>
  </section>;
}
