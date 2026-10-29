// Where each dancer's feet touch the floor, as a pure function of bar time (ADR 0002).
//
// Every bar a dancer is either standing (first position), travelling in skip change of step,
// or travelling sideways in slip step (the circle). Each step produces "stances": a foot
// planted at a fixed floor point from a plant time to a lift time. Between stances the foot
// swings. Stance points are taken from where the body will be partway through the stance, so
// the foot sits under the dancer while it bears weight and never slides, whatever the speed.
//
// Skip change of step, one bar, leading foot X, other foot Y ("and 1 and 2"):
//   1      X steps forward               X planted 0.00–0.30
//   and    Y closes behind X             Y planted 0.25–0.55
//   2      X steps forward again         X planted 0.50–0.875
//   and    hop on X, Y swings through    X lands 0.97, Y swings forward to lead next bar
// Lead feet alternate bar by bar, starting with the right.

import { locate } from './choreography.js';
import { add, dist, leftOf, scale } from './geometry.js';

export const FEET = ['L', 'R'];
const SIDE = { L: 1, R: -1 }; // along the dancer's left
const TRAVEL_THRESHOLD = 0.2; // metres in a bar below which a dancer stands
export const TURNOUT = { stand: 0.5, step: 0.3 }; // radians each foot points out
export const BALL_LIFT = 0.045; // heel raised: ankle this much higher when dancing on the balls of the feet

/** Mode for every whole bar of the dance: 'stand' | 'skip' | 'slip'. */
function barModes(perf, id) {
  const modes = [];
  for (let n = 0; n < Math.ceil(perf.lengthBars); n++) {
    const { section, figure } = locate(perf, n + 0.5);
    let travelled = 0;
    let prev = perf.poseAt(id, n).p;
    for (let k = 1; k <= 8; k++) {
      const p = perf.poseAt(id, n + k / 8).p;
      travelled += dist(p, prev);
      prev = p;
    }
    if (section.kind === 'chord' || travelled < TRAVEL_THRESHOLD) modes.push('stand');
    else modes.push(figure?.kind === 'circleSix' ? 'slip' : 'skip');
  }
  return modes;
}

/** Floor point for a foot at bar time t, offset forward/sideways from the body. */
function pointAt(perf, id, t, foot, forward, sideways) {
  const { p, h } = perf.poseAt(id, t);
  return add(add(p, scale(h, forward)), scale(leftOf(h), SIDE[foot] * sideways));
}

export function planFootwork(perf, id) {
  const modes = barModes(perf, id);
  const stances = { L: [], R: [] };
  const last = (f) => stances[f][stances[f].length - 1];
  const at = (t, foot, forward, sideways, kind) => ({ point: pointAt(perf, id, t, foot, forward, sideways), kind });
  /** Under the body a little before halfway through a stance (balances reach at landing and at lift-off). */
  const mid = (t0, t1, foot, forward, sideways) => at(t0 + 0.42 * (t1 - t0), foot, forward, sideways, 'step');

  // Both feet start in first position, planted for good until told to lift.
  for (const f of FEET) stances[f].push({ t0: -Infinity, t1: Infinity, ...at(0, f, 0.03, 0.045, 'stand') });

  /** Plants foot f at t0 (lifting its current stance at `liftBy` if still planted). */
  const plant = (f, t0, t1, where, liftBy = t0 - 0.12) => {
    const prev = last(f);
    // Lift the foot in time to swing to the new spot; a stance squeezed to nothing never happened.
    const end = Math.min(prev.t1, liftBy, t0 - 0.06);
    if (end - prev.t0 < 0.04 && stances[f].length > 1) stances[f].pop();
    else prev.t1 = end;
    // Never land on the other foot: keep a foot's width between them.
    const other = last(f === 'L' ? 'R' : 'L');
    if (other.t0 <= t0 && other.t1 >= t0) {
      const gap = dist(where.point, other.point);
      const MIN = 0.09;
      if (gap < MIN) {
        const away = gap > 1e-6 ? scale([where.point[0] - other.point[0], where.point[1] - other.point[1]], 1 / gap)
          : leftOf(perf.poseAt(id, t0).h).map((v) => v * SIDE[f]);
        where = { ...where, point: add(other.point, scale(away, MIN)) };
      }
    }
    stances[f].push({ t0, t1, ...where });
  };

  let lead = 'R';
  modes.forEach((mode, n) => {
    const prevMode = modes[n - 1] ?? 'stand';
    if (mode === 'skip') {
      lead = prevMode === 'skip' ? (lead === 'R' ? 'L' : 'R') : 'R';
      const x = lead;
      const y = x === 'R' ? 'L' : 'R';
      plant(x, n, n + 0.3, mid(n, n + 0.3, x, 0.04, 0.07));
      plant(y, n + 0.25, n + 0.55, mid(n + 0.25, n + 0.55, y, -0.06, 0.035), n + 0.1);
      plant(x, n + 0.5, n + 0.875, mid(n + 0.5, n + 0.875, x, 0.04, 0.07));
      plant(x, n + 0.97, Infinity, mid(n + 0.97, n + 1.1, x, 0.02, 0.07));
    } else if (mode === 'slip') {
      // Lead with the foot on the side the dancer is travelling toward.
      const { p: p0, h } = perf.poseAt(id, n);
      const { p: p1 } = perf.poseAt(id, n + 1);
      const toward = (p1[0] - p0[0]) * leftOf(h)[0] + (p1[1] - p0[1]) * leftOf(h)[1];
      const x = toward >= 0 ? 'L' : 'R';
      const y = x === 'R' ? 'L' : 'R';
      // Step out, close, step out, close, springing lightly between. The closing foot lands under
      // the body, but never past the leading foot.
      const close = (t0, t1, out) => {
        const under = mid(t0, t1, y, 0, 0.06);
        const { h } = perf.poseAt(id, (t0 + t1) / 2);
        const toward = scale(leftOf(h), SIDE[x]);
        const beside = add(out.point, scale(toward, -0.1));
        const along = (q) => q[0] * toward[0] + q[1] * toward[1];
        return along(under.point) < along(beside) ? under : { point: beside, kind: 'step' };
      };
      const out1 = mid(n, n + 0.2, x, 0, 0.14);
      plant(x, n, n + 0.2, out1);
      plant(y, n + 0.22, n + 0.45, close(n + 0.22, n + 0.45, out1), n + 0.05);
      const out2 = mid(n + 0.5, n + 0.7, x, 0, 0.14);
      plant(x, n + 0.5, n + 0.7, out2);
      plant(y, n + 0.72, n + 0.95, close(n + 0.72, n + 0.95, out2));
    } else if (prevMode !== 'stand') {
      // Coming to rest: whichever foot is in the air lands in first position, then the other joins it.
      const airborne = FEET.filter((f) => last(f).t1 <= n + 1e-9);
      const planted = FEET.filter((f) => last(f).t1 > n + 1e-9);
      for (const f of airborne) plant(f, n, Infinity, at(n, f, 0.03, 0.045, 'stand'));
      planted.forEach((f, i) => plant(f, n + 0.3 + 0.25 * i, Infinity, at(n + 0.3, f, 0.03, 0.045, 'stand'), n + 0.12 + 0.25 * i));
    }
  });
  return { perf, id, modes, stances };
}

const SWING_HEIGHT = 0.11;

/**
 * Where a foot is at bar time t: { point: [d, s], lift: height of the swing arc (0 when planted),
 * planted, kind, swing: 0–1 progress through a swing }.
 */
export function footAt(plan, foot, t) {
  const list = plan.stances[foot];
  let lo = 0;
  let hi = list.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (list[mid].t0 <= t) lo = mid;
    else hi = mid - 1;
  }
  const s = list[lo];
  if (t <= s.t1 || lo === list.length - 1) return { point: s.point, lift: 0, planted: true, kind: s.kind, swing: 0 };
  const next = list[lo + 1];
  const u = (t - s.t1) / (next.t0 - s.t1);
  const e = u * u * (3 - 2 * u);
  // Swing with the body: blend the foot's offset from the body at lift-off into its offset at
  // landing, so in a fast turn the free foot keeps up rather than cutting across the circle.
  const body = (time) => plan.perf.poseAt(plan.id, time).p;
  const from = [s.point[0] - body(s.t1)[0], s.point[1] - body(s.t1)[1]];
  const to = [next.point[0] - body(next.t0)[0], next.point[1] - body(next.t0)[1]];
  const here = body(t);
  return {
    point: [here[0] + from[0] + (to[0] - from[0]) * e, here[1] + from[1] + (to[1] - from[1]) * e],
    lift: Math.sin(Math.PI * u) * SWING_HEIGHT * Math.min(1, (next.t0 - s.t1) / 0.25),
    planted: false,
    kind: next.kind,
    swing: u,
  };
}

/** Ankle height above its flat-footed height: up on the ball of the foot while dancing. */
export function ankleRaise(foot) {
  return foot.kind === 'step' ? BALL_LIFT : 0;
}

/**
 * How far the hips rise over their standing height at bar time t: up on the toes, the hop
 * of skip change, the spring of slip step, and a little lower when covering ground fast.
 */
export function bodyRise(plan, t) {
  const n = Math.floor(t);
  const mode = plan.modes[n] ?? 'stand';
  const u = t - n;
  if (mode === 'stand') return 0;
  const a = plan.perf.poseAt(plan.id, t - 0.1).p;
  const b = plan.perf.poseAt(plan.id, t + 0.1).p;
  const speed = dist(a, b) / 0.2; // metres per bar
  const sink = -0.05 * Math.min(1, speed / 2) ** 2;
  if (mode === 'skip') {
    const hop = u > 0.86 && u < 0.98 ? Math.sin((Math.PI * (u - 0.86)) / 0.12) * 0.05 : 0;
    return 0.015 + sink + hop - 0.01 * Math.cos(4 * Math.PI * u);
  }
  // Slip step is danced with softer knees.
  return -0.025 + sink + 0.02 * Math.abs(Math.sin(2 * Math.PI * u));
}

const REACH = 0.995; // never quite lock the knee

/**
 * Hip-joint height and both feet at bar time t, for a body of the given proportions.
 * The hips sit at their intended height (bodyRise) unless the feet are far enough apart to
 * need them lower; then they drop just enough for both legs to reach, as a dancer's would.
 */
export function legPose(plan, body, t) {
  const { p, h } = plan.perf.poseAt(plan.id, t);
  const left = leftOf(h);
  let hipY = body.hipHeight + bodyRise(plan, t);
  const feet = {};
  for (const f of FEET) {
    const foot = footAt(plan, f, t);
    const hip = add(p, scale(left, SIDE[f] * body.hipWidth));
    const ankleY = body.ankleHeight + foot.lift + ankleRaise(foot);
    const across = dist(hip, foot.point);
    const reach = body.legLength * REACH;
    if (across < reach) hipY = Math.min(hipY, ankleY + Math.sqrt(reach * reach - across * across));
    feet[f] = { ...foot, ankleY, hip };
  }
  return { hipY, feet };
}
