import { CREDIT_PACKS, STARTER_CREDITS } from './Economy.js';
import { Renderer } from './Renderer.js';
import { Collectible, Player, PlayerProjectile } from './Entities.js';
import { ShipFlightDemo } from './ShipFlightDemo.js';
import { upgradeOffer } from './ShopCatalog.js';
import { trailValues } from './CoinTrails.js';
import { getCosmetic, getCosmeticPalette } from './CosmeticsCatalog.js';
import { advanceCosmeticTrail, createCosmeticTrailState, drawCosmeticTrail } from './CosmeticTrails.js';
import { getShip } from './ShipCatalog.js';

export const PREVIEW_WIDTH = 520;
export const PREVIEW_HEIGHT = 230;
const text = (ctx, value, x, y, color = '#cfdfeb', size = 12) => {
  ctx.fillStyle = color; ctx.font = `700 ${size}px Arial`; ctx.textAlign = 'center'; ctx.fillText(value, x, y);
};
function shipAt(renderer, ship, x, y, scale = 2, boosting = false, rotation = boosting ? -5 : 0, cosmeticId = null) {
  const ctx = renderer.ctx;
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  renderer.drawPlayer({ x: 0, y: 0, rotation, isBoosting: boosting }, ship, false, [], false, 0, cosmeticId);
  ctx.restore();
}
function gauge(ctx, x, y, width, fraction, color = '#80ddc6') {
  ctx.fillStyle = '#243b4c'; ctx.beginPath(); ctx.roundRect(x, y, width, 10, 5); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, Math.max(0, Math.min(1, fraction)) * width, 10, 5); ctx.fill();
}
function adBadge(ctx, x, y, size = 45) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#173749'; ctx.strokeStyle = '#80ddc6'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-size/2, -size/2, size, size, 9); ctx.fill(); ctx.stroke();
  text(ctx, 'AD', 0, 5, '#dfebef', size * .28);
  ctx.beginPath(); ctx.moveTo(-size*.36, size*.36); ctx.lineTo(size*.36,-size*.36); ctx.stroke(); ctx.restore();
}

// An isolated demonstration scene. It has no connection to gameplay, audio or saves.
export class ShopPreviewScene {
  constructor(canvas, { pixelRatio = 1 } = {}) {
    this.renderer = new Renderer(canvas);
    this.renderer.resize(PREVIEW_WIDTH, PREVIEW_HEIGHT);
    this.renderer.planets = [];
    if (pixelRatio !== 1) {
      canvas.width = PREVIEW_WIDTH * pixelRatio;
      canvas.height = PREVIEW_HEIGHT * pixelRatio;
      this.renderer.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }
    this.flightDemo = null;
    this.shipTime = 0;
    this.thrusterLevel = null;
    this.cosmeticTrail = createCosmeticTrailState();
    this.cosmeticPreviewGame = { phase: 'PAUSED', shipType: 'default', speed: 0, distance: 0, player: null };
    this.cosmeticPreviewTime = 0;
    this.cosmeticEffectTime = 0;
    this.cosmeticPreviewKey = '';
    this.cosmeticPreviewDistance = 0;
    this.cosmeticPreviewPlayer = { x: 230, y: 119, rotation: 0, isBoosting: true };
  }

  draw({ kind, itemId, ship = 'default', cosmeticId = '', upgrades = {}, pilotLevel = 1 }, time = 0, playing = false) {
    const r = this.renderer, ctx = r.ctx;
    const thrusterLevel = upgrades.thruster || 1;
    if (kind === 'ship' && (!this.flightDemo || this.thrusterLevel !== thrusterLevel)) {
      this.flightDemo = new ShipFlightDemo(thrusterLevel);
      this.thrusterLevel = thrusterLevel;
      this.shipTime = time;
    }
    const flightDelta = kind === 'ship' && playing ? Math.max(0, time - this.shipTime) : 0;
    if (kind === 'ship') { this.flightDemo.advance(flightDelta); this.shipTime = time; }
    r.clear(); r.drawBackground(kind === 'ship' ? 320 : 0, flightDelta);
    // Motion is local to the preview and follows no live-game state.
    if (playing) {
      ctx.save(); ctx.strokeStyle = '#426173'; ctx.globalAlpha = .22; ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) { const x = (i * 94 - time * 65) % 600; ctx.beginPath();ctx.moveTo(x, 45+i*24);ctx.lineTo(x+16,45+i*24);ctx.stroke(); }
      ctx.restore();
    }
    if (kind === 'ship') {
      const demo = this.flightDemo, p = demo.player;
      const offset = demo.scroll % 960;
      const coins = trailValues(11).map((value, i) => new Collectible(620 + i * 48 - offset, 112 - Math.sin(i * Math.PI / 4) * 24, value));
      r.drawCollectibles(coins.filter(coin => coin.x > -20 && coin.x < 550));
      shipAt(r, itemId, p.x, p.y, 2.4, p.isBoosting, p.rotation, cosmeticId);
      ctx.fillStyle = p.isBoosting ? '#35574d' : '#243e55';
      ctx.beginPath(); ctx.roundRect(18, 15, 95, 25, 8); ctx.fill();
      text(ctx, p.isBoosting ? 'BOOST · RISE' : 'GLIDE · COAST', 65, 32, '#d9eee4', 9);
      text(ctx, 'FLIGHT DEMO · CLOSE-UP', 190, 211, '#96bacb', 10);
      return;
    }
    if (kind === 'weapon') {
      shipAt(r, ship, 92, 112, 1.7, playing, playing ? -5 : 0, cosmeticId);
      const shots = [];
      for (let i = 0; i < 3; i++) {
        const shot = new PlayerProjectile(0, 111, itemId);
        const age = (time - i * .55) % 2.4;
        shot.x = playing ? 164 + shot.speed * age * .35 : 230 + i * 100;
        if (!playing || (age >= 0 && shot.x < 550)) shots.push(shot);
      }
      ctx.save();
      // Magnify the real projectile artwork around its center for inspection.
      for (const shot of shots) { ctx.save();ctx.translate(shot.x,shot.y);ctx.scale(1.7,1.7);r.drawPlayerProjectiles([{...shot,x:0,y:0}], cosmeticId);ctx.restore(); }
      ctx.restore();
      text(ctx, playing ? 'SAMPLE VOLLEY · SLOW MOTION' : 'SHOT PREVIEW · CLOSE-UP', 260, 205, '#96bacb', 10);
      return;
    }
    if (kind === 'cosmetic') {
      const cosmetic = getCosmetic(itemId);
      if (!cosmetic) return;
      const scale = 2.8, previewPlayer = this.cosmeticPreviewPlayer;
      const previewKey = `${ship}:${cosmetic.id}`;
      const trailScale = .18 * scale;
      if (this.cosmeticPreviewKey !== previewKey) {
        // Static previews use the regular trail sampler to build a brief, visible wake.
        // Leaving the game paused afterwards makes redraws (including visibility redraws)
        // render-only frames instead of adding coincident points.
        this.cosmeticPreviewKey = previewKey;
        this.cosmeticPreviewDistance = 0;
        this.cosmeticPreviewTime = time;
        Object.assign(previewPlayer, { x: 190, y: 119, rotation: 0, isBoosting: true });
        Object.assign(this.cosmeticPreviewGame, { phase: 'FLYING', shipType: ship, speed: 200, distance: 0, player: previewPlayer });
        for (let sample = 0; sample < 18; sample++) {
          this.cosmeticPreviewDistance += 200 / 30;
          this.cosmeticPreviewGame.distance = this.cosmeticPreviewDistance;
          advanceCosmeticTrail(this.cosmeticTrail, { game: this.cosmeticPreviewGame, cosmetic, deltaTime: 1 / 30, scale: trailScale });
        }
        this.cosmeticPreviewGame.phase = 'PAUSED';
        this.cosmeticPreviewGame.speed = 0;
      }
      if (playing) {
        const previewDelta = Math.max(0, Math.min(.1, time - this.cosmeticPreviewTime));
        this.cosmeticPreviewTime = time;
        this.cosmeticEffectTime += previewDelta;
        Object.assign(previewPlayer, { rotation: -4, isBoosting: true });
        Object.assign(this.cosmeticPreviewGame, { phase: 'FLYING', shipType: ship, speed: 95, player: previewPlayer });
        this.cosmeticPreviewDistance += this.cosmeticPreviewGame.speed * previewDelta;
        this.cosmeticPreviewGame.distance = this.cosmeticPreviewDistance;
        advanceCosmeticTrail(this.cosmeticTrail, { game: this.cosmeticPreviewGame, cosmetic, deltaTime: previewDelta, scale: trailScale });
      } else {
        this.cosmeticPreviewGame.phase = 'PAUSED';
        advanceCosmeticTrail(this.cosmeticTrail, { game: this.cosmeticPreviewGame, cosmetic, deltaTime: 0, scale: trailScale });
      }
      r.cosmeticEffectTime = this.cosmeticEffectTime;
      const points = this.cosmeticTrail.points;
      drawCosmeticTrail(ctx, points, cosmetic, getCosmeticPalette(getShip(ship).palette, cosmetic.id), r.lowPowerMode, scale);
      shipAt(r, ship, previewPlayer.x, previewPlayer.y, scale, previewPlayer.isBoosting, previewPlayer.rotation, cosmetic.id);
      const shots = [0, 1, 2].map(index => {
        const age = (this.cosmeticEffectTime + index * .42) % 1.26;
        const shot = new PlayerProjectile(245 + age * 205, 112, 'blaster', cosmetic.id);
        shot.visualAge = age; shot.visualMuzzleOffset = -age * 205 / 1.5; return shot;
      });
      for (const shot of shots) { ctx.save(); ctx.translate(shot.x, shot.y); ctx.scale(1.5, 1.5); r.drawPlayerProjectiles([{ ...shot, x: 0, y: 0 }], cosmetic.id); ctx.restore(); }
      text(ctx, 'HULL · ENGINE WAKE · FRIENDLY SHOTS', 260, 207, cosmetic.colors.shine, 10);
      return;
    }
    if (kind === 'upgrade') {
      const offer = upgradeOffer(itemId, upgrades, ship, pilotLevel);
      if (itemId === 'thruster') {
        const t = playing ? (time % 1.6) / 1.6 * .45 : .32;
        const rise = level => { const p = new Player(level); p.boost(true); for(let i=0;i<Math.floor(t*60);i++)p.update(1/60); return Math.max(-70, (p.y-300) * .45); };
        shipAt(r, ship, 132, 135 + rise(offer.level), 1.7, playing, playing ? -5 : 0, cosmeticId);
        shipAt(r, ship, 374, 135 + rise(offer.nextLevel), 1.7, playing, playing ? -5 : 0, cosmeticId);
        text(ctx, 'CURRENT', 130, 52, '#9bb9c8', 10);text(ctx, 'UPGRADED', 375, 52, '#80ddc6', 10);
      } else if (itemId === 'magnet') {
        shipAt(r, ship, 205, 112, 1.6, false, 0, cosmeticId);
        ctx.save(); ctx.setLineDash([4,5]);
        const rangeScale = Math.min(.8, 95 / offer.after);
        for(const [range,color] of [[offer.before,'#577181'],[offer.after,'#80ddc6']]) {ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(205,112,range * rangeScale,0,Math.PI*2);ctx.stroke();}
        ctx.restore();
        const coin = new Collectible(205 + offer.after * rangeScale + 5, 112, 500);
        if(playing)coin.x -= (time%1.6)/1.6*65;
        r.drawCollectibles([coin]);
        text(ctx,'ATTRACTION RANGE GUIDE',260,185,'#96bacb',10);
      } else if (itemId === 'multiplier') {
        r.drawCollectibles([new Collectible(260,92,500)]);
        text(ctx, `${Math.floor(500 * offer.before)} credits`,130,145,'#bdcdd7',18);
        text(ctx,'→',260,145,'#80ddc6',20);
        text(ctx,`${Math.floor(500 * offer.after)} credits`,390,145,'#ffe09b',18);
        text(ctx,'ONE 500-CREDIT COIN · COMBO 1×',260,183,'#96bacb',10);
      } else {
        shipAt(r,ship,105,108,1.7, itemId === 'battery' && playing, itemId === 'battery' && playing ? -5 : 0, cosmeticId);
        const boostTime = time % (offer.after / 10 + 1);
        const fraction = playing ? Math.max(0, 1 - boostTime * 10 / offer.before) : .62;
        if(itemId === 'battery') {
          text(ctx,'CURRENT TANK',326,63,'#9bb9c8',10);gauge(ctx,231,75,190,fraction);
          text(ctx,'LARGER TANK',326,111,'#80ddc6',10);gauge(ctx,231,123,190,playing?Math.max(0,1-boostTime*10/offer.after):(1 - .38 * offer.before / offer.after));
        } else if(itemId === 'hull') {
          text(ctx,`CURRENT · ${offer.before} HP`,325,65,'#9bb9c8',10);
          gauge(ctx,231,78,190,offer.before / offer.after,'#748f9d');
          text(ctx,`UPGRADED · ${offer.after} HP`,325,121,'#80ddc6',10);
          gauge(ctx,231,134,190,1);
        } else {
          text(ctx,'DAMAGED HULL · RECOVERY DEMO',325,65,'#9bb9c8',10);
          const recoveryTime = playing ? time % 8 : 3.5;
          const maxHull = upgradeOffer('hull', upgrades, ship, pilotLevel).before;
          gauge(ctx,231,83,190,.25+Math.min(.65,recoveryTime*offer.before/maxHull),'#748f9d');
          gauge(ctx,231,130,190,.25+Math.min(.65,recoveryTime*offer.after/maxHull));
          text(ctx,'NEXT UPGRADE',326,122,'#80ddc6',10);
        }
      }
      text(ctx, `${offer.beforeLabel}  →  ${offer.afterLabel}`, 260, 214, '#e5eee8', 13);
      return;
    }
    if (kind === 'product') {
      if(itemId === 'starter_pack') {
        shipAt(r,'interceptor',143,91,2.2,playing);
        r.drawPlayerProjectiles([{...new PlayerProjectile(350+(playing?(time%1)*100:0),83,'blaster')}]);
        r.drawCollectibles([new Collectible(160,154,10000),new Collectible(202,154,10000),new Collectible(244,154,10000),new Collectible(286,154,10000)]);
        text(ctx,`${(STARTER_CREDITS/10000).toLocaleString()} × 10,000 credits`,222,184,'#96bacb',10);
        text(ctx,'INTERCEPTOR + SOLAR BLASTER',260,37,'#dfebe9',12);
        text(ctx,`${STARTER_CREDITS.toLocaleString()} CREDITS`,260,211,'#ffe09b',12);
      } else if(itemId === 'remove_ads') {
        shipAt(r,ship,183,112,2.4,playing);adBadge(ctx,365,105,70);
        text(ctx,'NO FORCED AD BREAKS',260,200,'#80ddc6',13);
      } else {
        const totals=CREDIT_PACKS;
        const stacks = itemId === 'credits_1000' ? [1,1] : itemId === 'credits_5500' ? [3,3,3,2] : [6,6,6,6,6];
        for(let column=0;column<stacks.length;column++)for(let row=0;row<stacks[column];row++) {
          const coin=new Collectible(260-(stacks.length-1)*29+column*58,128-row*12,10000);
          r.drawCollectibles([coin]);
        }
        text(ctx,`${((totals[itemId]||0)/10000).toLocaleString()} × 10,000 credits`,260,170,'#96bacb',11);
        text(ctx,`${(totals[itemId]||0).toLocaleString()} CREDITS`,260,202,'#ffe09b',22);
      }
    }
  }
}
