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

        // Create 3 Planets/Galaxies
        for (let i = 0; i < 3; i++) {
            this.planets.push({
                x: Math.random() * this.width + this.width, // Start off-screen right
                y: Math.random() * this.height,
                radius: Math.random() * 40 + 20,
                color: `hsl(${Math.random() * 360}, 70%, 50%)`,
                speed: Math.random() * 20 + 5,
                type: Math.random() > 0.5 ? 'PLANET' : 'GALAXY'
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

        // Update and Draw Planets
        this.planets.forEach(planet => {
            planet.x -= (planet.speed + speed * 0.05) * deltaTime;

            // Respawn far right if off-screen left
            if (planet.x + planet.radius < 0) {
                planet.x = this.width + Math.random() * 1000 + 500; // Random delay
                planet.y = Math.random() * this.height;
                planet.color = `hsl(${Math.random() * 360}, 70%, 50%)`;
                planet.type = Math.random() > 0.5 ? 'PLANET' : 'GALAXY';
            }

            this.ctx.save();
            this.ctx.translate(planet.x, planet.y);

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

    drawPlayer(player, shipType = 'default') {
        this.ctx.save();
        this.ctx.translate(player.x, player.y);
        this.ctx.rotate(player.rotation * Math.PI / 180);

        // Glow effect
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = '#00f3ff';
        this.ctx.fillStyle = '#00f3ff';

        this.ctx.beginPath();

        switch (shipType) {
            case 'interceptor':
                // X-Wing style
                this.ctx.moveTo(20, 0);
                this.ctx.lineTo(-10, 15);
                this.ctx.lineTo(-5, 0);
                this.ctx.lineTo(-10, -15);
                break;
            case 'cruiser':
                // Bulky blocky ship
                this.ctx.rect(-15, -10, 35, 20);
                this.ctx.rect(-20, -15, 10, 30); // Engines
                break;
            case 'stealth':
                // Sharp angular stealth bomber
                this.ctx.moveTo(25, 0);
                this.ctx.lineTo(-15, 20);
                this.ctx.lineTo(-5, 0);
                this.ctx.lineTo(-15, -20);
                break;
            case 'default':
            default:
                // Standard Triangle
                this.ctx.moveTo(20, 0);
                this.ctx.lineTo(-10, 10);
                this.ctx.lineTo(-10, -10);
                break;
        }

        this.ctx.closePath();
        this.ctx.fill();

        // Engine Trail
        if (player.isBoosting) {
            this.ctx.shadowColor = '#ff0055';
            this.ctx.fillStyle = '#ff0055';
            this.ctx.beginPath();
            this.ctx.moveTo(-15, 0);
            this.ctx.lineTo(-35, 5);
            this.ctx.lineTo(-35, -5);
            this.ctx.closePath();
            this.ctx.fill();
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

    drawVillain(villain) {
        if (!villain) return;

        this.ctx.save();
        this.ctx.translate(villain.x, villain.y);

        this.ctx.shadowBlur = 25;
        this.ctx.shadowColor = '#ff0000';
        this.ctx.fillStyle = villain.hitFlashTimer > 0 ? '#ffffff' : '#cc0000'; // Flash white on hit

        // Draw menacing ship
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

        // Health Bar
        if (villain.hp < 100) {
            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(-20, -40, 60, 5);
            this.ctx.fillStyle = '#f00';
            this.ctx.fillRect(-20, -40, 60 * (villain.hp / 100), 5);
        }

        this.ctx.restore();
    }

    drawProjectiles(projectiles) {
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = '#ff0000';
        this.ctx.fillStyle = '#ff0000';

        projectiles.forEach(proj => {
            this.ctx.beginPath();
            this.ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    drawPlayerProjectiles(projectiles) {
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = '#0088ff';
        this.ctx.fillStyle = '#0088ff';

        projectiles.forEach(proj => {
            this.ctx.beginPath();
            this.ctx.rect(proj.x, proj.y - 2, 15, 4); // Laser beam
            this.ctx.fill();
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
