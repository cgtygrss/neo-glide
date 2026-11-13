import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Zap, Rocket, ArrowLeft, Crosshair, Star, BadgeDollarSign, Coins, Check, ArrowRight, Sparkles, Play, Eye, ShoppingBag } from 'lucide-react';
import StageBrowser from './StageBrowser';
import RealMoneyStore from './RealMoneyStore';
import FleetBrowser from './FleetBrowser';
import ShopPreviewCanvas from './ShopPreviewCanvas';
import { UPGRADES, WEAPONS, upgradeOffer, weaponDetails } from '../game/ShopCatalog';
import ShipPreview from './ShipPreview';
import CatalogCarousel from './CatalogCarousel';
import CatalogDetails from './CatalogDetails';
import CosmeticKitDetails from './CosmeticKitDetails';
import { sortCatalogByPrice } from '../game/CatalogSorting';
import './GarageVisuals.css';
import './GarageViewport.css';
import { getStoreProducts, refreshStoreProducts, refreshStorePurchases, subscribeStore, trackMonetizationEvent } from '../services/MonetizationService';
import CosmeticPurchaseOptions from './CosmeticPurchaseOptions';
import GarageFeatured from './GarageFeatured';
import { onlineServicesAllowed } from '../privacy/AudiencePolicy.js';
import CosmeticOfferNote from './CosmeticOfferNote';
import { SKINS, getCosmetic } from '../game/CosmeticsCatalog';

function BuyItem({ item, kind, cost, owned, equipped, currency, onBuy, onEquip, maxed = false }) {
  return <button type="button" className={`arcade-button ${equipped || (!owned && currency < cost) ? 'secondary' : 'primary'}`}
    disabled={maxed || equipped || (!owned && currency < cost)}
    onClick={()=>owned ? onEquip(item.id,'weapon') : onBuy(item.id,cost,kind)}>
    {maxed ? <><Check size={16}/>Maximum · 2×</> : equipped ? <><Check size={16}/>Equipped</> : owned ? 'Use this weapon' : <><span>{kind==='upgrade'?'Upgrade':'Unlock'}</span><Coins size={15}/>{cost.toLocaleString()}</>}
  </button>;
}

function CosmeticsBrowser({ initialSelectedId, cosmetics, ownedCosmetics, equippedCosmetic, pendingProducts, currency, ship, busyProduct, purchaseMessage, onBuy, onEquip, onPurchase }) {
  const storeProducts = useSyncExternalStore(subscribeStore, getStoreProducts);
  const [selectedId, setSelectedId] = useState(initialSelectedId || equippedCosmetic || sortCatalogByPrice(cosmetics)[0]?.id);
  const [previewMode, setPreviewMode] = useState('design');
  const [appearanceKind, setAppearanceKind] = useState(() => getCosmetic(initialSelectedId || equippedCosmetic)?.kind === 'skin' ? 'skin' : 'set');
  const items = sortCatalogByPrice(appearanceKind === 'skin' ? SKINS.filter(skin => cosmetics.some(set => set.id === skin.setId)) : cosmetics);
  const selected = items.find(item => item.id === selectedId) || items[0];
  useEffect(() => { void refreshStoreProducts().catch(() => {}); }, []);
  if (!selected) return null;
  const owned = Boolean(ownedCosmetics[selected.id]);
  const equipped = selected.id === equippedCosmetic;
  const pending = pendingProducts.includes(selected.kind === 'skin' ? getCosmetic(selected.setId).productId : selected.productId);
  const selectedStoreProduct = storeProducts.find(item => item.id === selected.productId);
  const selectKind = kind => {
    const setId = selected.setId || selected.id;
    setSelectedId(kind === 'skin' ? `skin_${setId}` : setId);
    setAppearanceKind(kind);
  };
  return <div className="shop-item-browser cosmetic-browser">
    <div className="cosmetic-kind-switch" role="group" aria-label="Cosmetic type">
      <button type="button" aria-pressed={appearanceKind === 'set'} onClick={() => selectKind('set')}>Complete sets</button>
      <button type="button" aria-pressed={appearanceKind === 'skin'} onClick={() => selectKind('skin')}>Skins</button>
    </div>
    <CatalogCarousel items={items} selectedId={selected.id} onSelect={setSelectedId} label="Cosmetics" itemLabel="cosmetic" accent={selected.colors.accent}>

    <section className="shop-spotlight cosmetic-spotlight-layout" data-showpiece={selected.showpiece || undefined} aria-label={`${selected.name} cosmetic preview`}>
      <div className="shop-spotlight-stage cosmetic-spotlight cosmetic-kit-stage" data-showpiece={selected.showpiece || undefined} style={{ '--cosmetic-accent': selected.colors.accent }}>
        <span className="cosmetic-art-label">{previewMode === 'original' ? 'ORIGINAL HULL' : selected.signature}</span>
        {previewMode === 'flight' ? <ShopPreviewCanvas key={selected.id} kind="cosmetic" itemId={selected.id} ship={ship}/> : <ShipPreview ship={ship} cosmeticId={previewMode === 'original' ? '' : selected.id} boosting/>}
        <div className="cosmetic-view-switch" role="group" aria-label="Cosmetic preview mode">
          <button type="button" aria-pressed={previewMode === 'design'} onClick={() => setPreviewMode('design')}><Sparkles size={13}/>{selected.kind === 'skin' ? 'Skin' : 'Full set'}</button>
          <button type="button" aria-pressed={previewMode === 'flight'} onClick={() => setPreviewMode('flight')}><Play size={13}/>In flight</button>
          <button type="button" aria-pressed={previewMode === 'original'} onClick={() => setPreviewMode('original')}><Eye size={13}/>Original</button>
        </div>
      </div>
      <CatalogDetails key={selected.id} className="shop-spotlight-details selection-reveal" actions={<>
        <CosmeticPurchaseOptions cosmetic={selected} storeProduct={selectedStoreProduct} currency={currency} owned={owned} ownedCosmetics={ownedCosmetics} equipped={equipped} pending={pending}
          busyProduct={busyProduct} onCreditUnlock={onBuy} onPurchase={onPurchase} onEquip={onEquip}/>
        {equippedCosmetic && <button className="cosmetic-reset" type="button" onClick={() => onEquip('', 'cosmetic')}>Remove visual kit</button>}
      </>}><div className="catalog-product-heading"><h3>{selected.name}</h3><span className="cosmetic-tier">{selected.tier}</span></div>
        {selected.showpiece && <span className="cosmetic-showpiece-note"><Sparkles size={14}/>{selected.kind === 'skin' ? 'Layered wings · Animated ornaments' : 'Layered wings · Animated ornaments · Signature fire'}</span>}
        <CosmeticOfferNote cosmetic={selected} owned={owned} ownedCosmetics={ownedCosmetics}/>
        <CosmeticKitDetails cosmetic={selected}/>
        <p>{selected.description}</p>
        {selected.eventReward && <span className="shop-preview-note">Also earnable in Events.</span>}
        {purchaseMessage && <p className="premium-message" role="status">{purchaseMessage}</p>}
      </CatalogDetails>
    </section>
    </CatalogCarousel>
  </div>;
}

export default function Shop({ initialTab = 'featured', equippedStage = 'default', stageOwnership = {}, onStageUnlock, onStageEquip, currency, upgrades, pilotLevel = 1, ownedShips = [], equippedShip = 'default', ownedWeapons = [], equippedWeapon = 'default', cosmetics = [], ownedCosmetics = {}, equippedCosmetic = '', pendingProducts = [], purchases = {}, busyProduct, purchaseMessage, onBuy, onEquip, onPurchase, onRestore, onClose }) {
  const [activeTab,setActiveTab] = useState(initialTab);
  const [upgradeId,setUpgradeId] = useState('battery');
  const [weaponId,setWeaponId] = useState(equippedWeapon);
  const [featuredCosmetic,setFeaturedCosmetic] = useState(null);
  const [featuredProduct,setFeaturedProduct] = useState(null);
  const panelRef = useRef(null), focusProduct = useRef(false);
  useEffect(() => {
    // Read current store ownership without opening an authentication sheet.
    void refreshStorePurchases().catch(error => trackMonetizationEvent('store_delivery_retry_needed', { message: error.message }));
  }, []);
  useEffect(() => {
    if (focusProduct.current) { panelRef.current?.focus({ preventScroll:true }); focusProduct.current = false; }
  }, [activeTab]);
  const tabs=[{id:'featured',name:'Featured',icon:ShoppingBag},{id:'upgrades',name:'Upgrades',icon:Zap},{id:'ships',name:'Ships',icon:Rocket},{id:'weapons',name:'Weapons',icon:Crosshair},{id:'cosmetics',name:'Cosmetics',icon:Sparkles},{id:'stages',name:'Galaxies',icon:Star},{id:'premium',name:'Store',icon:BadgeDollarSign}].filter(tab => onlineServicesAllowed() || tab.id !== 'premium');
  const isUpgrade=activeTab==='upgrades';
  const kind=isUpgrade?'upgrade':'weapon';
  const items=isUpgrade ? sortCatalogByPrice(UPGRADES, item => upgradeOffer(item.id, upgrades, equippedShip, pilotLevel).cost) : sortCatalogByPrice(WEAPONS);
  const selected=isUpgrade?upgradeOffer(upgradeId,upgrades,equippedShip,pilotLevel):weaponDetails(weaponId, equippedShip);
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
  return <section className="panel-screen garage-screen menu-screen" aria-label="Garage"><div className="arcade-panel garage-panel menu-panel">
    <header className="panel-header menu-header">
      <button className="icon-button" onClick={onClose} aria-label="Back to home"><ArrowLeft size={21}/></button>
      <div className="garage-heading"><h2>Garage<span className="garage-heading-marker" aria-hidden="true"/></h2><p>Your ship. Your signature.</p></div>
      <span className="coin-balance garage-wallet" aria-label={`${currency.toLocaleString()} credits`}><span className="garage-wallet-icon"><Coins size={20}/></span><span><small>YOUR CREDITS</small><strong>{currency.toLocaleString()}</strong></span></span>
    </header>
    <nav className="panel-tabs menu-tabs" role="tablist" aria-label="Garage categories" onKeyDown={handleTabKeyDown}>{tabs.map(tab=><button key={tab.id} type="button" role="tab" id={`garage-tab-${tab.id}`} aria-controls="garage-tab-panel" tabIndex={activeTab===tab.id?0:-1} onClick={event=>selectTab(tab.id,event.currentTarget)} className={activeTab===tab.id?'active':''} aria-selected={activeTab===tab.id}><tab.icon size={17}/>{tab.name}</button>)}</nav>
    <div ref={panelRef} key={activeTab} id="garage-tab-panel" role="tabpanel" aria-labelledby={`garage-tab-${activeTab}`} tabIndex={0} className="panel-body menu-body custom-scrollbar garage-tab-content">
      {activeTab==='featured'?<GarageFeatured cosmetics={cosmetics} ownedCosmetics={ownedCosmetics} pendingProducts={pendingProducts} ship={equippedShip}
          onCosmetic={id => { focusProduct.current = true; setFeaturedCosmetic(id); setActiveTab('cosmetics'); }} onProduct={id => { focusProduct.current = true; setFeaturedProduct(id); setActiveTab('premium'); }} onBrowse={() => { focusProduct.current = true; setActiveTab('upgrades'); }} onBrowseSets={() => { focusProduct.current = true; setActiveTab('cosmetics'); }}/>
      :activeTab==='premium'?<RealMoneyStore initialProductId={featuredProduct} currency={currency} onCreditUnlock={onBuy} purchases={purchases} pendingProducts={pendingProducts} busyProduct={busyProduct} message={purchaseMessage} onPurchase={onPurchase} onRestore={onRestore}/>
      :activeTab==='stages'?<StageBrowser currency={currency} equippedStage={equippedStage} ownership={stageOwnership} onUnlock={onStageUnlock} onEquip={onStageEquip}/>
      :activeTab==='ships'?<FleetBrowser currency={currency} ownedShips={ownedShips} equippedShip={equippedShip} cosmeticId={equippedCosmetic} upgrades={upgrades} pilotLevel={pilotLevel} onBuy={onBuy} onEquip={onEquip}/>
      :activeTab==='cosmetics'?<CosmeticsBrowser initialSelectedId={featuredCosmetic} cosmetics={cosmetics} ownedCosmetics={ownedCosmetics} equippedCosmetic={equippedCosmetic} pendingProducts={pendingProducts} currency={currency} ship={equippedShip} busyProduct={busyProduct} purchaseMessage={purchaseMessage} onBuy={onBuy} onEquip={onEquip} onPurchase={onPurchase} onRestore={onRestore}/>
      :<div className="shop-item-browser">
        <CatalogCarousel items={items} selectedId={selected.id} onSelect={isUpgrade ? setUpgradeId : setWeaponId}
          label={isUpgrade ? 'Upgrades' : 'Weapons'} itemLabel={isUpgrade ? 'upgrade' : 'weapon'}
          accent={isUpgrade ? '#f2cc8f' : '#88d3f0'}>
        <section className="shop-spotlight" aria-label={`${selected.name} preview details`}>
          <div className="shop-spotlight-stage"><ShopPreviewCanvas key={`${kind}:${selected.id}:${selected.level||0}:${equippedCosmetic}`} kind={kind} itemId={selected.id} ship={equippedShip} cosmeticId={equippedCosmetic} upgrades={upgrades} pilotLevel={pilotLevel}/></div>
          <CatalogDetails key={selected.id} className="shop-spotlight-details selection-reveal" actions={
            <BuyItem item={selected} kind={kind} cost={selected.cost} maxed={selected.maxed} owned={owned} equipped={equipped} currency={currency} onBuy={onBuy} onEquip={onEquip}/>
          }>
            <h3>{selected.name}</h3><p>{selected.desc}</p>
            {isUpgrade?<div className="upgrade-comparison"><span>{selected.metric}</span><div><span><small>Current</small><strong>{selected.beforeLabel}</strong></span><ArrowRight size={17}/><span><small>Next upgrade</small><strong>{selected.afterLabel}</strong></span></div></div>
            :<div className="weapon-metrics"><span><small>Damage</small><strong>{selected.damage}</strong></span><span><small>Shot speed</small><strong>{selected.speed}</strong></span><span><small>Ammo / shot</small><strong>1</strong></span></div>}
          </CatalogDetails>
        </section>
        </CatalogCarousel>
      </div>}
    </div>
  </div></section>;
}
