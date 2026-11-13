import { APP_VERSION } from '../version.js';
import { flightEquipment } from '../game/FlightEquipment';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Coins, Heart, HelpCircle, Music2, Orbit, Play, Rocket, Settings, ShieldCheck, Sparkles, Trophy, Wrench, X, Zap } from 'lucide-react';
import ShipPreview from './ShipPreview';
import { getStage } from '../game/StageCatalog';
import { getShip } from '../game/ShipCatalog';
import { maxHullHealth } from '../game/PlayerHealth';
import { MUSIC_CREDITS } from '../game/MusicTracks';
import AudioControls from './AudioControls';
import './HomeScreen.css';
import { onlineServicesAllowed } from '../privacy/AudiencePolicy.js';

export default function HomeScreen({ stageId = 'default', onGalaxies, profile, currency, ship, cosmeticId = '', upgrades = {}, audioPreferences = { music: true, sfx: true }, onAudioPreferenceChange, onPlay, onGarage, onCareer, onHelp, adPrivacyAvailable, adPrivacyBusy, adPrivacyMessage, onPrivacy, onLegal }) {
  const model = getShip(ship);
  const galaxy = getStage(stageId);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);
  const settingsButtonRef = useRef(null);
  const nativeDialog = typeof window !== 'undefined' && typeof window.HTMLDialogElement?.prototype.showModal === 'function';
  const pilotLevel = profile.level || 1;
  const maxHealth = maxHullHealth(upgrades.hull || 1, model.id, pilotLevel);
  const equipment = flightEquipment(upgrades, model.id, pilotLevel);
  const boostSeconds = equipment.maxEnergy / equipment.energyDrain;
  const ammoSeconds = Number(equipment.ammoRegenTime.toFixed(2));

  useEffect(() => {
    const dialog = settingsRef.current;
    if (nativeDialog) {
      if (settingsOpen && !dialog.open) dialog.showModal();
      else if (!settingsOpen && dialog.open) dialog.close();
    } else if (settingsOpen) {
      dialog.setAttribute('open', '');
      dialog.querySelector('button')?.focus();
    } else if (dialog.hasAttribute('open')) {
      dialog.removeAttribute('open');
      if (settingsButtonRef.current?.isConnected) settingsButtonRef.current.focus();
    }
  }, [settingsOpen, nativeDialog]);

  useEffect(() => {
    const dialog = settingsRef.current;
    return () => {
      if (dialog.open) dialog.close?.();
      dialog.removeAttribute('open');
    };
  }, []);

  const showHelp = () => {
    settingsRef.current.close?.();
    setSettingsOpen(false);
    onHelp();
  };

  const cycleSettingsFocus = event => {
    if (event.key === 'Escape' && !nativeDialog) {
      event.preventDefault();
      setSettingsOpen(false);
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href]')];
    const current = controls.indexOf(document.activeElement);
    const next = current < 0 ? (event.shiftKey ? controls.length - 1 : 0)
      : (current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
    event.preventDefault();
    controls[next]?.focus();
  };

  return <main className={`hangar-home ${settingsOpen ? 'hangar-settings-open' : ''}`} style={{ '--hangar-accent': model.palette.accent }}>
    <div className="hangar-shell" aria-hidden={!nativeDialog && settingsOpen ? true : undefined}>
      <header className="hangar-header">
        <div className="hangar-brand" aria-label="Neo Glide"><svg viewBox="0 0 52 42" width="42" height="34" aria-hidden="true"><ellipse cx="25" cy="21" rx="22" ry="10" fill="none" stroke="#79ddd4" strokeWidth="2" transform="rotate(-25 25 21)"/><path d="M8 26 42 8 30 28 24 24 19 32 19 23Z" fill="#d6fff4" stroke="#78cfc8" strokeWidth="1.5"/><circle cx="43" cy="22" r="2" fill="#f3d895"/></svg><span>NEO<span>GLIDE</span></span></div>
        <span className="hangar-wallet" aria-label={`${currency.toLocaleString()} credits`}><Coins size={18}/>{currency.toLocaleString()}</span>
      </header>

      <section className="hangar-showcase" aria-label={`Selected ship: ${model.name}`}>
        <div className="hangar-title"><span className="hangar-eyebrow"><i/> YOUR SHIP</span><h1>{model.name}</h1></div>
        <div className="hangar-display">
          <span className="hangar-model-number" aria-hidden="true">{model.number}</span>
          <div className="hangar-light" aria-hidden="true"/>
          <div className="hangar-pad" aria-hidden="true"/>
          <div className="hangar-ship-art"><ShipPreview ship={model.id} cosmeticId={cosmeticId} boosting viewBox="20 12 400 216"/></div>
        </div>
        <p className="hangar-trait"><Sparkles size={15}/><span>{model.trait}</span></p>
        <dl className="hangar-specs" aria-label="Ship capabilities">
          <div><dt><Heart size={14}/>HEALTH</dt><dd>{maxHealth}<span> HP</span></dd></div>
          <div><dt><Zap size={14}/>BOOST</dt><dd>{Number(boostSeconds.toFixed(1))}<span> sec</span></dd></div>
          <div><dt><Rocket size={14}/>RECHARGE</dt><dd className="hangar-ammo">+1 ammo <span>/ {ammoSeconds}s</span></dd></div>
        </dl>
      </section>

      <div className="hangar-start">
        <button className="hangar-play" onClick={onPlay} aria-label="Play"><Play size={21} fill="currentColor"/>Play<ArrowRight size={21}/></button>
        <span className="hangar-record"><Trophy size={13}/>Personal best <strong>{Math.floor(profile.bestDistance).toLocaleString()} m</strong></span>
      </div>
      <nav className="hangar-nav" aria-label="Main menu">
        <button className="hangar-nav-card nav-garage" onClick={onGarage} aria-label="Garage"><span className="hangar-nav-icon"><Wrench size={21}/></span><span className="hangar-nav-copy"><strong>Garage</strong><small>Your fleet</small></span></button>
        <button className="hangar-nav-card nav-career" onClick={onCareer} aria-label="Pilot career"><span className="hangar-nav-icon"><Trophy size={21}/></span><span className="hangar-nav-copy"><strong>Pilot</strong><small>Career & account</small></span></button>
        <button className="hangar-nav-card nav-galaxies" onClick={onGalaxies} aria-label={`Galaxies, current galaxy: ${galaxy.name}`}><span className="hangar-nav-icon"><Orbit size={21}/></span><span className="hangar-nav-copy"><strong>Galaxies</strong><small>{galaxy.name}</small></span></button>
        <button className="hangar-nav-card nav-settings" ref={settingsButtonRef} onClick={() => setSettingsOpen(true)} aria-label="Settings"><span className="hangar-nav-icon"><Settings size={21}/></span><span className="hangar-nav-copy"><strong>Settings</strong><small>Make it yours</small></span></button>
      </nav>
    </div>

    {!nativeDialog && settingsOpen && <div className="hangar-settings-backdrop" aria-hidden="true"/>}
    <dialog ref={settingsRef} className={`hangar-settings menu-settings ${!nativeDialog ? 'hangar-settings-fallback' : ''}`} role="dialog" aria-modal="true" aria-labelledby="hangar-settings-title" onClose={() => setSettingsOpen(false)} onKeyDown={cycleSettingsFocus}>
      <div className="hangar-settings-body">
        <header className="settings-header"><span className="settings-emblem"><Settings size={23}/></span><div><h2 id="hangar-settings-title">Settings</h2><p>Make space feel like yours.</p></div><button className="hangar-close" aria-label="Close settings" onClick={() => setSettingsOpen(false)} autoFocus><X size={21}/></button></header>
        <div className="settings-columns">
          <section className="settings-section" aria-label="Audio preferences"><h3>Sound & atmosphere</h3>
            <AudioControls preferences={audioPreferences} onChange={onAudioPreferenceChange}/>
          </section>
          <section className="settings-section hangar-settings-links" aria-label="Pilot options"><h3>Your space</h3>
            <button aria-label="How to play" onClick={showHelp}><span className="settings-row-icon"><HelpCircle size={20}/></span><span className="settings-row-copy"><strong>How to play</strong><small>Find your flying rhythm</small></span><ArrowRight size={16}/></button>
            {adPrivacyAvailable && <button aria-label="Ad privacy" onClick={onPrivacy} disabled={adPrivacyBusy}><span className="settings-row-icon"><ShieldCheck size={20}/></span><span className="settings-row-copy"><strong>{adPrivacyBusy ? 'Opening…' : 'Ad privacy'}</strong><small>Your advertising choices</small></span><ArrowRight size={16}/></button>}
            <button onClick={() => onLegal?.('privacy')} aria-label="Privacy policy"><span className="settings-row-icon"><ShieldCheck size={20}/></span><span className="settings-row-copy"><strong>Privacy policy</strong><small>How your data is used</small></span><ArrowRight size={16}/></button>
            <button onClick={() => onLegal?.('support')} aria-label="Support"><span className="settings-row-icon"><HelpCircle size={20}/></span><span className="settings-row-copy"><strong>Support & parents</strong><small>Purchases, saves & account help</small></span><ArrowRight size={16}/></button>
            <button onClick={() => onLegal?.('delete-account')} aria-label="Account deletion information"><span className="settings-row-icon"><ShieldCheck size={20}/></span><span className="settings-row-copy"><strong>Account deletion</strong><small>Remove a cloud account</small></span><ArrowRight size={16}/></button>
            <button onClick={() => onLegal?.('notices')} aria-label="Third-party licenses"><span className="settings-row-icon"><ShieldCheck size={20}/></span><span className="settings-row-copy"><strong>Third-party licenses</strong><small>Software & music notices</small></span><ArrowRight size={16}/></button>
          </section>
        </div>
        {adPrivacyMessage && <p role="status" className="hangar-privacy-message">{adPrivacyMessage}</p>}
        <section className="settings-music-credits" aria-label="Music credits">
          <div className="music-credit-header">
            <h3><Music2 size={14}/>Music credits</h3>
            {onlineServicesAllowed() ? <a className="music-credit-artist" href={MUSIC_CREDITS.artistUrl} target="_blank" rel="noreferrer">{MUSIC_CREDITS.artist}<ArrowUpRight size={11}/></a> : <span>{MUSIC_CREDITS.artist} (incompetech.com)</span>}
            <button className="music-credit-license" onClick={() => onLegal?.('notices')} aria-label="Creative Commons Attribution 4.0 license">{MUSIC_CREDITS.license}</button>
          </div>
          <ul className="music-credit-tracks">
            {MUSIC_CREDITS.tracks.map((track, index) => <li key={track.title}>{onlineServicesAllowed() ? <a href={track.source} target="_blank" rel="noreferrer"><small>{['Menu', 'Flight', 'Encounters'][index]}</small><span>{track.title}<ArrowUpRight size={11}/></span></a> : <span><small>{['Menu', 'Flight', 'Encounters'][index]}</small> {track.title}</span>}</li>)}
          </ul>
          <p className="music-credit-note">{MUSIC_CREDITS.changes} No artist endorsement.</p>
        </section>
        <footer className="settings-footer"><span className="hangar-version">NEO GLIDE · v{APP_VERSION}</span><span>{onlineServicesAllowed() ? 'Adult online services' : 'Family play · local only'}</span></footer>
      </div>
    </dialog>
  </main>;
}
