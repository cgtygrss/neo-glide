// Cosmetic data deliberately lives apart from ship stats. A selected theme can
// recolor every hull without changing its shape, physics, collision box or gun.
const cosmetic = (id, name, colors, trail, description, creditPrice, rank, tier, price) => ({
  id, name, productId: `cosmetic_${id}`, price, creditPrice, rank, tier,
  colors, trail, description,
});

export const COSMETICS = [
  cosmetic('copper_horizon', 'Copper Horizon', { body:'#5d3b2c', shade:'#8a553a', armor:'#a8714d', accent:'#c67b42', glass:'#6e4028', shine:'#fff1d2', trim:'#ead0a0', outline:'#261711', engine:'#d58a51', core:'#fff2d3', shot:'#fff0d2' }, 'step-dash', 'Copper rails and brass sparks mark each shot.', 1200000, 1, 'Classic', '$2.99'),
  cosmetic('arctic_pulse', 'Arctic Pulse', { body:'#f5fbff', shade:'#a8d6eb', armor:'#79b5d2', accent:'#b9efff', glass:'#4f90b5', shine:'#ffffff', trim:'#d6f7ff', outline:'#254c65', engine:'#9eeeff', core:'#ffffff', shot:'#e7f7ff' }, 'ice-dash', 'Ice chevrons and crystalline flakes trail your flight.', 1500000, 2, 'Classic', '$3.49'),
  cosmetic('cyber_current', 'Cyber Current', { body:'#10203d', shade:'#14294e', armor:'#1d4471', accent:'#25d8e8', glass:'#0b3356', shine:'#c5fdff', trim:'#57e7f0', outline:'#061224', engine:'#18cadb', core:'#d9ffff', shot:'#65f4ff' }, 'parallel', 'Cyan circuit rails and digital brackets trace your path.', 1800000, 3, 'Signature', '$3.99'),
  cosmetic('jade_drift', 'Jade Drift', { body:'#123437', shade:'#1b5553', armor:'#765535', accent:'#4ebc93', glass:'#185147', shine:'#d2fff0', trim:'#c98955', outline:'#071d20', engine:'#72d9b2', core:'#e4fff4', shot:'#c9f7dc' }, 'ribbon', 'Jade silk ribbons carry drifting leaf wisps.', 2200000, 4, 'Signature', '$4.49'),
  cosmetic('rose_circuit', 'Rose Circuit', { body:'#151018', shade:'#3c2439', armor:'#6e3d62', accent:'#ff6cac', glass:'#4c2145', shine:'#ffe0ef', trim:'#dca7c2', outline:'#07050a', engine:'#f281b7', core:'#fff0f7', shot:'#ffd4e8' }, 'dots', 'Pink bead chains shimmer with silver diamonds.', 2600000, 5, 'Elite', '$4.99'),
  cosmetic('solar_forge', 'Solar Forge', { body:'#303137', shade:'#17191e', armor:'#4a3d22', accent:'#f2b544', glass:'#604515', shine:'#ffe6a1', trim:'#d78522', outline:'#0b0d11', engine:'#ff8b32', core:'#ffe08c', shot:'#ffd05b' }, 'sparks', 'Orange forge flames scatter golden ember shards.', 3000000, 6, 'Elite', '$5.99'),
  cosmetic('pearl_comet', 'Pearl Comet', { body:'#fff9ed', shade:'#dfd4c2', armor:'#b99e78', accent:'#f2d69d', glass:'#977954', shine:'#ffffff', trim:'#f7e4bc', outline:'#5c4b3c', engine:'#f8d99a', core:'#ffffff', shot:'#ffffff' }, 'comet', 'A pearl comet wake sparkles with champagne glints.', 3600000, 7, 'Prestige', '$6.99'),
  cosmetic('void_pilot', 'Void Pilot', { body:'#120f1d', shade:'#34205a', armor:'#1b1630', accent:'#9b5de5', glass:'#25184d', shine:'#e1c7ff', trim:'#7a4fb3', outline:'#07050d', engine:'#9d75ff', core:'#eadcff', shot:'#d9b7ff' }, 'twin-taper', 'Twin violet ribbons and orbital crescents follow every shot.', 4200000, 8, 'Prestige', '$7.99'),
  cosmetic('cobalt_storm', 'Cobalt Storm', { body:'#242937', shade:'#40495c', armor:'#68748a', accent:'#326ee8', glass:'#1d3e76', shine:'#e1ebff', trim:'#aab8cc', outline:'#10131b', engine:'#4b82ff', core:'#eaf0ff', shot:'#6f9dff' }, 'zigzag', 'Cobalt lightning forks into silver electric branches.', 5000000, 9, 'Legendary', '$8.99'),
  cosmetic('prism_voyager', 'Prism Voyager', { body:'#130f21', shade:'#332052', armor:'#593c74', accent:'#b85cff', glass:'#243d72', shine:'#ffffff', trim:'#4ce9ef', outline:'#06050c', engine:'#ff73c8', core:'#ffffff', shot:'#ffffff' }, 'triple', 'Braided violet, cyan and pink streams refract around white shots.', 6000000, 10, 'Legendary', '$9.99'),
];

export const COSMETIC_IDS = COSMETICS.map(cosmetic => cosmetic.id);
export const COSMETIC_PRODUCT_IDS = COSMETICS.map(cosmetic => cosmetic.productId);
export const getCosmetic = id => COSMETICS.find(cosmetic => cosmetic.id === id) || null;
export const getCosmeticPalette = (shipPalette, id) => {
  const cosmetic = getCosmetic(id);
  return cosmetic ? { ...shipPalette, ...cosmetic.colors } : shipPalette;
};
