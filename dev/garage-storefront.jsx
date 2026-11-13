import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GarageFeaturedView } from '../src/components/GarageFeatured.jsx';
import { COSMETICS, SKINS } from '../src/game/CosmeticsCatalog.js';
import { garageRotationWindow } from '../src/game/GarageOffers.js';
import useOfferClock from '../src/components/useOfferClock.js';
import { PRODUCTS } from '../src/services/MonetizationService.js';
import '../src/index.css';
import '../src/App.css';
import '../src/components/MenuPanels.css';
import '../src/components/GarageVisuals.css';
import '../src/components/GarageViewport.css';

// Isolated presentation fixtures: these never contact a native store or debit.
export default function Review() {
  const [state, setState] = useState('ready'), [action, setAction] = useState('');
  const [reviewDay, setReviewDay] = useState('live');
  const liveNow = useOfferClock();
  const reviewDate = new Date(liveNow);
  if (reviewDay !== 'live') { reviewDate.setDate(reviewDate.getDate()+Number(reviewDay)); reviewDate.setHours(12,0,0,0); }
  const now = state==='expired' ? garageRotationWindow(reviewDate.getTime()).refreshesAt : reviewDay === 'live' ? liveNow : reviewDate.getTime();
  const unavailable = state === 'error' || state === 'loading';
  const products = PRODUCTS.filter(p=>state !== 'android' || p.cosmeticId).map(p=>({...p,available:!unavailable,price:unavailable?'':p.price}));
  return <section className="panel-screen garage-screen menu-screen"><div className="arcade-panel garage-panel menu-panel">
    <header className="panel-header menu-header"><h2>Garage review</h2><label>State <select aria-label="Review state" value={state} onChange={event=>{setState(event.target.value);setAction('');}} style={{minHeight:44,background:'#1e3547',padding:'4px 10px',color:'#e6eee9'}}>{['ready','loading','error','empty','owned','skin-owned','pending','expired','android'].map(s=><option key={s}>{s}</option>)}</select></label><label>Day <select aria-label="Review day" value={reviewDay} onChange={event=>setReviewDay(event.target.value)} style={{background:'#1e3547',color:'#e6eee9',minHeight:44}}><option value="live">Live clock</option><option value="0">Today</option><option value="1">Tomorrow</option><option value="2">In two days</option></select></label><span role="status">{action}</span></header>
    <nav className="panel-tabs menu-tabs" aria-label="Review categories">{['Featured','Upgrades','Ships','Weapons','Cosmetics','Galaxies','Store'].map(name=><button type="button" key={name}>{name}</button>)}</nav>
    <div className="garage-tab-content menu-body"><GarageFeaturedView cosmetics={state==='empty'?[]:COSMETICS} products={products} status={unavailable?state:'ready'} now={now}
      ownedCosmetics={state==='owned'?Object.fromEntries([...COSMETICS,...SKINS].map(c=>[c.id,true])):state==='skin-owned'?Object.fromEntries(SKINS.map(c=>[c.id,true])):{}} pendingProducts={state==='pending'?COSMETICS.map(c=>c.productId):[]} ship="default"
      onCosmetic={id=>setAction(`Preview ${id}`)} onProduct={id=>setAction(`Preview ${id}`)} onBrowse={()=>setAction('Open catalog')} onRetry={()=>setState('ready')}/></div>
  </div></section>;
}
const root = createRoot(document.getElementById('root'));
root.render(<Review/>);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
