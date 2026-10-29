import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPerformance } from '../../src/dance/choreography.js';
import {
  figureStarts, nextBar, nextFigure, previousBar, previousFigure, snapToBar,
} from '../../src/dance/navigation.js';

const perf = createPerformance();
const T1 = perf.sections[1].b0; // first time through

test('bar steps land on bar boundaries and stay inside the dance', () => {
  assert.equal(nextBar(perf, T1 + 10.6), T1 + 11);
  assert.equal(nextBar(perf, T1 + 11), T1 + 12);
  assert.equal(previousBar(perf, T1 + 10.6), T1 + 10);
  assert.equal(previousBar(perf, T1 + 10.1), T1 + 9, 'just past a boundary goes to the one before');
  assert.equal(previousBar(perf, 0), 0);
  assert.equal(nextBar(perf, perf.lengthBars), perf.lengthBars);
});

test('figure steps visit every figure of every time through and both chords', () => {
  const starts = figureStarts(perf);
  assert.equal(starts.length, 2 + 8 * 9 + 1);
  assert.ok(starts.every((b) => Number.isInteger(b)));
  assert.equal(nextFigure(perf, 0), T1, 'from the opening chord to bar 1');
  assert.equal(nextFigure(perf, T1 + 9), T1 + 12, 'from inside the first half reel to the second');
  assert.equal(previousFigure(perf, T1 + 9), T1 + 8, 'back to the start of the current figure');
  assert.equal(previousFigure(perf, T1 + 8.1), T1 + 4, 'just past a start goes to the figure before');
  assert.equal(nextFigure(perf, perf.lengthBars - 1), perf.lengthBars);
  assert.equal(previousFigure(perf, 0), 0);
});

test('the timeline snaps to the nearest bar', () => {
  assert.equal(snapToBar(perf, 41.4), 41);
  assert.equal(snapToBar(perf, 41.6), 42);
  assert.equal(snapToBar(perf, -3), 0);
  assert.equal(snapToBar(perf, 1e6), perf.lengthBars);
});
