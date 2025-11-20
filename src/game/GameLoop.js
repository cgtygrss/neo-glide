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

        const deltaTime = (timestamp - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = timestamp;

        this.update(deltaTime);
        this.draw();

        this.animationFrameId = requestAnimationFrame(this.loop);
    }
}
