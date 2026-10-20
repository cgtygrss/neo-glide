import React from "react";
import { getShip, getEngineFlame } from "../game/ShipCatalog";
import { getCosmeticPalette } from "../game/CosmeticsCatalog";

export default function ShipPreview({
  ship = "default",
  className = "",
  boosting = false,
  cosmeticId = null,
  viewBox = "0 0 440 240",
}) {
  const model = getShip(ship);
  const palette = getCosmeticPalette(model.palette, cosmeticId);
  return (
    <svg
      viewBox={viewBox}
      className={`ship-preview ship-model-${model.id} ${boosting ? "is-boosting" : ""} ${className}`}
      aria-hidden="true"
      data-ship-model={model.id}
      data-cosmetic={cosmeticId || undefined}
    >
      <ellipse cx="237" cy="223" rx="126" ry="9" fill="#06172b" opacity=".17" />
      <g className="ship-float">
        {model.engines.map((port, i) => (
          <g
            key={i}
            className="fleet-exhaust"
            style={{
              transformOrigin: `${port.x}px ${port.y}px`,
              animationDelay: `${i * -0.19}s`,
            }}
          >
            <path
              d={getEngineFlame(port, boosting)}
              fill={palette.engine}
              opacity={boosting ? ".9" : ".6"}
            />
            <path
              d={getEngineFlame(port, boosting)}
              fill={palette.core}
              transform={`translate(${port.x} ${port.y}) scale(.6 .48) translate(${-port.x} ${-port.y})`}
              opacity=".9"
            />
          </g>
        ))}
        {model.parts.map((part, i) => (
          <path
            key={i}
            d={part.d}
            fill={palette[part.fill] || part.fill}
            stroke={
              part.stroke === "none"
                ? "none"
                : palette[part.stroke || "outline"]
            }
            strokeWidth={part.width ?? 3.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={part.opacity ?? 1}
          />
        ))}
      </g>
    </svg>
  );
}
