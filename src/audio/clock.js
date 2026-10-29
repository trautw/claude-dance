// The dance's master clock, driven by the AudioContext. Everything that moves asks this clock
// what bar it is, so dancers can never drift from what is being heard.
//
// The clock is a straight line through an anchor: at context time `anchor.time` it is bar time
// `anchor.bar`, advancing at `barsPerSecond`. Seeking, pausing and changing speed re-anchor it
// and notify listeners, which reschedule any sound they had queued.

export const REEL_BARS_PER_MINUTE = 56; // 112 beats per minute, two beats to the bar
export const BEATS_PER_BAR = 2;
export const SPEEDS = [0.5, 0.75, 1];

const START_DELAY_S = 0.08;

export class DanceClock {
  constructor(ctx, { barsPerMinute = REEL_BARS_PER_MINUTE, lengthBars = Infinity } = {}) {
    this.ctx = ctx;
    this.baseBarsPerSecond = barsPerMinute / 60;
    this.lengthBars = lengthBars;
    this.speed = 1;
    this.running = false;
    this.anchor = { time: 0, bar: 0 };
    this.listeners = new Set();
  }

  get barsPerSecond() {
    return this.baseBarsPerSecond * this.speed;
  }

  /** Seconds per bar at the current speed. */
  get barDuration() {
    return 1 / this.barsPerSecond;
  }

  /** Calls `fn(clock)` after every seek, pause, play or speed change. Returns an unsubscribe. */
  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const fn of this.listeners) fn(this);
  }

  /** Plays from bar time `bar` (default: where the clock is now), a moment from now. */
  play(bar = this.bar) {
    this.anchor = { time: this.ctx.currentTime + START_DELAY_S, bar: this.clamp(bar) };
    this.running = true;
    this.notify();
  }

  pause() {
    this.anchor = { time: 0, bar: this.bar };
    this.running = false;
    this.notify();
  }

  toggle() {
    if (this.running) this.pause();
    else this.play(this.bar >= this.lengthBars ? 0 : this.bar);
  }

  /** Moves to bar time `bar`, keeping playing or paused as it was. */
  seek(bar) {
    if (this.running) this.play(bar);
    else {
      this.anchor = { time: 0, bar: this.clamp(bar) };
      this.notify();
    }
  }

  setSpeed(speed) {
    if (speed === this.speed) return;
    if (this.running) {
      // Re-anchor at the scheduled (not yet heard) present so the timeline stays continuous.
      const now = this.ctx.currentTime;
      this.anchor = { time: now, bar: this.barAtTime(now) };
    }
    this.speed = speed;
    this.notify();
  }

  /** Context time of the audio currently reaching the speakers. */
  heardTime() {
    const ts = this.ctx.getOutputTimestamp?.();
    if (ts?.performanceTime) return ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
    return this.ctx.currentTime;
  }

  /** Bar time sounding at context time `time` (held at the anchor until playback reaches it). */
  barAtTime(time) {
    if (!this.running) return this.anchor.bar;
    const b = this.anchor.bar + Math.max(0, time - this.anchor.time) * this.barsPerSecond;
    return this.clamp(b);
  }

  /** Current bar time as heard (0 = start of the opening chord). */
  get bar() {
    return this.barAtTime(this.heardTime());
  }

  /** Context time at which bar time `b` sounds (only meaningful while running). */
  timeOfBar(b) {
    return this.anchor.time + (b - this.anchor.bar) / this.barsPerSecond;
  }

  clamp(b) {
    return Math.min(this.lengthBars, Math.max(0, b));
  }
}
