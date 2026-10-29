import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrange } from '../../src/audio/arrangement.js';
import { createPerformance } from '../../src/dance/choreography.js';
import { BOW, bellowsAt, bowAt, planPlaying, strikeAt } from '../../src/band/playing.js';

const perf = createPerformance();
const events = arrange(perf);
const plan = planPlaying(events);

test('every drum note heard has a stick or the pedal on it', () => {
  const drumNotes = events.filter((e) => ['kick', 'snare', 'hat', 'crash'].includes(e.inst)).length;
  const hits = plan.drums.L.length + plan.drums.R.length + plan.drums.kick.length;
  assert.equal(hits, drumNotes);
});

test('a hand is down on the drum exactly at each hit and lifted between hits', () => {
  for (const hand of ['L', 'R']) {
    const hits = plan.drums[hand];
    for (let i = 1; i < hits.length - 1; i += 7) {
      const at = strikeAt(hits, hits[i].t);
      assert.ok(at.lift < 1e-6, `${hand} hit at ${hits[i].t} lifted ${at.lift}`);
      assert.equal(at.from, hits[i].key);
      const gap = hits[i + 1].t - hits[i].t;
      if (gap > 0.1 && gap < 1.5) assert.ok(strikeAt(hits, hits[i].t + gap * 0.45).lift > 0.3);
    }
  }
});

test('the drummer plays the ride on the off eighths and the snare on the off-beats', () => {
  const bar = 10;
  const ride = plan.drums.R.filter((h) => h.t >= bar && h.t < bar + 1).map((h) => +(h.t - bar).toFixed(3));
  const snare = plan.drums.L.filter((h) => h.t >= bar && h.t < bar + 1).map((h) => +(h.t - bar).toFixed(3));
  assert.deepEqual(ride, [0.125, 0.375, 0.625, 0.875]);
  assert.deepEqual(snare, [0.25, 0.75]);
});

test('drum rolls go hand to hand', () => {
  const roll = [...plan.drums.L, ...plan.drums.R].filter((h) => h.t < 0.75).sort((a, b) => a.t - b.t);
  assert.ok(roll.length >= 10);
  const hands = roll.map((h) => (plan.drums.L.includes(h) ? 'L' : 'R'));
  for (let i = 1; i < hands.length; i++) assert.notEqual(hands[i], hands[i - 1], `roll hit ${i}`);
});

test('hands rest when nothing is played for a while, and at the very end', () => {
  const end = perf.lengthBars;
  assert.equal(strikeAt(plan.drums.R, end).rest, 1);
  assert.equal(strikeAt(plan.piano.L, end).rest, 1);
  assert.equal(strikeAt(plan.piano.R, 0).rest, 1); // the piano comes in on the chord, after the roll
  assert.equal(strikeAt(plan.drums.R, 0).lift, 0); // ...which the drummer starts at once
});

test('piano: bass notes in the left hand, chords in the right, one hit per beat each', () => {
  const bar = 12;
  const inBar = (list) => list.filter((h) => h.t >= bar && h.t < bar + 1);
  assert.equal(inBar(plan.piano.L).length, 2);
  assert.equal(inBar(plan.piano.R).length, 2);
  assert.ok(inBar(plan.piano.L).every((h) => h.key < 55));
  assert.ok(inBar(plan.piano.R).every((h) => h.key >= 55));
});

test('the bow changes direction stroke by stroke and stays on the hair', () => {
  const strokes = plan.bow;
  assert.ok(strokes.length > 500);
  for (let i = 1; i < strokes.length; i++) {
    assert.notEqual(strokes[i].down, strokes[i - 1].down);
    assert.ok(Math.abs(strokes[i].p0 - strokes[i - 1].p1) < 1e-9, 'each stroke starts where the last ended');
  }
  for (let t = 2; t < perf.lengthBars; t += 0.037) {
    const { p } = bowAt(strokes, t);
    assert.ok(p >= BOW.near - 1e-9 && p <= BOW.far + 1e-9, `bow at ${p}`);
  }
});

test('the bow moves continuously', () => {
  let last = bowAt(plan.bow, 2).p;
  for (let t = 2; t < 50; t += 0.005) {
    const { p } = bowAt(plan.bow, t);
    assert.ok(Math.abs(p - last) < 0.03, `bow jumps ${Math.abs(p - last)} at bar ${t}`);
    last = p;
  }
});

test('the bellows breathe in four-bar cycles and stay within the instrument', () => {
  for (let t = 0; t < 20; t += 0.1) {
    const e = bellowsAt(t);
    assert.ok(e >= 0.07 - 1e-9 && e <= 0.24 + 1e-9);
    assert.ok(Math.abs(bellowsAt(t + 4) - e) < 1e-9);
  }
});
