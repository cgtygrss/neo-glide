export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;

        // Initialize Starfield
        this.stars = [];
        this.planets = [];
        this.initBackground();
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.width = width;
        this.height = height;
        // Re-init stars on resize to fill new space
        this.stars = [];
        this.initBackground();
    }

    clear() {
        // Clear is handled by drawBackground which fills the screen
        // But we keep this for compatibility if needed or for partial clears
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    initBackground() {
        // Create 200 stars with depth
        this.stars = [];
        for (let i = 0; i < 200; i++) {
            this.stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                size: Math.random() * 1.5 + 0.5,
                z: Math.random() * 2 + 0.5, // Depth factor (0.5 = far, 2.5 = close)
                alpha: Math.random()
            });
        }

        // Create Nebulas
        this.nebulas = [];
        for (let i = 0; i < 5; i++) {
            this.nebulas.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                radius: 200 + Math.random() * 300,
                color: `hsla(${Math.random() * 360}, 60%, 50%, 0.1)`,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10
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
                opacity: 0.8 // Higher opacity for visibility
            });
        }
    }

    drawBackground(speed, deltaTime) {
        // Deep Space Gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, '#000005'); // Pitch black
        gradient.addColorStop(1, '#0a0a2a'); // Deep midnight blue
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Draw Nebulas
        this.ctx.save();
        if (this.nebulas) {
            this.nebulas.forEach(neb => {
                neb.x -= (speed * 0.05 + neb.vx) * deltaTime; // Move slowly
                if (neb.x + neb.radius < 0) neb.x = this.width + neb.radius;

                const grad = this.ctx.createRadialGradient(neb.x, neb.y, 0, neb.x, neb.y, neb.radius);
                grad.addColorStop(0, neb.color);
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                this.ctx.fillStyle = grad;
                this.ctx.fillRect(0, 0, this.width, this.height);
            });
        }
        this.ctx.restore();

        // Draw Stars (Parallax)
        this.ctx.fillStyle = '#ffffff';
        this.stars.forEach(star => {
            // Move star based on depth (z)
            // Closer stars (higher z) move faster
            star.x -= (speed * 0.2 * star.z) * deltaTime;

            // Wrap around
            if (star.x < 0) {
                star.x = this.width;
                star.y = Math.random() * this.height;
            }

            // Twinkle
            star.alpha += (Math.random() - 0.5) * 2 * deltaTime;
            if (star.alpha < 0.1) star.alpha = 0.1;
            if (star.alpha > 1) star.alpha = 1;

            this.ctx.globalAlpha = star.alpha;
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size * (star.z * 0.5), 0, Math.PI * 2); // Size also affected by depth
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1.0;

        // Update and Draw Planets (scroll with game world)
        this.planets.forEach(planet => {
            // Move at game speed (like obstacles)
            planet.x -= speed * deltaTime * 0.5; // Parallax speed for planets

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
            this.ctx.globalAlpha = planet.opacity || 0.8;

            // Common Shadow/Glow
            this.ctx.shadowBlur = 20;

            if (planet.type === 'MARS') {
                this.ctx.shadowColor = '#ff4400';
                this.ctx.fillStyle = '#c1440e'; // Rusty Red
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
                this.ctx.shadowColor = '#d4a373';

                // Base
                const grad = this.ctx.createLinearGradient(0, -planet.radius, 0, planet.radius);
                grad.addColorStop(0, '#d4a373');
                grad.addColorStop(0.3, '#e9c46a');
                grad.addColorStop(0.5, '#d4a373');
                grad.addColorStop(0.7, '#e9c46a');
                grad.addColorStop(1, '#d4a373');
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
                this.ctx.shadowColor = '#f4e4ba';

                // Rings (Draw first to be behind top half, but we do simple overlay)
                this.ctx.strokeStyle = 'rgba(244, 228, 186, 0.6)';
                this.ctx.lineWidth = planet.radius * 0.4;
                this.ctx.beginPath();
                this.ctx.ellipse(0, 0, planet.radius * 1.8, planet.radius * 0.5, -0.2, 0, Math.PI * 2);
                this.ctx.stroke();

                // Planet Body
                this.ctx.fillStyle = '#f4e4ba'; // Pale Gold
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
                this.ctx.fillStyle = '#1e6091';
                this.ctx.beginPath();
                this.ctx.arc(0, 0, planet.radius, 0, Math.PI * 2);
                this.ctx.fill();

                // Continents (Green blobs)
                this.ctx.fillStyle = '#52b788';
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
                this.ctx.shadowColor = '#4361ee';
                this.ctx.fillStyle = '#4361ee'; // Deep Blue
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

    drawPlayer(player, shipType = 'default', ghostMode = false, activePowerUps = [], collectibles = []) {
        this.ctx.save();
        this.ctx.translate(player.x, player.y);
        this.ctx.rotate(player.rotation * Math.PI / 180);

        // 1. Ghost Mode Effect (Ethereal Glow)
        if (ghostMode) {
            this.ctx.globalAlpha = 0.6;
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = '#00ff88';
        }

        // 2. Neon Blaze Effect (Fiery Comet Trail)
        const hasNeonBlaze = activePowerUps.some(p => p.type === 'NEON_BLAZE');
        if (hasNeonBlaze) {
            const time = Date.now() / 100;
            // Draw trail behind
            for (let i = 0; i < 5; i++) {
                this.ctx.save();
                this.ctx.translate(-20 - (i * 10), 0); // Move back
                this.ctx.scale(1 - (i * 0.15), 1 - (i * 0.15)); // Shrink
                this.ctx.globalAlpha = (0.5 - (i * 0.1)) * 0.8;

                const hue = (Date.now() / 5 + i * 20) % 360;
                this.ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
                this.ctx.shadowBlur = 20;
                this.ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;

                this.ctx.beginPath();
                this.ctx.arc(0, Math.sin(time + i) * 5, 15, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.restore();
            }
        }

        // 3. Shield Effect (Hexagonal Energy Grid)
        const hasShield = activePowerUps.some(p => p.type === 'SHIELD');
        if (hasShield) {
            const time = Date.now() / 1000;
            this.ctx.save();
            this.ctx.strokeStyle = '#00ffff';
            this.ctx.lineWidth = 1.5;
            this.ctx.shadowBlur = 5;
            this.ctx.shadowColor = '#00ffff';

            // Rotate the grid
            this.ctx.rotate(time * 0.5);

            // Draw Hexagon
            this.ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i;
                const r = 55 + Math.sin(time * 5 + i) * 2; // Pulsing radius
                this.ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
            }
            this.ctx.closePath();
            this.ctx.stroke();

            // Inner Hexagon (Opposite rotation)
            this.ctx.rotate(-time);
            this.ctx.globalAlpha = 0.5;
            this.ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i;
                const r = 45;
                this.ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
            }
            this.ctx.closePath();
            this.ctx.stroke();
            this.ctx.restore();
        }

        // 4. Time Slow Effect (Chromatic Echo)
        const hasTimeSlow = activePowerUps.some(p => p.type === 'TIME_SLOW');
        if (hasTimeSlow) {
            // Draw echoes BEFORE the main ship (so they are behind)
            // We need to draw the ship shape multiple times. 
            // Since we are inside drawPlayer, we can't easily call "drawShipShape" without refactoring.
            // Instead, we'll draw some "digital glitch" particles around the ship.

            const time = Date.now() / 200;
            this.ctx.save();
            this.ctx.globalCompositeOperation = 'lighter';

            // Digital particles
            for (let i = 0; i < 5; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = 30 + Math.random() * 20;
                const x = Math.cos(angle) * dist;
                const y = Math.sin(angle) * dist;

                this.ctx.fillStyle = i % 2 === 0 ? '#00ff00' : '#ff00ff'; // Matrix/Glitch colors
                this.ctx.globalAlpha = Math.random() * 0.5;
                this.ctx.fillRect(x, y, Math.random() * 4 + 2, Math.random() * 4 + 2);
            }

            // Chromatic Aberration Rings
            this.ctx.lineWidth = 2;
            this.ctx.globalAlpha = 0.3;

            this.ctx.strokeStyle = '#ff0000'; // Red shift
            this.ctx.beginPath();
            this.ctx.arc(Math.random() * 4 - 2, Math.random() * 4 - 2, 40, 0, Math.PI * 2);
            this.ctx.stroke();

            this.ctx.strokeStyle = '#0000ff'; // Blue shift
            this.ctx.beginPath();
            this.ctx.arc(Math.random() * 4 - 2, Math.random() * 4 - 2, 40, 0, Math.PI * 2);
            this.ctx.stroke();

            this.ctx.restore();
        }

        // 5. Magnet Effect (Electric Arcs)
        const hasMagnet = activePowerUps.some(p => p.type === 'MAGNET');
        if (hasMagnet) {
            this.ctx.save();
            this.ctx.strokeStyle = '#ffff00';
            this.ctx.lineWidth = 2;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = '#ffff00';
            this.ctx.lineCap = 'round';

            // Find nearby collectibles to arc to
            // Note: collectibles are in world space, we are in player local space (translated & rotated)
            // We need to transform coin positions to local space OR draw arcs in world space before this function.
            // Drawing in local space is easier if we inverse transform the coin pos.
            // Actually, let's just draw "seeking" arcs that point roughly towards coins or just random arcs if none close.

            // Simplified: Random electric arcs around ship
            const time = Date.now();
            const numArcs = 3;

            for (let i = 0; i < numArcs; i++) {
                if (Math.random() > 0.3) continue; // Flicker

                this.ctx.beginPath();
                this.ctx.moveTo(0, 0);

                let cx = 0, cy = 0;
                // Jagged line
                for (let j = 0; j < 5; j++) {
                    const angle = (time / 200) + (i * (Math.PI * 2 / numArcs)) + (Math.random() - 0.5);
                    const dist = (j + 1) * 10;
                    cx = Math.cos(angle) * dist + (Math.random() - 0.5) * 5;
                    cy = Math.sin(angle) * dist + (Math.random() - 0.5) * 5;
                    this.ctx.lineTo(cx, cy);
                }
                this.ctx.stroke();
            }
            this.ctx.restore();
        }

        // 6. Rapid Fire Effect (Muzzle Flash & Overheat Glow)
        const hasRapidFire = activePowerUps.some(p => p.type === 'RAPID_FIRE');
        if (hasRapidFire) {
            const time = Date.now() / 50;
            this.ctx.save();

            // Overheat Glow
            this.ctx.shadowBlur = 30;
            this.ctx.shadowColor = '#ff4400';
            this.ctx.fillStyle = `rgba(255, 100, 0, ${0.3 + Math.sin(time / 5) * 0.2})`;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 35, 0, Math.PI * 2);
            this.ctx.fill();

            // Muzzle Flashes (Fast flickering at front)
            if (Math.random() > 0.5) {
                this.ctx.fillStyle = '#ffff00';
                this.ctx.beginPath();
                // Front of ship is roughly x=30
                this.ctx.arc(35, 0, 8 + Math.random() * 5, 0, Math.PI * 2);
                this.ctx.fill();

                // Side sparks
                this.ctx.strokeStyle = '#ffaa00';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(30, 0);
                this.ctx.lineTo(45, Math.random() * 10 - 5);
                this.ctx.stroke();
            }

            this.ctx.restore();
        }

        // Determine Boost Color based on Ship Type
        let boostColor = '#ff0055'; // Default Red/Pink
        switch (shipType) {
            case 'interceptor': boostColor = '#ffaa00'; break; // Orange
            case 'cruiser': boostColor = '#ff4400'; break; // Red-Orange
            case 'stealth': boostColor = '#0088ff'; break; // Blue
            case 'void_runner': boostColor = '#a855f7'; break; // Purple
            case 'plasma_breaker': boostColor = '#00ff00'; break; // Green
        }

        // Advanced Engine Effect
        if (player.isBoosting) {
            // 1. Shockwave Rings (Pulsating)
            const time = Date.now() / 100;
            const ringSize = (time % 10) * 2;
            const ringAlpha = 1 - ((time % 10) / 10);

            this.ctx.strokeStyle = boostColor;
            this.ctx.globalAlpha = ringAlpha * 0.5;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(-20, 0, 10 + ringSize, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.globalAlpha = 1.0;

            // 2. Multi-layered Flame
            // Outer Glow
            this.ctx.shadowBlur = 30;
            this.ctx.shadowColor = boostColor;

            // Inner Core (White Hot)
            const grad = this.ctx.createLinearGradient(-15, 0, -60, 0);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.2, boostColor);
            grad.addColorStop(1, 'rgba(0,0,0,0)');

            this.ctx.fillStyle = grad;
            this.ctx.beginPath();
            this.ctx.moveTo(-15, 0);
            this.ctx.lineTo(-50 - Math.random() * 10, 8); // Flicker effect
            this.ctx.lineTo(-50 - Math.random() * 10, -8);
            this.ctx.closePath();
            this.ctx.fill();
        }

        switch (shipType) {
            case 'interceptor': {
                // INTERCEPTOR: High-Speed Fighter
                this.ctx.shadowBlur = 20;
                this.ctx.shadowColor = '#ffaa00';

                // Engine Flares
                this.ctx.fillStyle = '#ffaa00';
                this.ctx.beginPath();
                this.ctx.moveTo(-15, 8);
                this.ctx.lineTo(-35 - Math.random() * 10, 12);
                this.ctx.lineTo(-15, 16);
                this.ctx.fill();
                this.ctx.beginPath();
                this.ctx.moveTo(-15, -8);
                this.ctx.lineTo(-35 - Math.random() * 10, -12);
                this.ctx.lineTo(-15, -16);
                this.ctx.fill();

                // Main Body (Sleek Delta)
                const grad = this.ctx.createLinearGradient(20, 0, -20, 0);
                grad.addColorStop(0, '#ffaa00');
                grad.addColorStop(1, '#442200');
                this.ctx.fillStyle = grad;

                this.ctx.beginPath();
                this.ctx.moveTo(35, 0);
                this.ctx.lineTo(-15, 20);
                this.ctx.lineTo(-5, 0);
                this.ctx.lineTo(-15, -20);
                this.ctx.closePath();
                this.ctx.fill();

                // Wing Detail
                this.ctx.fillStyle = '#ffcc00';
                this.ctx.beginPath();
                this.ctx.moveTo(10, 0);
                this.ctx.lineTo(-10, 15);
                this.ctx.lineTo(-5, 0);
                this.ctx.lineTo(-10, -15);
                this.ctx.fill();

                // Cockpit
                this.ctx.fillStyle = '#00ffff';
                this.ctx.shadowColor = '#00ffff';
                this.ctx.beginPath();
                this.ctx.moveTo(5, 0);
                this.ctx.lineTo(-5, 4);
                this.ctx.lineTo(-5, -4);
                this.ctx.fill();
                break;
            }

            case 'cruiser': {
                // HEAVY CRUISER: Armored Tank
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = '#ff4400';

                // Triple Exhaust
                this.ctx.fillStyle = '#ff4400';
                for (let y of [-10, 0, 10]) {
                    this.ctx.beginPath();
                    this.ctx.arc(-22, y, 4 + Math.random() * 2, 0, Math.PI * 2);
                    this.ctx.fill();
                }

                // Main Hull (Blocky)
                this.ctx.fillStyle = '#441100';
                this.ctx.fillRect(-20, -15, 45, 30);

                // Armor Plating
                this.ctx.fillStyle = '#882200';
                this.ctx.fillRect(-15, -18, 30, 6); // Top Plate
                this.ctx.fillRect(-15, 12, 30, 6);  // Bottom Plate
                this.ctx.fillRect(5, -10, 15, 20);  // Front Armor

                // Turret Mounts
                this.ctx.fillStyle = '#aa4400';
                this.ctx.beginPath();
                this.ctx.arc(0, -10, 5, 0, Math.PI * 2);
                this.ctx.arc(0, 10, 5, 0, Math.PI * 2);
                this.ctx.fill();

                // Bridge
                this.ctx.fillStyle = '#ffaa00';
                this.ctx.fillRect(-5, -4, 10, 8);
                break;
            }

            case 'stealth': {
                // STEALTH WING: Angular Bomber
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = '#0044ff';

                // Dark Body
                this.ctx.fillStyle = '#111111';
                this.ctx.strokeStyle = '#0044ff';
                this.ctx.lineWidth = 2;

                this.ctx.beginPath();
                this.ctx.moveTo(35, 0);
                this.ctx.lineTo(-10, 30);
                this.ctx.lineTo(-5, 0);
                this.ctx.lineTo(-10, -30);
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.stroke();

                // Running Lights
                this.ctx.fillStyle = '#ff0000';
                this.ctx.shadowColor = '#ff0000';
                this.ctx.beginPath();
                this.ctx.arc(-10, 30, 1.5, 0, Math.PI * 2);
                this.ctx.arc(-10, -30, 1.5, 0, Math.PI * 2);
                this.ctx.fill();

                // Engine Glow (Internal)
                this.ctx.fillStyle = '#0088ff';
                this.ctx.shadowColor = '#0088ff';
                this.ctx.beginPath();
                this.ctx.moveTo(-5, 0);
                this.ctx.lineTo(-15, 5);
                this.ctx.lineTo(-15, -5);
                this.ctx.fill();
                break;
            }

            case 'void_runner': {
                // VOID RUNNER: Alien/Organic
                this.ctx.shadowBlur = 25;
                this.ctx.shadowColor = '#a855f7';

                // Pulsating Core
                const pulse = Math.sin(Date.now() / 200) * 2;

                // Organic Wings
                this.ctx.fillStyle = '#581c87';
                this.ctx.beginPath();
                this.ctx.ellipse(0, -10, 25, 8, Math.PI / 12, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.beginPath();
                this.ctx.ellipse(0, 10, 25, 8, -Math.PI / 12, 0, Math.PI * 2);
                this.ctx.fill();

                // Veins
                this.ctx.strokeStyle = '#d8b4fe';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(-10, -10);
                this.ctx.quadraticCurveTo(0, -15, 15, -5);
                this.ctx.moveTo(-10, 10);
                this.ctx.quadraticCurveTo(0, 15, 15, 5);
                this.ctx.stroke();

                // Void Core
                this.ctx.fillStyle = '#ffffff';
                this.ctx.shadowColor = '#ffffff';
                this.ctx.beginPath();
                this.ctx.arc(0, 0, 6 + pulse, 0, Math.PI * 2);
                this.ctx.fill();
                break;
            }

            case 'plasma_breaker': {
                // PLASMA BREAKER: Energy Ram
                this.ctx.shadowBlur = 30;
                this.ctx.shadowColor = '#00ff00';

                // Energy Spike
                const grad = this.ctx.createLinearGradient(0, 0, 40, 0);
                grad.addColorStop(0, '#004400');
                grad.addColorStop(0.5, '#00ff00');
                grad.addColorStop(1, '#ccffcc');
                this.ctx.fillStyle = grad;

                this.ctx.beginPath();
                this.ctx.moveTo(45, 0); // Long ram
                this.ctx.lineTo(-10, 12);
                this.ctx.lineTo(-5, 0);
                this.ctx.lineTo(-10, -12);
                this.ctx.closePath();
                this.ctx.fill();

                // Rotating Rings
                const time = Date.now() / 500;
                this.ctx.strokeStyle = '#00ff00';
                this.ctx.lineWidth = 2;

                this.ctx.save();
                this.ctx.rotate(time);
                this.ctx.beginPath();
                this.ctx.ellipse(0, 0, 15, 5, 0, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.restore();

                this.ctx.save();
                this.ctx.rotate(-time);
                this.ctx.beginPath();
                this.ctx.ellipse(0, 0, 15, 5, 0, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.restore();
                break;
            }

            case 'default':
            default: {
                // STANDARD GLIDER: High-Tech
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = '#00f3ff';

                // Engine Trail
                this.ctx.fillStyle = 'rgba(0, 243, 255, 0.5)';
                this.ctx.beginPath();
                this.ctx.moveTo(-10, 5);
                this.ctx.lineTo(-30 - Math.random() * 10, 0);
                this.ctx.lineTo(-10, -5);
                this.ctx.fill();

                // Main Body
                this.ctx.fillStyle = '#005555';
                this.ctx.beginPath();
                this.ctx.moveTo(30, 0);
                this.ctx.lineTo(-10, 15);
                this.ctx.lineTo(-5, 0);
                this.ctx.lineTo(-10, -15);
                this.ctx.closePath();
                this.ctx.fill();

                // Neon Strips
                this.ctx.strokeStyle = '#00f3ff';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(10, 0);
                this.ctx.lineTo(-5, 10);
                this.ctx.moveTo(10, 0);
                this.ctx.lineTo(-5, -10);
                this.ctx.stroke();

                // Cockpit
                this.ctx.fillStyle = '#ffffff';
                this.ctx.beginPath();
                this.ctx.arc(0, 0, 4, 0, Math.PI * 2);
                this.ctx.fill();
                break;
            }
        }

        this.ctx.restore();
    }

    drawObstacles(obstacles) {
        obstacles.forEach(obs => {
            this.ctx.save();
            this.ctx.translate(obs.x, obs.y);

            // Cyber Structure Styling
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = '#ff0055';

            // Main Block (Dark Tech)
            this.ctx.fillStyle = '#1a050d';
            this.ctx.fillRect(0, 0, obs.width, obs.height);

            // Neon Borders
            this.ctx.strokeStyle = '#ff0055';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(0, 0, obs.width, obs.height);

            // Tech Pattern (Circuit Lines)
            this.ctx.strokeStyle = '#ff0055';
            this.ctx.lineWidth = 1;
            this.ctx.globalAlpha = 0.5;
            this.ctx.beginPath();

            // Random-looking circuit lines based on position (deterministic)
            const seed = obs.x + obs.y;
            const step = 20;

            for (let i = 0; i < obs.width; i += step) {
                if ((seed + i) % 3 === 0) {
                    this.ctx.moveTo(i, 0);
                    this.ctx.lineTo(i, obs.height);
                }
            }
            for (let i = 0; i < obs.height; i += step) {
                if ((seed + i) % 2 === 0) {
                    this.ctx.moveTo(0, i);
                    this.ctx.lineTo(obs.width, i);
                }
            }
            this.ctx.stroke();

            // Inner Glow/Core
            this.ctx.fillStyle = 'rgba(255, 0, 85, 0.1)';
            this.ctx.fillRect(5, 5, obs.width - 10, obs.height - 10);

            // 3D Depth Effect (Side)
            this.ctx.fillStyle = '#550011';
            this.ctx.beginPath();
            this.ctx.moveTo(obs.width, 0);
            this.ctx.lineTo(obs.width + 10, 10);
            this.ctx.lineTo(obs.width + 10, obs.height + 10);
            this.ctx.lineTo(obs.width, obs.height);
            this.ctx.fill();

            // 3D Depth Effect (Bottom)
            this.ctx.beginPath();
            this.ctx.moveTo(0, obs.height);
            this.ctx.lineTo(10, obs.height + 10);
            this.ctx.lineTo(obs.width + 10, obs.height + 10);
            this.ctx.lineTo(obs.width, obs.height);
            this.ctx.fill();

            this.ctx.restore();
        });
    }

    drawCollectibles(collectibles) {
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = '#00ff99';
        this.ctx.fillStyle = '#00ff99';

        collectibles.forEach(col => {
            this.ctx.beginPath();
            this.ctx.arc(col.x, col.y, col.radius, 0, Math.PI * 2);
            this.ctx.fill();

            // Draw '$' symbol
            this.ctx.fillStyle = '#003300';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('$', col.x, col.y + 1);

            // Reset fill style for next iteration/other draws
            this.ctx.fillStyle = '#00ff99';
        });
    }

    drawFuels(fuels) {
        this.ctx.shadowBlur = 15;

        fuels.forEach(fuel => {
            this.ctx.shadowColor = fuel.color;
            this.ctx.fillStyle = fuel.color;

            this.ctx.save();
            this.ctx.translate(fuel.x, fuel.y);

            if (fuel.type === 'LARGE') {
                // Blue Battery (Cylinder)
                this.ctx.beginPath();
                this.ctx.roundRect(-10, -15, 20, 30, 5);
                this.ctx.fill();

                // Bolt Icon
                this.ctx.fillStyle = '#ffffff';
                this.ctx.beginPath();
                this.ctx.moveTo(2, -5);
                this.ctx.lineTo(-5, 0);
                this.ctx.lineTo(0, 0);
                this.ctx.lineTo(-2, 5);
                this.ctx.lineTo(5, 0);
                this.ctx.lineTo(0, 0);
                this.ctx.closePath();
                this.ctx.fill();
            } else {
                // Yellow Jerry Can
                this.ctx.beginPath();
                this.ctx.rect(-12, -12, 24, 24); // Main body
                this.ctx.fill();

                // Handle (for Fuel)
                this.ctx.strokeStyle = fuel.color;
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.moveTo(-8, -12);
                this.ctx.lineTo(-8, -18);
                this.ctx.lineTo(8, -18);
                this.ctx.lineTo(8, -12);
                this.ctx.stroke();

                // 'F' Label
                this.ctx.fillStyle = '#000000';
                this.ctx.font = 'bold 16px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('F', 0, 2);
            }

            this.ctx.restore();
        });
    }

    drawPowerUps(powerUps) {
        powerUps.forEach(powerUp => {
            this.ctx.save();
            this.ctx.translate(powerUp.x, powerUp.y);
            this.ctx.rotate(powerUp.rotation);

            // Pulsing glow effect
            const pulseSize = 1 + Math.sin(powerUp.pulseTimer) * 0.15;
            this.ctx.scale(pulseSize, pulseSize);

            // Outer glow
            const gradient = this.ctx.createRadialGradient(0, 0, 5, 0, 0, 25);
            gradient.addColorStop(0, powerUp.color + 'ff');
            gradient.addColorStop(0.5, powerUp.color + '88');
            gradient.addColorStop(1, powerUp.color + '00');

            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 25, 0, Math.PI * 2);
            this.ctx.fill();

            // Main hexagon shape
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = powerUp.color;
            this.ctx.fillStyle = powerUp.color;
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;

            this.ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i;
                const x = Math.cos(angle) * 15;
                const y = Math.sin(angle) * 15;
                if (i === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();

            // Inner icon background
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 10, 0, Math.PI * 2);
            this.ctx.fill();

            // Draw icon based on type
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.shadowBlur = 5;
            this.ctx.shadowColor = '#000000';

            switch (powerUp.type) {
                case 'SHIELD':
                    // Draw shield symbol
                    this.ctx.beginPath();
                    this.ctx.moveTo(0, -8);
                    this.ctx.lineTo(6, -4);
                    this.ctx.lineTo(6, 4);
                    this.ctx.lineTo(0, 8);
                    this.ctx.lineTo(-6, 4);
                    this.ctx.lineTo(-6, -4);
                    this.ctx.closePath();
                    this.ctx.stroke();
                    break;
                case 'TIME_SLOW':
                    // Draw clock symbol
                    this.ctx.fillText('⏰', 0, 0);
                    break;
                case 'MAGNET':
                    // Draw magnet symbol
                    this.ctx.fillText('🧲', 0, 0);
                    break;
                case 'RAPID_FIRE':
                    // Draw infinity symbol for unlimited ammo
                    this.ctx.font = 'bold 20px Arial';
                    this.ctx.fillText('∞', 0, 0);
                    break;
                case 'GHOST_MODE':
                    // Draw ghost emoji
                    this.ctx.fillText('👻', 0, 0);
                    break;
                case 'COIN_RAIN':
                    // Draw money bag emoji
                    this.ctx.fillText('💰', 0, 0);
                    break;
            }

            this.ctx.restore();
        });
    }



    drawVillain(villain) {
        if (!villain) return;

        this.ctx.save();
        this.ctx.translate(villain.x, villain.y);

        if (villain.type === 'SPEEDSTER') {
            // SPEEDSTER: Aggressive Racer
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = '#ff0000';

            // Engine Trail
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            this.ctx.beginPath();
            this.ctx.moveTo(40, 0);
            this.ctx.lineTo(70 + Math.random() * 20, 0);
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
            this.ctx.fill();

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
            this.ctx.shadowBlur = 25;
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
            this.ctx.fill();

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
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = '#ff0000';

            // Main Body - Aggressive Angular Shape
            const grad = this.ctx.createLinearGradient(20, 0, -20, 0);
            grad.addColorStop(0, '#440000');
            grad.addColorStop(1, '#110000');
            this.ctx.fillStyle = villain.hitFlashTimer > 0 ? '#ffffff' : grad;

            this.ctx.beginPath();
            this.ctx.moveTo(30, 0);
            this.ctx.lineTo(-10, 25);
            this.ctx.lineTo(-5, 0);
            this.ctx.lineTo(-10, -25);
            this.ctx.closePath();
            this.ctx.fill();

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
            this.ctx.save();
            this.ctx.translate(proj.x, proj.y);

            if (proj.type === 'SONIC_BLADE') {
                // SONIC BLADE: Crescent Energy Wave
                this.ctx.rotate(proj.rotation);

                // Glow
                this.ctx.shadowBlur = 20;
                this.ctx.shadowColor = '#00ffff';

                // Main Blade (Crescent)
                const grad = this.ctx.createLinearGradient(0, -15, 0, 15);
                grad.addColorStop(0, 'rgba(0, 255, 255, 0)');
                grad.addColorStop(0.5, '#ffffff');
                grad.addColorStop(1, 'rgba(0, 255, 255, 0)');
                this.ctx.fillStyle = grad;

                this.ctx.beginPath();
                this.ctx.arc(-10, 0, 25, -Math.PI / 2, Math.PI / 2); // Outer curve
                this.ctx.bezierCurveTo(-5, 10, -5, -10, -10, -25); // Inner curve
                this.ctx.fill();

                // Energy Trail
                this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(-10, -25);
                this.ctx.quadraticCurveTo(10, 0, -10, 25);
                this.ctx.stroke();

            } else if (proj.type === 'FUSE') {
                // Enhanced Fuse Bomb Rendering
                this.ctx.rotate(proj.rotation);

                // Trail Effect (drawn behind)
                this.ctx.shadowBlur = 20;
                this.ctx.shadowColor = '#ff4400';
                this.ctx.fillStyle = 'rgba(255, 68, 0, 0.3)';
                this.ctx.beginPath();
                this.ctx.moveTo(10, -5);
                this.ctx.lineTo(40, 0); // Trail tail
                this.ctx.lineTo(10, 5);
                this.ctx.fill();

                // Bomb Body (High-tech Canister)
                const gradient = this.ctx.createLinearGradient(-10, 0, 10, 0);
                gradient.addColorStop(0, '#333');
                gradient.addColorStop(0.5, '#666');
                gradient.addColorStop(1, '#333');
                this.ctx.fillStyle = gradient;

                this.ctx.beginPath();
                this.ctx.roundRect(-12, -6, 24, 12, 4);
                this.ctx.fill();

                // Glowing Core
                this.ctx.fillStyle = '#ff0000';
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = '#ff0000';
                this.ctx.beginPath();
                this.ctx.arc(0, 0, 3, 0, Math.PI * 2);
                this.ctx.fill();

                // Sparking Fuse at back
                this.ctx.strokeStyle = '#ffff00';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(12, 0);
                this.ctx.quadraticCurveTo(18, Math.sin(Date.now() / 50) * 5, 24, 0);
                this.ctx.stroke();

                // Random sparks
                if (Math.random() > 0.3) {
                    this.ctx.fillStyle = '#ffffaa';
                    this.ctx.beginPath();
                    this.ctx.arc(24 + Math.random() * 5, (Math.random() - 0.5) * 10, 2, 0, Math.PI * 2);
                    this.ctx.fill();
                }

            } else if (proj.target) { // It's a Homing Projectile
                // Missile Body
                this.ctx.rotate(Math.atan2(proj.vy, proj.vx));

                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = '#ffaa00';
                this.ctx.fillStyle = '#ffaa00';

                this.ctx.beginPath();
                this.ctx.moveTo(10, 0);
                this.ctx.lineTo(-10, 5);
                this.ctx.lineTo(-10, -5);
                this.ctx.fill();

                // Thruster Flame
                this.ctx.fillStyle = '#ffff00';
                this.ctx.beginPath();
                this.ctx.moveTo(-10, 0);
                this.ctx.lineTo(-20, 3);
                this.ctx.lineTo(-20, -3);
                this.ctx.fill();

            } else {
                // Standard Projectile: Plasma Bolt
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = '#ff4400';

                // Unstable Core
                const wobble = Math.sin(Date.now() / 50) * 2;

                const grad = this.ctx.createRadialGradient(0, 0, 2, 0, 0, proj.radius + 2);
                grad.addColorStop(0, '#ffffff');
                grad.addColorStop(0.4, '#ff8800');
                grad.addColorStop(1, 'rgba(255, 0, 0, 0)');

                this.ctx.fillStyle = grad;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, proj.radius + wobble, 0, Math.PI * 2);
                this.ctx.fill();

                // Trail/Glow
                this.ctx.fillStyle = 'rgba(255, 68, 0, 0.4)';
                this.ctx.beginPath();
                this.ctx.arc(-5, 0, proj.radius + 4, 0, Math.PI * 2);
                this.ctx.fill();
            }

            this.ctx.restore();
        });
    }

    drawPlayerProjectiles(projectiles) {
        projectiles.forEach(proj => {
            this.ctx.save();
            this.ctx.translate(proj.x, proj.y);

            switch (proj.type) {
                case 'blaster': {
                    // Solar Blaster: Aggressive Fighter
                    // Main Body
                    this.ctx.shadowBlur = 15;
                    this.ctx.shadowColor = '#ffaa00';
                    const gradInt = this.ctx.createLinearGradient(0, 0, 40, 0);
                    gradInt.addColorStop(0, '#442200');
                    gradInt.addColorStop(1, '#ffaa00');
                    this.ctx.fillStyle = gradInt;

                    this.ctx.beginPath();
                    this.ctx.moveTo(30, 0);
                    this.ctx.lineTo(-10, 6);
                    this.ctx.lineTo(-10, -6);
                    this.ctx.closePath();
                    this.ctx.fill();
                    break;
                }

                case 'cannon':
                    // Magma Cannon: Red Plasma Cannonball
                    this.ctx.shadowBlur = 15;
                    this.ctx.shadowColor = '#ff0000';
                    this.ctx.fillStyle = '#ff0000';
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, 8, 0, Math.PI * 2);
                    this.ctx.fill();
                    // Core
                    this.ctx.fillStyle = '#ffffff';
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, 4, 0, Math.PI * 2);
                    this.ctx.fill();
                    break;

                case 'beam':
                    // Ion Beam: Blue Precision Beam
                    this.ctx.shadowBlur = 10;
                    this.ctx.shadowColor = '#0088ff';
                    this.ctx.fillStyle = '#0088ff';
                    this.ctx.fillRect(-15, -2, 30, 4);
                    break;

                case 'wave':
                    // Void Wave: Purple Energy Wave
                    this.ctx.shadowBlur = 15;
                    this.ctx.shadowColor = '#a855f7';
                    this.ctx.strokeStyle = '#a855f7';
                    this.ctx.lineWidth = 3;
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, 6, 0, Math.PI * 2);
                    this.ctx.stroke();
                    // Inner
                    this.ctx.fillStyle = '#ffffff';
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, 3, 0, Math.PI * 2);
                    this.ctx.fill();
                    break;

                case 'shock':
                    // Tesla Arc: Green Electric Bolt
                    this.ctx.shadowBlur = 15;
                    this.ctx.shadowColor = '#00ff00';
                    this.ctx.strokeStyle = '#00ff00';
                    this.ctx.lineWidth = 2;
                    this.ctx.beginPath();
                    this.ctx.moveTo(-10, 0);
                    this.ctx.lineTo(-5, 5);
                    this.ctx.lineTo(0, -5);
                    this.ctx.lineTo(5, 5);
                    this.ctx.lineTo(10, 0);
                    this.ctx.stroke();
                    break;

                default:
                    // Default Pulse Laser: Cyan Laser
                    this.ctx.shadowBlur = 10;
                    this.ctx.shadowColor = '#00f3ff';
                    this.ctx.fillStyle = '#00f3ff';
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, 5, 0, Math.PI * 2);
                    this.ctx.fill();
                    break;
            }

            this.ctx.restore();
        });
    }

    drawFloatingTexts(texts) {
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.shadowBlur = 0;

        texts.forEach(text => {
            this.ctx.fillStyle = text.color || '#ffffff';
            this.ctx.fillText(text.text, text.x, text.y);
        });
    }
}
