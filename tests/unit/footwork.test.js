import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPerformance } from '../../src/dance/choreography.js';
import { FEET, footAt, legPose, planFootwork } from '../../src/dance/footwork.js';
import { dist } from '../../src/dance/geometry.js';
import { BODY } from '../../src/dancers/proportions.js';

const perf = createPerformance();
const plans = new Map(perf.dancers.map((d) => [d.id, planFootwork(perf, d.id)]));
const STEP = 1 / 48;

test('dancers stand during the chords and travel in skip change or, in the circle, slip step', () => {
  const plan = plans.get('A.M');
  assert.equal(plan.modes[0], 'stand', 'opening chord');
  assert.equal(plan.modes[perf.lengthBars - 1], 'stand', 'closing chord');
  const T1 = perf.sections[1].b0;
  assert.equal(plan.modes[T1], 'skip', 'turning right hand');
  assert.equal(plan.modes[T1 + 34], 'slip', 'circling');
  assert.equal(plans.get('D.M').modes[T1 + 10], 'stand', 'the 4th couple waits');
});

test('skip change alternates the leading foot bar by bar, starting with the right', () => {
  const plan = plans.get('A.M');
  const T1 = perf.sections[1].b0;
  const leadOf = (n) => FEET.find((f) => plan.stances[f].some((s) => s.t0 === n));
  assert.equal(leadOf(T1), 'R');
  assert.equal(leadOf(T1 + 1), 'L');
  assert.equal(leadOf(T1 + 2), 'R');
});

test('a planted foot never moves, and each foot is in the air only briefly', () => {
  for (const [id, plan] of plans) {
    for (const f of FEET) {
      let prev = footAt(plan, f, 0);
      let airborne = 0;
      for (let t = STEP; t <= perf.lengthBars; t += STEP) {
        const now = footAt(plan, f, t);
        // Planted then planted again a moment later: must be the same spot (no sliding, no jumping).
        if (prev.planted && now.planted) {
          assert.ok(dist(prev.point, now.point) < 1e-9, `${id} ${f} moves while planted at ${t.toFixed(2)}`);
        }
        airborne = now.planted ? 0 : airborne + STEP;
        assert.ok(airborne < 1.2, `${id} ${f} in the air for over a bar at ${t.toFixed(2)}`);
        prev = now;
      }
    }
  }
});

test('legs always reach their feet, and nobody has to crouch to manage it', () => {
  for (const [id, plan] of plans) {
    const body = BODY[id.endsWith('M') ? 'M' : 'W'];
    let lowest = { drop: 0 };
    for (let t = 0; t <= perf.lengthBars; t += STEP) {
      const { hipY, feet } = legPose(plan, body, t);
      for (const f of FEET) {
        const { hip, point, ankleY } = feet[f];
        const reach = Math.hypot(dist(hip, point), hipY - ankleY);
        assert.ok(reach <= body.legLength + 1e-9, `${id} ${f} needs ${reach.toFixed(3)} m of leg at bar time ${t.toFixed(2)}`);
      }
      const drop = body.hipHeight - hipY;
      if (drop > lowest.drop) lowest = { drop, t };
    }
    assert.ok(lowest.drop < 0.12, `${id} sinks ${lowest.drop.toFixed(3)} m at bar time ${lowest.t.toFixed(2)}`);
  }
});

test('feet keep apart: no foot planted through the other', () => {
  for (const [id, plan] of plans) {
    for (let t = 0; t <= perf.lengthBars; t += STEP) {
      const l = footAt(plan, 'L', t);
      const r = footAt(plan, 'R', t);
      if (l.planted && r.planted) assert.ok(dist(l.point, r.point) > 0.04, `${id} feet collide at ${t.toFixed(2)}`);
    }
  }
});
