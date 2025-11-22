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
        // Create 100 stars
        for (let i = 0; i < 100; i++) {
            this.stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                size: Math.random() * 2 + 0.5,
                speed: Math.random() * 50 + 10, // Parallax speed
                alpha: Math.random()
            });
        }

        // Create 2 Planets/Galaxies in background
        for (let i = 0; i < 2; i++) {
            this.planets.push({
                x: (i * this.width) + Math.random() * 500,
                y: Math.random() * this.height,
                radius: Math.random() * 100 + 40, // Random sizes (40-140)
                color: `hsl(${Math.random() * 360}, 90%, 70%)`, // More colorful
                type: Math.random() > 0.5 ? 'PLANET' : 'GALAXY',
                opacity: 0.5 + Math.random() * 0.3
            });
        }
    }

    drawBackground(speed, deltaTime) {
        // Deep Space Background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, '#020010');
        gradient.addColorStop(1, '#050020');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Update and Draw Stars
        this.ctx.fillStyle = '#ffffff';
        this.stars.forEach(star => {
            // Move star
            star.x -= (star.speed + speed * 0.1) * deltaTime;

            // Wrap around
            if (star.x < 0) {
                star.x = this.width;
                star.y = Math.random() * this.height;
            }

            // Twinkle
            star.alpha += (Math.random() - 0.5) * 0.1;
            star.alpha = Math.max(0.2, Math.min(1, star.alpha));

            this.ctx.globalAlpha = star.alpha;
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1.0;

        // Update and Draw Planets (scroll with game world)
        this.planets.forEach(planet => {
            // Move at game speed (like obstacles)
            planet.x -= speed * deltaTime;

            // Respawn when off-screen left
            if (planet.x + planet.radius < -200) {
                planet.x = this.width + Math.random() * 2000 + 500; // Less appearing (large gap)
                planet.y = Math.random() * this.height;
                planet.radius = Math.random() * 100 + 40; // New random size
                planet.color = `hsl(${Math.random() * 360}, 90%, 70%)`; // New random color
                planet.type = Math.random() > 0.5 ? 'PLANET' : 'GALAXY';
            }

            this.ctx.save();
            this.ctx.translate(planet.x, planet.y);
            this.ctx.globalAlpha = planet.opacity || 0.4; // Apply low opacity

            if (planet.type === 'PLANET') {
                // Draw Planet
                this.ctx.shadowBlur = 20;
                this.ctx.shadowColor = planet.color;
                this.ctx.fillStyle = planet.color;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, planet.radius, 0, Math.PI * 2);
                this.ctx.fill();

                // Crater
                this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
                this.ctx.beginPath();
                this.ctx.arc(-planet.radius * 0.3, -planet.radius * 0.3, planet.radius * 0.2, 0, Math.PI * 2);
                this.ctx.fill();
            } else {
                // Draw Galaxy (Spiral)
                this.ctx.shadowBlur = 30;
                this.ctx.shadowColor = planet.color;
                this.ctx.strokeStyle = planet.color;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                for (let i = 0; i < 100; i++) {
                    const angle = 0.1 * i;
                    const x = (1 + angle) * Math.cos(angle);
                    const y = (1 + angle) * Math.sin(angle);
                    this.ctx.lineTo(x, y);
                }
                this.ctx.stroke();
            }

            this.ctx.restore();
        });
    }

    drawPlayer(player, shipType = 'default', ghostMode = false) {
        this.ctx.save();
        this.ctx.translate(player.x, player.y);
        this.ctx.rotate(player.rotation * Math.PI / 180);

        // Ghost Mode Effect - make player semi-transparent and glowing
        if (ghostMode) {
            this.ctx.globalAlpha = 0.5;
            this.ctx.shadowBlur = 30;
            this.ctx.shadowColor = '#00ff88';
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
                // INTERCEPTOR: Aggressive Fighter
                // Main Body
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = '#ffaa00';
                const gradInt = this.ctx.createLinearGradient(0, 0, 40, 0);
                gradInt.addColorStop(0, '#442200');
                gradInt.addColorStop(1, '#ffaa00');
                this.ctx.fillStyle = gradInt;

                this.ctx.beginPath();
                this.ctx.moveTo(30, 0);
                this.ctx.lineTo(-10, 8);
                this.ctx.lineTo(-10, -8);
                this.ctx.closePath();
                this.ctx.fill();

                // Wings
                this.ctx.fillStyle = '#cc8800';
                this.ctx.beginPath();
                this.ctx.moveTo(10, 0);
                this.ctx.lineTo(-15, 25); // Forward swept
                this.ctx.lineTo(-5, 5);
                this.ctx.lineTo(-5, -5);
                this.ctx.lineTo(-15, -25);
                this.ctx.closePath();
                this.ctx.fill();

                // Cockpit
                this.ctx.fillStyle = '#00ffff';
                this.ctx.beginPath();
                this.ctx.ellipse(5, 0, 8, 3, 0, 0, Math.PI * 2);
                this.ctx.fill();
                break;
            }

            case 'cruiser':
                // HEAVY CRUISER: Tank
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = '#ff0000';

                // Main Hull
                this.ctx.fillStyle = '#550000';
                this.ctx.fillRect(-20, -12, 40, 24);

                // Armor Plates
                this.ctx.fillStyle = '#aa0000';
                this.ctx.fillRect(-15, -15, 30, 5); // Top
                this.ctx.fillRect(-15, 10, 30, 5);  // Bottom
                this.ctx.fillRect(10, -8, 15, 16);  // Front Armor

                // Cockpit
                this.ctx.fillStyle = '#ffaa00';
                this.ctx.fillRect(0, -4, 8, 8);
                break;

            case 'stealth':
                // STEALTH WING: Bomber
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = '#0000ff';

                this.ctx.fillStyle = '#111111';
                this.ctx.strokeStyle = '#0044ff';
                this.ctx.lineWidth = 2;

                this.ctx.beginPath();
                this.ctx.moveTo(30, 0);
                this.ctx.lineTo(-10, 25);
                this.ctx.lineTo(-5, 0);
                this.ctx.lineTo(-10, -25);
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.stroke();

                // Pulse Lights
                this.ctx.fillStyle = '#0088ff';
                this.ctx.beginPath();
                this.ctx.arc(-10, 25, 2, 0, Math.PI * 2);
                this.ctx.arc(-10, -25, 2, 0, Math.PI * 2);
                this.ctx.fill();
                break;

            case 'void_runner':
                // VOID RUNNER: Sci-Fi Split
                this.ctx.shadowBlur = 20;
                this.ctx.shadowColor = '#a855f7'; // Purple

                // Floating Core
                this.ctx.fillStyle = '#ffffff';
                this.ctx.beginPath();
                this.ctx.arc(0, 0, 6, 0, Math.PI * 2);
                this.ctx.fill();

                // Split Hulls
                this.ctx.fillStyle = '#581c87';
                // Top Hull
                this.ctx.beginPath();
                this.ctx.moveTo(20, -5);
                this.ctx.lineTo(-15, -15);
                this.ctx.lineTo(-15, -5);
                this.ctx.fill();
                // Bottom Hull
                this.ctx.beginPath();
                this.ctx.moveTo(20, 5);
                this.ctx.lineTo(-15, 15);
                this.ctx.lineTo(-15, 5);
                this.ctx.fill();
                break;

            case 'plasma_breaker': {
                // PLASMA BREAKER: Spiked Ram
                this.ctx.shadowBlur = 25;
                this.ctx.shadowColor = '#00ff00';

                // Main Spike
                const gradPlasma = this.ctx.createLinearGradient(0, 0, 40, 0);
                gradPlasma.addColorStop(0, '#003300');
                gradPlasma.addColorStop(1, '#00ff00');
                this.ctx.fillStyle = gradPlasma;

                this.ctx.beginPath();
                this.ctx.moveTo(40, 0); // Long spike
                this.ctx.lineTo(-10, 10);
                this.ctx.lineTo(-10, -10);
                this.ctx.closePath();
                this.ctx.fill();

                // Side Spikes
                this.ctx.fillStyle = '#00aa00';
                this.ctx.beginPath();
                this.ctx.moveTo(10, 0);
                this.ctx.lineTo(-15, 20);
                this.ctx.lineTo(-5, 5);
                this.ctx.lineTo(-5, -5);
                this.ctx.lineTo(-15, -20);
                this.ctx.fill();
                break;
            }

            case 'default':
            default:
                // STANDARD GLIDER: Refined
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = '#00f3ff';

                // Body
                this.ctx.fillStyle = '#005555';
                this.ctx.beginPath();
                this.ctx.moveTo(25, 0);
                this.ctx.lineTo(-10, 12);
                this.ctx.lineTo(-5, 0);
                this.ctx.lineTo(-10, -12);
                this.ctx.closePath();
                this.ctx.fill();

                // Highlights
                this.ctx.strokeStyle = '#00f3ff';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
                break;
        }

        this.ctx.restore();
    }

    drawObstacles(obstacles) {
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = '#ff0055';
        this.ctx.fillStyle = '#ff0055';

        obstacles.forEach(obs => {
            this.ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
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

                // Handle
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

        this.ctx.shadowBlur = 25;

        if (villain.type === 'SPEEDSTER') {
            // Speedster Drawing (Purple Lightning Shape)
            this.ctx.shadowColor = '#a855f7'; // Purple
            this.ctx.fillStyle = villain.hitFlashTimer > 0 ? '#ffffff' : '#a855f7';

            this.ctx.beginPath();
            this.ctx.moveTo(30, 0);
            this.ctx.lineTo(-10, 20);
            this.ctx.lineTo(0, 0);
            this.ctx.lineTo(-10, -20);
            this.ctx.closePath();
            this.ctx.fill();

            // Lightning Bolt Detail
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(10, -10);
            this.ctx.lineTo(-5, 5);
            this.ctx.lineTo(5, 5);
            this.ctx.lineTo(-10, 15);
            this.ctx.stroke();

        } else if (villain.type === 'JUGGERNAUT') {
            // Juggernaut Drawing (Heavy Tank)
            this.ctx.shadowColor = '#ff8800'; // Orange/Brown
            this.ctx.fillStyle = villain.hitFlashTimer > 0 ? '#ffffff' : '#5c4033'; // Dark Brown/Metal

            // Main Body (Hexagon)
            this.ctx.beginPath();
            this.ctx.moveTo(40, 0);
            this.ctx.lineTo(20, 35);
            this.ctx.lineTo(-30, 35);
            this.ctx.lineTo(-50, 0);
            this.ctx.lineTo(-30, -35);
            this.ctx.lineTo(20, -35);
            this.ctx.closePath();
            this.ctx.fill();

            // Armor Plates
            this.ctx.fillStyle = '#3e2723';
            this.ctx.fillRect(-20, -25, 40, 50);

            // Glowing Core
            this.ctx.fillStyle = '#ff4400';
            this.ctx.shadowColor = '#ff4400';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 10, 0, Math.PI * 2);
            this.ctx.fill();

        } else {
            // Normal Villain
            this.ctx.shadowColor = '#ff0000';
            this.ctx.fillStyle = villain.hitFlashTimer > 0 ? '#ffffff' : '#cc0000';

            this.ctx.beginPath();
            this.ctx.moveTo(40, 0);
            this.ctx.lineTo(-20, 30);
            this.ctx.lineTo(-10, 0);
            this.ctx.lineTo(-20, -30);
            this.ctx.closePath();
            this.ctx.fill();

            // Eyes
            this.ctx.fillStyle = '#ffffff';
            this.ctx.shadowColor = '#ffffff';
            this.ctx.fillRect(10, -10, 10, 5);
            this.ctx.fillRect(10, 5, 10, 5);
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

            if (proj.target) { // It's a Homing Projectile
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
                // Standard Projectile
                // Outer Glow (Red/Orange)
                this.ctx.shadowBlur = 20;
                this.ctx.shadowColor = '#ff0000';

                // Main Body (Gradient)
                const grad = this.ctx.createRadialGradient(0, 0, 2, 0, 0, proj.radius + 4);
                grad.addColorStop(0, '#ffffff'); // White hot center
                grad.addColorStop(0.4, '#ff4400'); // Orange mid
                grad.addColorStop(1, '#ff0000'); // Red edge

                this.ctx.fillStyle = grad;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, proj.radius + 4, 0, Math.PI * 2); // Larger visual size
                this.ctx.fill();

                // Inner Core (Bright White)
                this.ctx.fillStyle = '#ffffff';
                this.ctx.beginPath();
                this.ctx.arc(0, 0, proj.radius * 0.5, 0, Math.PI * 2);
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
