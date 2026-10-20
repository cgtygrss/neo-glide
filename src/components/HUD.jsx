import React from "react";
import { ArrowUp, ChevronsRight, Coins, Crosshair, Heart, Pause, Zap, RotateCw, Rocket, CircleDot, Shield } from "lucide-react";
import { TRANSFORMATION_SECONDS } from '../game/TransformationCatalog';
import './TransformationHUD.css';

export default function HUD({
  distance,
  currency,
  energy,
  ammo,
  maxAmmo,
  health,
  maxHealth,
  combo = 0,
  activePowerUps = [],
  transformation = null,
  onShoot,
  onBoostStart,
  onBoostEnd,
  onPause,
  countdown,
  paused,
  flightPhase,
}) {
  const unlimited = activePowerUps.some((p) => p.type === "RAPID_FIRE");
  const formReady = transformation?.phase === 'ACTIVE';
  const fireAvailable = flightPhase === "FLYING" && !paused && !countdown && (transformation ? formReady && transformation.cooldownRemaining <= 0 : ammo > 0 || unlimited);
  const PrimaryIcon = transformation?.id === 'sphere' ? RotateCw : ['drill', 'aegis', 'striker'].includes(transformation?.id) ? Zap : ArrowUp;
  const SecondaryIcon = transformation?.id === 'aegis' ? Shield : transformation?.id === 'volt' ? Zap : transformation?.id === 'drill' ? ChevronsRight : transformation?.id === 'striker' ? Rocket : transformation ? CircleDot : Crosshair;
  const primaryLabel = transformation ? `${transformation.primary} — ${transformation.primaryHint.toLowerCase()}` : 'Boost — hold to rise';
  const secondaryLabel = transformation ? `${transformation.secondary} — ${transformation.cooldownRemaining > 0 ? `${transformation.cooldownRemaining.toFixed(1)} seconds cooldown` : transformation.secondaryHint.toLowerCase()}` : `Fire — ${unlimited ? 'unlimited' : ammo} ammo`;
  const energyValue = transformation ? transformation.remaining / TRANSFORMATION_SECONDS * 100 : energy;
  return (
    <div className={`flight-hud ${transformation ? 'transformed-hud' : ''}`} style={transformation ? { '--form-accent': transformation.color } : undefined}>
      <div className="flight-topbar">
        <div className="flight-vitals">
          <div className="vital-row">
            <Heart size={17} />
            <div
              className="vital-track hull-track"
              role="meter"
              aria-label="Health"
              aria-valuemin={0}
              aria-valuemax={maxHealth}
              aria-valuenow={Math.max(0, health)}
            >
              <span
                style={{
                  width: `${Math.min(100, Math.max(0, (health / maxHealth) * 100))}%`,
                }}
              />
            </div>
            <span>
              {Math.ceil(health)}/{maxHealth}
            </span>
          </div>
          <div className={`vital-row ${!transformation && energy < 25 ? "low-energy" : ""}`}>
            <Zap size={17} />
            <div
              className="vital-track energy-track"
              role="meter"
              aria-label={transformation ? 'Vehicle duration' : 'Boost energy'}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(energyValue)}
            >
              <span
                style={{ width: `${Math.max(0, Math.min(100, energyValue))}%` }}
              />
            </div>
            <span>{transformation ? `${Math.ceil(transformation.remaining)}s` : `${Math.floor(energy)}%`}</span>
          </div>
        </div>
        <div className="flight-distance">
          <strong>
            {Math.floor(distance).toLocaleString()}
            <small>m</small>
          </strong>
          <span>DISTANCE</span>
        </div>
        <div className="flight-top-actions">
          <span className="coin-balance">
            <Coins size={18} />
            {currency.toLocaleString()}
          </span>
          <button
            className="icon-button"
            onClick={onPause}
            disabled={paused}
            aria-label="Pause flight"
          >
            <Pause size={21} />
          </button>
        </div>
      </div>
      {transformation && <div className="transformation-banner">
        <strong role="status">{transformation.name}</strong>
        <span>{transformation.shieldRemaining > 0 ? `BARRIER ACTIVE · ${transformation.shieldRemaining.toFixed(1)}s` : transformation.phase === 'ENTERING' ? `ASSEMBLING · ${Math.round(transformation.transitionProgress * 100)}%` : transformation.phase === 'EXITING' ? 'Releasing modules…' : transformation.hint}</span>
        {transformation.phase !== 'ACTIVE' && <div className="transformation-progress" role="progressbar" aria-label={transformation.phase === 'ENTERING' ? 'Vehicle assembly' : 'Returning to ship'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(transformation.transitionProgress * 100)}>
          <span style={{ width: `${transformation.transitionProgress * 100}%` }} />
        </div>}
      </div>}
      <div className="flight-bonuses">
        {combo >= 2 && <span className="combo-badge">{combo} streak</span>}
        {activePowerUps.map((power) => (
          <span
            key={power.type}
            className="power-badge"
            title={power.name}
            aria-label={`${power.name}: ${Math.ceil(power.remainingTime)} seconds`}
          >
            <span>{power.icon}</span>
            {Math.ceil(power.remainingTime)}s
          </span>
        ))}
      </div>
      <div className="flight-controls">
        <button
          className="flight-pedal boost-pedal"
          aria-label={primaryLabel}
          onPointerDown={onBoostStart}
          onPointerUp={onBoostEnd}
          onPointerCancel={onBoostEnd}
          onLostPointerCapture={onBoostEnd}
          onKeyDown={(e) => {
            if ((e.key === " " || e.key === "Enter") && !e.repeat) {
              e.preventDefault();
              onBoostStart(e);
            }
          }}
          onKeyUp={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              onBoostEnd(e);
            }
          }}
          aria-disabled={Boolean(transformation && !formReady) || undefined}
          disabled={paused || Boolean(countdown)}
        >
          <PrimaryIcon size={29} strokeWidth={3} />
          <strong>{transformation?.primary || 'BOOST'}</strong>
          <small>{transformation?.primaryHint || 'HOLD TO RISE'}</small>
        </button>
        <span className="keyboard-hint">
          {transformation ? `SPACE / ↑ ${transformation.primary} · SHIFT ${transformation.secondary}` : 'SPACE / ↑ to boost · SHIFT to fire'}
        </span>
        <button
          className="flight-pedal fire-pedal"
          aria-label={secondaryLabel}
          onPointerDown={(e) => {
            if (e.button === 0) {
              e.preventDefault();
              onShoot();
            }
          }}
          onClick={(e) => {
            if (e.detail === 0) onShoot();
          }}
          disabled={!fireAvailable}
        >
          <SecondaryIcon size={28} />
          <strong>{transformation?.secondary || 'FIRE'}</strong>
          <small>{transformation ? transformation.cooldownRemaining > 0 ? `READY IN ${transformation.cooldownRemaining.toFixed(1)}s` : transformation.secondaryHint : unlimited ? '∞ AMMO' : `${ammo} / ${maxAmmo}`}</small>
        </button>
      </div>
      {countdown && (
        <div className="countdown-overlay">
          <span>Back to your flight in</span>
          <strong>{countdown}</strong>
          <span>Get ready to boost</span>
        </div>
      )}
    </div>
  );
}
