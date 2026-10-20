export const TRANSFORMATION_SECONDS = 12;
export const ENTRY_SECONDS = 1.6;
export const EXIT_SECONDS = .3;
export const REDUCED_ENTRY_SECONDS = .25;
export const ASSEMBLY_WORLD_SCALE = .2;
export const ENTRY_PROTECTION_SECONDS = .35;

// Offsets are in vehicle coordinates; the renderer fits the whole assembly to the viewport.
const piece = (id, start, x, y, rotation = 0, duration = .35) => ({ id, start, duration, x, y, rotation });
const capsuleAssembly = [piece('capsuleTop', .25, -12, -62, -.2, .5), piece('capsuleBottom', .32, 12, 62, .2, .5)];
export const TRANSFORMATION_ASSEMBLIES = {
  striker: [...capsuleAssembly, piece('wingTop', .25, -42, -58, -.7), piece('wingBottom', .32, -42, 58, .7), piece('boosterTop', .4, -55, -28), piece('boosterBottom', .45, -55, 28), piece('rackTop', .56, 40, -55, .5), piece('rackBottom', .62, 40, 55, -.5), piece('nose', .74, 70, 0, 0, .36)],
  volt: [...capsuleAssembly, piece('wingTop', .25, -38, -65, -1), piece('wingBottom', .34, -38, 65, 1), piece('nodeTop', .67, 55, -50, .8), piece('nodeBottom', .75, 55, 50, -.8)],
  drill: [...capsuleAssembly, piece('turbineTop', .25, -50, -52, -.4), piece('turbineBottom', .34, -50, 52, .4), piece('mount', .45, 55, 0), ...[0, 1, 2].map(i => piece(`bit${i}`, .57 + i * .09, 60 + i * 8, 0, (i - 1) * .8))],
  sphere: [...capsuleAssembly, ...[0, 1, 2, 3, 4, 5].map(i => { const a = i * Math.PI / 3; return piece(`shell${i}`, .25 + i * .055, Math.cos(a) * 78, Math.sin(a) * 78, .9); }), ...[0, 1, 2].map(i => piece(`ring${i}`, .64 + i * .055, 0, 0, Math.PI * 1.5, .35)), piece('emitterTop', .65, -30, -60), piece('emitterBottom', .75, -30, 60)],
  aegis: [...capsuleAssembly, ...[0, 1, 2, 3, 4, 5].map(i => { const a = i * Math.PI / 3 - Math.PI / 2; return piece(`panel${i}`, .25 + i * .055, Math.cos(a) * 72, Math.sin(a) * 72, -.6); }), ...[0, 1, 2].map(i => { const a = i * Math.PI * 2 / 3; return piece(`satellite${i}`, .64 + i * .055, Math.cos(a) * 65, Math.sin(a) * 65, 1); })],
};
export const transformationEntryCues = form => form?.reducedMotion ? [[0, 'fold'], [.15, 'activate']] : [[0, 'fold'], [.6, 'lock'], [.87, 'lock'], [1.1, 'activate']];
export const transformationEntryDuration = form => form?.reducedMotion ? REDUCED_ENTRY_SECONDS : ENTRY_SECONDS;
export const transformationTransitionDuration = form => form?.phase === 'EXITING' ? EXIT_SECONDS : transformationEntryDuration(form);
// The original ship is tucked inside once the two capsule halves lock together.
export function transformationCapsuleClosure(form) {
  const progress = form.phase === 'ACTIVE' ? 1 : form.phase === 'EXITING' ? 1 - transformationProgress(form) : form.reducedMotion ? transformationProgress(form) : Math.max(0, Math.min(1, (form.transitionTime - .25) / .57));
  return progress * progress * (3 - 2 * progress);
}
export const transformationProgress = form => Math.max(0, Math.min(1, (form?.transitionTime || 0) / transformationTransitionDuration(form)));

// The cinematic clock remains real time. Only the world clock composes with TIME_SLOW.
// Split boundary frames so 30/60fps produce the same amount of world simulation.
export function transformationWorldDelta(game, deltaTime) {
  if (game.phase !== 'FLYING' || game.gameOver) return 0;
  const dt = Math.max(0, Math.min(.1, Number(deltaTime) || 0));
  const form = game.transformation;
  const entry = form?.phase === 'ENTERING' ? Math.min(dt, Math.max(0, transformationEntryDuration(form) - form.transitionTime)) : 0;
  const powerScale = game.activePowerUps?.some(power => power.type === 'TIME_SLOW' && power.remainingTime > 0) ? .5 : 1;
  return (dt - entry + entry * ASSEMBLY_WORLD_SCALE) * powerScale;
}
export const TRANSFORMATIONS = [
  { id: 'striker', name: 'Star Striker', color: '#ffc181', primary: 'LIFT', secondary: 'SALVO', primaryHint: 'HOLD TO RISE', secondaryHint: '3 FORWARD MISSILES', hint: 'Hold to rise · Release to glide · Fire 3 straight missiles', cooldown: 2.4 },
  { id: 'drill', name: 'Comet Drill', color: '#8bf1ed', primary: 'LIFT', secondary: 'DRILL', primaryHint: 'HOLD TO RISE', secondaryHint: 'PIERCE AHEAD', hint: 'Hold to rise · Release to glide · Drill through hazards', cooldown: 2.5 },
  { id: 'sphere', name: 'Storm Sphere', color: '#d4b6ff', primary: 'FLIP', secondary: 'PULSE', primaryHint: 'FLIP GRAVITY', secondaryHint: 'CLEAR NEARBY', hint: 'Tap to flip gravity · Pulse clears nearby obstacles and shots', cooldown: 2 },
  { id: 'volt', name: 'Volt Ray', color: '#ffe58b', primary: 'FLAP', secondary: 'BOLT', primaryHint: 'TAP TO CLIMB', secondaryHint: 'STRAIGHT LIGHTNING', hint: 'Tap to climb · Fire straight lightning at enemies', cooldown: 2.2 },
  { id: 'aegis', name: 'Aegis Orb', color: '#91bcff', primary: 'LIFT', secondary: 'BARRIER', primaryHint: 'HOLD TO RISE', secondaryHint: '2 SECOND SHIELD', hint: 'Hold to rise · Release to glide · Barrier protects for 2s', cooldown: 4.5 },
];
export const getTransformation = id => TRANSFORMATIONS.find(item => item.id === id);
