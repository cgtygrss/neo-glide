// Each held pointer/key owns its input until that same source releases it.
export class FlightInput {
  constructor(onBoostChange) {
    this.sources = new Set();
    this.onBoostChange = onBoostChange;
  }

  press(source) {
    const wasActive = this.sources.size > 0;
    this.sources.add(source);
    if (!wasActive) this.onBoostChange(true);
  }

  release(source) {
    const wasActive = this.sources.size > 0;
    this.sources.delete(source);
    if (wasActive && this.sources.size === 0) this.onBoostChange(false);
  }

  reset() {
    this.sources.clear();
    this.onBoostChange(false);
  }
}
