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
        this.attackTimer = 0;
        this.targetY = y;
        this.active = true;
    }

    update(deltaTime, playerY) {
        // Hover movement - try to align with player but with lag
        this.targetY = playerY;
        this.y += (this.targetY - this.y) * 2 * deltaTime;

        // Clamp to screen
        this.y = Math.max(50, Math.min(window.innerHeight - 100, this.y));

        this.attackTimer += deltaTime;
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
