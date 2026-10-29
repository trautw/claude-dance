// Where jumps in time land. All targets are bar boundaries (whole bar times).
import { CRIB } from './crib.js';

// A "back" press within this much of a boundary goes to the one before, like a CD player.
const BACK_GRACE_BARS = 0.35;

/** Bar times where each section and each figure begins, plus the very end. */
export function figureStarts(perf) {
  const starts = [];
  for (const s of perf.sections) {
    if (s.kind === 'timeThrough') for (const f of CRIB.figures) starts.push(s.b0 + f.bars[0] - 1);
    else starts.push(s.b0);
  }
  starts.push(perf.lengthBars);
  return starts;
}

const clampTo = (perf, b) => Math.min(perf.lengthBars, Math.max(0, b));

export function nextBar(perf, t) {
  return clampTo(perf, Math.floor(t + 1e-6) + 1);
}

export function previousBar(perf, t) {
  const start = Math.floor(t + 1e-6);
  return clampTo(perf, t - start < BACK_GRACE_BARS ? start - 1 : start);
}

export function nextFigure(perf, t) {
  return figureStarts(perf).find((b) => b > t + 1e-6) ?? perf.lengthBars;
}

export function previousFigure(perf, t) {
  const before = figureStarts(perf).filter((b) => b <= t - BACK_GRACE_BARS);
  return before.length ? before[before.length - 1] : 0;
}

/** The bar boundary nearest to a point on the timeline. */
export function snapToBar(perf, t) {
  return clampTo(perf, Math.round(t));
}
