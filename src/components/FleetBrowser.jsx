import React, { useState } from "react";
import { Check, Coins, LockKeyhole, Sparkles, Play, Eye, Heart, Zap, Crosshair } from "lucide-react";
import { SHIPS, getShip } from "../game/ShipCatalog";
import ShipPreview from "./ShipPreview";
import CatalogCarousel from "./CatalogCarousel";
import CatalogDetails from "./CatalogDetails";
import ShopPreviewCanvas from "./ShopPreviewCanvas";
import { sortCatalogByPrice } from '../game/CatalogSorting';
import { flightEquipment } from '../game/FlightEquipment';
import { maxHullHealth } from '../game/PlayerHealth';

const SORTED_SHIPS = sortCatalogByPrice(SHIPS);

export default function FleetBrowser({
  currency,
  ownedShips,
  equippedShip,
  cosmeticId = '',
  upgrades = {},
  pilotLevel = 1,
  onBuy,
  onEquip,
}) {
  const [selectedId, setSelectedId] = useState(equippedShip);
  const [flightPreviewId, setFlightPreviewId] = useState('');
  const ship = getShip(selectedId);
  const owned = ownedShips.includes(ship.id);
  const equipped = equippedShip === ship.id;
  const canAfford = currency >= ship.cost;
  const equipment = flightEquipment(upgrades, ship.id, pilotLevel);
  return (
    <div className="fleet-browser fleet-carousel">
      <CatalogCarousel items={SORTED_SHIPS} selectedId={ship.id} onSelect={setSelectedId} label="Ships" itemLabel="ship" accent={ship.palette.accent}>

      <section
        className="fleet-spotlight"
        data-ownership={equipped ? 'equipped' : owned ? 'owned' : 'locked'}
        aria-label={`${ship.name} details`}
        style={{ "--ship-accent": ship.palette.accent }}
      >
        <div className="fleet-stage" data-live-preview={flightPreviewId === ship.id}>
          <span className="fleet-number" aria-hidden="true">
            {ship.number}
          </span>
          <div className="fleet-stage-orbit" aria-hidden="true" />
            <span className={`fleet-status ${equipped ? "equipped" : ""}`}>
              {equipped ? (
                <Check size={13} />
              ) : owned ? null : (
                <LockKeyhole size={12} />
              )}{" "}
              {equipped ? "Equipped" : owned ? "Owned" : "Locked"}
            </span>
          {flightPreviewId === ship.id
            ? <ShopPreviewCanvas key={`${ship.id}:${cosmeticId}`} kind="ship" itemId={ship.id} cosmeticId={cosmeticId} upgrades={upgrades}/>
            : <ShipPreview ship={ship.id} cosmeticId={cosmeticId} boosting/>}
          <button type="button" className={`preview-play catalog-art-toggle ${flightPreviewId === ship.id ? 'is-previewing' : ''}`} onClick={() => setFlightPreviewId(flightPreviewId === ship.id ? '' : ship.id)}>
            {flightPreviewId === ship.id ? <><Eye size={14}/>Ship view</> : <><Play size={14}/>Watch flight</>}
          </button>
        </div>
        <CatalogDetails key={ship.id} className="fleet-details selection-reveal" actions={<button
          className={`arcade-button ${equipped || (!owned && !canAfford) ? 'secondary' : 'primary'}`}
          disabled={equipped || (!owned && !canAfford)}
          onClick={() => owned ? onEquip(ship.id, 'ship') : onBuy(ship.id, ship.cost, 'ship')}>
          {equipped ? <><Check size={17}/>Ready to fly</> : owned ? 'Use this ship' : <>Unlock ship <Coins size={16}/>{ship.cost.toLocaleString()}</>}
        </button>}>
          <div className="fleet-title">
            <div>
              <span className="tiny-label">{ship.className}</span>
              <h3>{ship.name}</h3>
            </div>

          </div>
          <p className="fleet-story">{ship.description}</p>
          <p className="fleet-trait">
            <Sparkles size={16} />
            <span>{ship.trait}</span>
          </p>
          <dl className="garage-ship-specs" aria-label="Ship capabilities with your upgrades">
            <div><dt><Heart size={14}/>Hull</dt><dd>{maxHullHealth(upgrades.hull || 1, ship.id, pilotLevel)}<small> HP</small></dd></div>
            <div><dt><Zap size={14}/>Boost</dt><dd>{Number((equipment.maxEnergy / equipment.energyDrain).toFixed(1))}<small> sec</small></dd></div>
            <div><dt><Crosshair size={14}/>Ammo refill</dt><dd>{Number(equipment.ammoRegenTime.toFixed(2))}<small> sec</small></dd></div>
          </dl>
          {!owned && !canAfford && (
            <p className="fleet-shortfall">
              {(ship.cost - currency).toLocaleString()} more credits to unlock
            </p>
          )}
        </CatalogDetails>
      </section>
      </CatalogCarousel>
    </div>
  );
}
