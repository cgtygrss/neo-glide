import React from "react";
import { ArrowLeft, Award, Coins } from "lucide-react";
import {
  CAREER_MISSIONS,
  xpForNextLevel,
} from "../services/ProgressionService";

export default function Career({ profile, onClaim, onClose }) {
  const neededXp = xpForNextLevel(profile.level);
  return (
    <section className="panel-screen" aria-label="Pilot career">
      <div className="arcade-panel">
        <header className="panel-header">
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Back to home"
          >
            <ArrowLeft size={21} />
          </button>
          <div>
            <h2>Your journey</h2>
            <p>Small flights. Big adventures.</p>
          </div>
          <span className="header-meta">
            <Award size={22} />
            Level {profile.level}
          </span>
        </header>
        <div className="panel-body custom-scrollbar">
          <div className="career-summary">
            <div>
              <h3>Keep exploring, pilot.</h3>
              <p>
                {profile.xp} / {neededXp} XP to your next level
              </p>
              <div className="xp-track">
                <span
                  style={{
                    width: `${Math.min(100, (profile.xp / neededXp) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="career-stats">
              {[
                { label: "Flights", value: profile.runs },
                { label: "Best flight", value: `${profile.bestDistance} m` },
                { label: "Bosses defeated", value: profile.bosses },
                { label: "Credits collected", value: profile.totalCoins },
              ].map((stat) => (
                <span key={stat.label}>
                  {stat.label}
                  <strong>{stat.value}</strong>
                </span>
              ))}
            </div>
          </div>
          <h3 className="section-title">A few things to aim for</h3>
          <div className="garage-grid">
            {CAREER_MISSIONS.map((mission) => {
              const value = profile[mission.stat] || 0;
              const complete = value >= mission.target;
              const claimed = profile.claimedMissions.includes(mission.id);
              return (
                <article className="garage-card" key={mission.id}>
                  <div className="garage-card-top">
                    <span className="garage-item-icon">
                      <Award size={21} />
                    </span>
                    <span className="coin-balance" style={{ fontSize: 14 }}>
                      <Coins size={16} />+{mission.reward}
                    </span>
                  </div>
                  <h3>{mission.title}</h3>
                  <p>{mission.description}</p>
                  <div className="mission-progress">
                    <span
                      style={{
                        width: `${Math.min(100, (value / mission.target) * 100)}%`,
                      }}
                    />
                  </div>
                  <button
                    className="arcade-button primary"
                    onClick={() => onClaim(mission.id)}
                    disabled={!complete || claimed}
                  >
                    {claimed
                      ? "Claimed"
                      : complete
                        ? "Collect reward"
                        : `${Math.min(value, mission.target).toLocaleString()} / ${mission.target.toLocaleString()}`}
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
