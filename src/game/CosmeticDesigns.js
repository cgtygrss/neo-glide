// A visual kit is authored once for SVG hangars and the flight canvas.
// All coordinates are decorative; none enter physics, weapons or collision.
const path = (d, fill = 'accent', stroke = 'outline', width = 2.5, opacity = 1) => ({ d, fill, stroke, width, opacity });
const wire = (d, color = 'trim', width = 2, opacity = 1) => path(d, 'none', color, width, opacity);
const oval = (rx, ry = rx) => `M${-rx} 0a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0`;
const diamond = (r = 14) => `M0 ${-r}L${r * .6} 0L0 ${r}L${-r * .6} 0Z`;
const hex = (r = 16) => Array.from({ length: 6 }, (_, i) => `${i ? 'L' : 'M'}${(Math.cos(i * Math.PI / 3) * r).toFixed(2)} ${(Math.sin(i * Math.PI / 3) * r).toFixed(2)}`).join('') + 'Z';
const gear = (r = 30) => Array.from({ length: 48 }, (_, i) => { const a = i * Math.PI / 24, reach = i % 4 < 2 ? r : r * .8; return `${i ? 'L' : 'M'}${(Math.cos(a) * reach).toFixed(2)} ${(Math.sin(a) * reach).toFixed(2)}`; }).join('') + 'Z';
const node = (x, y, parts, options = {}) => ({ x, y, parts, layer: 'back', motion: 'float', duration: 5, phase: 0, ...options });
const gem = (x, y, r, options = {}) => node(x, y, [path(diamond(r), options.color || 'accent'), wire(`M0 ${-r}L0 ${r}M${-r * .6} 0L${r * .6} 0`, 'shine', 1.2)], options);
const wings = (d, detail, options = {}) => [-1, 1].map(side => node(215, 120, [path(d), wire(detail, 'shine', 1.5)], { sy: side, deploy: true, ...options }));
const badge = (parts, options = {}) => node(302, 143, parts, { layer: 'front', motion: 'pulse', ...options });
const halo = (x, y, r, options = {}) => node(x, y, [wire(oval(r), 'accent', 3), wire(oval(r * .77), 'trim', 1), ...[0, 90, 180, 270].map(a => {const rad=a*Math.PI/180;return path(`M${Math.cos(rad)*r*.9} ${Math.sin(rad)*r*.9}l${Math.cos(rad)*10} ${Math.sin(rad)*10}`, 'none', 'shine', 4);})], { motion: 'spin', duration: 16, ...options });
const kit = (label, story, hull, wake, shots, groups) => ({ label, story, features: [hull, wake, shots], groups });
const star = (r = 10) => Array.from({ length: 10 }, (_, i) => { const a = i * Math.PI / 5 - Math.PI / 2, reach = i % 2 ? r * .43 : r; return `${i ? 'L' : 'M'}${(Math.cos(a) * reach).toFixed(2)} ${(Math.sin(a) * reach).toFixed(2)}`; }).join('') + 'Z';
const crown = (x = 242, y = 52, options = {}) => node(x, y, [
  path('M-27 -12L-16 12H16L27 -12L12 -5L0 -26L-12 -5Z', 'trim'),
  wire('M-15 6H15', 'shine', 2), path(diamond(7), 'engine', 'outline', 1.5),
], { layer: 'front', motion: 'float', duration: 6, ...options });
const butterflyWings = (options = {}) => [-1, 1].map(side => node(200, 120, [
  path('M18 -14C-1 -75 -61 -118 -94 -98C-121 -79 -103 -45 -63 -39C-91 -27 -76 -4 -48 -8L18 -14Z', 'wing'),
  path('M10 -20C-14 -67 -64 -99 -85 -88C-104 -75 -87 -55 -58 -49Z', 'petal', 'trim', 1.5, .86),
  path('M-7 -20Q-47 -42 -62 -27Q-65 -11 -39 -14Z', 'accent', 'trim', 1.5, .9),
  wire('M17 -16L-77 -82M17 -16L-58 -49M17 -16L-45 -24', 'shine', 1.3, .85),
  path('M-65 -77Q-46 -81 -38 -64Q-49 -51 -64 -57Q-73 -67 -65 -77Z', 'core', 'trim', 2.5),
  path('M10 -22Q27 -117 75 -103Q109 -76 65 -42Q43 -26 10 -22Z', 'engine', 'outline', 2.5, .94),
  path('M21 -31Q35 -99 70 -93Q88 -77 58 -51Z', 'trim', 'none', 0, .55),
], { layer: 'front', sy: side, deploy: true, motion: 'flutter', duration: 4.8, ...options }));
const fairyStar = (x, y, color = 'trim', phase = 0) => node(x, y, [path(star(9), color, 'outline', 1.5), path(oval(2), 'core', 'none')], { layer: 'front', phase, duration: 5, detail: true });

export const COSMETIC_DESIGNS = {
  copper_horizon: kit('Clockwork aviator', 'A hand-built star machine, alive with turning brass and copper instruments.', 'Clockwork engine & brass wings', 'Mechanical spark rails', 'Brass tracer fire', [
    node(113, 120, [path(gear(45), 'armor'), path(oval(27), 'body'), wire(oval(19), 'trim', 3)], { motion: 'spin', duration: 12 }),
    ...wings('M-30 -18L-84 -75L-56 -87L36 -31L40 -18Z', 'M-62 -68L-17 -35M-42 -68L2 -37'),
    badge([path(oval(18), 'armor'), path(oval(13), 'body'), wire('M0 8L0 -9M-7 0L7 0', 'core', 2)]),
    node(147, 130, [wire('M-20 12L-20 -10Q-20 -20 -9 -20L10 -20M-12 12L-12 -4Q-12 -12 0 -12L12 -12', 'trim', 5)], { layer: 'front', motion: 'still' }),
  ]),
  arctic_pulse: kit('Living ice', 'A glacier in flight. Faceted ice fins split the light while tiny snow crystals orbit the hull.', 'Sculpted crystal fins', 'Drifting snowflake wake', 'Ice shard volleys', [
    ...wings('M-26 -24L-40 -106L-9 -77L12 -99L25 -39L72 -18Z', 'M-40 -106L-9 -77L25 -39M-9 -77L12 -99'),
    gem(134, 55, 13, { phase: 1 }), gem(163, 195, 18, { phase: 3 }), gem(333, 66, 9, { detail: true }),
    badge([path(diamond(19), 'core'), wire('M-13 0L13 0M0 -16L0 16M-9 -9L9 9M-9 9L9 -9', 'accent', 2)]),
  ]),
  cyber_current: kit('Holographic interceptor', 'Detached circuit panels follow your hull, linked by a live cyan data lattice.', 'Floating hologram panels', 'Digital circuit wake', 'Glitch bracket shots', [
    ...wings('M-34 -27L-70 -86L-12 -86L40 -32Z', 'M-56 -72L-20 -72L-2 -48M-44 -60L-29 -60'),
    node(140, 120, [wire('M-14 -53L-27 -53L-27 -26M-27 26L-27 53L-14 53M20 -48L34 -48L34 -31M20 48L34 48L34 31', 'accent', 5)], { motion: 'float', duration: 3 }),
    badge([path(hex(20), 'glass'), wire('M-12 0H-3V-11H9M-3 0V10H11', 'core', 3)]),
    node(232, 151, [wire('M-36 0H-12L-4 -8H22L30 0H58', 'accent', 3)], { layer: 'front', motion: 'pulse' }),
  ]),
  jade_drift: kit('Celestial botanist', 'Jade leaves unfurl into a living canopy. A little piece of a lost garden, carried between stars.', 'Unfurling leaf wings', 'Silk ribbons & falling leaves', 'Botanical energy strokes', [
    ...wings('M18 -27Q-58 -131 -110 -86Q-59 -78 -43 -47Q-3 -22 37 -16Z', 'M-97 -85Q-48 -73 19 -27M-52 -72L-50 -97M-36 -58L-15 -63'),
    node(122, 120, [wire('M0 0Q-54 -22 -53 -65M0 0Q-65 14 -68 65', 'trim', 4)], { motion: 'sway', duration: 6 }),
    badge([path('M-18 7Q-11 -26 20 -17Q21 7 -18 7Z'), wire('M-15 5L15 -14', 'trim', 2)]),
  ]),
  rose_circuit: kit('Rose fairy', 'A rose-pink fairy garden in flight, with translucent petal wings and a tiny flower crown.', 'Petal butterfly wings & flower crown', 'Rose beads & blossom sparks', 'Petal-shaped fairy fire', [
    ...[-1,1].map(side => node(215,120,[path('M14 -18Q-38 -118 -90 -91Q-112 -61 -57 -43Q-92 -13 -41 -15Z','wing'), path('M1 -23Q-36 -86 -76 -78Q-83 -56 -48 -48Z','petal','trim',1.5,.8),wire('M-77 -78L1 -23M-48 -48L1 -23','shine',1.5)],{sy:side,deploy:true,motion:'flutter',duration:4.6})),
    crown(243,55), badge([path('M0 -21Q15 -23 13 -9Q29 -3 15 8Q13 24 0 15Q-15 23 -14 8Q-30 -3 -14 -9Q-16 -25 0 -21Z'), path(oval(6), 'core')]),
  ]),
  solar_forge: kit('Starforged reactor', 'An exposed turbine and layered heat vanes turn your ship into a miniature solar engine.', 'Spinning reactor & heat vanes', 'Molten ember exhaust', 'Forged flame projectiles', [
    ...wings('M-42 -24L-91 -77L-51 -88L-43 -59L-17 -79L9 -37L44 -23Z', 'M-76 -72L-49 -44M-51 -88L-17 -32'),
    node(110, 120, [path(gear(48), 'armor'), path(oval(30), 'accent'), ...[0,1,2,3,4,5].map(i => {const a=i*Math.PI/3;return wire(`M${Math.cos(a)*12} ${Math.sin(a)*12}L${Math.cos(a+.45)*28} ${Math.sin(a+.45)*28}`, 'core', 6);})], { motion: 'spin', duration: 5 }),
    badge([path(hex(19), 'armor'), path(hex(12), 'engine'), path(oval(5), 'core')]),
  ]),
  pearl_comet: kit('Moonlit butterfly queen', 'An ivory butterfly carriage with rose-glass wings, a pearl tiara and trailing moon ribbons. Its wings open wide when you boost.', 'Rose-glass butterfly wings & pearl tiara', 'Pearl ribbons & fluttering butterflies', 'Moonflower butterfly fire', [
    ...butterflyWings(),
    crown(245, 49),
    node(125, 120, [wire('M-5 -22Q-67 -64 -82 -18Q-91 12 -111 -6M-5 22Q-67 64 -82 18Q-91 -12 -111 6', 'petal', 4), wire('M-4 -14Q-58 -42 -77 -4M-4 14Q-58 42 -77 4', 'trim', 2)], { motion: 'sway', duration: 7 }),
    node(304, 143, [path('M-19 0Q-17 -19 0 -22Q17 -19 19 0Q9 17 0 22Q-9 17 -19 0Z', 'trim'), path(oval(10), 'core'), wire('M-13 -4Q0 -15 13 -4', 'petal', 2)], { layer: 'front', motion: 'pulse' }),
    fairyStar(156, 30, 'petal', 1), fairyStar(156, 210, 'wing', 3),
    node(113, 120, [wire(oval(27, 54), 'trim', 2, .6)], { motion: 'sway', duration: 8 }),
  ]),
  void_pilot: kit('Eclipse dragon rider', 'An obsidian space dragon unfurls enormous violet membrane wings. A horned crest, eclipse ring and coiling comet tail complete the transformation.', 'Dragon wings, horned crest & eclipse ring', 'Coiling dragon tails & lunar runes', 'Dragon-shaped eclipse fire', [
    ...[-1, 1].map(side => node(215, 120, [
      path('M20 -17L-7 -105L-28 -85L-67 -111L-70 -62L-106 -76L-75 -23Q-52 -52 -28 -22Q-7 -42 20 -17Z', 'armor'),
      path('M7 -25L-10 -91L-27 -72L-58 -96L-59 -51L-91 -61L-73 -34Q-49 -52 -28 -30Q-8 -47 7 -25Z', 'wing', 'accent', 1.5, .85),
      wire('M-10 -91L-28 -30M-58 -96L-28 -30M-59 -51L-73 -34M-28 -30L7 -25', 'trim', 1.5),
    ], { layer: 'front', sy: side, deploy: true, motion: 'flutter', duration: 6.5 })),
    halo(151, 120, 88, { sx: .63, opacity: .55, duration: 28, deploy: true, detail: true }),
    node(137, 120, [wire('M-4 0Q-68 -68 -95 -12Q-113 17 -69 35Q-53 47 -95 61', 'engine', 5), wire('M-4 0Q-68 -68 -95 -12', 'shine', 1.5)], { motion: 'sway', duration: 8 }),
    node(300, 142, [path('M-20 -7L-13 -29L-2 -17L9 -24L15 -9L28 -3L18 12L0 18L-19 9Z', 'armor'), wire('M-11 -4L-3 1M8 -3L16 0', 'core', 2.5), path('M8 8L21 2L18 12Z', 'engine', 'none')], { layer: 'front', motion: 'pulse' }),
    gem(322, 41, 14, { color: 'petal', detail: true, phase: 2 }), gem(321, 200, 12, { detail: true, phase: 4 }),
  ]),
  cobalt_storm: kit('Thunder mecha paladin', 'Royal mecha armor, twin hovering sentries and a luminous knight crest turn the hull into a cobalt sky guardian. Its plated wings deploy on boost.', 'Mecha wing armor, knight crest & sentries', 'Tesla lightning & reactor sparks', 'Mecha reactor volleys', [
    ...[-1,1].map(side => node(210, 120, [
      path('M-25 -21L-72 -72L-55 -103L-29 -92L-7 -46L27 -25Z', 'armor'),
      path('M-53 -89L-40 -79L-23 -43L-43 -51L-62 -75Z', 'wing', 'trim', 2),
      path('M-45 -70L-33 -45L-25 -49L-37 -76Z', 'core', 'none', 0, .8),
      wire('M-63 -74L-44 -53M-55 -103L-29 -92L-7 -46', 'shine', 2),
    ], { layer: 'front', sy: side, deploy: true, motion: 'sway', duration: 7 })),
    ...[-1,1].map((side,i) => node(312, 120+side*72, [path(hex(17), 'armor'), path(hex(11), 'accent'), path(oval(5), 'core'), wire('M-26 0H-18M18 0H26', 'trim', 3)], { phase: i*2, duration: 4, detail: true })),
    node(158, 120, [wire('M-5 -90L16 -74L-2 -61L16 -45M-5 90L16 74L-2 61L16 45', 'core', 2)], { motion: 'pulse', detail: true }),
    node(297, 141, [path('M-21 -15L0 -25L21 -15L17 9L0 23L-17 9Z', 'trim'), path('M-12 -9L0 -16L12 -9L9 7L0 15L-9 7Z', 'armor'), wire('M-7 -3L0 1L7 -3M0 1V10', 'core', 2)], { layer: 'front', motion: 'pulse' }),
    crown(246, 52, { detail: true }),
  ]),
  prism_voyager: kit('Rainbow fairy monarch', 'A rainbow butterfly spectacle: four stained-glass wings, a floating jewel crown and a constellation of fairy stars. Boost opens the full royal silhouette.', 'Rainbow butterfly wings & floating jewel crown', 'Three-color ribbons & fairy butterflies', 'Prismatic butterfly starfire', [
    ...butterflyWings(),
    crown(244, 48),
    node(126, 120, [wire('M0 -10Q-59 -58 -89 -24M0 0Q-68 0 -106 12M0 12Q-52 61 -88 35', 'wing', 3), wire('M0 -14Q-45 -49 -79 -36M0 14Q-45 49 -79 36', 'petal', 2)], { motion: 'sway', duration: 7 }),
    fairyStar(157, 25, 'petal', 1), fairyStar(309, 39, 'wing', 2), fairyStar(153, 213, 'wing', 4), fairyStar(306, 204, 'petal', 3),
    badge([path(diamond(22), 'trim'), path('M0 -22L13 0L0 5Z', 'accent'), path('M0 5L0 22L-13 0Z', 'engine'), wire('M0 -22V22M-13 0H13', 'core', 1.5)]),
  ]),
  mint_condition: kit('Biosphere capsule', 'A miniature terrarium in orbit, with translucent seed pods and gently opening fronds.', 'Seed pods & unfurling fronds', 'Mint silk wake', 'Leaf-tip tracers', [
    ...wings('M-21 -19Q-86 -65 -34 -98Q7 -81 12 -35L25 -20Z', 'M-34 -88Q-45 -56 2 -29'),
    node(135, 120, [wire(oval(31, 61), 'trim', 3)], { motion: 'sway' }),
    badge([path(oval(17, 23), 'glass'), path('M-8 10Q-9 -14 11 -13Q16 5 -8 10Z', 'accent')]),
  ]),
  scarlet_comet: kit('Phoenix flight', 'Swept flame feathers rise behind a ruby phoenix crest.', 'Phoenix feather wings', 'Scarlet comet feathers', 'Ruby ember fire', [
    ...wings('M21 -18L-96 -89L-65 -44L-96 -52L-50 -24L-67 -20L-13 -9Z', 'M-78 -74L-27 -30M-65 -44L-29 -22'),
    badge([path('M-21 7L-6 -8L0 -22L6 -8L21 7L4 3L0 17L-4 3Z', 'accent')]), gem(149, 39, 10),
  ]),
  amber_signal: kit('Honeycomb navigator', 'An amber navigation array opens its honeycomb wings and broadcasts concentric signal rings.', 'Honeycomb antenna array', 'Golden signal bars', 'Amber beacon pulses', [
    ...[-1,1].flatMap(side => [0,1,2].map(i => node(172+i*25, 120+side*(55+i%2*23), [path(hex(20), 'glass'), wire(hex(13), 'accent', 2)], { phase: i, deploy: true }))),
    badge([path(hex(20), 'armor'), wire(oval(10), 'core', 3)]),
  ]),
  lunar_silver: kit('Moonlit regalia', 'Silver crescent sails and a moonstone brooch drift in a quiet orbital dance.', 'Crescent sails & moonstone', 'Lunar chevrons', 'Moonstone tracers', [
    ...wings('M-5 -24Q-79 -61 -32 -107Q-99 -85 -67 -32Q-36 -9 21 -15Z', 'M-49 -87Q-67 -54 -22 -31'),
    halo(134, 120, 57, { sx: .45 }), badge([path(oval(17), 'core'), path('M3 -17Q-14 0 3 17Q25 3 3 -17Z', 'shade')]),
  ]),
  ocean_depth: kit('Abyssal voyager', 'A bioluminescent manta wears luminous gill fans and a flowing deep-sea crest.', 'Manta fins & luminous gills', 'Aquatic circuit streams', 'Bioluminescent fire', [
    ...wings('M20 -23Q-26 -111 -99 -85L-65 -37L-32 -47L-6 -23Z', 'M-75 -75L-44 -44M-54 -81L-23 -39M-33 -74L-6 -32'),
    node(130, 120, [wire('M-7 -18Q-49 -71 -71 -41M-7 18Q-49 71 -71 41', 'accent', 3)], { motion: 'sway' }), badge([path(oval(14,22), 'glass'), wire('M-6 -8L6 8M6 -8L-6 8', 'core', 2)]),
  ]),
  lavender_dream: kit('Twilight dream butterfly', 'Soft lilac butterfly wings open around a moonstone brooch, with tiny dream stars floating nearby.', 'Lilac butterfly wings & moonstone brooch', 'Dream beads & tiny butterflies', 'Lavender dream-star fire', [
    ...[-1,1].map(side => node(215,120,[path('M13 -18C-11 -87 -70 -114 -94 -84Q-111 -52 -57 -39Q-82 -16 -42 -11Z','wing'),path('M1 -25Q-39 -92 -77 -77Q-88 -53 -49 -47Z','petal','trim',1.5,.85),wire('M-77 -77L1 -25M-49 -47L1 -25','shine',1.5)],{sy:side,deploy:true,motion:'flutter',duration:5.2})),
    fairyStar(151,40,'trim',1), fairyStar(151,200,'petal',3), badge([wire(oval(19), 'trim', 3), path(diamond(15),'core')]),
  ]),
  toxic_bloom: kit('Venom orchid', 'Thorned living armor surrounds a bright, unstable botanical core.', 'Thorned orchid armor', 'Lime spore embers', 'Venom-green tracers', [
    ...wings('M20 -22L-25 -105L-30 -65L-71 -91L-56 -43L-92 -48L-36 -18Z', 'M-25 -85L-10 -43M-59 -74L-38 -39'),
    badge([path('M0 -22L9 -8L24 -5L11 7L12 22L0 13L-12 22L-11 7L-24 -5L-9 -8Z', 'armor'), path(oval(8), 'core')]),
  ]),
  desert_mirage: kit('Dune skimmer', 'Bronze sail spars hold wind-carved fabric above the hull, with a compass rose at the prow.', 'Desert sails & compass crest', 'Warm sand ribbons', 'Sunlit silk fire', [
    ...wings('M-35 -24L-60 -101Q-9 -81 42 -24Z', 'M-60 -101L-35 -24M-45 -81L19 -36'),
    badge([path(oval(20), 'armor'), path('M0 -16L5 -4L16 0L4 5L0 16L-5 4L-16 0L-4 -5Z', 'trim')]),
  ]),
  ruby_eclipse: kit('Crimson empress', 'A red eclipse, royal blade wings and a suspended ruby seal form a dark celestial crown.', 'Royal blade wings & ruby seal', 'Ruby orbital crescents', 'Crimson eclipse shots', [
    ...wings('M13 -23L-5 -104L-37 -74L-55 -95L-45 -43L-15 -24Z', 'M-5 -104L-20 -54L13 -23'),
    halo(139, 120, 72, { sx: .6, duration: 20 }), badge([path(hex(21), 'armor'), path(diamond(15), 'accent'), wire('M0 -15V15', 'core', 2)]),
  ]),
  glacier_blue: kit('Icebreaker regalia', 'Stacked ice blades float on either side of a frost-cut star medallion.', 'Floating glacier blades', 'Fractured blue lightning', 'Frozen arc fire', [
    ...[-1,1].flatMap(side => [0,1,2].map(i => gem(164+i*29, 120+side*(63+i*12), 30-i*5, { sy: side, phase: i, deploy: true }))),
    badge([path('M0 -22L6 -6L18 -12L12 0L22 8L6 7L0 22L-6 7L-22 8L-12 0L-18 -12L-6 -6Z', 'core')]),
  ]),
  saffron_sky: kit('Sundancer', 'A fan of golden sun feathers unfolds into a warm, radiant star sail.', 'Radiant sun fan', 'Saffron spectral braid', 'Golden dawn shots', [
    ...wings('M18 -22L-66 -98L-49 -57L-31 -86L-18 -49L2 -74L16 -34L40 -23Z', 'M-66 -98L18 -22M-31 -86L18 -22'),
    badge([path(gear(22), 'trim'), path(oval(12), 'engine'), path(oval(5), 'core')]),
  ]),
  midnight_gold: kit('Sovereign of night', 'Gilded architectural fins frame a miniature royal observatory.', 'Gilded fins & sovereign crown', 'Golden clockwork rails', 'Gilded tracer rounds', [
    ...wings('M-32 -24L-68 -89L-41 -72L-17 -101L4 -47L29 -23Z', 'M-55 -76L-24 -39M-17 -101L-8 -51'),
    badge([path('M-21 -10L-13 12H13L21 -10L9 -3L0 -20L-9 -3Z', 'trim'), wire('M-11 6H11', 'armor', 3)]),
  ]),
  coral_reef: kit('Coral symphony', 'Sculpted coral antlers and a luminous sea-pearl bring a little reef into deep space.', 'Coral antlers & sea pearl', 'Coral pearl chains', 'Pearlescent reef fire', [
    ...wings('M-13 -22L-28 -53L-56 -60L-68 -84L-56 -89L-43 -70L-32 -68L-43 -98L-29 -103L-15 -69L5 -88L13 -77L-10 -52L8 -23Z', 'M-29 -91L-15 -57L-2 -32'),
    badge([path('M-21 10Q-24 -16 -11 -11Q0 -30 11 -11Q24 -16 21 10Z', 'accent'), path(oval(8), 'core')]),
  ]),
  ultraviolet: kit('Phase architect', 'Detached spectral frames and an ultraviolet lens turn your hull into an impossible light sculpture.', 'Detached phase frames', 'Ultraviolet braided wake', 'Spectral lens shots', [
    ...wings('M-35 -23L-63 -98L-16 -98L36 -24L21 -24L-24 -85H-44L-21 -23Z', 'M-57 -92H-22L28 -29'),
    halo(132, 120, 54, { sx: .5, duration: 11 }), badge([wire(hex(23), 'trim', 3), path(diamond(15), 'engine'), wire(diamond(8), 'core', 2)]),
  ]),
  nebula_circuit: kit('Nebula cartographer', 'A hard-earned navigational crown charts a tiny constellation around your ship.', 'Constellation fins & star chart', 'Nebula circuit rails', 'Stellar coordinate shots', [
    ...wings('M-20 -24L-68 -77L-21 -96L24 -35Z', 'M-56 -74L-18 -81L10 -40M-56 -74L-16 -40'),
    ...[[135,48],[165,194],[309,44]].map(([x,y],i) => gem(x,y,9+i*2,{phase:i})), badge([wire(hex(21), 'trim'), wire('M-12 4L0 -12L12 5L-8 11Z', 'core', 2)]),
  ]),
  aurora_pathfinder: kit('Aurora expedition', 'Sweeping auroral sails carry a luminous expedition compass across the frontier.', 'Aurora sails & expedition crest', 'Living aurora ribbons', 'Northern-light shots', [
    ...wings('M17 -25Q-2 -99 -86 -98L-53 -66L-73 -58Q-20 -40 17 -25Z', 'M-72 -91Q-26 -72 4 -37M-53 -66L-8 -38'),
    halo(127,120,46,{sx:.5}), badge([path(hex(19), 'armor'), path('M0 -17L9 8L0 4L-9 8Z', 'core')]),
  ]),
};

const GARDEN_STYLES = new Set(['jade_drift', 'rose_circuit', 'pearl_comet', 'prism_voyager', 'mint_condition', 'lavender_dream', 'lunar_silver', 'coral_reef', 'saffron_sky']);
const GUARDIAN_STYLES = new Set(['cyber_current', 'solar_forge', 'void_pilot', 'cobalt_storm', 'scarlet_comet', 'toxic_bloom', 'midnight_gold', 'ocean_depth']);
const SHOWPIECES = new Set(['pearl_comet', 'void_pilot', 'cobalt_storm', 'prism_voyager']);
const ART_DIRECTIONS = {
  pearl_comet: { motif: 'butterfly', palette: { wing: '#d7eefb', petal: '#efb5d7', accent: '#eacb8d', trim: '#f6dfab', engine: '#e8b7e6' } },
  prism_voyager: { motif: 'butterfly', palette: { body: '#f4e6ff', shade: '#bb9fd6', armor: '#775e99', accent: '#d990f7', glass: '#405582', trim: '#80e5ee', engine: '#ff9ccf', wing: '#a9dcff', petal: '#e7b3ff', core: '#fff9d4', outline: '#34335c' } },
  rose_circuit: { motif: 'blossom', palette: { body: '#f6e0ed', shade: '#cf94b7', armor: '#94517b', accent: '#ed78b1', glass: '#66436a', wing: '#ffc8e7', petal: '#f49ac8', trim: '#fff0c2', outline: '#613853' } },
  lavender_dream: { motif: 'butterfly', palette: { wing: '#c5c5ff', petal: '#f4c6f0', trim: '#fff0bd', engine: '#b5e8ff' } },
  mint_condition: { motif: 'blossom', palette: { wing: '#abefda', petal: '#f7e3b6', trim: '#fff1bd' } },
  jade_drift: { motif: 'butterfly' },
  coral_reef: { motif: 'blossom' },
  void_pilot: { motif: 'dragon', palette: { wing: '#a96bda', petal: '#dfc2ff', engine: '#c77bff', trim: '#c3adff' } },
  scarlet_comet: { motif: 'dragon' },
  cobalt_storm: { motif: 'mecha', palette: { wing: '#3c86ed', trim: '#e4cb8d', petal: '#93dfff', core: '#f5fdff' } },
  cyber_current: { motif: 'mecha' },
  midnight_gold: { motif: 'mecha' },
};
for (const [id, design] of Object.entries(COSMETIC_DESIGNS)) {
  const direction = ART_DIRECTIONS[id] || {};
  design.collection = GARDEN_STYLES.has(id) ? 'dream_garden' : GUARDIAN_STYLES.has(id) ? 'star_guardians' : 'cosmic_voyages';
  design.showpiece = SHOWPIECES.has(id);
  design.motif = direction.motif || '';
  design.palette = direction.palette || {};
}

export const getCosmeticDesign = id => COSMETIC_DESIGNS[id?.replace(/^skin_/, '')] || null;

// Inlays are clipped to the actual hull, so a skin reads as crafted material
// rather than accessories floating over a flat repaint.
const SURFACES = {
  copper_horizon: [wire('M126 107H161V151H207V139H246M137 107V137H151M282 94V117H334M154 155H218', 'trim', 2.5, .65), path('M174 127H184V145H174ZM190 127H200V145H190ZM206 127H216V145H206Z', 'armor', 'none', 0, .7)],
  arctic_pulse: [path('M120 110L203 81L174 151ZM203 81L309 100L240 156ZM309 100L391 127L289 155Z', 'shine', 'none', 0, .18), wire('M121 110L174 151L203 81L240 156L309 100L289 155', 'core', 1.5, .6)],
  cyber_current: [wire('M128 108H151V123H183V138H229M147 149H194V156H263V144H314M276 94V110H308V122H354', 'accent', 3, .9), path('M179 134H187V142H179ZM310 140H318V148H310ZM350 118H357V125H350Z', 'core', 'none', 0, .8)],
  jade_drift: [wire('M133 139Q172 104 225 136Q268 159 350 125M154 130Q154 115 170 108M187 129Q190 111 206 111M233 140Q244 128 261 131', 'trim', 2, .75), path('M260 144Q282 117 300 131Q293 147 260 144Z', 'accent', 'none', 0, .4)],
  rose_circuit: [wire('M137 137Q175 106 211 136T286 133T358 123M137 144Q175 113 211 143T286 140T358 130', 'trim', 1.5, .7), path('M179 127L184 132L179 137L174 132ZM249 132L255 138L249 144L243 138Z', 'core', 'none', 0, .75)],
  solar_forge: [path('M146 118L156 118L165 142L155 142ZM164 115L174 115L183 142L173 142ZM182 114L192 114L201 142L191 142Z', 'engine', 'outline', 1, .9), wire('M211 145L258 151L321 132', 'trim', 3, .8)],
  pearl_comet: [wire('M130 140Q244 176 369 128M144 146Q244 179 349 141', 'trim', 2.5, .85), wire('M179 129L195 138L219 126L244 140L263 134M195 132V144M213 126H225', 'core', 2, .85)],
  void_pilot: [wire('M155 129Q211 160 278 147Q325 136 351 119M152 136Q214 173 289 153', 'accent', 2, .8), wire('M185 140L190 133L195 143M219 146V136M241 149L247 141L253 147M273 145L278 136', 'trim', 2, .8)],
  cobalt_storm: [path('M129 110L139 107L171 149L160 148ZM151 103L161 101L193 151L182 151ZM173 100L183 99L215 151L204 151Z', 'armor', 'none', 0, .75), wire('M225 145L241 133L253 141L272 128L282 136L321 120', 'core', 2, .8)],
  prism_voyager: [path('M127 108L201 88L183 151ZM201 88L263 95L231 157ZM263 95L323 108L293 148Z', 'trim', 'none', 0, .19), path('M183 151L201 88L231 157ZM293 148L323 108L378 127Z', 'engine', 'none', 0, .25), wire('M127 108L183 151L201 88L231 157L263 95L293 148L323 108', 'shine', 1.2, .7)],
};
const SURFACE_FAMILY = { mint_condition: 'jade_drift', scarlet_comet: 'solar_forge', amber_signal: 'copper_horizon', lunar_silver: 'pearl_comet', ocean_depth: 'cyber_current', lavender_dream: 'rose_circuit', toxic_bloom: 'jade_drift', desert_mirage: 'copper_horizon', ruby_eclipse: 'void_pilot', glacier_blue: 'arctic_pulse', saffron_sky: 'solar_forge', midnight_gold: 'pearl_comet', coral_reef: 'rose_circuit', ultraviolet: 'prism_voyager', nebula_circuit: 'cyber_current', aurora_pathfinder: 'jade_drift' };
export const getCosmeticSurface = id => { const appearance = id?.replace(/^skin_/, ''); return SURFACES[appearance] || SURFACES[SURFACE_FAMILY[appearance]] || []; };

export function cosmeticNodePose(group, time = 0, boosting = false, reducedMotion = false) {
  const t = reducedMotion ? 0 : (Number.isFinite(time) ? time : 0);
  const phase = t * Math.PI * 2 / group.duration + group.phase;
  return {
    x: group.x, y: group.y + (group.motion === 'float' ? Math.sin(phase) * 3 : 0),
    angle: (group.angle || 0) + (group.motion === 'spin' ? t * 360 / group.duration : group.motion === 'sway' ? Math.sin(phase) * 4 : 0),
    sx: group.sx ?? 1,
    sy: (group.sy ?? 1) * (group.deploy ? (boosting ? 1 : .72) : 1) * (group.motion === 'flutter' ? .9 + Math.cos(phase) * .1 : 1),
    opacity: (group.opacity ?? 1) * (group.motion === 'pulse' ? .83 + Math.sin(phase) * .13 : 1),
  };
}
