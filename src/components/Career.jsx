import React, { useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowRight, Award, Coins, Rocket, Trophy, Crosshair, Check, Flag, UserRound } from "lucide-react";
import { CAREER_MISSIONS, xpForNextLevel } from "../services/ProgressionService";
import { accountSnapshot, subscribeAccount } from "../account/AccountService";
import AccountPanel from "./AccountPanel";
import { pilotDisplayName } from "../account/PilotIdentity";

const missionIcons = { totalDistance: Rocket, totalCoins: Coins, bosses: Crosshair, runs: Flag };

export default function Career({ profile, onRename, onClaim, onClose, initialTab = 'career' }) {
  const [tab, setTab] = useState(initialTab);
  const account = useSyncExternalStore(subscribeAccount, accountSnapshot);
  const tabRefs = useRef({});
  const tabs = [{ id: 'career', label: 'Career', icon: Trophy }, { id: 'account', label: 'Account', icon: UserRound }];
  const navigateTab = event => {
    if (account.busy || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'career' : event.key === 'End' ? 'account' : tab === 'career' ? 'account' : 'career';
    setTab(next);
    tabRefs.current[next]?.focus();
  };
  const neededXp = xpForNextLevel(profile.level);
  const xpPercent = Math.min(100, (profile.xp / neededXp) * 100);
  const completed = CAREER_MISSIONS.filter(mission => profile.claimedMissions.includes(mission.id)).length;
  const stats = [
    { label: "Flights", value: profile.runs.toLocaleString(), icon: Rocket },
    { label: "Best flight", value: `${profile.bestDistance.toLocaleString()} m`, icon: Trophy },
    { label: "Enemy ships defeated", value: profile.bosses.toLocaleString(), icon: Crosshair },
    { label: "Credits collected", value: profile.totalCoins.toLocaleString(), icon: Coins },
  ];
  return <section className="panel-screen career-screen menu-screen" aria-label="Pilot career">
    <div className="arcade-panel menu-panel">
      <header className="panel-header menu-header">
        <button className="icon-button" onClick={onClose} disabled={account.busy} aria-label="Back to home"><ArrowLeft size={21}/></button>
        <div className="menu-heading"><h2>Pilot</h2><p>Your career. Your next adventure.</p></div>
        <span className="header-meta menu-header-badge"><Award size={19}/>Level {profile.level}</span>
      </header>
      <nav className="pilot-tabs menu-tabs" role="tablist" aria-label="Pilot sections" onKeyDown={navigateTab}>{tabs.map(item => <button key={item.id} ref={element => { tabRefs.current[item.id] = element; }} id={`pilot-tab-${item.id}`} role="tab" aria-selected={tab === item.id} aria-controls={`pilot-panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1} disabled={account.busy} onClick={() => setTab(item.id)}><item.icon size={17}/>{item.label}</button>)}<span>ONE PILOT. EVERY ADVENTURE.</span></nav>
      <div key={tab} id={`pilot-panel-${tab}`} role="tabpanel" aria-labelledby={`pilot-tab-${tab}`} className="panel-body menu-body custom-scrollbar" tabIndex={0}>
        {tab === 'account' ? <AccountPanel profile={profile} onRename={onRename}/> : <>
        <section className="career-summary" aria-label="Pilot progress">
          <div className="career-pilot">
            <div className="career-level-orbit" style={{ '--xp-progress': `${xpPercent}%` }} aria-hidden="true"><div><Award size={22}/><strong>{profile.level}</strong><span>LEVEL</span></div></div>
            <div className="career-pilot-copy"><span className="menu-eyebrow">YOUR NEXT CHAPTER</span><h3>{pilotDisplayName(profile, account.user)}</h3><p>{profile.xp.toLocaleString()} / {neededXp.toLocaleString()} XP</p>
              <div className="xp-track" role="progressbar" aria-label="Progress to next pilot level" aria-valuenow={profile.xp} aria-valuemin={0} aria-valuemax={neededXp}><span style={{ width: `${xpPercent}%` }}/></div>
              <small>{Math.max(0, neededXp - profile.xp).toLocaleString()} XP to level {profile.level + 1}</small>
            </div>
          </div>
          <div className="career-stats">{stats.map(stat => <div key={stat.label}><stat.icon size={17}/><span>{stat.label}<strong>{stat.value}</strong></span></div>)}</div>
        </section>
        <div className="menu-section-heading"><div><span className="menu-eyebrow">MILESTONES</span><h3>A little further, every flight.</h3></div><span>{completed} / {CAREER_MISSIONS.length} claimed</span></div>
        <div className="career-missions">{CAREER_MISSIONS.map(mission => {
          const value = profile[mission.stat] || 0;
          const complete = value >= mission.target;
          const claimed = profile.claimedMissions.includes(mission.id);
          const Icon = missionIcons[mission.stat] || Award;
          return <article className={`career-mission ${claimed ? 'is-claimed' : complete ? 'is-ready' : ''}`} key={mission.id}>
            <div className="career-mission-top"><span className="menu-feature-icon"><Icon size={21}/></span><span className="career-mission-state">{claimed ? <><Check size={13}/>Claimed</> : complete ? 'Ready to collect' : 'In progress'}</span></div>
            <h3>{mission.title}</h3><p>{mission.description}</p>
            <div className="career-mission-progress-label"><span>{Math.min(value, mission.target).toLocaleString()} / {mission.target.toLocaleString()}</span><strong>{Math.min(100, Math.floor(value / mission.target * 100))}%</strong></div>
            <div className="mission-progress" role="progressbar" aria-label={`${mission.title} progress`} aria-valuenow={Math.min(value, mission.target)} aria-valuemin={0} aria-valuemax={mission.target}><span style={{ width: `${Math.min(100, value / mission.target * 100)}%` }}/></div>
            <div className="career-mission-bottom"><span className="career-reward"><Coins size={17}/><strong>+{mission.reward.toLocaleString()}</strong></span><button className="arcade-button primary" onClick={() => onClaim(mission.id)} disabled={!complete || claimed}>{claimed ? <><Check size={15}/>Claimed</> : complete ? 'Collect reward' : 'Keep flying'}</button></div>
          </article>;
        })}</div>
        <button className="career-account-link" onClick={() => { setTab('account'); tabRefs.current.account?.focus(); }}><UserRound size={18}/><span><strong>Your pilot, connected.</strong><small>Manage your account & cloud save</small></span><ArrowRight size={18}/></button>
        </>}
      </div>
    </div>
  </section>;
}
