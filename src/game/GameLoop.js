export class GameLoop {
    constructor(update, draw) {
        this.update = update;
        this.draw = draw;
        this.lastTime = 0;
        this.isRunning = false;
        this.animationFrameId = null;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.animationFrameId = requestAnimationFrame(this.loop);
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }

    loop = (timestamp) => {
        if (!this.isRunning) return;

        let deltaTime = (timestamp - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = timestamp;

        // Cap deltaTime to prevent physics explosions (max 0.1s = 10fps)
        if (deltaTime > 0.1) deltaTime = 0.1;

        this.update(deltaTime);
        this.draw(deltaTime);

        this.animationFrameId = requestAnimationFrame(this.loop);
    }
}
