export class Player {
    constructor() {
        this.x = 100;
        this.y = 300;
        this.velocity = 0;
        this.gravity = 500;
        this.lift = -800;
        this.width = 40;
        this.height = 20;
        this.isBoosting = false;
        this.rotation = 0;
    }

    update(deltaTime) {
        if (this.isBoosting) {
            this.velocity += this.lift * deltaTime;
        } else {
            this.velocity += this.gravity * deltaTime;
        }

        this.y += this.velocity * deltaTime;

        // Rotation based on velocity
        this.rotation = Math.min(Math.max(this.velocity * 0.05, -45), 45);

        // Floor/Ceiling collision (basic)
        if (this.y < 0) {
            this.y = 0;
            this.velocity = 0;
        }
        // Floor collision is handled by the game manager (GameOver)
    }

    boost(active) {
        this.isBoosting = active;
    }
}

export class Obstacle {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.markedForDeletion = false;
    }

    update(deltaTime, speed) {
        this.x -= speed * deltaTime;
        if (this.x + this.width < 0) {
            this.markedForDeletion = true;
        }
    }
}

export class Collectible {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 10;
        this.markedForDeletion = false;
        this.oscillation = Math.random() * Math.PI * 2;
    }

    update(deltaTime, speed) {
        this.x -= speed * deltaTime;
        this.oscillation += deltaTime * 5;
        this.y += Math.sin(this.oscillation) * 0.5; // Floating effect

        if (this.x + this.radius < 0) {
            this.markedForDeletion = true;
        }
    }
}

export class Fuel {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.markedForDeletion = false;
        this.oscillation = Math.random() * Math.PI * 2;

        // Varied Fuel Types
        this.type = Math.random() > 0.9 ? 'LARGE' : 'SMALL'; // 10% chance for large (Rare)
        this.value = this.type === 'LARGE' ? 50 : 25;
        this.color = this.type === 'LARGE' ? '#0088ff' : '#ffff00'; // Blue vs Yellow
    }

    update(deltaTime, speed) {
        this.x -= speed * deltaTime;
        this.oscillation += deltaTime * 5;
        this.y += Math.sin(this.oscillation) * 0.5;

        if (this.x + this.width < 0) {
            this.markedForDeletion = true;
        }
    }
}

export class Villain {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 80;
        this.height = 60;
        this.markedForDeletion = false;
        this.hp = 100;
        this.state = 'ENTERING'; // ENTERING, ATTACKING, LEAVING
        this.stateTimer = 0;
        this.attackTimer = 0;
        this.targetY = y;
        this.active = true;
        this.oscillation = 0;
        this.hitFlashTimer = 0;
    }

    takeDamage(amount) {
        this.hp -= amount;
        this.hitFlashTimer = 0.1; // Flash for 100ms
        if (this.hp <= 0) {
            this.markedForDeletion = true;
            return true; // Died
        }
        return false;
    }

    update(deltaTime, playerY, playerProjectiles = []) {
        this.stateTimer += deltaTime;
        this.oscillation += deltaTime * 2;
        if (this.hitFlashTimer > 0) this.hitFlashTimer -= deltaTime;

        // Dodge Logic
        let dodgeOffset = 0;
        playerProjectiles.forEach(proj => {
            const dx = proj.x - this.x;
            const dy = proj.y - this.y;
            // If projectile is close and incoming
            if (Math.abs(dx) < 300 && Math.abs(dy) < 60) {
                // Dodge away from projectile
                dodgeOffset += dy > 0 ? -100 : 100;
            }
        });

        if (this.state === 'ENTERING') {
            // Move to attack position (right side of screen)
            const targetX = window.innerWidth - 150;
            this.x -= (this.x - targetX) * 2 * deltaTime;

            // Smoothly match player Y
            this.y += (playerY - this.y) * 1 * deltaTime;

            if (Math.abs(this.x - targetX) < 10) {
                this.state = 'ATTACKING';
                this.stateTimer = 0;
            }
        } else if (this.state === 'ATTACKING') {
            // Sine wave movement around player Y + Dodge
            const wave = Math.sin(this.oscillation) * 150;
            this.targetY = playerY + wave + dodgeOffset;
            this.y += (this.targetY - this.y) * 3 * deltaTime;

            // Clamp
            this.y = Math.max(50, Math.min(window.innerHeight - 100, this.y));

            this.attackTimer += deltaTime;

            // Leave after 15 seconds
            if (this.stateTimer > 15) {
                this.state = 'LEAVING';
            }
        } else if (this.state === 'LEAVING') {
            // Fly away to the left
            this.x -= 500 * deltaTime;
            if (this.x < -200) {
                this.markedForDeletion = true;
            }
        }
    }
}

export class Projectile {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 8;
        this.speed = 500;
        this.markedForDeletion = false;
    }

    update(deltaTime) {
        this.x -= this.speed * deltaTime;
        if (this.x < 0) {
            this.markedForDeletion = true;
        }
    }
}

export class PlayerProjectile {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 5;
        this.speed = 800;
        this.markedForDeletion = false;
    }

    update(deltaTime) {
        this.x += this.speed * deltaTime;
        if (this.x > window.innerWidth) {
            this.markedForDeletion = true;
        }
    }
}
