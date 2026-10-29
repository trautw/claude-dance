import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TUNE, EIGHTHS_PER_BAR, parseBar, chordTones } from '../../src/audio/tune.js';
import { arrange } from '../../src/audio/arrangement.js';
import { createPerformance } from '../../src/dance/choreography.js';
import { CRIB } from '../../src/dance/crib.js';

test('the tune is 40 bars, each exactly a bar long', () => {
  assert.equal(TUNE.bars.length, CRIB.barsPerTimeThrough);
  TUNE.bars.forEach((b, i) => {
    const notes = parseBar(b.notes);
    const len = notes.reduce((n, x) => n + x.eighths, 0);
    assert.equal(len, EIGHTHS_PER_BAR, `bar ${i + 1} "${b.notes}" is ${len} eighths`);
    assert.ok(b.chords.length === 1 || b.chords.length === 2, `bar ${i + 1} chords`);
  });
});

test('notes parse with the key signature and octave marks', () => {
  assert.deepEqual(parseBar('FAdf').map((n) => n.midi), [66, 69, 74, 78]); // F♯4 A4 D5 F♯5
  assert.deepEqual(parseBar("A,cd'=c").map((n) => n.midi), [57, 73, 86, 72]);
  assert.deepEqual(parseBar('d2z2').map((n) => [n.eighth, n.eighths, n.midi]), [[0, 2, 74], [2, 2, null]]);
  assert.deepEqual(chordTones('Bm'), [59, 62, 66]);
  assert.deepEqual(chordTones('A7'), [57, 61, 64, 67]);
});

test('every melody note stays in the key of D and a playable range', () => {
  const scale = new Set([2, 4, 6, 7, 9, 11, 1]);
  for (const b of TUNE.bars) {
    for (const n of parseBar(b.notes)) {
      if (n.midi === null) continue;
      assert.ok(scale.has(n.midi % 12), `${b.notes}: ${n.midi} is outside D major`);
      assert.ok(n.midi >= 55 && n.midi <= 88, `${b.notes}: ${n.midi} out of range`);
    }
  }
});

test('phrases cadence on D at the end of every 8 bars, where figures change', () => {
  for (const end of [8, 16, 24, 40]) {
    const notes = parseBar(TUNE.bars[end - 1].notes).filter((n) => n.midi !== null);
    assert.equal(notes[0].midi % 12, 2, `bar ${end} starts on D`);
  }
});

const perf = createPerformance();
const events = arrange(perf);

test('the arrangement covers the whole dance on a sixteenth-note grid', () => {
  assert.ok(events.length > 10_000);
  for (let i = 1; i < events.length; i++) assert.ok(events[i].bar >= events[i - 1].bar, 'sorted');
  for (const e of events) {
    assert.ok(e.bar >= 0 && e.bar + e.dur <= perf.lengthBars + 1e-9, `event at ${e.bar} inside the dance`);
    assert.ok(Math.abs(e.bar * 16 - Math.round(e.bar * 16)) < 1e-9, `event at ${e.bar} on the grid`);
    assert.ok(e.vel > 0 && e.vel <= 1);
  }
});

test('the melody plays once per time through, and both chords sound', () => {
  for (const s of perf.sections) {
    const melody = events.filter((e) => e.inst === 'accordion' && e.bar >= s.b0 && e.bar < s.b1);
    if (s.kind === 'timeThrough') {
      const expected = TUNE.bars.flatMap((b) => parseBar(b.notes)).filter((n) => n.midi !== null).length;
      assert.equal(melody.length, expected, `${s.name}`);
    } else {
      assert.ok(melody.length >= 3, `${s.name} has a chord`);
      assert.ok(events.some((e) => e.inst === 'crash' && e.bar >= s.b0 && e.bar < s.b1), `${s.name} has a cymbal`);
    }
  }
});
