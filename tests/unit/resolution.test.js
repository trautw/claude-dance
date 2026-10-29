import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AdaptiveResolution } from '../../src/world/resolution.js';

const renderer = () => ({ ratio: null, setPixelRatio(r) { this.ratio = r; } });
const run = (res, frames, dt) => { for (let i = 0; i < frames; i++) res.frame(dt); };

test('a GPU holding 60 fps keeps full sharpness, hitches or not', () => {
  const r = renderer();
  const res = new AdaptiveResolution(r, { max: 1.5 });
  for (let i = 0; i < 600; i++) res.frame(i % 30 === 0 ? 0.4 : 1 / 60);
  assert.equal(r.ratio, 1.5);
});

test('a slow GPU steps down a quarter at a time, and never below 1', () => {
  const r = renderer();
  const res = new AdaptiveResolution(r, { max: 1.5 });
  run(res, 90, 1 / 40);
  assert.equal(r.ratio, 1.25);
  run(res, 900, 1 / 30);
  assert.equal(r.ratio, 1);
});
