import React from 'react';
import { Crosshair, AlertTriangle, Coins } from 'lucide-react';
import './BossStatus.css';

export default function BossStatus({ boss, transformed }) {
  if (!boss) return null;
  if (boss.intro) return <section className={`boss-status boss-arrival-status ${transformed ? 'boss-status-transformed' : ''}`} style={{ '--boss-color': boss.color }} aria-label={`${boss.name} incoming`}>
    <div className="boss-arrival-heading"><span><AlertTriangle size={14}/>BOSS INCOMING</span><small>{boss.remaining}s TO ARRIVAL</small></div>
    <strong className="boss-arrival-name">{boss.name}</strong>
    <span className="boss-arrival-reward"><Coins size={13}/>{boss.reward.toLocaleString()} credits <small>DEFEAT REWARD</small></span>
    <div className="boss-arrival-progress" aria-hidden="true"><span style={{width:`${boss.progress * 100}%`}}/></div>
  </section>;
  return <section className={`boss-status ${transformed ? 'boss-status-transformed' : ''}`} style={{ '--boss-color': boss.color }} aria-label={`${boss.name}, phase ${boss.stage}`}>
    <div><span><Crosshair size={12}/>{boss.name}</span><small>PHASE {boss.stage} · {boss.remaining}s</small></div>
    <div className="boss-health" role="meter" aria-label={`${boss.name} health`} aria-valuemin={0} aria-valuemax={boss.maxHp} aria-valuenow={Math.max(0, boss.hp)}><span style={{width:`${Math.max(0, boss.hp / boss.maxHp * 100)}%`}}/></div>
  </section>;
}
