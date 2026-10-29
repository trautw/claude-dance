// Dynamic resolution: on a GPU that can't hold the frame rate at full sharpness, step the
// pixel ratio down (never below 1) until it can. Only ever steps down, so it settles rather
// than flickers between sizes; vsync hides any headroom there'd be to step back up.

const WINDOW = 90; // frames judged together
const TOO_SLOW_FPS = 52;
const STEP = 0.25;

export class AdaptiveResolution {
  constructor(renderer, { max, min = 1 }) {
    this.renderer = renderer;
    this.min = Math.min(min, max);
    this.ratio = max;
    renderer.setPixelRatio(max);
    this.times = [];
  }

  /** Call once a frame with the frame's duration in seconds. */
  frame(dt) {
    this.times.push(dt);
    if (this.times.length < WINDOW) return;
    // The median frame, so a few hitches (a tab switch, the browser busy elsewhere) don't count.
    const median = this.times.sort((a, b) => a - b)[WINDOW >> 1];
    this.times = [];
    if (1 / median < TOO_SLOW_FPS && this.ratio > this.min) {
      this.ratio = Math.max(this.min, this.ratio - STEP);
      this.renderer.setPixelRatio(this.ratio);
    }
  }
}
