export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.width = width;
        this.height = height;
    }

    clear() {
        this.ctx.fillStyle = '#050510'; // Dark background
        this.ctx.fillRect(0, 0, this.width, this.height);
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
        });
    }

    drawFuels(fuels) {
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = '#ffff00';
        this.ctx.fillStyle = '#ffff00';

        fuels.forEach(fuel => {
            // Draw Lightning Bolt
            this.ctx.save();
            this.ctx.translate(fuel.x, fuel.y);
            this.ctx.beginPath();
            this.ctx.moveTo(10, -15);
            this.ctx.lineTo(-5, 0);
            this.ctx.lineTo(5, 0);
            this.ctx.lineTo(-10, 15);
            this.ctx.lineTo(5, 0);
            this.ctx.lineTo(-5, 0);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.restore();
        });
    }

    drawVillain(villain) {
        if (!villain) return;

        this.ctx.save();
        this.ctx.translate(villain.x, villain.y);

        this.ctx.shadowBlur = 25;
        this.ctx.shadowColor = '#ff0000';
        this.ctx.fillStyle = '#cc0000';

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

    drawBackground(speed, deltaTime) {
        // Simple grid or starfield effect could go here
        this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.1)';
        this.ctx.lineWidth = 2;

        // Draw a moving grid floor
        const gridSize = 100;
        const offset = (Date.now() / 10 * (speed / 100)) % gridSize;

        this.ctx.beginPath();
        for (let x = -offset; x < this.width; x += gridSize) {
            this.ctx.moveTo(x, this.height);
            this.ctx.lineTo(x + (this.width / 2), 0); // Perspective lines
        }
        this.ctx.stroke();
    }
}
