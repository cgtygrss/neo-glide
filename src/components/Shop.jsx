import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Zap, Magnet, Rocket, Shield, ArrowLeft, Crosshair, Star, Activity, Circle, Minus, BadgeDollarSign, Coins, Check, Eye, ArrowRight, Sparkles } from 'lucide-react';
import StageBrowser from './StageBrowser';
import RealMoneyStore from './RealMoneyStore';
import FleetBrowser from './FleetBrowser';
import ShopPreviewCanvas from './ShopPreviewCanvas';
import { UPGRADES, WEAPONS, upgradeOffer, weaponDetails } from '../game/ShopCatalog';
import ShipPreview from './ShipPreview';
import { getStorePlatform, getStoreProducts, refreshStoreProducts, subscribeStore } from '../services/MonetizationService';
import { canRetryPendingPurchase } from '../services/StorePolicy';

const ICONS = { battery: Zap, thruster: Rocket, magnet: Magnet, hull: Shield, multiplier: Star, shield_gen: Activity, default: Zap, blaster: Crosshair, cannon: Circle, beam: Minus, wave: Activity, shock: Zap };
function BuyItem({ item, kind, cost, owned, equipped, currency, onBuy, onEquip, maxed = false }) {
  return <button type="button" className={`arcade-button ${equipped || (!owned && currency < cost) ? 'secondary' : 'primary'}`}
    disabled={maxed || equipped || (!owned && currency < cost)}
    onClick={()=>owned ? onEquip(item.id,'weapon') : onBuy(item.id,cost,kind)}>
    {maxed ? <><Check size={16}/>Maximum · 2×</> : equipped ? <><Check size={16}/>Equipped</> : owned ? 'Use this weapon' : <><span>{kind==='upgrade'?'Upgrade':'Unlock'}</span><Coins size={15}/>{cost.toLocaleString()}</>}
  </button>;
}

function CosmeticsBrowser({ cosmetics, ownedCosmetics, equippedCosmetic, pendingProducts, currency, ship, busyProduct, purchaseMessage, onBuy, onEquip, onPurchase, onRestore }) {
  const storeProducts = useSyncExternalStore(subscribeStore, getStoreProducts);
  const [selectedId, setSelectedId] = useState(equippedCosmetic || cosmetics[0]?.id);
  const selected = cosmetics.find(item => item.id === selectedId) || cosmetics[0];
  useEffect(() => { void refreshStoreProducts().catch(() => {}); }, []);
  if (!selected) return null;
  const owned = Boolean(ownedCosmetics[selected.id]);
  const equipped = selected.id === equippedCosmetic;
  const pending = pendingProducts.includes(selected.productId);
  const selectedStoreProduct = storeProducts.find(item => item.id === selected.productId);
  return <div className="shop-item-browser cosmetic-browser">
    <section className="shop-spotlight cosmetic-spotlight-layout" aria-label={`${selected.name} cosmetic preview`}>
      <div className="shop-spotlight-stage cosmetic-spotlight" style={{ '--cosmetic-accent': selected.colors.accent }}><ShopPreviewCanvas kind="cosmetic" itemId={selected.id} ship={ship}/></div>
      <div key={selected.id} className="shop-spotlight-details selection-reveal"><div className="cosmetic-meta"><span className="cosmetic-tier">{selected.tier}</span><span>{String(selected.rank).padStart(2, '0')} / {String(cosmetics.length).padStart(2, '0')}</span></div><h3>{selected.name}</h3><p>{selected.description}</p>
        {pending ? canRetryPendingPurchase({ platform: getStorePlatform(), isPending: true, isOwned: owned })
          ? <button className="arcade-button secondary" disabled={Boolean(busyProduct)} onClick={() => onPurchase(selected.productId)}>Check / retry purchase</button>
          : <button className="arcade-button secondary" disabled>Approval pending</button>
          : equipped ? <button className="arcade-button secondary" disabled><Check size={16}/>Active</button>
          : owned ? <button className="arcade-button primary" onClick={() => onEquip(selected.id, 'cosmetic')}>Equip cosmetic</button>
          : <div className={`cosmetic-actions ${selectedStoreProduct?.available ? '' : 'single'}`} aria-label="Purchase options"><button type="button" className="cosmetic-action credit" aria-label={`Unlock ${selected.name} for ${selected.creditPrice.toLocaleString()} credits`} disabled={currency < selected.creditPrice || Boolean(busyProduct)} onClick={() => onBuy(selected.id, selected.creditPrice, 'cosmetic')}><span>Unlock <Coins size={15}/></span><strong>{selected.creditPrice.toLocaleString()}</strong><small>credits</small></button>{selectedStoreProduct?.available && <button type="button" className="cosmetic-action cash" aria-label={`Buy ${selected.name} for ${selectedStoreProduct.price}, one-time purchase`} disabled={Boolean(busyProduct)} onClick={() => onPurchase(selected.productId)}><span>Buy</span><strong>{selectedStoreProduct.price}</strong><small>one-time</small></button>}</div>}
        {equippedCosmetic && <button className="cosmetic-reset" type="button" onClick={() => onEquip('', 'cosmetic')}>Use default colors</button>}
        <button type="button" className="cosmetic-reset" onClick={onRestore} disabled={Boolean(busyProduct)}>Restore purchases</button>
        {purchaseMessage && <p className="premium-message" role="status">{purchaseMessage}</p>}
      </div>
    </section>
    <div className="shop-selection-heading"><span>Theme library</span><span>{cosmetics.length} permanent cosmetics</span></div>
    <div className="garage-grid cosmetic-grid">{cosmetics.map(item => {
      const itemOwned = Boolean(ownedCosmetics[item.id]), itemEquipped = item.id === equippedCosmetic, itemPending = pendingProducts.includes(item.productId);
      return <article key={item.id} className={`garage-card visual-garage-card ${item.id === selected.id ? 'preview-selected' : ''} ${itemEquipped ? 'equipped' : ''}`} style={{ '--cosmetic-accent': item.colors.accent }}>
        <div className="garage-card-top"><span className="garage-item-icon"><Sparkles size={18}/></span><span className="item-level">{itemEquipped ? 'Active' : itemOwned ? 'Owned' : itemPending ? 'Pending' : 'Locked'}</span></div>
        <button type="button" className="garage-preview-choice cosmetic-choice" aria-label={`Preview ${item.name}`} onClick={() => setSelectedId(item.id)}><ShipPreview ship={ship} cosmeticId={item.id} boosting/><span><Eye size={13}/>Preview</span></button>
        <h3>{item.name}</h3><p className="cosmetic-card-meta">{item.tier} · {String(item.rank).padStart(2, '0')} / {String(cosmetics.length).padStart(2, '0')}</p><p>{item.creditPrice.toLocaleString()} credits</p>
      </article>;
    })}</div>
  </div>;
}

export default function Shop({ initialTab = 'upgrades', equippedStage = 'default', stageOwnership = {}, onStageUnlock, onStageEquip, currency, upgrades, pilotLevel = 1, ownedShips = [], equippedShip = 'default', ownedWeapons = [], equippedWeapon = 'default', cosmetics = [], ownedCosmetics = {}, equippedCosmetic = '', pendingProducts = [], purchases = {}, busyProduct, purchaseMessage, onBuy, onEquip, onPurchase, onRestore, onClose }) {
  const [activeTab,setActiveTab] = useState(initialTab);
  const [upgradeId,setUpgradeId] = useState('battery');
  const [weaponId,setWeaponId] = useState(equippedWeapon);
  const tabs=[{id:'upgrades',name:'Upgrades',icon:Zap},{id:'ships',name:'Ships',icon:Rocket},{id:'weapons',name:'Weapons',icon:Crosshair},{id:'cosmetics',name:'Cosmetics',icon:Sparkles},{id:'stages',name:'Galaxies',icon:Star},{id:'premium',name:'Store',icon:BadgeDollarSign}];
  const isUpgrade=activeTab==='upgrades';
  const kind=isUpgrade?'upgrade':'weapon';
  const items=isUpgrade?UPGRADES:WEAPONS;
  const selected=isUpgrade?upgradeOffer(upgradeId,upgrades,equippedShip,pilotLevel):weaponDetails(weaponId);
  const owned=!isUpgrade&&ownedWeapons.includes(selected.id);
  const equipped=!isUpgrade&&selected.id===equippedWeapon;
  const selectTab = (id, button) => {
    setActiveTab(id);
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  const handleTabKeyDown = event => {
    const current = tabs.findIndex(tab => tab.id === activeTab);
    const next = event.key === 'ArrowRight' ? (current + 1) % tabs.length
      : event.key === 'ArrowLeft' ? (current - 1 + tabs.length) % tabs.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    const button = event.currentTarget.querySelectorAll('[role="tab"]')[next];
    button?.focus({ preventScroll: true });
    selectTab(tabs[next].id, button);
  };
  return <section className="panel-screen" aria-label="Garage"><div className="arcade-panel">
    <header className="panel-header">
      <button className="icon-button" onClick={onClose} aria-label="Back to home"><ArrowLeft size={21}/></button>
      <div><h2>Garage</h2><p>See it. Try it. Find your next favorite.</p></div>
      <span className="coin-balance"><Coins size={20}/>{currency.toLocaleString()}</span>
    </header>
    <nav className="panel-tabs" role="tablist" aria-label="Garage categories" onKeyDown={handleTabKeyDown}>{tabs.map(tab=><button key={tab.id} type="button" role="tab" id={`garage-tab-${tab.id}`} aria-controls="garage-tab-panel" tabIndex={activeTab===tab.id?0:-1} onClick={event=>selectTab(tab.id,event.currentTarget)} className={activeTab===tab.id?'active':''} aria-selected={activeTab===tab.id}><tab.icon size={17}/>{tab.name}</button>)}</nav>
    <div key={activeTab} id="garage-tab-panel" role="tabpanel" aria-labelledby={`garage-tab-${activeTab}`} tabIndex={0} className="panel-body custom-scrollbar garage-tab-content">
      {activeTab==='premium'?<RealMoneyStore purchases={purchases} pendingProducts={pendingProducts} busyProduct={busyProduct} message={purchaseMessage} onPurchase={onPurchase} onRestore={onRestore}/>
      :activeTab==='stages'?<StageBrowser currency={currency} equippedStage={equippedStage} ownership={stageOwnership} onUnlock={onStageUnlock} onEquip={onStageEquip}/>
      :activeTab==='ships'?<FleetBrowser currency={currency} ownedShips={ownedShips} equippedShip={equippedShip} cosmeticId={equippedCosmetic} upgrades={upgrades} onBuy={onBuy} onEquip={onEquip}/>
      :activeTab==='cosmetics'?<CosmeticsBrowser cosmetics={cosmetics} ownedCosmetics={ownedCosmetics} equippedCosmetic={equippedCosmetic} pendingProducts={pendingProducts} currency={currency} ship={equippedShip} busyProduct={busyProduct} purchaseMessage={purchaseMessage} onBuy={onBuy} onEquip={onEquip} onPurchase={onPurchase} onRestore={onRestore}/>
      :<div className="shop-item-browser">
        <section className="shop-spotlight" aria-label={`${selected.name} preview details`}>
          <div className="shop-spotlight-stage"><ShopPreviewCanvas key={`${kind}:${selected.id}:${selected.level||0}:${equippedCosmetic}`} kind={kind} itemId={selected.id} ship={equippedShip} cosmeticId={equippedCosmetic} upgrades={upgrades} pilotLevel={pilotLevel}/></div>
          <div key={selected.id} className="shop-spotlight-details selection-reveal">
            <span className="eyebrow">{isUpgrade?'FEEL THE DIFFERENCE':'YOUR NEXT SHOT'}</span>
            <h3>{selected.name}</h3><p>{selected.desc}</p>
            {isUpgrade?<div className="upgrade-comparison"><span>{selected.metric}</span><div><span><small>Current</small><strong>{selected.beforeLabel}</strong></span><ArrowRight size={17}/><span><small>Next upgrade</small><strong>{selected.afterLabel}</strong></span></div>{selected.startingSpeed&&<small>Starting pace: {selected.startingSpeed.join(' → ')}</small>}</div>
            :<div className="weapon-metrics"><span><small>Damage</small><strong>{selected.damage}</strong></span><span><small>Shot speed</small><strong>{selected.speed}</strong></span><span><small>Ammo / shot</small><strong>1</strong></span></div>}
            <BuyItem item={selected} kind={kind} cost={selected.cost} maxed={selected.maxed} owned={owned} equipped={equipped} currency={currency} onBuy={onBuy} onEquip={onEquip}/>
            <span className="shop-preview-note">Preview any item, including locked ones.</span>
          </div>
        </section>
        <div className="shop-selection-heading"><span>Take a closer look</span><span>{items.length} {isUpgrade?'upgrades':'weapons'}</span></div>
        <div className="garage-grid">
          {items.map(item=>{
            const offer=isUpgrade?upgradeOffer(item.id,upgrades,equippedShip,pilotLevel):weaponDetails(item.id);
            const isOwned=!isUpgrade&&ownedWeapons.includes(item.id), isEquipped=!isUpgrade&&item.id===equippedWeapon;
            const Icon=ICONS[item.id];
            return <article key={item.id} className={`garage-card visual-garage-card ${selected.id===item.id?'preview-selected':''} ${isEquipped?'equipped':''}`}>
              <div className="garage-card-top"><span className="garage-item-icon"><Icon size={18}/></span><span className="item-level">{isUpgrade?`Level ${offer.level}`:isEquipped?'Equipped':isOwned?'Owned':'Locked'}</span></div>
              <button type="button" className="garage-preview-choice" aria-label={`Preview ${item.name}`} aria-pressed={selected.id===item.id} onClick={()=>isUpgrade?setUpgradeId(item.id):setWeaponId(item.id)}>
                <ShopPreviewCanvas compact kind={kind} itemId={item.id} ship={equippedShip} cosmeticId={equippedCosmetic} upgrades={upgrades} pilotLevel={pilotLevel}/>
                <span><Eye size={13}/>Preview</span>
              </button>
              <h3>{item.name}</h3><p>{isUpgrade?`${offer.beforeLabel} → ${offer.afterLabel}`:`${offer.damage} damage · ${offer.speed} speed`}</p>
              <BuyItem item={item} kind={kind} cost={offer.cost} maxed={offer.maxed} owned={isOwned} equipped={isEquipped} currency={currency} onBuy={onBuy} onEquip={onEquip}/>
            </article>;
          })}
        </div>
      </div>}
    </div>
  </div></section>;
}
