import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPerformance, locate } from '../../src/dance/choreography.js';
import { CRIB } from '../../src/dance/crib.js';
import { dist, dot, facingIn, norm, stance, sub } from '../../src/dance/geometry.js';

const perf = createPerformance();
const pose = (id, t) => perf.poseAt(id, t);
const near = (actual, expected, msg, tol = 0.02) =>
  assert.ok(dist(actual, expected) < tol, `${msg}: got [${actual.map((x) => x.toFixed(2))}], want [${expected}]`);
const facing = (id, t, dir, msg, minDot = 0.95) => {
  const d = dot(pose(id, t).h, norm(dir));
  assert.ok(d > minDot, `${msg}: heading off by ${((Math.acos(Math.min(1, d)) * 180) / Math.PI).toFixed(0)}°`);
};
const inPlace = (couple, place, t) => {
  for (const role of ['M', 'W']) {
    near(pose(`${couple}.${role}`, t).p, stance(place, role), `${couple}.${role} in place ${place} at bar time ${t}`);
    facing(`${couple}.${role}`, t, facingIn(role), `${couple}.${role} faces in at bar time ${t}`);
  }
};
/** Couples ordered by place at bar time t, assuming everyone is home. */
const order = (t) => ['A', 'B', 'C', 'D'].sort((a, b) => pose(`${a}.M`, t).p[0] - pose(`${b}.M`, t).p[0]).join('');

const timesThrough = perf.sections.filter((s) => s.kind === 'timeThrough');
const [first] = timesThrough;
/** Bar time of a bar count within the first time through. */
const T = (bars) => first.b0 + bars;

// ---------- structure ----------

test('the dance is an opening chord, 8 times through and a closing chord: about 5¾ minutes', () => {
  assert.deepEqual(perf.sections.map((s) => s.kind), ['chord', ...Array(8).fill('timeThrough'), 'chord']);
  assert.equal(perf.lengthBars, 2 * CRIB.chordBars + 8 * CRIB.barsPerTimeThrough);
  const minutes = perf.lengthBars / 56;
  assert.ok(minutes > 5.5 && minutes < 6, `${minutes.toFixed(2)} minutes`);
});

test('each couple leads twice, in order A, A, B, B, C, C, D, D', () => {
  assert.deepEqual(timesThrough.map((s) => s.dancingCouple), ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D']);
  assert.deepEqual(timesThrough.map((s) => s.place), [1, 2, 1, 2, 1, 2, 1, 2]);
});

test('the set progresses and ends in its original order', () => {
  const expected = ['ABCD', 'BACD', 'BCDA', 'CBDA', 'CDAB', 'DCAB', 'DABC', 'ADBC'];
  timesThrough.forEach((s, i) => {
    assert.equal(order(s.b0), expected[i], `order at the start of time through ${s.n}`);
    [...order(s.b0)].forEach((c, k) => inPlace(c, k + 1, s.b0));
  });
  ['A', 'B', 'C', 'D'].forEach((c, k) => inPlace(c, k + 1, perf.lengthBars));
});

test('after leading from 2nd place, the dancing couple step down to 4th in bars 39–40', () => {
  for (const s of timesThrough.filter((x) => x.place === 2)) {
    const before = order(s.b1 - 2);
    assert.equal(before.indexOf(s.dancingCouple), -1 + 3, `${s.dancingCouple} in 3rd place at bar 38`);
    assert.equal(order(s.b1).indexOf(s.dancingCouple), 3, `${s.dancingCouple} in 4th place after bar 40`);
    inPlace(s.dancingCouple, 4, s.b1);
  }
});

test('the couple not involved stands still for the whole time through', () => {
  for (const s of timesThrough) {
    const idlePlace = s.place === 1 ? 4 : 1;
    const idle = order(s.b0)[idlePlace - 1];
    for (let t = s.b0; t <= s.b1; t += 0.25) inPlace(idle, idlePlace, t);
  }
});

test('locate names the section, bar and figures', () => {
  assert.equal(locate(perf, 0.5).section.name, 'Opening chord');
  const mid = locate(perf, T(10.5));
  assert.equal(mid.section.n, 1);
  assert.equal(mid.bar, 11);
  assert.equal(mid.figure.name, CRIB.figures[3].name);
  assert.equal(mid.nextFigure.name, CRIB.figures[4].name);
  assert.equal(locate(perf, perf.lengthBars - 0.5).section.name, 'Closing chord');
  assert.equal(locate(perf, perf.lengthBars).section.name, 'Closing chord');
});

// ---------- the figures, in the first time through ----------

test('after the cast, 2s have stepped up and 1s are in 2nd place', () => {
  near(pose('A.M', T(4)).p, stance(2, 'M'), 'A.M after cast');
  near(pose('A.W', T(4)).p, stance(2, 'W'), 'A.W after cast');
  inPlace('B', 1, T(4));
});

test('after turning left hand 1¼, the dancing couple face their 1st corners back to back', () => {
  const m = pose('A.M', T(8));
  const w = pose('A.W', T(8));
  facing('A.M', T(8), sub(stance(1, 'W'), m.p), 'A.M faces 2W');
  facing('A.W', T(8), sub(stance(3, 'M'), w.p), 'A.W faces 3M');
  assert.ok(dot(m.h, w.h) < -0.95, 'back to back');
});

test('each half reel swaps the corners it is danced with and leaves the 1s facing the next corners', () => {
  near(pose('B.W', T(12)).p, stance(3, 'M'), '2W in 3rd place men’s side');
  near(pose('C.M', T(12)).p, stance(1, 'W'), '3M in 1st place women’s side');
  facing('A.M', T(12), sub(stance(3, 'W'), pose('A.M', T(12)).p), 'A.M faces 3W');
  near(pose('C.W', T(16)).p, stance(1, 'M'), '3W in 1st place men’s side');
  near(pose('B.M', T(16)).p, stance(3, 'W'), '2M in 3rd place women’s side');
  facing('A.M', T(16), sub(pose('B.W', T(16)).p, pose('A.M', T(16)).p), 'A.M faces 2W in 3rd corner position');
  near(pose('B.W', T(20)).p, stance(1, 'W'), '2W home');
  near(pose('C.M', T(20)).p, stance(3, 'M'), '3M home');
  facing('A.M', T(20), sub(pose('C.W', T(20)).p, pose('A.M', T(20)).p), 'A.M faces 3W in 4th corner position');
  near(pose('C.W', T(24)).p, stance(3, 'W'), '3W home');
  near(pose('B.M', T(24)).p, stance(1, 'M'), '2M home');
});

test('the 1s enter the reels of three across in the middle of the top and bottom', () => {
  near(pose('A.W', T(24)).p, [stance(1, 'W')[0], 0], 'A.W top centre');
  near(pose('A.M', T(24)).p, [stance(3, 'M')[0], 0], 'A.M bottom centre');
});

test('after the reels and after the circle, 2s, 1s, 3s are in places 1, 2, 3', () => {
  for (const t of [T(32), T(40)]) {
    inPlace('B', 1, t);
    inPlace('A', 2, t);
    inPlace('C', 3, t);
  }
});

// ---------- motion quality, over the whole dance ----------

const STEP = 1 / 60;
const ids = perf.dancers.map((d) => d.id);
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const angleOf = (v) => Math.atan2(v[1], v[0]);

for (const s of perf.sections) {
  test(`${s.name}: nobody teleports, crowds or spins`, () => {
    let worst = { d: Infinity };
    let prev = ids.map((id) => pose(id, s.b0));
    for (let t = s.b0 + STEP; t <= s.b1 + 1e-9; t += STEP) {
      const now = ids.map((id) => pose(id, t));
      for (let i = 0; i < ids.length; i++) {
        const speed = dist(now[i].p, prev[i].p) / STEP;
        assert.ok(speed < 2.6, `${ids[i]} moves ${speed.toFixed(2)} m/bar at bar time ${t.toFixed(2)}`);
        const spin = (Math.abs(wrapAngle(angleOf(now[i].h) - angleOf(prev[i].h))) * 180) / Math.PI / STEP;
        assert.ok(spin < 720, `${ids[i]} turns ${spin.toFixed(0)}°/bar at bar time ${t.toFixed(2)}`);
        for (let j = i + 1; j < ids.length; j++) {
          const d = dist(now[i].p, now[j].p);
          if (d < worst.d) worst = { d, t, a: ids[i], b: ids[j] };
        }
      }
      prev = now;
    }
    assert.ok(worst.d >= 0.45, `${worst.a} and ${worst.b} come within ${worst.d.toFixed(2)} m at bar time ${worst.t.toFixed(2)}`);
  });
}
