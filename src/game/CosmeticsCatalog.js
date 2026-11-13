import { COSMETIC_PRICING } from '../../backend/shared/store-catalog.js';
import { getCosmeticDesign } from './CosmeticDesigns.js';
import { skinCreditCost } from './SkinPricing.js';
// Complete visual kits add decorative silhouettes, engine wakes and signature
// fire. Flight stats, collision and weapon damage stay with the equipment.
const cosmetic = (id, name, colors, trail, description, rank, tier) => ({
  id, name, rank, tier,
  colors, trail, description,
});

export const COSMETICS = [
  cosmetic('copper_horizon', 'Copper Horizon', { body:'#5d3b2c', shade:'#8a553a', armor:'#a8714d', accent:'#c67b42', glass:'#6e4028', shine:'#fff1d2', trim:'#ead0a0', outline:'#261711', engine:'#d58a51', core:'#fff2d3', shot:'#fff0d2' }, 'step-dash', 'Copper rails and brass sparks mark each shot.', 1, 'Classic'),
  cosmetic('arctic_pulse', 'Arctic Pulse', { body:'#f5fbff', shade:'#a8d6eb', armor:'#79b5d2', accent:'#b9efff', glass:'#4f90b5', shine:'#ffffff', trim:'#d6f7ff', outline:'#254c65', engine:'#9eeeff', core:'#ffffff', shot:'#e7f7ff' }, 'ice-dash', 'Ice chevrons and crystalline flakes trail your flight.', 2, 'Classic'),
  cosmetic('cyber_current', 'Cyber Current', { body:'#10203d', shade:'#14294e', armor:'#1d4471', accent:'#25d8e8', glass:'#0b3356', shine:'#c5fdff', trim:'#57e7f0', outline:'#061224', engine:'#18cadb', core:'#d9ffff', shot:'#65f4ff' }, 'parallel', 'Cyan circuit rails and digital brackets trace your path.', 3, 'Signature'),
  cosmetic('jade_drift', 'Jade Drift', { body:'#123437', shade:'#1b5553', armor:'#765535', accent:'#4ebc93', glass:'#185147', shine:'#d2fff0', trim:'#c98955', outline:'#071d20', engine:'#72d9b2', core:'#e4fff4', shot:'#c9f7dc' }, 'ribbon', 'Jade silk ribbons carry drifting leaf wisps.', 4, 'Signature'),
  cosmetic('rose_circuit', 'Rose Circuit', { body:'#151018', shade:'#3c2439', armor:'#6e3d62', accent:'#ff6cac', glass:'#4c2145', shine:'#ffe0ef', trim:'#dca7c2', outline:'#07050a', engine:'#f281b7', core:'#fff0f7', shot:'#ffd4e8' }, 'dots', 'Pink bead chains shimmer with silver diamonds.', 5, 'Elite'),
  cosmetic('solar_forge', 'Solar Forge', { body:'#303137', shade:'#17191e', armor:'#4a3d22', accent:'#f2b544', glass:'#604515', shine:'#ffe6a1', trim:'#d78522', outline:'#0b0d11', engine:'#ff8b32', core:'#ffe08c', shot:'#ffd05b' }, 'sparks', 'Orange forge flames scatter golden ember shards.', 6, 'Elite'),
  cosmetic('pearl_comet', 'Pearl Comet', { body:'#fff9ed', shade:'#dfd4c2', armor:'#b99e78', accent:'#f2d69d', glass:'#977954', shine:'#ffffff', trim:'#f7e4bc', outline:'#5c4b3c', engine:'#f8d99a', core:'#ffffff', shot:'#ffffff' }, 'comet', 'A pearl comet wake sparkles with champagne glints.', 7, 'Prestige'),
  cosmetic('void_pilot', 'Void Pilot', { body:'#120f1d', shade:'#34205a', armor:'#1b1630', accent:'#9b5de5', glass:'#25184d', shine:'#e1c7ff', trim:'#7a4fb3', outline:'#07050d', engine:'#9d75ff', core:'#eadcff', shot:'#d9b7ff' }, 'twin-taper', 'Twin violet ribbons and orbital crescents follow every shot.', 8, 'Prestige'),
  cosmetic('cobalt_storm', 'Cobalt Storm', { body:'#242937', shade:'#40495c', armor:'#68748a', accent:'#326ee8', glass:'#1d3e76', shine:'#e1ebff', trim:'#aab8cc', outline:'#10131b', engine:'#4b82ff', core:'#eaf0ff', shot:'#6f9dff' }, 'zigzag', 'Cobalt lightning forks into silver electric branches.', 9, 'Legendary'),
  cosmetic('prism_voyager', 'Prism Voyager', { body:'#130f21', shade:'#332052', armor:'#593c74', accent:'#b85cff', glass:'#243d72', shine:'#ffffff', trim:'#4ce9ef', outline:'#06050c', engine:'#ff73c8', core:'#ffffff', shot:'#ffffff' }, 'triple', 'Braided violet, cyan and pink streams refract around white shots.', 10, 'Legendary'),
];

// Additional visual kits use the same credit and native-store purchase paths.
const creditStyles = [
  [
    "mint_condition",
    "Mint Condition",
    "#b7f5d2",
    "#48cda6",
    "ribbon",
    "Fresh mint panels and flowing emerald ribbons."
  ],
  [
    "scarlet_comet",
    "Scarlet Comet",
    "#812b3a",
    "#ff6978",
    "comet",
    "Scarlet armor with a bright ruby comet wake."
  ],
  [
    "amber_signal",
    "Amber Signal",
    "#67462b",
    "#ffbe61",
    "step-dash",
    "Amber rails carry precise golden signal bars."
  ],
  [
    "lunar_silver",
    "Lunar Silver",
    "#e5edf4",
    "#b4c9e2",
    "ice-dash",
    "Brushed silver and pale blue lunar chevrons."
  ],
  [
    "ocean_depth",
    "Ocean Depth",
    "#153b59",
    "#38c6df",
    "parallel",
    "Deep blue plating carries turquoise circuit rails."
  ],
  [
    "lavender_dream",
    "Lavender Dream",
    "#78638e",
    "#d9b7ff",
    "dots",
    "Soft lavender beads and lilac diamond sparks."
  ],
  [
    "toxic_bloom",
    "Toxic Bloom",
    "#2c4027",
    "#b9ef55",
    "sparks",
    "Lime embers glow against dark forest armor."
  ],
  [
    "desert_mirage",
    "Desert Mirage",
    "#c5a079",
    "#ffe0a0",
    "ribbon",
    "Sandstone panels trail warm desert ribbons."
  ],
  [
    "ruby_eclipse",
    "Ruby Eclipse",
    "#3f1739",
    "#ed609a",
    "twin-taper",
    "Ruby crescents orbit a dark wine-colored hull."
  ],
  [
    "glacier_blue",
    "Glacier Blue",
    "#bddbe9",
    "#6bc4ff",
    "zigzag",
    "Glacial plating splits the wake into blue lightning."
  ],
  [
    "saffron_sky",
    "Saffron Sky",
    "#9c4e29",
    "#ffcb64",
    "triple",
    "Saffron, cream and orange braid into a warm wake."
  ],
  [
    "midnight_gold",
    "Midnight Gold",
    "#1e253b",
    "#e9c875",
    "step-dash",
    "Golden rails illuminate midnight navy armor."
  ],
  [
    "coral_reef",
    "Coral Reef",
    "#d48779",
    "#ffb7a2",
    "dots",
    "Coral pearl chains drift behind a warm rose hull."
  ],
  [
    "ultraviolet",
    "Ultraviolet",
    "#302049",
    "#b87bff",
    "triple",
    "Violet, lavender and icy white streams cross in flight."
  ]
];
for (const [index, [id, name, body, accent, trail, description]] of creditStyles.entries()) {
  COSMETICS.push({ ...cosmetic(id, name, {
    body, shade: '#405369', armor: '#293b50', accent, glass: '#213c56', shine: '#f5fcff',
    trim: accent, outline: '#101b2b', engine: accent, core: '#fff6e5', shot: accent,
  }, trail, description, index + 11, index < 5 ? 'Classic' : index < 10 ? 'Signature' : 'Elite'), effectScale: .95 + (index + 1) * .012 });
}

export const EVENT_COSMETICS = [
  {...cosmetic('nebula_circuit', 'Nebula Circuit', { body:'#18223f',shade:'#30294f',armor:'#554879',accent:'#c9a2ff',glass:'#294f67',shine:'#f8e6ff',trim:'#75e5d2',outline:'#080e20',engine:'#b697ff',core:'#fff0ff',shot:'#b9f9ec'}, 'parallel', 'Earned in the Weekly Capsule Hunt.', 25, 'Event'), eventReward: true, effectScale: 1.13},
  {...cosmetic('aurora_pathfinder', 'Aurora Pathfinder', { body:'#13393d',shade:'#235e60',armor:'#467d72',accent:'#9af7b9',glass:'#176c83',shine:'#f0ffe5',trim:'#e9d391',outline:'#08252d',engine:'#8eeadd',core:'#ffffff',shot:'#d9fff1'}, 'ribbon', 'Earned on the Galaxy Expedition.', 26, 'Event'), eventReward: true, effectScale: 1.142}
];
COSMETICS.push(...EVENT_COSMETICS);
export const ALL_COSMETICS = COSMETICS;
for (const appearance of ALL_COSMETICS) {
  const pricing = COSMETIC_PRICING[appearance.id];
  if (!pricing) throw new Error(`Missing skin pricing: ${appearance.id}`);
  Object.assign(appearance, pricing);
  const design = getCosmeticDesign(appearance.id);
  if (design) {
    appearance.description = design.story;
    appearance.signature = design.label;
    appearance.features = design.features;
    appearance.collection = design.collection;
    appearance.showpiece = design.showpiece;
    appearance.motif = design.motif;
    appearance.colors = { ...appearance.colors, wing: appearance.colors.accent, petal: appearance.colors.engine, ...design.palette };
  }
}
export const COSMETIC_COLLECTIONS = [
  { id: 'all', name: 'All styles' },
  { id: 'dream_garden', name: 'Dream Garden' },
  { id: 'star_guardians', name: 'Star Guardians' },
  { id: 'cosmic_voyages', name: 'Cosmic Voyages' },
  { id: 'showpieces', name: 'Showpieces' },
];
export const cosmeticsInCollection = (cosmetics, collection = 'all') => cosmetics.filter(cosmetic => collection === 'all' || (collection === 'showpieces' ? cosmetic.showpiece : cosmetic.collection === collection));
export const COSMETIC_IDS = COSMETICS.map(cosmetic => cosmetic.id);
export const COSMETIC_PRODUCT_IDS = COSMETICS.map(cosmetic => cosmetic.productId);
// Existing IDs and store receipts always grant the complete set. Standalone
// skins are separate credit unlocks, persisted in the same atomic wallet.
export const SKINS = COSMETICS.map(set => ({ ...set, id: `skin_${set.id}`, setId: set.id,
  kind: 'skin', productId: null, price: null, usdCents: null, trail: null,
  creditPrice: skinCreditCost(set.creditPrice),
  features: [set.features[0]], description: `${set.features[0]}. Ship appearance only; engine trail and shot effects belong to the complete set.`,
}));
export const ALL_APPEARANCES = [...ALL_COSMETICS, ...SKINS];
export const getCosmetic = id => ALL_APPEARANCES.find(cosmetic => cosmetic.id === id) || null;
export const getCosmeticEffects = id => { const cosmetic = getCosmetic(id); return cosmetic?.kind === 'skin' ? null : cosmetic; };
const TRAIL_EFFECTS = { 'step-dash': 'copper_horizon', 'ice-dash': 'arctic_pulse', parallel: 'cyber_current', ribbon: 'jade_drift', dots: 'rose_circuit', sparks: 'solar_forge', comet: 'pearl_comet', 'twin-taper': 'void_pilot', zigzag: 'cobalt_storm', triple: 'prism_voyager' };
export const cosmeticEffectId = cosmetic => TRAIL_EFFECTS[cosmetic.trail] || cosmetic.id;
export const getCosmeticPalette = (shipPalette, id) => {
  const cosmetic = getCosmetic(id);
  if (!cosmetic) return shipPalette;
  const palette = { ...shipPalette, ...cosmetic.colors };
  if (cosmetic.kind === 'skin') for (const key of ['engine', 'core', 'shot']) palette[key] = shipPalette[key];
  return palette;
};
