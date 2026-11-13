import React from 'react';
import { cosmeticNodePose, getCosmeticDesign } from '../game/CosmeticDesigns';
import './CosmeticAdornment.css';

export default function CosmeticAdornment({ cosmeticId, palette, layer, boosting = false }) {
  const design = getCosmeticDesign(cosmeticId);
  if (!design) return null;
  return <g className="cosmetic-adornment" data-cosmetic-layer={layer}>
    {design.groups.filter(group => group.layer === layer).map((group, index) => {
      const pose = cosmeticNodePose(group, 0, boosting, true);
      return <g key={index} transform={`translate(${group.x} ${group.y}) scale(${pose.sx} ${pose.sy})`} opacity={group.opacity ?? 1}>
        <g className={`cosmetic-motion cosmetic-motion-${group.motion}`} style={{ '--cosmetic-period': `${group.duration}s`, '--cosmetic-delay': `${-group.phase * group.duration / (Math.PI * 2)}s` }}>
          {group.parts.map((part, i) => <path key={i} d={part.d} fill={palette[part.fill] || part.fill} stroke={palette[part.stroke] || part.stroke}
            strokeWidth={part.width} strokeLinecap="round" strokeLinejoin="round" opacity={part.opacity}/>)}
        </g>
      </g>;
    })}
  </g>;
}
