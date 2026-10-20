import React, { useState } from "react";
import { Check, Coins, LockKeyhole, Sparkles } from "lucide-react";
import { SHIPS, getShip } from "../game/ShipCatalog";
import ShipPreview from "./ShipPreview";
import ShopPreviewCanvas from "./ShopPreviewCanvas";

export default function FleetBrowser({
  currency,
  ownedShips,
  equippedShip,
  cosmeticId = '',
  upgrades = {},
  onBuy,
  onEquip,
}) {
  const [selectedId, setSelectedId] = useState(equippedShip);
  const ship = getShip(selectedId);
  const owned = ownedShips.includes(ship.id);
  const equipped = equippedShip === ship.id;
  const canAfford = currency >= ship.cost;
  return (
    <div className="fleet-browser">
      <section
        className="fleet-spotlight"
        aria-label={`${ship.name} details`}
        style={{ "--ship-accent": ship.palette.accent }}
      >
        <div className="fleet-stage">
          <span className="fleet-number" aria-hidden="true">
            {ship.number}
          </span>
          <div className="fleet-stage-orbit" aria-hidden="true" />
          <ShopPreviewCanvas key={`${ship.id}:${cosmeticId}`} kind="ship" itemId={ship.id} cosmeticId={cosmeticId} upgrades={upgrades}/>

        </div>
        <div key={ship.id} className="fleet-details selection-reveal">
          <div className="fleet-title">
            <div>
              <span className="tiny-label">{ship.className}</span>
              <h3>{ship.name}</h3>
            </div>
            <span className={`fleet-status ${equipped ? "equipped" : ""}`}>
              {equipped ? (
                <Check size={13} />
              ) : owned ? null : (
                <LockKeyhole size={12} />
              )}{" "}
              {equipped ? "Equipped" : owned ? "Owned" : "Locked"}
            </span>
          </div>
          <p className="fleet-story">{ship.description}</p>
          <p className="fleet-trait">
            <Sparkles size={16} />
            <span>{ship.trait}</span>
          </p>
          <button
            className={`arcade-button ${equipped || (!owned && !canAfford) ? "secondary" : "primary"}`}
            disabled={equipped || (!owned && !canAfford)}
            onClick={() =>
              owned
                ? onEquip(ship.id, "ship")
                : onBuy(ship.id, ship.cost, "ship")
            }
          >
            {equipped ? (
              <>
                <Check size={17} />
                Ready to fly
              </>
            ) : owned ? (
              "Use this ship"
            ) : (
              <>
                Unlock ship <Coins size={16} />
                {ship.cost.toLocaleString()}
              </>
            )}
          </button>
          {!owned && !canAfford && (
            <p className="fleet-shortfall">
              {(ship.cost - currency).toLocaleString()} more credits to unlock
            </p>
          )}
        </div>
      </section>
      <div className="fleet-selection">
        <div className="fleet-selection-heading">
          <span>Pick a ship. Watch it fly.</span>
          <span>
            {
              ownedShips.filter((id) => SHIPS.some((ship) => ship.id === id))
                .length
            }{" "}
            / {SHIPS.length} owned
          </span>
        </div>
        <div
          className="fleet-grid"
          role="group"
          aria-label="Choose a ship to preview"
        >
          {SHIPS.map((model) => {
            const isOwned = ownedShips.includes(model.id);
            return (
              <button
                key={model.id}
                aria-label={`Preview ${model.name}`}
                aria-pressed={ship.id === model.id}
                onClick={() => setSelectedId(model.id)}
                className={`fleet-tile ${ship.id === model.id ? "selected" : ""}`}
                style={{ "--ship-accent": model.palette.accent }}
              >
                <span className="fleet-tile-number">{model.number}</span>
                <ShipPreview ship={model.id} cosmeticId={cosmeticId} />
                <strong>{model.name}</strong>
                <span className="fleet-tile-meta">
                  {equippedShip === model.id ? (
                    <>
                      <Check size={11} />
                      Equipped
                    </>
                  ) : isOwned ? (
                    "Owned"
                  ) : (
                    <>
                      <Coins size={11} />
                      {model.cost.toLocaleString()}
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
