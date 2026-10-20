// Fictional destinations; prices and ownership never change flight mechanics.
export const STAGES = [
  { id:'default', name:'Milky Way', price:0, description:'The familiar deep-space frontier.', colors:['#071022','#263752','#93b9d5'] },
  { id:'andromeda', name:'Andromeda Dawn', price:12000, description:'A golden sunrise over distant worlds.', colors:['#364263','#dba35f','#fff0bd'] },
  { id:'triangulum', name:'Triangulum Frost', price:20000, description:'Ice spires shimmer beneath a pale sky.', colors:['#18394f','#68a5b6','#d9fbff'] },
  { id:'whirlpool', name:'Whirlpool Tides', price:30000, description:'Ocean currents curl around a distant moon.', colors:['#09273d','#218093','#a6f5f1'] },
  { id:'sunflower', name:'Sunflower Bloom', price:45000, description:'A stellar corona opens across the horizon.', colors:['#3a283c','#bf7138','#ffe49a'] },
  { id:'black_eye', name:'Black Eye Eclipse', price:60000, description:'An eclipse cuts through a violet haze.', colors:['#100f26','#4c345e','#d5a7e3'] },
  { id:'sombrero', name:'Sombrero Dunes', price:80000, description:'Warm dust and a great ring cross the sky.', colors:['#372634','#a45d48','#f6cda3'] },
  { id:'cartwheel', name:'Cartwheel Halo', price:105000, description:'A luminous wheel turns in the distance.', colors:['#151d3a','#5854a5','#b9c9ff'] },
  { id:'centaurus_a', name:'Centaurus Ember', price:130000, description:'Glowing lava fissures light a fiery world.', colors:['#2a1720','#a23a28','#ffd080'] },
  { id:'bode', name:'Bode Aurora', price:160000, description:'Green auroras ripple above an ice world.', colors:['#102b37','#22765e','#baffdd'] },
  { id:'pinwheel', name:'Pinwheel Prism', price:200000, description:'A multicolored spiral turns among the stars.', colors:['#1b1735','#574e8c','#f4bdff'] },
];
export const getStage = id => STAGES.find(stage => stage.id === id) || STAGES[0];
