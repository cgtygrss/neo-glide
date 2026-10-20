export class GameLoop {
    constructor(update, draw) {
        this.update = update;
        this.draw = draw;
        this.lastTime = 0;
        this.isRunning = false;
        this.animationFrameId = null;
        this.frameInterval = 1000 / 60;
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

        if (document.hidden) {
            this.lastTime = timestamp;
            this.animationFrameId = requestAnimationFrame(this.loop);
            return;
        }

        const elapsed = timestamp - this.lastTime;
        if (elapsed < this.frameInterval - 1) {
            this.animationFrameId = requestAnimationFrame(this.loop);
            return;
        }

        let deltaTime = elapsed / 1000; // Convert to seconds
        this.lastTime = timestamp;

        // Cap deltaTime to prevent physics explosions (max 0.1s = 10fps)
        if (deltaTime > 0.1) deltaTime = 0.1;

        this.update(deltaTime);
        this.draw(deltaTime);

        this.animationFrameId = requestAnimationFrame(this.loop);
    }
}
