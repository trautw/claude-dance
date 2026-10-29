import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPerformance } from '../../src/dance/choreography.js';
import { leftOf } from '../../src/dance/geometry.js';
import { BODY } from '../../src/dancers/proportions.js';
import { GRIP_DROP } from '../../src/dance/holds.js';

const perf = createPerformance();
const role = (id) => id.split('.')[1];

/** Shoulder of a dancer at bar time t, in set-frame [d, s] plus height. */
function shoulder(id, hand, t) {
  const body = BODY[role(id)];
  const { p, h } = perf.poseAt(id, t);
  const l = leftOf(h);
  const side = hand === 'L' ? 1 : -1;
  return [p[0] + l[0] * side * body.shoulderX, p[1] + l[1] * side * body.shoulderX, body.shoulderY];
}

test('turns and circles have hand-holds: 2 turns + 6 in the circle, every time through', () => {
  const timesThrough = perf.sections.filter((s) => s.kind === 'timeThrough');
  assert.equal(perf.holds.length, timesThrough.length * 8);
  for (const s of timesThrough) {
    const inside = perf.holds.filter((h) => h.b0 >= s.b0 && h.b1 <= s.b1);
    assert.equal(inside.length, 8, `time through ${s.n}`);
    const rh = inside.filter((h) => h.aHand === 'R' && h.bHand === 'R');
    const lh = inside.filter((h) => h.aHand === 'L' && h.bHand === 'L');
    assert.equal(rh.length, 1, 'right hands in the turn');
    assert.equal(lh.length, 1, 'left hands in the 1¼ turn');
    assert.equal(inside.filter((h) => h.aHand === 'L' && h.bHand === 'R').length, 6, 'a closed ring of six');
  }
});

test('in the circle every dancer holds one neighbour with each hand', () => {
  const s = perf.sections[1];
  const ring = perf.holds.filter((h) => h.b0 >= s.b0 + 32 && h.b1 <= s.b1);
  const lefts = new Set(ring.map((h) => h.a));
  const rights = new Set(ring.map((h) => h.b));
  assert.equal(lefts.size, 6);
  assert.deepEqual([...lefts].sort(), [...rights].sort());
});

test('joined hands can always reach each other', () => {
  for (const hold of perf.holds) {
    for (let t = hold.b0 + hold.fade; t <= hold.b1 - hold.fade; t += 1 / 32) {
      const a = shoulder(hold.a, hold.aHand, t);
      const b = shoulder(hold.b, hold.bHand, t);
      const grip = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 - GRIP_DROP];
      for (const [id, sh] of [[hold.a, a], [hold.b, b]]) {
        const need = Math.hypot(grip[0] - sh[0], grip[1] - sh[1], grip[2] - sh[2]);
        assert.ok(need <= BODY[role(id)].armLength * 0.97,
          `${id} needs ${need.toFixed(2)} m of arm at bar time ${t.toFixed(2)}`);
      }
    }
  }
});
