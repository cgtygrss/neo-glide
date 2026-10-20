import React from 'react';
import { ArrowRight, Check, Coins, Film, Home, Rocket, RotateCcw, Star, Trophy, Wrench } from 'lucide-react';
import './RunResults.css';
import { flightEarningsBreakdown } from '../game/Economy';

export default function RunResults({
  distance,
  bestDistance,
  isNewBest,
  coins = 0,
  distanceBonus = 0,
  xp = 0,
  onRetry,
  onHome,
  onGarage,
  onContinue,
  continueUsed,
  rewardBusy,
  rewardMessage,
  levelBonus = 0,
  earningsBonus = 0,
  earningsBonusClaimed = false,
  onBoostEarnings,
  wallet = 0,
  nextShip = null,
  fleetComplete = false,
  rewardAction = null,
}) {
  const breakdown = flightEarningsBreakdown(coins, distanceBonus, levelBonus, earningsBonus);
  const remaining = nextShip ? Math.max(0, nextShip.cost - wallet) : 0;
  const progress = nextShip ? (nextShip.cost > 0 ? Math.max(0, Math.min(100, wallet / nextShip.cost * 100)) : 100) : 0;
  const boostingEarnings = rewardBusy && rewardAction === 'earnings';
  const continuing = rewardBusy && rewardAction === 'continue';

  return (
    <section className="earnings-overlay" aria-label="Flight results">
      <div className="earnings-board">
        <div className="earnings-summary">
          <h2 className="earnings-heading"><Coins size={19} />FLIGHT EARNINGS</h2>
          <p className="earnings-total"><strong>+{breakdown.total.toLocaleString()}</strong><span>credits</span></p>
          <dl className="earnings-breakdown" aria-label="Flight earnings breakdown">
            <div><dt>Collected credits</dt><dd>+{breakdown.collected.toLocaleString()}</dd></div>
            <div><dt>Distance bonus</dt><dd>+{breakdown.distance.toLocaleString()}</dd></div>
            {levelBonus > 0 && <div><dt>Level bonus</dt><dd>+{levelBonus.toLocaleString()}</dd></div>}
            {earningsBonusClaimed && <div className="earnings-ad-bonus"><dt><Check size={12} />Ad bonus</dt><dd>+{earningsBonus.toLocaleString()}</dd></div>}
          </dl>
          <div className="earnings-wallet"><span>In your wallet</span><strong><Coins size={15} />{wallet.toLocaleString()}</strong></div>
          <div className="earnings-flight-stats">
            <span><small>Distance</small><strong>{Math.floor(distance).toLocaleString()}<i> m</i></strong></span>
            <span><small><Star size={11} />Pilot XP</small><strong>+{xp.toLocaleString()}</strong></span>
            <span><small><Trophy size={11} />{isNewBest ? 'New best!' : 'Best flight'}</small><strong>{Math.floor(bestDistance).toLocaleString()}<i> m</i></strong></span>
          </div>
          {coins > 0 && !earningsBonusClaimed && onBoostEarnings && (
            <button type="button" className="earnings-ad-action earnings-double" onClick={onBoostEarnings} disabled={rewardBusy} aria-label="Double flight credits">
              <Film size={18} />
              <span><strong>{boostingEarnings ? 'Getting your ad ready…' : `Double these ${coins.toLocaleString()} credits`}</strong><small>Watch ad · Optional</small></span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>

        <div className="earnings-next-flight">
          {nextShip ? (
            <section className="earnings-goal" aria-label={`Next ship: ${nextShip.name}`}>
              <span className="earnings-goal-label"><Rocket size={15} />NEXT SHIP</span>
              <div className="earnings-goal-title"><h3>{nextShip.name}</h3><span><Coins size={12} />{nextShip.cost.toLocaleString()}</span></div>
              <div className="earnings-goal-track" role="progressbar" aria-label={`Wallet progress toward ${nextShip.name}`} aria-valuemin={0} aria-valuemax={nextShip.cost} aria-valuenow={Math.max(0, Math.min(wallet, nextShip.cost))}><span style={{ width: `${progress}%` }} /></div>
              <p>{remaining > 0 ? <><strong>{remaining.toLocaleString()}</strong> credits to go</> : <><Check size={13} />Ready to unlock</>}</p>
            </section>
          ) : fleetComplete && (
            <section className="earnings-goal earnings-fleet" aria-label="Fleet complete"><span className="earnings-goal-label"><Check size={15} />FLEET COMPLETE</span><h3>Every ship is yours.</h3><p>Fine-tune your fleet in the Garage.</p></section>
          )}
          <div className="earnings-main-actions">
            <button type="button" className="earnings-button earnings-play" onClick={onRetry} disabled={rewardBusy}><RotateCcw size={21} />Play again<ArrowRight size={18} /></button>
            <div className="earnings-secondary-actions">
              <button type="button" className="earnings-button earnings-garage" onClick={onGarage} disabled={rewardBusy}><Wrench size={18} />Garage{nextShip && remaining === 0 && <span className="earnings-ready-dot" aria-label="Ship ready to unlock" />}</button>
              <button type="button" className="earnings-button earnings-home" onClick={onHome} disabled={rewardBusy} aria-label="Back to home"><Home size={19} /></button>
            </div>
          </div>
          {!continueUsed && (
            <button type="button" className="earnings-ad-action earnings-continue" onClick={onContinue} disabled={rewardBusy}>
              <Film size={18} /><span><strong>{continuing ? 'Getting your ad ready…' : 'Continue this flight'}</strong><small>Watch ad · Continue once</small></span><ArrowRight size={16} />
            </button>
          )}
          {rewardMessage && <p className="earnings-feedback" role="status">{rewardMessage}</p>}
        </div>
      </div>
    </section>
  );
}
