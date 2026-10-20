import { SHIP_PRICES } from './Economy.js';

// One set of ordered vector parts feeds both the garage SVG and the flight canvas.
const part = (d, fill, extra = {}) => ({ d, fill, ...extra });
const line = (d, stroke = "trim", width = 3) =>
  part(d, "none", { stroke, width });
const circle = (x, y, r, fill, extra) =>
  part(
    `M${x - r} ${y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`,
    fill,
    extra,
  );
const engine = (x, y, width, length, style = "jet") => ({
  x,
  y,
  width,
  length,
  style,
});

export const SHIPS = [
  {
    id: "default",
    name: "Standard Glider",
    className: "The everyday explorer",
    number: "01",
    cost: SHIP_PRICES.default,
    description:
      "A little curiosity goes a long way. Your trusty, rounded all-rounder.",
    trait: "Balanced flight. Ready for your first adventure.",
    shortTrait: "Balanced starter",
    palette: {
      body: "#f4edda",
      shade: "#afc5ce",
      armor: "#658999",
      accent: "#72cddd",
      glass: "#316c86",
      shine: "#c4f4f3",
      trim: "#eaf9ef",
      outline: "#203f51",
      engine: "#ffb66d",
      core: "#fff2bf",
    },
    engines: [engine(105, 125, 22, 84)],
    parts: [
      part("M180 105L154 40Q153 31 163 35L259 99Z", "accent"),
      part("M183 141L126 192Q118 203 134 202L278 164Z", "accent"),
      part("M105 105L88 114L93 141L118 149L143 124Z", "armor"),
      part(
        "M122 103Q202 71 277 89Q337 103 386 129Q351 163 274 166L126 149L107 126Z",
        "body",
      ),
      part("M123 135Q255 160 376 130Q338 166 272 166L126 149Z", "shade", {
        stroke: "none",
      }),
      part("M208 95Q247 69 286 94L327 116L218 122Z", "glass"),
      line("M229 94L242 113M253 92L273 113", "shine", 5),
      part("M251 143L315 139L293 162L230 165Z", "accent", { stroke: "none" }),
      line("M158 119L166 134M175 116L183 131", "armor", 5),
      line("M122 110L119 125M124 138L130 147", "engine", 8),
      line("M147 107L178 98", "trim", 4),
      circle(350, 128, 4, "core", { stroke: "none" }),
    ],
  },
  {
    id: "interceptor",
    name: "Interceptor",
    className: "The twin-engine dart",
    number: "02",
    cost: SHIP_PRICES.interceptor,
    description:
      "A needle nose, swept wings, and two eager engines. Built to chase the horizon.",
    trait: "Ammo refills every 1.5 seconds instead of 2.",
    shortTrait: "Faster ammo refill",
    palette: {
      body: "#ffe8bc",
      shade: "#d58b54",
      armor: "#895843",
      accent: "#f7a451",
      glass: "#33576d",
      shine: "#c4eff4",
      trim: "#fff8df",
      outline: "#493c3e",
      engine: "#ff9865",
      core: "#fff0c7",
    },
    engines: [engine(114, 75, 15, 101), engine(114, 163, 15, 101)],
    parts: [
      part("M221 108L109 42L96 48L160 114Z", "accent"),
      part("M222 137L108 196L96 190L158 130Z", "accent"),
      part("M114 58L173 66L203 83L119 90L100 81Z", "body"),
      part("M114 147L179 150L204 164L121 181L101 169Z", "body"),
      part("M130 106L275 99L398 121L275 144L131 139L113 123Z", "body"),
      part("M136 126L392 121L275 145L131 139Z", "shade", { stroke: "none" }),
      part("M185 106L256 106L292 119L198 125Z", "glass"),
      line("M211 109L237 110", "shine", 4),
      part("M272 100L398 121L285 122L309 113Z", "accent", { stroke: "none" }),
      line("M149 68L174 72M147 161L173 161", "armor", 4),
      line("M114 66L114 83M114 154L114 171", "engine", 7),
      line("M160 109L181 107", "trim", 4),
      part("M219 91L196 62L213 65L250 101Z", "armor"),
      circle(309, 125, 3, "core", { stroke: "none" }),
    ],
  },
  {
    id: "cruiser",
    name: "Heavy Cruiser",
    className: "The armored space tug",
    number: "03",
    cost: SHIP_PRICES.cruiser,
    description:
      "Chunky armor, a high bridge, and three hardworking thrusters. Big ship. Big heart.",
    trait: "Starts every flight with 40 extra health.",
    shortTrait: "+40 maximum HP",
    palette: {
      body: "#d4cbea",
      shade: "#9a95b6",
      armor: "#627388",
      accent: "#b7a4dc",
      glass: "#344c67",
      shine: "#c6f0ef",
      trim: "#f3e8fc",
      outline: "#354359",
      engine: "#ffa56a",
      core: "#fff1c2",
    },
    engines: [
      engine(99, 91, 16, 64),
      engine(91, 126, 19, 74),
      engine(99, 160, 16, 64),
    ],
    parts: [
      part("M121 67L242 67L262 89L116 100Z", "armor"),
      part("M145 48L206 48L229 72L143 79Z", "body"),
      part("M157 54L194 54L207 65L157 68Z", "glass"),
      line("M174 56L174 66", "shine", 3),
      part(
        "M105 91L251 77L333 97L353 123L339 164L261 181L112 165L93 137Z",
        "body",
      ),
      part("M107 134L345 132L339 164L261 181L112 165Z", "shade", {
        stroke: "none",
      }),
      part("M270 88L337 101L353 122L339 164L280 173L265 150Z", "armor"),
      part("M291 98L329 107L339 124L327 153L292 160Z", "accent"),
      part("M121 94L164 91L164 123L119 126Z", "accent"),
      part("M177 89L221 88L224 122L178 123Z", "accent"),
      part("M125 139L167 140L167 163L125 158Z", "armor"),
      part("M181 140L223 140L228 171L181 166Z", "armor"),
      line("M136 101L150 100M188 99L210 99", "trim", 4),
      line("M110 84L106 98M101 118L100 135M110 153L109 168", "engine", 8),
      circle(251, 111, 8, "glass"),
      circle(251, 111, 3, "shine", { stroke: "none" }),
      line("M304 115L324 122L316 142", "trim", 4),
    ],
  },
  {
    id: "stealth",
    name: "Stealth Wing",
    className: "The quiet flying wing",
    number: "04",
    cost: SHIP_PRICES.stealth,
    description:
      "A broad swept wing with tucked-away engines. Quiet enough to slip between the stars.",
    trait: "Enemy ships appear half as often.",
    shortTrait: "Fewer enemy encounters",
    palette: {
      body: "#417e82",
      shade: "#285461",
      armor: "#243f50",
      accent: "#8ce3bd",
      glass: "#183f51",
      shine: "#b7f9dc",
      trim: "#a9cfc8",
      outline: "#153545",
      engine: "#69decd",
      core: "#dcfff1",
    },
    engines: [
      engine(132, 87, 8, 61, "ribbon"),
      engine(132, 157, 8, 61, "ribbon"),
    ],
    parts: [
      part(
        "M357 120L141 20L104 27L168 92L138 107L110 119L139 132L166 150L104 212L143 219Z",
        "body",
      ),
      part("M357 120L143 219L104 212L166 150L139 132Z", "shade", {
        stroke: "none",
      }),
      part("M298 120L151 49L195 97L172 120L197 143L151 190Z", "armor", {
        stroke: "none",
      }),
      part("M239 103L293 120L239 138L215 121Z", "glass"),
      line("M241 110L267 120L241 129", "shine", 4),
      line("M131 33L169 59M132 206L169 180", "accent", 6),
      line("M189 81L229 99M187 160L227 142", "trim", 3),
      line("M132 80L132 93M132 151L132 164", "engine", 7),
      part("M315 111L357 120L315 131L326 121Z", "accent", { stroke: "none" }),
      circle(141, 29, 3, "core", { stroke: "none" }),
      circle(143, 211, 3, "core", { stroke: "none" }),
    ],
  },
  {
    id: "void_runner",
    name: "Void Runner",
    className: "The split-hull wanderer",
    number: "05",
    cost: SHIP_PRICES.void_runner,
    description:
      "Two curved, floating hulls cradle a living void core. A visitor from somewhere else.",
    trait: "Passes through obstacles smaller than 80px.",
    shortTrait: "Phases through small obstacles",
    palette: {
      body: "#e6d9f2",
      shade: "#b8a0cf",
      armor: "#6e5d96",
      accent: "#c59cf0",
      glass: "#4c3e73",
      shine: "#f4e8ff",
      trim: "#f0d4fc",
      outline: "#493d70",
      engine: "#b997ff",
      core: "#efffff",
    },
    engines: [engine(126, 73, 12, 74, "orb"), engine(126, 168, 12, 74, "orb")],
    parts: [
      part(
        "M121 78Q142 30 218 35Q302 36 369 87L316 97Q254 62 204 75Q158 90 131 109Z",
        "body",
      ),
      part(
        "M125 160Q143 207 216 207Q303 207 370 153L315 143Q254 179 204 166Q159 151 131 132Z",
        "body",
      ),
      part("M121 78Q142 30 218 35L203 52Q154 61 139 94L131 109Z", "armor", {
        stroke: "none",
      }),
      part(
        "M125 160Q143 207 216 207L203 189Q155 181 139 147L131 132Z",
        "armor",
        { stroke: "none" },
      ),
      part(
        "M204 75Q257 63 316 97L369 87L333 106L299 109Q248 85 204 90Z",
        "accent",
        { stroke: "none" },
      ),
      part(
        "M204 166Q257 179 315 143L370 153L332 134L299 131Q248 155 204 151Z",
        "accent",
        { stroke: "none" },
      ),
      circle(235, 121, 34, "glass"),
      circle(235, 121, 26, "accent"),
      circle(235, 121, 17, "core", { stroke: "none" }),
      part("M218 108Q232 95 246 109Q228 104 222 119Z", "shine", {
        stroke: "none",
      }),
      line("M169 65Q197 52 231 54M170 178Q199 192 231 188", "trim", 4),
      line("M126 65L121 80M125 160L130 176", "engine", 7),
      circle(323, 92, 4, "core", { stroke: "none" }),
      circle(324, 148, 4, "core", { stroke: "none" }),
    ],
  },
  {
    id: "plasma_breaker",
    name: "Plasma Breaker",
    className: "The reactor-powered ram",
    number: "06",
    cost: SHIP_PRICES.plasma_breaker,
    description:
      "A reinforced split prow and an exposed reactor. Why go around when you can go through?",
    trait: "Smashes obstacles without taking hull damage.",
    shortTrait: "Breaks obstacles on impact",
    palette: {
      body: "#f3e1cf",
      shade: "#c18d80",
      armor: "#744f59",
      accent: "#ee8c79",
      glass: "#3e5e69",
      shine: "#d2f4dc",
      trim: "#fff2df",
      outline: "#483c4c",
      engine: "#96ed9b",
      core: "#eaffcc",
    },
    engines: [
      engine(110, 88, 19, 65, "pulse"),
      engine(110, 157, 19, 65, "pulse"),
    ],
    parts: [
      part("M110 67L172 57L197 83L163 106L102 106Z", "armor"),
      part("M103 137L165 137L195 163L171 185L109 177Z", "armor"),
      part("M143 85L278 84L324 103L326 146L276 164L141 161L121 126Z", "body"),
      part("M139 132L324 128L326 146L276 164L141 161Z", "shade", {
        stroke: "none",
      }),
      part(
        "M288 72L382 93L401 112L342 120L399 135L380 157L288 175L307 139L307 106Z",
        "accent",
      ),
      part("M350 86L382 93L401 112L363 115L349 102Z", "body"),
      part("M364 130L399 135L380 157L349 164L348 148Z", "body"),
      part("M177 88L208 82L227 99L181 111Z", "glass"),
      line("M185 91L201 88", "shine", 4),
      circle(250, 124, 37, "armor"),
      circle(250, 124, 28, "accent"),
      circle(250, 124, 19, "engine"),
      circle(250, 124, 9, "core", { stroke: "none" }),
      line(
        "M250 84L250 98M250 150L250 164M211 124L224 124M276 124L290 124",
        "trim",
        5,
      ),
      line("M114 77L111 98M111 147L114 169", "engine", 8),
      line("M153 118L179 117M151 135L177 136", "armor", 5),
    ],
  },
];

export const SHIP_NAMES = Object.fromEntries(
  SHIPS.map((ship) => [ship.id, ship.name]),
);
const shipsById = new Map(SHIPS.map((ship) => [ship.id, ship]));
export const getShip = (id) => shipsById.get(id) || shipsById.get("default");

// Fixed flame outlines are reused by SVG and cached Path2D. Animation only scales them.
export function getEngineFlame(enginePort, boosting = false) {
  const { x, y, width, length, style } = enginePort;
  const reach = length * (boosting ? 1 : 0.46);
  const half = width * (boosting ? 0.55 : 0.36);
  if (style === "ribbon")
    return `M${x} ${y - half}L${x - reach} ${y - half * 0.4}L${x - reach - 8} ${y}L${x - reach} ${y + half * 0.4}L${x} ${y + half}Z`;
  if (style === "orb")
    return `M${x} ${y - half}Q${x - reach * 0.6} ${y - half * 1.5} ${x - reach} ${y}Q${x - reach * 0.6} ${y + half * 1.5} ${x} ${y + half}Z`;
  if (style === "pulse")
    return `M${x} ${y - half}L${x - reach * 0.4} ${y - half * 0.8}L${x - reach * 0.5} ${y - half * 0.35}L${x - reach} ${y}L${x - reach * 0.5} ${y + half * 0.35}L${x - reach * 0.4} ${y + half * 0.8}L${x} ${y + half}Z`;
  return `M${x} ${y - half}Q${x - reach * 0.35} ${y - half * 0.9} ${x - reach} ${y}Q${x - reach * 0.35} ${y + half * 0.9} ${x} ${y + half}Z`;
}
