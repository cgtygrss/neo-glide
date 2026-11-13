import React from 'react';
import { Crosshair, Sparkles, Wind } from 'lucide-react';

const PARTS = [{ label: 'SHIP DESIGN', Icon: Sparkles }, { label: 'ENGINE TRAIL', Icon: Wind }, { label: 'SHOT EFFECTS', Icon: Crosshair }];
export default function CosmeticKitDetails({ cosmetic }) {
  if (!cosmetic.features) return null;
  const skinOnly = cosmetic.kind === 'skin';
  return <section className="cosmetic-set-details" aria-label={skinOnly ? 'Standalone skin' : 'Complete skin set'}>
    <div className="cosmetic-set-heading"><strong>{skinOnly ? 'Skin · Ship appearance only' : 'Complete skin set'}</strong><span>One unlock · Every ship · Yours permanently</span></div>
    {skinOnly && <p className="shop-preview-note">Engine trail and shot effects are included in the complete set.</p>}
    <ul className="cosmetic-kit-features" aria-label={skinOnly ? 'Included in this skin' : 'Included in this skin set'}>
    {(skinOnly ? PARTS.slice(0, 1) : PARTS).map((part, index) => <li key={part.label}><part.Icon size={17}/><span><small>{part.label}</small><strong>{cosmetic.features[index]}</strong></span></li>)}
    </ul>
  </section>;
}
