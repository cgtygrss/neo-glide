// Gameplay and artwork use this same table. Each weapon trades projectile
// speed, impact and hit radius; every shot consumes one round.
export const WEAPON_STATS = {
  default: { speed: 800, damage: 10, radius: 5 },
  blaster: { speed: 1200, damage: 25, radius: 5 },
  cannon: { speed: 600, damage: 50, radius: 8 },
  beam: { speed: 2000, damage: 75, radius: 5 },
  wave: { speed: 500, damage: 100, radius: 10 },
  shock: { speed: 1000, damage: 150, radius: 5 },
  needle: { speed: 1700, damage: 18, radius: 3, color: '#b3ffd9', shape: 'dart' },
  frost: { speed: 900, damage: 40, radius: 7, color: '#a6eeff', shape: 'crystal' },
  ember: { speed: 720, damage: 65, radius: 9, color: '#ffa16e', shape: 'ember' },
  rail: { speed: 2400, damage: 90, radius: 3, color: '#ffe5a1', shape: 'rail' },
  photon: { speed: 1600, damage: 55, radius: 6, color: '#fff5b8', shape: 'star' },
  vortex: { speed: 650, damage: 115, radius: 12, color: '#b5a0ff', shape: 'vortex' },
  sonic: { speed: 1350, damage: 85, radius: 10, color: '#8ff1d6', shape: 'rings' },
  shard: { speed: 1900, damage: 110, radius: 6, color: '#ffb6d8', shape: 'shard' },
  nova: { speed: 800, damage: 175, radius: 13, color: '#ffd18b', shape: 'nova' },
  antimatter: { speed: 1100, damage: 200, radius: 8, color: '#dda9ff', shape: 'atom' },
};
export const getWeaponStats = id => WEAPON_STATS[id] || WEAPON_STATS.default;

export function drawCatalogProjectile(ctx, stats, tint) {
  ctx.fillStyle = tint || stats.color;
  ctx.strokeStyle = tint || stats.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  switch (stats.shape) {
    case 'dart':
      ctx.moveTo(19, 0); ctx.lineTo(-10, -3); ctx.lineTo(-4, 0); ctx.lineTo(-10, 3); ctx.closePath(); ctx.fill(); break;
    case 'crystal':
      ctx.moveTo(12, 0); ctx.lineTo(0, -7); ctx.lineTo(-10, 0); ctx.lineTo(0, 7); ctx.closePath(); ctx.fill(); break;
    case 'ember':
      ctx.moveTo(-16, -6); ctx.quadraticCurveTo(12, -13, 12, 0); ctx.quadraticCurveTo(12, 13, -16, 6); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill(); break;
    case 'rail':
      ctx.moveTo(-24, -3); ctx.lineTo(24, -3); ctx.moveTo(-24, 3); ctx.lineTo(24, 3); ctx.stroke(); break;
    case 'star':
    case 'nova': {
      const rays = stats.shape === 'nova' ? 8 : 4, radius = stats.radius;
      for (let i = 0; i <= rays * 2; i++) {
        const a = i * Math.PI / rays, r = i % 2 ? radius * .4 : radius;
        if (!i) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill(); break;
    }
    case 'vortex':
      for (let i = 0; i <= 30; i++) {
        const a = i * .45, r = i * .4;
        if (!i) ctx.moveTo(0, 0); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.stroke(); break;
    case 'rings':
      for (const x of [-9, 0, 9]) { ctx.moveTo(x + 4, 0); ctx.arc(x, 0, 4, 0, Math.PI * 2); } ctx.stroke(); break;
    case 'shard':
      ctx.moveTo(18, 0); ctx.lineTo(-10, -6); ctx.lineTo(-2, 0); ctx.lineTo(-10, 6); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-16, -5); ctx.lineTo(-11, 0); ctx.lineTo(-16, 5); ctx.stroke(); break;
    case 'atom':
      for (const y of [-5, 5]) { ctx.moveTo(8, y); ctx.arc(0, y, 8, 0, Math.PI * 2); } ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill(); break;
  }
}
