import React, { useId } from 'react';
import { getCosmeticSurface } from '../game/CosmeticDesigns';

export default function CosmeticSurface({ cosmeticId, palette, ship }) {
  const id = useId();
  const parts = getCosmeticSurface(cosmeticId);
  if (!parts.length) return null;
  return <g className="cosmetic-surface" pointerEvents="none">
    <defs><clipPath id={id}>{ship.parts.filter(part => part.fill === 'body' || part.fill === 'shade').map((part, i) => <path key={i} d={part.d}/>)}</clipPath></defs>
    <g clipPath={`url(#${id})`}>{parts.map((part, i) => <path key={i} d={part.d} fill={palette[part.fill] || part.fill} stroke={palette[part.stroke] || part.stroke} strokeWidth={part.width} strokeLinecap="round" strokeLinejoin="round" opacity={part.opacity}/>)}</g>
  </g>;
}
