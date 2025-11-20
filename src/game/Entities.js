export class Player {
    constructor(thrusterLevel = 1) {
        this.x = 100;
        this.y = 300;
        this.velocity = 0;
        this.gravity = 500;
        this.lift = -800 - ((thrusterLevel - 1) * 100); // Stronger lift with upgrades
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

        // Physics & AI Properties
        this.vy = 0;
        this.targetOffset = 0;
        this.repositionTimer = 0;
        this.friction = 0.92;
        this.acceleration = 1500;
        this.maxSpeed = 250;
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

        // AI: Repositioning Logic (Randomly change "lane" relative to player)
        this.repositionTimer -= deltaTime;
        if (this.repositionTimer <= 0) {
            // Pick a new offset between -100 and 100
            this.targetOffset = (Math.random() - 0.5) * 200;
            this.repositionTimer = 1 + Math.random() * 2; // Change every 1-3 seconds
        }

        // AI: Dodge Logic (Burst of speed)
        let dodgeForce = 0;
        playerProjectiles.forEach(proj => {
            const dx = proj.x - this.x;
            const dy = proj.y - this.y;
            // If projectile is close and incoming
            if (Math.abs(dx) < 250 && Math.abs(dy) < 60) {
                // Dodge away from projectile with a burst
                dodgeForce += dy > 0 ? -2000 : 2000;
            }
        });

        if (this.state === 'ENTERING') {
            // Move to attack position (right side of screen)
            const targetX = window.innerWidth - 150;
            this.x -= (this.x - targetX) * 2 * deltaTime;

            // Smoothly center vertically
            this.y += (window.innerHeight / 2 - this.y) * 2 * deltaTime;

            if (Math.abs(this.x - targetX) < 10) {
                this.state = 'ATTACKING';
                this.stateTimer = 0;
            }
        } else if (this.state === 'ATTACKING') {
            // Human-like Tracking with Physics
            const desiredY = playerY + this.targetOffset;
            const distY = desiredY - this.y;

            // Accelerate towards desired Y
            if (Math.abs(distY) > 10) {
                const dir = Math.sign(distY);
                this.vy += dir * this.acceleration * deltaTime;
            }

            // Apply Dodge Force
            this.vy += dodgeForce * deltaTime;

            // Apply Friction (Damping)
            this.vy *= this.friction;

            // Clamp Speed
            this.vy = Math.max(-this.maxSpeed, Math.min(this.maxSpeed, this.vy));

            // Apply Velocity
            this.y += this.vy * deltaTime;

            // Clamp Position
            this.y = Math.max(50, Math.min(window.innerHeight - 100, this.y));

            this.attackTimer += deltaTime;

            // Leave after 20 seconds (gave them a bit more time)
            if (this.stateTimer > 20) {
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
    constructor(x, y, vx = -500, vy = 0) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = 8;
        this.markedForDeletion = false;
    }

    update(deltaTime) {
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;

        if (this.x < 0 || this.y < 0 || this.y > window.innerHeight) {
            this.markedForDeletion = true;
        }
    }
}

export class PlayerProjectile {
    constructor(x, y, type = 'default') {
        this.x = x;
        this.y = y;
        this.radius = 5;
        this.markedForDeletion = false;
        this.type = type;

        // Weapon Stats
        switch (type) {
            case 'blaster':
                this.speed = 1200;
                this.damage = 25;
                break;
            case 'cannon':
                this.speed = 600;
                this.radius = 8;
                this.damage = 50;
                break;
            case 'beam':
                this.speed = 2000;
                this.damage = 75;
                break;
            case 'wave':
                this.speed = 500;
                this.radius = 10;
                this.damage = 100;
                break;
            case 'shock':
                this.speed = 1000;
                this.damage = 150;
                break;
            default:
                this.speed = 800;
                this.damage = 10;
                break;
        }
    }

    update(deltaTime) {
        this.x += this.speed * deltaTime;
        if (this.x > window.innerWidth) {
            this.markedForDeletion = true;
        }
    }
}

export class HomingProjectile extends Projectile {
    constructor(x, y, target) {
        super(x, y, -300, 0); // Slower base speed
        this.target = target;
        this.radius = 10;
        this.turnRate = 1.2; // Slower turn rate (was 2.0, now 1.2 - less accurate)
        this.speed = 300; // Slower speed (was 400, now 300)
        this.life = 5.0; // Expires after 5 seconds
    }

    update(deltaTime) {
        this.life -= deltaTime;
        if (this.life <= 0) {
            this.markedForDeletion = true;
            return;
        }

        if (this.target) {
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            const angle = Math.atan2(dy, dx);

            // Simple homing: adjust velocity towards target
            // Calculate current velocity angle
            const currentAngle = Math.atan2(this.vy, this.vx);

            // Smoothly rotate towards target
            let diff = angle - currentAngle;
            // Normalize angle to -PI to PI
            while (diff <= -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;

            const turn = Math.max(-this.turnRate * deltaTime, Math.min(this.turnRate * deltaTime, diff));
            const newAngle = currentAngle + turn;

            this.vx = Math.cos(newAngle) * this.speed;
            this.vy = Math.sin(newAngle) * this.speed;
        }

        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;

        if (this.x < -50 || this.y < -50 || this.y > window.innerHeight + 50) {
            this.markedForDeletion = true;
        }
    }
}

export class SpeedsterVillain extends Villain {
    constructor(x, y) {
        super(x, y);
        this.width = 60; // Smaller
        this.height = 40;
        this.hp = 60; // Less HP
        this.type = 'SPEEDSTER';
        this.dashTimer = 0;
        this.dashState = 'IDLE'; // IDLE, DASHING, RETURNING
        this.dashDuration = 0;
        this.vx = 0; // Horizontal velocity
    }

    update(deltaTime, playerY, playerProjectiles = []) {
        super.update(deltaTime, playerY, playerProjectiles);

        if (this.state === 'ATTACKING') {
            // Smooth Dash Logic
            this.dashTimer += deltaTime;

            if (this.dashState === 'IDLE' && this.dashTimer > 3.0) {
                // Start dash
                this.dashState = 'DASHING';
                this.dashTimer = 0;
                this.dashDuration = 0;
                this.vx = -400; // Fast forward velocity
            } else if (this.dashState === 'DASHING') {
                this.dashDuration += deltaTime;
                if (this.dashDuration > 0.3) { // Dash for 0.3 seconds
                    this.dashState = 'RETURNING';
                    this.dashDuration = 0;
                    this.vx = 200; // Return velocity (slower)
                }
            } else if (this.dashState === 'RETURNING') {
                this.dashDuration += deltaTime;
                if (this.dashDuration > 0.5) { // Return for 0.5 seconds
                    this.dashState = 'IDLE';
                    this.vx = 0;
                    this.dashTimer = 0;
                }
            }

            // Apply horizontal velocity
            this.x += this.vx * deltaTime;

            // Enhanced vertical movement (faster than normal villain)
            this.vy *= 0.95; // Slightly more friction
            this.maxSpeed = 350; // Faster max speed
        }
    }
}
export class JuggernautVillain extends Villain {
    constructor(x, y) {
        super(x, y);
        this.width = 100; // Larger
        this.height = 80;
        this.hp = 200; // Tanky
        this.type = 'JUGGERNAUT';
        this.maxSpeed = 80; // Slower movement (was 100, now 80)
        this.friction = 0.98; // Heavy
        this.acceleration = 600; // Slower acceleration (was 800, now 600)
    }

    update(deltaTime, playerY, playerProjectiles = []) {
        super.update(deltaTime, playerY, playerProjectiles);

        if (this.state === 'ATTACKING') {
            // Juggernaut moves slowly and relentlessly towards player Y
            // Less dodging, just tanking

            const desiredY = playerY + this.targetOffset;
            const distY = desiredY - this.y;

            if (Math.abs(distY) > 10) {
                const dir = Math.sign(distY);
                this.vy += dir * this.acceleration * deltaTime;
            }

            this.vy *= this.friction;
            this.vy = Math.max(-this.maxSpeed, Math.min(this.maxSpeed, this.vy));
            this.y += this.vy * deltaTime;
            this.y = Math.max(50, Math.min(window.innerHeight - 100, this.y));
        }
    }
}
