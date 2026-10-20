import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Coins, Heart, HelpCircle, Music2, Play, Rocket, Settings, ShieldCheck, Sparkles, Trophy, Volume2, Wrench, X, Zap } from 'lucide-react';
import ShipPreview from './ShipPreview';
import { getStage } from '../game/StageCatalog';
import { getShip } from '../game/ShipCatalog';
import { maxHullHealth } from '../game/PlayerHealth';
import './HomeScreen.css';

export default function HomeScreen({ stageId = 'default', onGalaxies, profile, currency, ship, cosmeticId = '', upgrades = {}, audioPreferences = { music: true, sfx: true }, onAudioPreferenceChange, onPlay, onGarage, onCareer, onHelp, adPrivacyAvailable, adPrivacyBusy, adPrivacyMessage, onPrivacy }) {
  const model = getShip(ship);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);
  const settingsButtonRef = useRef(null);
  const nativeDialog = typeof window !== 'undefined' && typeof window.HTMLDialogElement?.prototype.showModal === 'function';
  const pilotLevel = profile.level || 1;
  const maxHealth = maxHullHealth(upgrades.hull || 1, model.id, pilotLevel);
  const boostSeconds = (100 + ((upgrades.battery || 1) - 1) * 20 + (pilotLevel - 1) * 2) / 10;
  const ammoSeconds = model.id === 'interceptor' ? 1.5 : 2;

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
    const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
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
        <button type="button" className="hangar-galaxy" onClick={onGalaxies}><Sparkles size={14}/><span>{getStage(stageId).name}</span><span>Change galaxy →</span></button>
        <button className="hangar-play" onClick={onPlay} aria-label="Play"><Play size={21} fill="currentColor"/>Play<ArrowRight size={21}/></button>
        <span className="hangar-record"><Trophy size={13}/>Personal best <strong>{Math.floor(profile.bestDistance).toLocaleString()} m</strong></span>
      </div>
      <nav className="hangar-nav" aria-label="Main menu">
        <button onClick={onGarage} aria-label="Garage"><Wrench size={21}/><span>Garage</span></button>
        <button onClick={onCareer} aria-label="Pilot career"><Trophy size={21}/><span>Career<small>Level {pilotLevel}</small></span></button>
        <button ref={settingsButtonRef} onClick={() => setSettingsOpen(true)} aria-label="Settings"><Settings size={21}/><span>Settings</span></button>
      </nav>
    </div>

    {!nativeDialog && settingsOpen && <div className="hangar-settings-backdrop" aria-hidden="true"/>}
    <dialog ref={settingsRef} className={`hangar-settings ${!nativeDialog ? 'hangar-settings-fallback' : ''}`} role="dialog" aria-modal="true" aria-labelledby="hangar-settings-title" onClose={() => setSettingsOpen(false)} onKeyDown={cycleSettingsFocus}>
      <div className="hangar-settings-body">
        <header><h2 id="hangar-settings-title">Settings</h2><button className="hangar-close" aria-label="Close settings" onClick={() => setSettingsOpen(false)} autoFocus><X size={21}/></button></header>
        <button className="hangar-setting-switch" role="switch" aria-checked={audioPreferences.music} onClick={() => onAudioPreferenceChange?.('music', !audioPreferences.music)}><Music2 size={20}/><span>Music</span><span className="hangar-toggle" aria-hidden="true"><i/></span></button>
        <button className="hangar-setting-switch" role="switch" aria-checked={audioPreferences.sfx} onClick={() => onAudioPreferenceChange?.('sfx', !audioPreferences.sfx)}><Volume2 size={20}/><span>Sound effects</span><span className="hangar-toggle" aria-hidden="true"><i/></span></button>
        <div className="hangar-settings-links"><button onClick={showHelp}><HelpCircle size={19}/>How to play<ArrowRight size={17}/></button>{adPrivacyAvailable && <button onClick={onPrivacy} disabled={adPrivacyBusy}><ShieldCheck size={19}/>{adPrivacyBusy ? 'Opening…' : 'Ad privacy'}<ArrowRight size={17}/></button>}</div>
        {adPrivacyMessage && <p role="status" className="hangar-privacy-message">{adPrivacyMessage}</p>}
        <span className="hangar-version">NEO GLIDE · v1.0.1</span>
      </div>
    </dialog>
  </main>;
}
