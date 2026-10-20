import { drawCosmeticMuzzle, drawCosmeticShot } from './CosmeticEffects.js';
import { StageBackground } from './StageBackground.js';
import { drawVoltLightning, drawTransformationCapsule, drawTransformationVehicle, drawTransformationCinematic } from './TransformationArt.js';
import { drawShipArt } from './ShipArt.js';
import { transformationWorldDelta } from './TransformationCatalog.js';
import { getCosmetic, getCosmeticPalette } from './CosmeticsCatalog.js';
import { getShip } from './ShipCatalog.js';
import { advanceCosmeticTrail, createCosmeticTrailState, drawCosmeticTrail, resetCosmeticTrail } from './CosmeticTrails.js';

const INK = '#06121f';
const DANGER = '#ff627d';
const DANGER_CORE = '#fff2ed';
const COIN = '#ffd369';
const FUEL = '#eef2a0';
const FRIENDLY = '#89e6ff';

// A solid silhouette and dark separation edge survive any background or overlap.
function outlinedShape(ctx, fill, edge = '#e9f6ff', width = 1.5) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = width;
    ctx.stroke();
}


export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;

        // Initialize Starfield
        this.stars = [];
        this.planets = [];
        this.fxParticles = [];
        this.flash = 0;
        this.lowPowerMode = false;
        this.stageBackground = new StageBackground();
        this.stageTime = 0;
        this.stageRun = null;
        this.cosmeticTrail = createCosmeticTrailState();
        this.cosmeticEffectTime = 0;
        this.cosmeticEffectRun = null;
        this.cosmeticEffectDistance = 0;
        this.cosmeticEffectId = null;
        this.initBackground();
    }

    drawScene(game, deltaTime) {
    if (this.width <= 0 || this.height <= 0) return;
    this.clear();
    const transformation = game.transformation;
    const realDelta = Math.max(0, Math.min(.1, deltaTime || 0));
    deltaTime = game.phase === 'FLYING' ? realDelta * (game.worldTimeScale ?? (realDelta ? transformationWorldDelta(game, realDelta) / realDelta : 1)) : game.phase === 'LAUNCH' ? realDelta : 0;
    if (this.visualRevision !== game.visualRevision) {
        if (this.cosmeticTrail) resetCosmeticTrail(this.cosmeticTrail);
        this.visualRevision = game.visualRevision;
    }
    if (this.cosmeticEffectRun !== game || this.cosmeticEffectId !== game.cosmeticId || Number(game.distance || 0) < this.cosmeticEffectDistance) {
        this.cosmeticEffectTime = 0; this.cosmeticEffectRun = game; this.cosmeticEffectId = game.cosmeticId;
    }
    this.cosmeticEffectDistance = Number(game.distance || 0);
    if (game.phase === 'FLYING' || game.phase === 'LAUNCH') this.cosmeticEffectTime += Math.max(0, Math.min(.1, deltaTime || 0));
    const launching = game.phase === 'LAUNCH' || (game.phase === 'PAUSED' && game.pausedPhase === 'LAUNCH');
    const cosmeticDelta = game.launch?.reducedMotion && game.phase !== 'FLYING' ? 0 : deltaTime;
    if (game.stageId && game.stageId !== 'default') {
        if (!this.stageBackground) this.stageBackground = new StageBackground();
        if (this.stageRun !== game) { this.stageRun = game; this.stageTime = 0; this.stageBackground.reset(); }
        if ((game.phase === 'FLYING' || game.phase === 'LAUNCH') && !game.launch?.reducedMotion) this.stageTime += Math.max(0, Math.min(.1, deltaTime || 0));
        this.stageBackground.draw(this.ctx, game.stageId, this.width, this.height, this.stageTime, game.launch?.reducedMotion ? 0 : (game.distance || 0), this.lowPowerMode);
    } else this.drawBackground(game.speed, cosmeticDelta);
    if (game.phase === 'FLYING') this.drawSpeedLines(game.speed, deltaTime);
    if (!transformation && (launching || game.phase === 'READY')) this.drawLaunchBay(game.launch, game.phase === 'READY');
    // Atmospheric effects stay behind every collectible and threat.
    this.drawEffects(deltaTime);
    if (!transformation) this.drawCosmeticTrail(game, deltaTime);
    this.drawObstacles(game.obstacles);
    this.drawVillain(game.villain);
    this.drawCollectibles(game.collectibles);
    this.drawFuels(game.fuels);
    this.drawHealthPickups(game.healthPickups || []);
    this.drawPowerUps(game.powerUps);
    drawTransformationCapsule(this.ctx, game.transformationDirector?.capsule, game.launch?.reducedMotion);
    this.drawPlayerProjectiles(game.playerProjectiles, game.cosmeticId, game.launch?.reducedMotion);
    if (transformation) {
        if (transformation.phase !== 'ENTERING' || transformation.reducedMotion) {
            drawTransformationVehicle(this.ctx, transformation, game.cosmeticId, this.lowPowerMode, transformation.reducedMotion, game.shipType);
        }
    } else this.drawPlayer(game.player, game.shipType, game.ghostMode, game.activePowerUps, launching, game.hitProtection, game.cosmeticId);
    this.drawFloatingTexts(game.floatingTexts);
    // Incoming fire must survive overlapping auras, pickups and reward labels.
    this.drawProjectiles(game.projectiles);
    // The protected assembly is a foreground presentation, beneath the React HUD.
    drawTransformationCinematic(this.ctx, game, this.width, this.height, this.lowPowerMode);
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.width = width;
        this.height = height;
        // Re-init stars on resize to fill new space
        this.stars = [];
        resetCosmeticTrail(this.cosmeticTrail);
        this.stageBackground?.reset();
        this.initBackground();
    }

    drawCosmeticTrail(game, deltaTime) {
        if (!this.cosmeticTrail) this.cosmeticTrail = createCosmeticTrailState();
        const cosmetic = getCosmetic(game.cosmeticId);
        const points = advanceCosmeticTrail(this.cosmeticTrail, { game, cosmetic, deltaTime });
        if (cosmetic) drawCosmeticTrail(this.ctx, points, cosmetic, getCosmeticPalette(getShip(game.shipType).palette, cosmetic.id), this.lowPowerMode);
    }

    clear() {
        // Clear is handled by drawBackground which fills the screen
        // But we keep this for compatibility if needed or for partial clears
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    emitBurst(x, y, color = '#00ffff', count = 16, force = 220) {
        const available = Math.max(0, 32 - this.fxParticles.length);
        const density = this.lowPowerMode ? 0.16 : 0.24;
        const particleCount = Math.min(Math.max(3, Math.ceil(count * density)), available);
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = force * (0.35 + Math.random() * 0.65);
            this.fxParticles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.25 + Math.random() * 0.2, maxLife: 0.45, size: 1 + Math.random() * 1.5, color });
        }
        this.flash = Math.max(this.flash, 0.045);
    }

    drawSpeedLines(speed, deltaTime) {
        const intensity = Math.max(0, Math.min(1, (speed - 300) / 650));
        if (intensity <= 0.02) return;
        this.ctx.save();
        this.ctx.strokeStyle = `rgba(80, 220, 255, ${0.018 + intensity * 0.055})`;
        this.ctx.lineWidth = 0.7 + intensity;
        const lineCount = this.lowPowerMode ? 2 : 3;
        const now = (this.cosmeticEffectTime || 0) * 1000;
        for (let i = 0; i < lineCount; i++) {
            const y = ((i * 83 + now * (0.04 + intensity * 0.08)) % this.height);
            const x = (i * 197 + now * 0.35 * intensity) % this.width;
            const length = 25 + intensity * 140;
            this.ctx.beginPath();
            this.ctx.moveTo(x, y);
            this.ctx.lineTo(x - length, y);
            this.ctx.stroke();
        }
        this.ctx.restore();
        this.flash = Math.max(0, this.flash - deltaTime);
    }

    drawEffects(deltaTime) {
        this.ctx.save();
        this.fxParticles.forEach(particle => {
            particle.life -= deltaTime;
            particle.x += particle.vx * deltaTime;
            particle.y += particle.vy * deltaTime;
            particle.vx *= 0.96;
            particle.vy *= 0.96;
            const alpha = Math.max(0, particle.life / particle.maxLife);
            this.ctx.globalAlpha = alpha * 0.45;
            this.ctx.fillStyle = particle.color;
            this.ctx.shadowBlur = 0;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;
        this.fxParticles = this.fxParticles.filter(particle => particle.life > 0);

        if (this.flash > 0) {
            this.ctx.fillStyle = `rgba(255,255,255,${Math.min(0.045, this.flash)})`;
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.flash = Math.max(0, this.flash - deltaTime);
        }

        if (this.vignetteCanvas) this.ctx.drawImage(this.vignetteCanvas, 0, 0);
        this.ctx.restore();
    }

    buildStaticLayers() {
        this.backgroundCanvas = document.createElement('canvas');
        this.backgroundCanvas.width = this.width;
        this.backgroundCanvas.height = this.height;
        const backgroundContext = this.backgroundCanvas.getContext('2d');
        const backgroundGradient = backgroundContext.createLinearGradient(0, 0, 0, this.height);
        backgroundGradient.addColorStop(0, '#02030a');
        backgroundGradient.addColorStop(0.55, '#040617');
        backgroundGradient.addColorStop(1, '#080b20');
        backgroundContext.fillStyle = backgroundGradient;
        backgroundContext.fillRect(0, 0, this.width, this.height);

        this.vignetteCanvas = document.createElement('canvas');
        this.vignetteCanvas.width = this.width;
        this.vignetteCanvas.height = this.height;
        const vignetteContext = this.vignetteCanvas.getContext('2d');
        const vignette = vignetteContext.createRadialGradient(this.width / 2, this.height / 2, this.height * 0.22, this.width / 2, this.height / 2, this.width * 0.68);
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, 'rgba(0,0,10,0.22)');
        vignetteContext.fillStyle = vignette;
        vignetteContext.fillRect(0, 0, this.width, this.height);
    }

    initBackground() {
        const pixelLoad = this.width * this.height;
        this.lowPowerMode = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || pixelLoad > 1800000;
        this.buildStaticLayers();

        this.stars = [];
        const starCount = this.lowPowerMode ? 38 : 62;
        for (let i = 0; i < starCount; i++) {
            this.stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                size: Math.random() * 0.65 + 0.35,
                z: Math.random() * 2 + 0.5, // Depth factor (0.5 = far, 2.5 = close)
                alpha: Math.random() * 0.12 + 0.08,
                twinkleOffset: Math.random() * Math.PI * 2
            });
        }

        // Create 2 Planets/Galaxies in background
        this.planets = [];
        const planetTypes = ['MARS', 'JUPITER', 'SATURN', 'EARTH', 'NEPTUNE'];

        for (let i = 0; i < 2; i++) {
            const type = planetTypes[Math.floor(Math.random() * planetTypes.length)];
            // Size based on type roughly
            let radius = 40;
            if (type === 'JUPITER' || type === 'SATURN') radius = 100 + Math.random() * 40;
            else if (type === 'NEPTUNE') radius = 70 + Math.random() * 20;
            else radius = 40 + Math.random() * 20; // Earth/Mars

            this.planets.push({
                x: (i * this.width) + Math.random() * 500,
                y: Math.random() * this.height,
                radius: radius,
                type: type,
                opacity: 0.18
            });
        }
    }

    drawBackground(speed, deltaTime) {
        this.ctx.drawImage(this.backgroundCanvas, 0, 0);

        // Draw Stars (Parallax)
        this.ctx.fillStyle = '#a6bccd';
        this.stars.forEach(star => {
            // Move star based on depth (z)
            // Closer stars (higher z) move faster
            star.x -= (speed * 0.2 * star.z) * deltaTime;

            // Wrap around
            if (star.x < 0) {
                star.x = this.width;
                star.y = Math.random() * this.height;
            }

            this.ctx.globalAlpha = star.alpha;
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size * (star.z * 0.5), 0, Math.PI * 2); // Size also affected by depth
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1.0;

        // Update and Draw Planets (scroll with game world)
        this.planets.forEach(planet => {
            // Move at game speed (like obstacles)
            planet.x -= speed * deltaTime * 0.12; // Distant scenery moves slowly

            // Respawn when off-screen left
            if (planet.x + planet.radius < -200) {
                planet.x = this.width + Math.random() * 2000 + 500; // Less appearing (large gap)
                planet.y = Math.random() * this.height;

                const planetTypes = ['MARS', 'JUPITER', 'SATURN', 'EARTH', 'NEPTUNE'];
                planet.type = planetTypes[Math.floor(Math.random() * planetTypes.length)];

                if (planet.type === 'JUPITER' || planet.type === 'SATURN') planet.radius = 100 + Math.random() * 40;
                else if (planet.type === 'NEPTUNE') planet.radius = 70 + Math.random() * 20;
                else planet.radius = 40 + Math.random() * 20;
            }

            this.ctx.save();
            this.ctx.translate(planet.x, planet.y);
            this.ctx.globalAlpha = planet.opacity || 0.18;

            // Common Shadow/Glow
            this.ctx.shadowBlur = 0;

            if (planet.type === 'MARS') {
                this.ctx.shadowColor = '#ff4400';
                this.ctx.fillStyle = '#526478'; // Rusty Red
                this.ctx.beginPath();
                this.ctx.arc(0, 0, planet.radius, 0, Math.PI * 2);
                this.ctx.fill();

                // Craters
                this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
                this.ctx.beginPath();
                this.ctx.arc(-planet.radius * 0.3, -planet.radius * 0.2, planet.radius * 0.15, 0, Math.PI * 2);
                this.ctx.arc(planet.radius * 0.4, planet.radius * 0.4, planet.radius * 0.1, 0, Math.PI * 2);
                this.ctx.fill();

            } else if (planet.type === 'JUPITER') {
                this.ctx.shadowColor = '#566b7e';

                // Base
                const grad = this.ctx.createLinearGradient(0, -planet.radius, 0, planet.radius);
                grad.addColorStop(0, '#566b7e');
                grad.addColorStop(0.3, '#738396');
                grad.addColorStop(0.5, '#566b7e');
                grad.addColorStop(0.7, '#738396');
                grad.addColorStop(1, '#566b7e');
                this.ctx.fillStyle = grad;

                this.ctx.beginPath();
                this.ctx.arc(0, 0, planet.radius, 0, Math.PI * 2);
                this.ctx.fill();

                // Great Red Spot
                this.ctx.fillStyle = 'rgba(165, 42, 42, 0.6)';
                this.ctx.beginPath();
                this.ctx.ellipse(planet.radius * 0.3, planet.radius * 0.2, planet.radius * 0.25, planet.radius * 0.15, 0, 0, Math.PI * 2);
                this.ctx.fill();

            } else if (planet.type === 'SATURN') {
                this.ctx.shadowColor = '#7e8d9d';

                // Rings (Draw first to be behind top half, but we do simple overlay)
                this.ctx.strokeStyle = 'rgba(126, 141, 157, 0.4)';
                this.ctx.lineWidth = planet.radius * 0.4;
                this.ctx.beginPath();
                this.ctx.ellipse(0, 0, planet.radius * 1.8, planet.radius * 0.5, -0.2, 0, Math.PI * 2);
                this.ctx.stroke();

                // Planet Body
                this.ctx.fillStyle = '#7e8d9d'; // Pale Gold
                this.ctx.beginPath();
                this.ctx.arc(0, 0, planet.radius, 0, Math.PI * 2);
                this.ctx.fill();

                // Ring Shadow on Planet
                this.ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                this.ctx.lineWidth = 4;
                this.ctx.beginPath();
                this.ctx.moveTo(-planet.radius, 0);
                this.ctx.quadraticCurveTo(0, planet.radius * 0.3, planet.radius, 0);
                this.ctx.stroke();

            } else if (planet.type === 'EARTH') {
                this.ctx.shadowColor = '#4cc9f0';

                // Ocean
                this.ctx.fillStyle = '#41647b';
                this.ctx.beginPath();
                this.ctx.arc(0, 0, planet.radius, 0, Math.PI * 2);
                this.ctx.fill();

                // Continents (Green blobs)
                this.ctx.fillStyle = '#69838b';
                this.ctx.beginPath();
                this.ctx.arc(-planet.radius * 0.4, -planet.radius * 0.3, planet.radius * 0.3, 0, Math.PI * 2);
                this.ctx.arc(planet.radius * 0.5, planet.radius * 0.2, planet.radius * 0.25, 0, Math.PI * 2);
                this.ctx.fill();

                // Clouds
                this.ctx.fillStyle = 'rgba(255,255,255,0.4)';
                this.ctx.beginPath();
                this.ctx.arc(0, -planet.radius * 0.4, planet.radius * 0.2, 0, Math.PI * 2);
                this.ctx.fill();

            } else if (planet.type === 'NEPTUNE') {
                this.ctx.shadowColor = '#4b607e';
                this.ctx.fillStyle = '#4b607e'; // Deep Blue
                this.ctx.beginPath();
                this.ctx.arc(0, 0, planet.radius, 0, Math.PI * 2);
                this.ctx.fill();

                // Dark Storm
                this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
                this.ctx.beginPath();
                this.ctx.ellipse(-planet.radius * 0.2, -planet.radius * 0.1, planet.radius * 0.2, planet.radius * 0.1, 0, 0, Math.PI * 2);
                this.ctx.fill();
            }

            // Atmosphere Glow (Rim Light)
            this.ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, planet.radius, 0, Math.PI * 2);
            this.ctx.stroke();

            this.ctx.restore();
        });
    }

    drawPlayer(player, shipType = 'default', ghostMode = false, activePowerUps = [], launchEngines = false, hitProtection = 0, cosmeticId = null) {
        this.ctx.save();
        this.ctx.translate(player.x, player.y);
        this.ctx.rotate(player.rotation * Math.PI / 180);

        if (hitProtection > 0) {
            this.ctx.save();
            this.ctx.strokeStyle = '#ffd369';
            this.ctx.lineWidth = 2;
            this.ctx.globalAlpha = .65;
            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, 37, 27, 0, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.restore();
        }

        // 1. Ghost Mode Effect (Ethereal Glow)
        if (ghostMode) {
            this.ctx.globalAlpha = 0.6;
            this.ctx.shadowBlur = 3;
            this.ctx.shadowColor = '#00ff88';
        }

        const time = this.cosmeticEffectTime || 0;
        const hasPower = type => activePowerUps.some(p => p.type === type);
        if (hasPower('NEON_BLAZE')) {
            this.ctx.save();
            this.ctx.fillStyle = '#c6b7f5';
            for (let i = 0; i < 3; i++) {
                this.ctx.globalAlpha = 0.16 - i * 0.04;
                this.ctx.beginPath();
                this.ctx.ellipse(-25 - i * 12, 0, 13, 7 - i, 0, 0, Math.PI * 2);
                this.ctx.fill();
            }
            this.ctx.restore();
        }
        if (hasPower('SHIELD')) {
            this.ctx.save();
            this.ctx.strokeStyle = '#a2dfed';
            this.ctx.lineWidth = 1.5;
            this.ctx.globalAlpha = 0.65;
            this.ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = Math.PI / 3 * i;
                const x = Math.cos(angle) * 39, y = Math.sin(angle) * 31;
                if (i === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            }
            this.ctx.closePath();
            this.ctx.stroke();
            this.ctx.restore();
        }
        if (hasPower('TIME_SLOW') || hasPower('MAGNET')) {
            this.ctx.save();
            this.ctx.strokeStyle = hasPower('TIME_SLOW') ? '#c6b7f5' : '#b7dcb7';
            this.ctx.lineWidth = 1.5;
            this.ctx.globalAlpha = 0.45;
            for (let i = 0; i < 2; i++) {
                this.ctx.beginPath();
                const angle = time * 0.6 + i * Math.PI;
                this.ctx.arc(0, 0, 35 + i * 5, angle, angle + 1.1);
                this.ctx.stroke();
            }
            this.ctx.restore();
        }
        if (hasPower('RAPID_FIRE')) {
            this.ctx.save();
            this.ctx.fillStyle = FRIENDLY;
            this.ctx.globalAlpha = 0.5;
            this.ctx.fillRect(26, -3, 6, 6);
            this.ctx.restore();
        }

        // The garage and flight renderer share the same silhouettes, palettes and engines.
        // Keep world-space physics/collisions unchanged; fit art around the existing hull.
        this.ctx.save();
        this.ctx.scale(0.18, 0.18);
        this.ctx.translate(-160, -120);
        drawShipArt(this.ctx, shipType, {
            boosting: player.isBoosting || launchEngines,
            time,
            cosmeticId,
            lowPower: this.lowPowerMode,
        });
        this.ctx.restore();

        this.ctx.restore();
    }

    drawObstacles(obstacles) {
        obstacles.forEach(obs => {
            const ctx = this.ctx;
            ctx.save();
            ctx.translate(obs.x, obs.y);
            ctx.fillStyle = '#302d3d';
            ctx.fillRect(0, 0, obs.width, obs.height);
            ctx.strokeStyle = INK;
            ctx.lineWidth = 6;
            ctx.strokeRect(0, 0, obs.width, obs.height);
            ctx.strokeStyle = '#e9778b';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, obs.width, obs.height);
            // Repeated edge notches signal a solid hazard without glowing circuitry.
            ctx.fillStyle = '#d47b89';
            for (let y = 8; y < obs.height - 4; y += 18) ctx.fillRect(0, y, 7, 5);
            ctx.restore();
        });
    }

    drawCollectibles(collectibles) {
        collectibles.forEach(col => {
            const ctx = this.ctx;
            ctx.save();
            ctx.translate(col.x, col.y);
            ctx.beginPath();
            ctx.arc(0, 0, col.radius, 0, Math.PI * 2);
            outlinedShape(ctx, COIN, '#fff1b0');
            ctx.strokeStyle = '#a96e27';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, 0, col.radius - 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#493214';
            ctx.font = col.value === 10000 ? '900 8px Arial' : '900 11px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(col.value), 0, 1);
            if (col.value === 10000) {
                ctx.beginPath();
                ctx.arc(0, 0, col.radius + 2, 0, Math.PI * 2);
                ctx.strokeStyle = '#fff1b0';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            ctx.restore();
        });
    }

    drawLaunchBay(launch, ready) {
        const ctx = this.ctx;
        const progress = ready ? 1 : Math.min(1, (launch?.elapsed || 0) / (launch?.duration || 1));
        const reducedMotion = launch?.reducedMotion;
        const opening = reducedMotion ? 1 : 1 - Math.pow(1 - progress, 3);
        const offset = reducedMotion ? -160 : -opening * 160;
        const center = this.height * 0.45;
        ctx.save();
        ctx.translate(offset, 0);
        ctx.globalAlpha = ready ? 0.55 : 1;
        ctx.fillStyle = '#10283a';
        ctx.fillRect(0, 0, 205, center - 65 - opening * 35);
        ctx.fillRect(0, center + 65 + opening * 35, 205, this.height);
        ctx.fillStyle = '#1d4555';
        ctx.fillRect(188, 0, 17, center - 65 - opening * 35);
        ctx.fillRect(188, center + 65 + opening * 35, 17, this.height);
        ctx.strokeStyle = '#77e7d2';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, center - 65 - opening * 35);
        ctx.lineTo(205, center - 65 - opening * 35);
        ctx.moveTo(0, center + 65 + opening * 35);
        ctx.lineTo(205, center + 65 + opening * 35);
        ctx.stroke();
        // A pair of doors retracts vertically as the selected ship leaves its bay.
        if (!ready && !reducedMotion) {
            ctx.fillStyle = '#234957';
            ctx.fillRect(180, center - 65 - opening * 130, 25, 65);
            ctx.fillRect(180, center + opening * 130, 25, 65);
            ctx.fillStyle = '#ffc960';
            for (let i = 0; i < 5; i++) {
                ctx.fillRect(181, center - 55 - opening * 130 + i * 12, 23, 4);
                ctx.fillRect(181, center + 8 + opening * 130 + i * 12, 23, 4);
            }
        }
        ctx.restore();
    }

    drawFuels(fuels) {
        fuels.forEach(fuel => {
            const ctx = this.ctx;
            ctx.save();
            // Match the existing top-left collision rectangle; handle stays inside it.
            ctx.translate(fuel.x + fuel.width / 2, fuel.y + fuel.height / 2);
            ctx.beginPath();
            ctx.roundRect(-11, -8, 22, 21, 3);
            outlinedShape(ctx, FUEL, '#f9ffcf');
            ctx.strokeStyle = INK;
            ctx.lineWidth = 6;
            ctx.strokeRect(-7, -14, 12, 6);
            ctx.strokeStyle = FUEL;
            ctx.lineWidth = 3;
            ctx.strokeRect(-7, -14, 12, 6);
            ctx.fillStyle = '#9bb85b';
            ctx.fillRect(-10, 7, 20, 4);
            ctx.fillStyle = '#29391e';
            ctx.font = '900 15px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('F', 0, 2);
            ctx.restore();
        });
    }

    drawHealthPickups(pickups) {
        const ctx = this.ctx;
        pickups.forEach(pickup => {
            if (pickup.markedForDeletion) return;
            ctx.save();
            ctx.translate(pickup.x, pickup.y);
            ctx.beginPath();
            ctx.roundRect(0, 0, pickup.width, pickup.height, 8);
            outlinedShape(ctx, '#2f9b6a', '#b5f4cc', 2);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(13, 6, 6, 20);
            ctx.fillRect(6, 13, 20, 6);
            ctx.restore();
        });
    }

    drawPowerUps(powerUps) {
        powerUps.forEach(power => {
            const ctx = this.ctx;
            ctx.save();
            ctx.translate(power.x + power.width / 2, power.y + power.height / 2);
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = Math.PI / 3 * i;
                const x = Math.cos(angle) * 16, y = Math.sin(angle) * 16;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.closePath();
            outlinedShape(ctx, '#172b3c', '#b6cbdc');
            ctx.fillStyle = power.color;
            ctx.fillRect(-5, 10, 10, 2);
            ctx.strokeStyle = '#edf7ff';
            ctx.fillStyle = '#edf7ff';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            switch (power.type) {
                case 'SHIELD':
                    ctx.moveTo(-6, -7); ctx.lineTo(6, -7); ctx.lineTo(5, 2);
                    ctx.lineTo(0, 7); ctx.lineTo(-5, 2); ctx.closePath(); ctx.stroke();
                    break;
                case 'TIME_SLOW':
                    ctx.arc(0, -1, 7, 0, Math.PI * 2); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, -1); ctx.lineTo(4, 1); ctx.stroke();
                    break;
                case 'MAGNET':
                    ctx.moveTo(-6, -7); ctx.lineTo(-6, 1); ctx.quadraticCurveTo(0, 10, 6, 1); ctx.lineTo(6, -7); ctx.stroke();
                    ctx.fillRect(-7, -7, 3, 4); ctx.fillRect(4, -7, 3, 4);
                    break;
                case 'RAPID_FIRE':
                    ctx.moveTo(2, -8); ctx.lineTo(-5, 0); ctx.lineTo(0, 0);
                    ctx.lineTo(-2, 7); ctx.lineTo(6, -2); ctx.lineTo(1, -2); ctx.closePath(); ctx.fill();
                    break;
                case 'GHOST_MODE':
                    ctx.arc(0, -2, 6, Math.PI, 0); ctx.lineTo(6, 6);
                    ctx.lineTo(2, 3); ctx.lineTo(0, 6); ctx.lineTo(-3, 3); ctx.lineTo(-6, 6); ctx.closePath(); ctx.stroke();
                    ctx.fillRect(-3, -2, 2, 2); ctx.fillRect(2, -2, 2, 2);
                    break;
                default:
                    // A flame for Neon Blaze; never an unlabeled glowing orb.
                    ctx.moveTo(0, -9); ctx.quadraticCurveTo(9, 0, 5, 5);
                    ctx.quadraticCurveTo(0, 10, -5, 5); ctx.quadraticCurveTo(-9, 0, -2, -4);
                    ctx.lineTo(-1, 1); ctx.closePath(); ctx.stroke();
            }
            ctx.restore();
        });
    }

    drawVillain(villain) {
        if (!villain) return;

        this.ctx.save();
        this.ctx.translate(villain.x, villain.y);

        if (villain.type === 'SPEEDSTER') {
            // SPEEDSTER: Aggressive Racer
            this.ctx.shadowBlur = 3;
            this.ctx.shadowColor = '#ff0000';

            // Engine Trail
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            this.ctx.beginPath();
            this.ctx.moveTo(40, 0);
            this.ctx.lineTo(80 + Math.sin((this.cosmeticEffectTime || 0) * 28) * 10, 0);
            this.ctx.lineTo(40, 5);
            this.ctx.fill();

            // Main Body (Sharp, Jagged)
            const grad = this.ctx.createLinearGradient(-20, 0, 20, 0);
            grad.addColorStop(0, '#ff0000');
            grad.addColorStop(1, '#440000');
            this.ctx.fillStyle = villain.hitFlashTimer > 0 ? '#ffffff' : grad;

            this.ctx.beginPath();
            this.ctx.moveTo(-30, 0); // Nose
            this.ctx.lineTo(20, 15);
            this.ctx.lineTo(10, 0);
            this.ctx.lineTo(20, -15);
            this.ctx.closePath();
            outlinedShape(this.ctx, this.ctx.fillStyle, '#f3a0af');

            // Wings (Forward Swept)
            this.ctx.fillStyle = villain.hitFlashTimer > 0 ? '#ffffff' : '#aa0000';
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(10, 25);
            this.ctx.lineTo(-10, 10);
            this.ctx.lineTo(-10, -10);
            this.ctx.lineTo(10, -25);
            this.ctx.closePath();
            this.ctx.fill();

            // Cockpit/Eye
            this.ctx.fillStyle = '#ffff00';
            this.ctx.shadowColor = '#ffff00';
            this.ctx.beginPath();
            this.ctx.moveTo(-10, 0);
            this.ctx.lineTo(-5, 3);
            this.ctx.lineTo(-5, -3);
            this.ctx.fill();

        } else if (villain.type === 'JUGGERNAUT') {
            // JUGGERNAUT: Flying Fortress
            this.ctx.shadowBlur = 3;
            this.ctx.shadowColor = '#ff8800';

            // Main Hull (Massive Block)
            const grad = this.ctx.createLinearGradient(-40, 0, 40, 0);
            grad.addColorStop(0, '#332200');
            grad.addColorStop(1, '#664400');
            this.ctx.fillStyle = villain.hitFlashTimer > 0 ? '#ffffff' : grad;

            this.ctx.beginPath();
            this.ctx.moveTo(-50, -20);
            this.ctx.lineTo(30, -30);
            this.ctx.lineTo(50, -10);
            this.ctx.lineTo(50, 10);
            this.ctx.lineTo(30, 30);
            this.ctx.lineTo(-50, 20);
            this.ctx.closePath();
            outlinedShape(this.ctx, this.ctx.fillStyle, '#e6a09e');

            // Heavy Armor Plates
            this.ctx.fillStyle = villain.hitFlashTimer > 0 ? '#ffffff' : '#885500';
            this.ctx.fillRect(-40, -25, 60, 8); // Top
            this.ctx.fillRect(-40, 17, 60, 8);  // Bottom
            this.ctx.fillRect(-55, -15, 15, 30); // Front Shield

            // Turrets
            this.ctx.fillStyle = '#aa6600';
            this.ctx.beginPath();
            this.ctx.arc(0, -20, 8, 0, Math.PI * 2);
            this.ctx.arc(0, 20, 8, 0, Math.PI * 2);
            this.ctx.fill();

            // Barrels
            this.ctx.strokeStyle = '#ffaa00';
            this.ctx.lineWidth = 4;
            this.ctx.beginPath();
            this.ctx.moveTo(0, -20);
            this.ctx.lineTo(-20, -25);
            this.ctx.moveTo(0, 20);
            this.ctx.lineTo(-20, 25);
            this.ctx.stroke();

            // Core (Glowing)
            this.ctx.fillStyle = '#ff4400';
            this.ctx.shadowColor = '#ff4400';
            this.ctx.beginPath();
            this.ctx.arc(10, 0, 6, 0, Math.PI * 2);
            this.ctx.fill();
        } else {
            // Default Villain: Crimson Striker
            this.ctx.shadowBlur = 3;
            this.ctx.shadowColor = '#ff0000';

            // Main Body - Aggressive Angular Shape
            const grad = this.ctx.createLinearGradient(20, 0, -20, 0);
            grad.addColorStop(0, '#613247');
            grad.addColorStop(1, '#38243a');
            this.ctx.fillStyle = villain.hitFlashTimer > 0 ? '#ffffff' : grad;

            this.ctx.beginPath();
            this.ctx.moveTo(30, 0);
            this.ctx.lineTo(-10, 25);
            this.ctx.lineTo(-5, 0);
            this.ctx.lineTo(-10, -25);
            this.ctx.closePath();
            outlinedShape(this.ctx, this.ctx.fillStyle, '#f3a0af');

            // Glowing Vents
            this.ctx.fillStyle = '#ff0000';
            this.ctx.shadowColor = '#ff0000';
            this.ctx.beginPath();
            this.ctx.moveTo(0, 5);
            this.ctx.lineTo(-15, 15);
            this.ctx.lineTo(-10, 5);
            this.ctx.fill();
            this.ctx.beginPath();
            this.ctx.moveTo(0, -5);
            this.ctx.lineTo(-15, -15);
            this.ctx.lineTo(-10, -5);
            this.ctx.fill();

            // Core
            this.ctx.fillStyle = '#ff3300';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 4, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Health Bar - Always show for all villains
        const maxHp = villain.type === 'JUGGERNAUT' ? 100 : (villain.type === 'SPEEDSTER' ? 40 : 20);
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(-30, -50, 60, 6);
        this.ctx.fillStyle = villain.type === 'SPEEDSTER' ? '#a855f7' : (villain.type === 'JUGGERNAUT' ? '#ff8800' : '#f00');
        this.ctx.fillRect(-30, -50, 60 * (villain.hp / maxHp), 6);

        this.ctx.restore();
    }

    drawProjectiles(projectiles) {
        projectiles.forEach(proj => {
            const ctx = this.ctx;
            ctx.save();
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
            ctx.shadowBlur = 0;
            ctx.translate(proj.x, proj.y);
            ctx.rotate(Math.atan2(proj.vy || 0, proj.vx ?? -1));
            const r = proj.radius;
            // Short directional tail stays behind the opaque body, opposite velocity.
            ctx.strokeStyle = 'rgba(255,98,125,0.22)';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(-r - 16, 0); ctx.stroke();
            ctx.beginPath();
            if (proj.type === 'SONIC_BLADE') {
                ctx.moveTo(0, -r);
                ctx.quadraticCurveTo(r * 1.5, 0, 0, r);
                ctx.quadraticCurveTo(r * 0.4, 0, 0, -r);
                ctx.closePath();
                outlinedShape(ctx, DANGER, DANGER_CORE);
            } else if (proj.type === 'FUSE') {
                for (let i = 0; i < 16; i++) {
                    const angle = i * Math.PI / 8;
                    const size = i % 2 ? r * 0.78 : r;
                    const x = Math.cos(angle) * size, y = Math.sin(angle) * size;
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.closePath();
                outlinedShape(ctx, '#b93258', DANGER);
                ctx.strokeStyle = DANGER_CORE; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(-3, -3); ctx.lineTo(3, 3);
                ctx.moveTo(3, -3); ctx.lineTo(-3, 3); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(-r + 1, -3); ctx.lineTo(-r - 4, -8); ctx.stroke();
            } else if (proj.target) {
                ctx.moveTo(r, 0); ctx.lineTo(-r * 0.7, -r * 0.6);
                ctx.lineTo(-r * 0.4, 0); ctx.lineTo(-r * 0.7, r * 0.6); ctx.closePath();
                outlinedShape(ctx, DANGER, DANGER_CORE);
            } else {
                ctx.moveTo(r, 0); ctx.lineTo(0, -r); ctx.lineTo(-r, 0);
                ctx.lineTo(0, r); ctx.closePath();
                outlinedShape(ctx, DANGER, DANGER_CORE);
            }
            if (proj.type !== 'FUSE') {
                ctx.fillStyle = DANGER_CORE;
                ctx.beginPath(); ctx.arc(proj.type === 'SONIC_BLADE' ? r * 0.6 : 0, 0, 2, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        });
    }

    drawPlayerProjectiles(projectiles, cosmeticId = null, reducedMotion = false) {
        projectiles.forEach(proj => {
            const ctx = this.ctx;
            const cosmetic = getCosmetic(cosmeticId || proj.cosmeticId);
            const shot = cosmetic?.colors.shot || FRIENDLY;
            if (cosmetic && Number.isFinite(proj.visualAge) && proj.visualAge >= 0 && proj.visualAge < .12) {
                ctx.save(); ctx.translate(proj.x + (proj.visualMuzzleOffset ?? -proj.speed * proj.visualAge), proj.y);
                drawCosmeticMuzzle(ctx, cosmetic, proj.visualAge); ctx.restore();
            }
            ctx.save();
            ctx.translate(proj.x, proj.y);
            if (proj.type === 'striker_missile') ctx.rotate(proj.angle);
            ctx.shadowBlur = 0;
            drawCosmeticShot(ctx, cosmetic, proj.visualAge ?? 1, this.lowPowerMode);
            ctx.strokeStyle = INK;
            ctx.lineWidth = 5;
            ctx.beginPath();
            switch (proj.type) {
                case 'volt_bolt':
                    drawVoltLightning(ctx,proj.visualAge || 0,this.lowPowerMode,reducedMotion);break;
                case 'striker_missile':
                    ctx.moveTo(13,0); ctx.lineTo(4,-5); ctx.lineTo(-8,-5); ctx.lineTo(-11,-8); ctx.lineTo(-11,8); ctx.lineTo(-8,5); ctx.lineTo(4,5); ctx.closePath();
                    outlinedShape(ctx, '#ffc181', '#fff0c5', 1.5);
                    ctx.beginPath(); ctx.moveTo(-12,0); ctx.lineTo(-23,0); ctx.strokeStyle='#ffbd74'; ctx.lineWidth=3; ctx.stroke(); break;
                case 'blaster':
                    ctx.moveTo(17, 0); ctx.lineTo(-6, -4); ctx.lineTo(-3, 0); ctx.lineTo(-6, 4); ctx.closePath();
                    outlinedShape(ctx, shot); break;
                case 'cannon':
                    ctx.arc(0, 0, 7, 0, Math.PI * 2); outlinedShape(ctx, cosmetic ? shot : '#b8d6ff');
                    ctx.strokeStyle = '#315d78'; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(-2, -3); ctx.lineTo(2, 0); ctx.lineTo(-2, 3); ctx.stroke(); break;
                case 'beam':
                    ctx.roundRect(-12, -2, 28, 4, 2); outlinedShape(ctx, cosmetic ? shot : '#d0f6ff', cosmetic ? '#ffffff' : FRIENDLY, 1); break;
                case 'wave':
                    ctx.arc(-3, 0, 7, -Math.PI / 2, Math.PI / 2);
                    ctx.stroke(); ctx.strokeStyle = cosmetic ? shot : FRIENDLY; ctx.lineWidth = 2; ctx.stroke(); break;
                case 'shock':
                    ctx.moveTo(-9, 0); ctx.lineTo(-4, -3); ctx.lineTo(1, 3); ctx.lineTo(7, -3); ctx.lineTo(12, 0);
                    ctx.stroke(); ctx.strokeStyle = cosmetic ? shot : '#bdf4f5'; ctx.lineWidth = 2; ctx.stroke(); break;
                default:
                    ctx.roundRect(-7, -2, 15, 4, 2); outlinedShape(ctx, shot, cosmetic ? '#ffffff' : '#c9f6ff', 1);
            }
            ctx.restore();
        });
    }

    drawFloatingTexts(texts) {
        // Bound labels during dense coin trails; important damage/fuel notices come last.
        const rewards = texts.filter(text => text.text.trim().startsWith('+ $')).slice(-3);
        const notices = texts.filter(text => !text.text.trim().startsWith('+ $')).slice(-3);
        [...rewards, ...notices].forEach((text, index) => {
            const ctx = this.ctx;
            ctx.save();
            ctx.translate(text.x, text.y - 20 - (index % 3) * 8);
            ctx.globalAlpha = Math.max(0, Math.min(1, text.life * 2));
            ctx.font = text.text.includes('HP') ? '900 15px Arial' : '800 13px Arial';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.shadowBlur = 0;
            ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineJoin = 'round';
            ctx.strokeText(text.text, 0, 0);
            ctx.fillStyle = text.color || '#edf5ff';
            ctx.fillText(text.text, 0, 0);
            ctx.restore();
        });
    }
}
