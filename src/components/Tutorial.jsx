import React, { useEffect } from "react";
import { ArrowUp, Crosshair, X } from "lucide-react";

export default function Tutorial({ boosted, fired, onComplete, onSkip }) {
  useEffect(() => {
    if (boosted && fired) onComplete();
  }, [boosted, fired, onComplete]);
  return (
    <aside className="flight-tip" aria-label="Flight tutorial">
      <span className="tip-icon">
        {boosted ? <Crosshair size={22} /> : <ArrowUp size={22} />}
      </span>
      <span>
        <strong>{boosted ? "Now try your laser" : "Your first flight"}</strong>
        <span>
          {boosted
            ? "Tap Fire. Enemy hits cost 20 HP. Green medical packs restore 25 HP."
            : "Hold Boost to rise. Release to glide. Avoid walls — they end your flight."}
        </span>
      </span>
      <button
        onClick={onSkip}
        className="icon-button"
        aria-label="Dismiss flight tips"
      >
        <X size={18} />
      </button>
    </aside>
  );
}
