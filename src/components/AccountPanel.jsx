import { useRef, useState, useSyncExternalStore } from 'react';
import { ArrowRight, Check, ChevronDown, Cloud, CloudOff, Gamepad2, Link2, Monitor, Pencil, RefreshCw, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { accountSnapshot, subscribeAccount, connectAccount, resolveConflict, deleteAccount } from '../account/AccountService';
import { identity } from '../account/FirebaseClient';
import './AccountPanel.css';
import { automaticPilotName, pilotDisplayName, PILOT_NAME_LIMIT } from '../account/PilotIdentity';
import { onlineServicesAllowed } from '../privacy/AudiencePolicy.js';

export default function AccountPanel({ profile, onRename }) {
  const account = useSyncExternalStore(subscribeAccount, accountSnapshot);
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteButton = useRef(null);
  const editButton = useRef(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameError, setNameError] = useState('');
  const [nameNotice, setNameNotice] = useState('');
  const displayName = pilotDisplayName(profile, account.user);
  const closeNameEditor = () => { setEditingName(false); setNameError(''); editButton.current?.focus(); };
  const saveName = value => {
    try { onRename(value); closeNameEditor(); setNameNotice(value === null ? 'Automatic pilot name restored.' : 'Pilot name saved.'); }
    catch (error) { setNameError(error.message); }
  };
  const providers = account.user?.providers || [];
  const connected = !account.user?.anonymous && providers.length > 0;
  const synced = account.status === 'synced';
  const syncing = account.status === 'syncing';
  const cloudTitle = account.conflict ? 'Two saves, one next adventure.' : synced ? 'Your progress is up to date.' : syncing ? 'Saving your latest adventure…' : 'Your device save is ready.';
  const cloudDescription = account.conflict ? 'Choose the progress you want to continue with below.' : synced ? 'Your progress and events sync automatically every minute.' : syncing ? 'Your progress is syncing automatically. You can keep playing.' : 'Your progress is saved on this device. Cloud sync retries automatically when online.';
  const run = async action => {
    setMessage('');
    try { await action(); } catch (error) { setMessage(error.message); }
  };
  const services = [
    { id: 'google', provider: 'google.com', name: 'Google', icon: Link2, description: 'Take your progress to another device.' },
    ...(identity.platform === 'ios' ? [{ id: 'gamecenter', provider: 'gc.apple.com', name: 'Game Center', icon: Gamepad2, description: 'Keep your pilot connected on Apple devices.' }] : []),
  ];

  if (!onlineServicesAllowed()) return <section className="pilot-account" aria-label="Family play account"><h2>Saved on this device</h2><p>Family play does not connect to Google, Game Center or cloud accounts. Your progress and earned items stay on this device.</p><p>A parent can find support and deletion information in Home → Settings → Support & parents.</p></section>;
  return <section className="pilot-account" aria-label="Pilot account">
    <div className="pilot-identity">
      <div className="pilot-avatar" aria-hidden="true"><UserRound size={31}/><span>LV {profile.level}</span></div>
      <div className="pilot-identity-copy"><span className="menu-eyebrow">YOUR PILOT</span><div className="pilot-name-heading"><h3>{displayName}</h3><button ref={editButton} className="pilot-edit-name" disabled={account.busy} aria-label="Edit pilot name" onClick={() => { setNameDraft(displayName === 'Guest pilot' ? '' : displayName); setNameError(''); setNameNotice(''); setEditingName(true); }}><Pencil size={15}/></button></div><p>{connected ? 'Connected and ready for the next adventure.' : 'Every great adventure starts somewhere.'}</p>
        <div className="pilot-provider-tags">{account.user?.platformProvider && <span><Gamepad2 size={12}/>{account.user.platformProvider}</span>}{connected ? providers.filter(provider => !(provider === 'gc.apple.com' && account.user?.platformProvider === 'Game Center')).map(provider => <span key={provider}><Check size={12}/>{{'google.com': 'Google', 'gc.apple.com': 'Game Center'}[provider] || 'Connected account'}</span>) : <span><Monitor size={12}/>Guest save</span>}</div>
      </div>
      <span className="pilot-pass" aria-hidden="true"><ShieldCheck size={28}/><small>NEO GLIDE<br/>PILOT PASS</small></span>
    </div>
    {editingName && <form className="pilot-name-editor" aria-label="Edit pilot name" onSubmit={event => { event.preventDefault(); saveName(nameDraft); }}>
      <label htmlFor="pilot-display-name">What should we call you, pilot?</label>
      <p id="pilot-name-help">2–{PILOT_NAME_LIMIT} characters. This changes your in-game name only.</p>
      <input id="pilot-display-name" value={nameDraft} onChange={event => { setNameDraft(event.target.value); setNameError(''); }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); closeNameEditor(); } }} disabled={account.busy} autoFocus onFocus={event => event.target.select()} autoComplete="nickname" aria-describedby={`pilot-name-help${nameError ? ' pilot-name-error' : ''}`} aria-invalid={Boolean(nameError)} placeholder="Your pilot name"/>
      {nameError && <p id="pilot-name-error" role="alert">{nameError}</p>}
      <div className="pilot-name-editor-actions"><button type="submit" disabled={account.busy}>Save name<Check size={15}/></button><button type="button" disabled={account.busy} onClick={closeNameEditor}>Cancel</button>{profile.displayName && <button type="button" className="pilot-reset-name" disabled={account.busy} onClick={() => saveName(null)}>Use automatic name</button>}</div>
      {profile.displayName && <p>Automatic name: {automaticPilotName(account.user)}</p>}
    </form>}
    {nameNotice && <p className="pilot-account-message" role="status">{nameNotice}</p>}

    <section className={`pilot-cloud ${synced ? 'is-synced' : ''} ${account.conflict ? 'has-conflict' : ''}`} aria-label="Save status">
      <span className="account-feature-icon">{synced ? <ShieldCheck size={23}/> : account.status === 'offline' ? <CloudOff size={23}/> : <Cloud size={23}/>}</span>
      <div><span className="menu-eyebrow">{account.conflict ? 'SAVE NEEDS ATTENTION' : 'CLOUD SAVE'}</span><h3 role="status">{cloudTitle}</h3><p>{cloudDescription}</p></div>
      {!account.conflict && <span className="account-sync"><RefreshCw size={17} className={syncing ? 'account-spinning' : ''}/><span>{syncing ? 'Syncing…' : 'Auto sync'}</span></span>}
    </section>

    {account.conflict ? <section className="pilot-save-choice" aria-label="Choose a save">
      <div className="account-section-title"><span className="menu-eyebrow">CONTINUE YOUR JOURNEY</span><h3>Which save would you like to keep?</h3><p>Credits will not be added together. A backup is kept before this choice.</p></div>
      <div className="pilot-save-options">{['local', 'cloud'].map(choice => {
        const save = account.conflict[choice];
        const Icon = choice === 'local' ? Monitor : Cloud;
        return <button key={choice} disabled={account.busy} onClick={() => run(() => resolveConflict(choice))}>
          <Icon size={23}/><strong>{choice === 'local' ? 'This device' : 'Connected account'}</strong>
          <span>Level {save.level} · {save.credits.toLocaleString()} credits · {save.ships} ships</span>
          <small>{save.updatedAt ? new Date(save.updatedAt).toLocaleString() : 'New pilot'}</small><b>Continue with this save <ArrowRight size={15}/></b>
        </button>;
      })}</div>
    </section> : <>
      <section className="pilot-connections" aria-label="Account connections">
        <div className="account-section-title"><span className="menu-eyebrow">BRING YOUR PROGRESS ALONG</span><h3>Your connections</h3><p>Connect a service to find this pilot on another device.</p></div>
        <div className="pilot-service-list">{services.map(service => {
          const linked = providers.includes(service.provider);
          return <div className="pilot-service" key={service.id}>
            <span className="account-feature-icon"><service.icon size={22}/></span>
            <div className="pilot-service-copy"><h4>{service.name}{linked && <span><Check size={11}/>Connected</span>}</h4><p>{service.description}</p></div>
            <button disabled={account.busy} onClick={() => run(() => connectAccount(service.id, 'link'))} aria-label={`Connect ${service.name} account`}>{linked ? 'Reconnect' : 'Connect'}<ArrowRight size={15}/></button>
          </div>;
        })}</div>
      </section>

      <details className="pilot-account-management">
        <summary><span><ShieldCheck size={17}/>Manage account</span><ChevronDown size={17}/></summary>
        <div className="pilot-management-body">
          <p>Switch to another pilot or manage your game account.</p>
          {account.user?.uid && <p>Account reference: <code>{account.user.uid}</code></p>}
          <div className="pilot-switch-list">{services.map(service => <button key={service.id} disabled={account.busy} onClick={() => run(() => connectAccount(service.id, 'switch'))}><service.icon size={17}/><span>Switch {service.name} account</span><ArrowRight size={15}/></button>)}</div>
          {identity.platform === 'ios' && <p className="pilot-account-note">To change Game Center accounts, open iPhone Settings → Game Center. Return here and connect the new account.</p>}
          <div className="pilot-danger-row"><div><h4>Delete game account</h4><p>Permanently remove this pilot and cloud progress.</p></div><button ref={deleteButton} className="account-danger" disabled={account.busy} onClick={() => setConfirmDelete(true)} aria-label="Delete game account"><Trash2 size={16}/>Delete account</button></div>
          {confirmDelete && <div className="pilot-delete-confirm" role="group" aria-label="Confirm account deletion"><h4>Delete this pilot permanently?</h4><p>Delete this game account and its cloud progress? This cannot be undone. Store purchases are not refunded.</p><div><button autoFocus disabled={account.busy} onClick={() => { setConfirmDelete(false); deleteButton.current?.focus(); }}>Keep account</button><button className="account-danger" disabled={account.busy} onClick={() => run(deleteAccount)}>Delete permanently</button></div></div>}
        </div>
      </details>
    </>}
    {(message || account.message) && <p className="pilot-account-message" role="status">{message || account.message}</p>}
    {account.busy && <p className="pilot-account-message" role="status"><RefreshCw size={15} className="account-spinning"/>Updating your pilot. Please wait…</p>}
  </section>;
}
