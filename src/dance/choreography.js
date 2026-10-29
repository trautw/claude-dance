// Computes every dancer's floor path from the crib (ADR 0001).
// Time is measured in bars from the start: t = 0 is the downbeat of bar 1.
// A path is a list of segments { b0, b1, pos(u), face?(u, tangent) } with u in [0, 1].

import { CRIB } from './crib.js';
import {
  PLACES, SIDE_OFFSET as H, add, angleOf, closedTrack, curveThrough, dist, facingIn, fromAngle, hermite, lerp,
  len, localFrame, norm, placeD, scale, slerpHeading, smoothstep, stance, sub,
} from './geometry.js';

export const COUPLES = ['A', 'B', 'C', 'D'];
export const ROLES = ['M', 'W'];
export const dancerId = (couple, role) => `${couple}.${role}`;

const EPS = 1e-3;
const TURN_IN_BARS = 0.25;

class Performance {
  constructor() {
    this.dancers = [];
    this.paths = new Map();
    this.state = new Map(); // id -> { p, h } at the end of everything added so far
    COUPLES.forEach((couple, i) => {
      for (const role of ROLES) {
        const id = dancerId(couple, role);
        this.dancers.push({ id, couple, role });
        this.paths.set(id, []);
        this.state.set(id, { p: stance(i + 1, role), h: facingIn(role) });
      }
    });
    this.initial = new Map([...this.state].map(([id, s]) => [id, { ...s }]));
    this.lengthBars = 0;
    this.holds = []; // { a, aHand, b, bHand, b0, b1, fade }: a's hand joins b's hand from b0 to b1
  }

  /** Records two dancers joining hands from b0 to b1, reaching in and letting go over `fade` bars. */
  hold(a, aHand, b, bHand, b0, b1, fade = 0.4) {
    this.holds.push({ a, aHand, b, bHand, b0, b1, fade });
  }

  /** Headings ease over `turnInBars` from wherever the dancer was facing (0 when `face` handles it). */
  move(id, b0, b1, pos, face, { turnInBars = TURN_IN_BARS } = {}) {
    const turnIn = Math.min(1, turnInBars / (b1 - b0));
    const seg = { b0, b1, pos, face, restHeading: this.state.get(id).h, turnIn };
    this.paths.get(id).push(seg);
    this.state.set(id, evalSegment(seg, 1));
    this.lengthBars = Math.max(this.lengthBars, b1);
  }

  /** Pose of a dancer at time t (bars): { p: [d, s], h: unit heading }. */
  poseAt(id, t) {
    const path = this.paths.get(id);
    let last = this.initial.get(id);
    for (const seg of path) {
      if (t < seg.b0) break;
      if (t <= seg.b1) return evalSegment(seg, (t - seg.b0) / (seg.b1 - seg.b0));
      last = seg.end ??= evalSegment(seg, 1);
    }
    return last;
  }
}

function evalSegment(seg, u) {
  const p = seg.pos(u);
  const a = seg.pos(Math.max(0, u - EPS));
  const b = seg.pos(Math.min(1, u + EPS));
  const v = sub(b, a);
  const tangent = len(v) > 1e-7 ? norm(v) : seg.restHeading;
  const h = seg.face ? seg.face(u, tangent) : tangent;
  const w = seg.turnIn > 0 ? smoothstep(0, seg.turnIn, u) : 1;
  return { p, h: slerpHeading(seg.restHeading, norm(h), w) };
}

// ---------- tracks ----------

// Reel of four on a line: ends at x = ±1.5, centres at ±0.5 (one unit = a third of the diagonal).
// Dancers 2 phases apart; one phase per bar. Ends and centres pass by the right, centres pass
// by the left in the middle. Start phases: P0 end 2, P1 centre 0, P2 centre 4, P3 end 6.
const RW = 0.35;
const REEL_OF_FOUR = closedTrack(
  [
    [0, [-0.5, 0]], [0.5, [-1.0, -RW]], [1, [-1.5, -0.55]], [1.5, [-1.85, -0.27]],
    [2, [-1.5, 0]], [2.5, [-1.0, RW]], [3, [-0.5, 0]], [3.5, [0, -RW]],
    [4, [0.5, 0]], [4.5, [1.0, RW]], [5, [1.5, 0.55]], [5.5, [1.85, 0.27]],
    [6, [1.5, 0]], [6.5, [1.0, -RW]], [7, [0.5, 0]], [7.5, [0, RW]],
  ],
  8,
);

// Reel of three on a line: ends at x = ±1, centre at 0, 8 phases per reel, dancers 8/3 apart.
// The centre starts heading toward the +x end and passes that end dancer by the right.
const RIGHT_LOBE = [
  [0, [0, 0]], [0.5, [0.45, 0.28]], [1.2, [1.1, 0.4]], [1.55, [1.35, 0.3]], [1.9, [1.45, 0.05]],
  [2.25, [1.35, -0.2]], [2.6, [1.1, -0.3]], [3.3, [0.5, -0.27]],
];
const REEL_OF_THREE = closedTrack(
  [...RIGHT_LOBE, ...RIGHT_LOBE.map(([ph, [x, y]]) => [ph + 4, [-x, y]])],
  8,
);

const trackTangent = (track, toSet, phase) =>
  scale(sub(toSet(track(phase + EPS)), toSet(track(phase - EPS))), 1 / (2 * EPS));

// ---------- figures ----------

const PASSING_CLEARANCE = 0.3;

/**
 * One bar from `from` to `to` around the middle of the set, bowing out so two dancers
 * passing each other there keep a shoulder width apart.
 */
function passingPath(from, startTangent, to, endHeading, centre) {
  const clear = (t) => {
    const off = sub(lerp(from, to, t), centre);
    return add(centre, scale(norm(off), Math.max(len(off), PASSING_CLEARANCE)));
  };
  const speed = Math.max(len(startTangent), dist(from, to));
  return curveThrough([from, clear(1 / 3), clear(2 / 3), to], scale(startTangent, 0.6), scale(endHeading, speed));
}

/**
 * Heading for a dancer who turns from `startHeading` onto a path and off it to `endHeading`.
 * Turns the same way round throughout, even when the path heads directly away.
 */
function leaveAndReturn(startHeading, endHeading, tangentAt, weight) {
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const ends = [[0, startHeading, 1], [1, endHeading, -1]].map(([u, h, dir]) => {
    const base = angleOf(h);
    let ref = wrap(angleOf(tangentAt(u)) - base);
    // Near a half turn, turn the way the path is curving rather than doubling back.
    const curving = Math.sign(wrap(angleOf(tangentAt(u + dir * 0.02)) - angleOf(tangentAt(u))));
    const wanted = dir > 0 ? curving : -curving;
    if (Math.abs(ref) > (2 * Math.PI) / 3 && Math.sign(ref) !== wanted) ref += wanted * 2 * Math.PI;
    return { base, ref };
  });
  return (u, tangent) => {
    const { base, ref } = ends[u < 0.5 ? 0 : 1];
    const delta = ref + wrap(angleOf(tangent) - base - ref);
    return fromAngle(base + delta * weight(u));
  };
}

/** Turn about `centre`, sweeping `sweep` radians (positive = right hand). */
function turnPath(centre, from, sweep, rMid, rEnd) {
  const phi0 = angleOf(sub(from, centre));
  const r0 = len(sub(from, centre));
  const radius = (u) => r0 + (rMid - r0) * smoothstep(0, 0.25, u) + (rEnd - rMid) * smoothstep(0.75, 1, u);
  // Spread the rotation by 1/radius so dancers travel at an even speed while closing in and out.
  const N = 64;
  const progress = [0];
  for (let i = 1; i <= N; i++) progress.push(progress[i - 1] + 1 / radius((i - 0.5) / N));
  const ease = (u) => {
    const x = Math.min(N - 1e-9, u * N);
    const i = Math.floor(x);
    return (progress[i] + (progress[i + 1] - progress[i]) * (x - i)) / progress[N];
  };
  return (u) => add(centre, fromAngle(phi0 + sweep * ease(u), radius(u)));
}

const FIGURES = {
  turnRightHand(perf, f, ctx) {
    const centre = [ctx.D1, 0];
    for (const role of ROLES) {
      const id = ctx.dancing[role];
      perf.move(id, f.b0, f.b1, turnPath(centre, perf.state.get(id).p, 2 * Math.PI, 0.42, H));
    }
    perf.hold(ctx.dancing.M, 'R', ctx.dancing.W, 'R', f.b0 + 0.1, f.b1 - 0.2);
  },

  castOff(perf, f, ctx) {
    const { D1, D2 } = ctx;
    const man = curveThrough(
      [[D1, -H], [D1 + 0.55, -H - 0.5], [D2 + 0.35, -H - 0.4], [D2, -H]], [1.2, 0], [-0.9, 0.7],
    );
    const woman = curveThrough(
      [[D1, H], [D1 - 0.1, H + 0.45], [D1 + 0.6, H + 0.6], [D2, H]], [-0.8, 0], [0.9, -0.5],
    );
    perf.move(ctx.dancing.M, f.b0, f.b1, man);
    perf.move(ctx.dancing.W, f.b0, f.b1, woman);
    for (const role of ROLES) {
      const from = [D2, stance(1, role)[1]];
      const to = [D1, from[1]];
      perf.move(ctx.second[role], f.b0, f.b1, (u) => lerp(from, to, smoothstep(0, 1, u)), () => facingIn(role));
    }
  },

  turnLeftHandToCorners(perf, f, ctx) {
    const diag = diagonal(ctx, 1);
    for (const role of ROLES) {
      const id = ctx.dancing[role];
      const from = perf.state.get(id).p;
      const target = diag.toSet([role === 'M' ? -0.5 : 0.5, 0]);
      const phi0 = angleOf(sub(from, ctx.centre));
      const phi1 = angleOf(sub(target, ctx.centre));
      // Left-hand turns sweep negative; pick the sweep nearest 1¼ turns.
      const nominal = -2.5 * Math.PI;
      let sweep = phi1 - phi0;
      sweep += Math.round((nominal - sweep) / (2 * Math.PI)) * 2 * Math.PI;
      const path = turnPath(ctx.centre, from, sweep, 0.42, len(sub(target, ctx.centre)));
      const corner = norm(sub(target, ctx.centre));
      perf.move(id, f.b0, f.b1, path, (u, tangent) => slerpHeading(tangent, corner, smoothstep(0.8, 1, u)));
    }
    // Take hands once they've come in from the sides; let go a little before facing corners.
    perf.hold(ctx.dancing.M, 'L', ctx.dancing.W, 'L', f.b0 + 0.45, f.b0 + 3.3, 0.4);
  },

  halfDiagonalReel(perf, f, ctx) {
    const diag = diagonal(ctx, f.corner);
    const p0 = whoStandsAt(perf, diag.p0);
    const p3 = whoStandsAt(perf, diag.p3);
    const phase = new Map([[p0, 2], [ctx.dancing.M, 0], [ctx.dancing.W, 4], [p3, 6]]);
    for (const id of [p0, p3]) {
      const sp = phase.get(id);
      perf.move(id, f.b0, f.b1, (u) => diag.toSet(REEL_OF_FOUR(sp + 4 * u)));
    }
    // The dancing couple dance three bars of the reel, then in the fourth pass each other
    // by the left in the middle and come out facing their next corners.
    const next = f.corner < 4 ? nextDiagonalStart(ctx, f.corner + 1) : reelsOfThreeStart(ctx);
    for (const role of ROLES) {
      const id = ctx.dancing[role];
      const sp = phase.get(id);
      perf.move(id, f.b0, f.b0 + 3, (u) => diag.toSet(REEL_OF_FOUR(sp + 3 * u)));
      const from = diag.toSet(REEL_OF_FOUR(sp + 3));
      const t0 = trackTangent(REEL_OF_FOUR, diag.toSet, sp + 3);
      const { p, h } = next[role];
      perf.move(id, f.b0 + 3, f.b1, passingPath(from, t0, p, h, ctx.centre));
    }
  },

  reelsOfThreeAcross(perf, f, ctx) {
    const reels = reelsOfThree(ctx);
    for (const role of ROLES) {
      const { toSet, line } = reels[role];
      // The dancing dancer follows the reel, then peels off into 2nd place on their own side.
      const id = ctx.dancing[role];
      const peel = 6.75;
      perf.move(id, f.b0, f.b0 + peel, (u) => toSet(REEL_OF_THREE(peel * u)));
      const from = toSet(REEL_OF_THREE(peel));
      const exitBars = 8 - peel;
      const t0 = scale(trackTangent(REEL_OF_THREE, toSet, peel), exitBars);
      const home = stance(ctx.place + 1, role);
      const t1 = scale(norm(sub(home, from)), len(t0));
      perf.move(id, f.b0 + peel, f.b1, (u) => hermite(from, t0, home, t1, u),
        (u, tangent) => slerpHeading(tangent, facingIn(role), smoothstep(0.5, 1, u)));
      // End dancers: blend in from their places and back out to them.
      // The end dancer passed first slips straight in; the other curves out and round into the reel.
      const ends = [[whoStandsAt(perf, line(1)), 8 / 3, 0.8], [whoStandsAt(perf, line(-1)), 16 / 3, 1.5]];
      for (const [endId, sp, blendBars] of ends) {
        const home = perf.state.get(endId).p;
        const inFacing = facingIn(perf.dancers.find((d) => d.id === endId).role);
        const blend = (u) => smoothstep(0, blendBars / 8, u) * (1 - smoothstep(1 - blendBars / 8, 1, u));
        const trackHeading = (u) => norm(trackTangent(REEL_OF_THREE, toSet, sp + 8 * u));
        perf.move(endId, f.b0, f.b1, (u) => lerp(home, toSet(REEL_OF_THREE(sp + 8 * u)), blend(u)),
          leaveAndReturn(perf.state.get(endId).h, inFacing, trackHeading, blend), { turnInBars: 0 });
      }
    }
  },

  circleSix(perf, f, ctx) {
    const R = 1.1;
    // When the dancing couple step down, the circle finishes by bar 38 and in bars 39–40 the
    // dancing couple (inside) and the bottom couple (outside) change places.
    // Halfway round and back normally; two places round when the circle has to make room.
    const timing = ctx.stepDown
      ? { turn: (2 * Math.PI) / 3, roundEnd: 3.3, backEnd: 6, outStart: 6, outEnd: 7 }
      : { turn: Math.PI, roundEnd: 4, backEnd: 7.7, outStart: 7.4, outEnd: 8 };
    const ring = [ctx.second, ctx.dancing, ctx.third].flatMap((c) => [c.M, c.W]);
    const places = [];
    for (const id of ring) {
      const { couple, role } = perf.dancers.find((d) => d.id === id);
      const home = perf.state.get(id).p;
      // Even out the ring: snap each dancer to the nearest of six equally spaced angles.
      const phiHome = angleOf(sub(home, ctx.centre));
      const phi = Math.round((phiHome - Math.PI / 6) / (Math.PI / 3)) * (Math.PI / 3) + Math.PI / 6;
      places.push({ id, phi });
      const ringAt = (t) => {
        // Round to the left (anticlockwise in the set frame) halfway, then back.
        const rot = timing.turn * (smoothstep(0.3, timing.roundEnd, t) - smoothstep(timing.roundEnd, timing.backEnd, t));
        return add(ctx.centre, fromAngle(phi + rot, R));
      };

      let out = { start: timing.outStart, end: timing.outEnd, path: null };
      const steps = ctx.stepDown && (couple === ctx.dancingCouple || couple === ctx.thirdCouple);
      if (steps) {
        const goingDown = couple === ctx.dancingCouple;
        const to = stance(goingDown ? ctx.place + 2 : ctx.place + 1, role);
        const from = ringAt(timing.outStart);
        // Coming out of the ring, the couple stepping down pass on the outside, the couple
        // stepping up on the inside.
        const mid = lerp(from, to, 0.5);
        mid[1] = goingDown ? mid[1] + Math.sign(mid[1]) * 0.2 : mid[1] * 0.6;
        out = { start: timing.outStart, end: 8, path: curveThrough([from, mid, to], [0, 0], [0, 0]) };
      }
      const outW = (t) => smoothstep(out.start, out.end, t);
      const pos = (u) => {
        const t = 8 * u;
        if (out.path && t >= out.start) return out.path(smoothstep(0, 1, (t - out.start) / (out.end - out.start)));
        return lerp(home, ringAt(t), smoothstep(0, 0.6, t) * (1 - outW(t)));
      };
      perf.move(id, f.b0, f.b1, pos, (u) => {
        const t = 8 * u;
        const inW = smoothstep(0, 0.6, t) * (1 - outW(t));
        return slerpHeading(facingIn(role), norm(sub(ctx.centre, ringAt(t))), inW);
      });
    }
    // Facing in, each dancer's left hand takes the right hand of the neighbour on their left
    // (the next one anticlockwise).
    places.sort((a, b) => a.phi - b.phi);
    places.forEach(({ id }, i) => {
      const next = places[(i + 1) % places.length].id;
      perf.hold(id, 'L', next, 'R', f.b0 + 0.45, f.b0 + timing.outStart);
    });
  },
};

// ---------- figure geometry ----------

/** The n-th diagonal (1–4) the dancing couple reel on, by the dancing man's corner positions. */
function diagonal(ctx, n) {
  const { D1, D3 } = ctx;
  const cornerPositions = [[D1, H], [D3, H], [D3, -H], [D1, -H]];
  const p0 = cornerPositions[n - 1];
  const p3 = cornerPositions[(n + 1) % 4];
  const axis = sub(p3, p0);
  return { p0, p3, toSet: localFrame(ctx.centre, axis, len(axis) / 3) };
}

function nextDiagonalStart(ctx, n) {
  const diag = diagonal(ctx, n);
  const e = norm(sub(diag.p3, diag.p0));
  return {
    M: { p: diag.toSet([-0.5, 0]), h: scale(e, -1) },
    W: { p: diag.toSet([0.5, 0]), h: e },
  };
}

/** Reels across: the dancing woman with the couple above, the man with the couple below. */
function reelsOfThree(ctx) {
  // dir: which side (+1 women's, -1 men's) holds the end dancer passed first.
  const build = (d, dir) => ({
    toSet: localFrame([d, 0], [0, dir], H),
    line: (x) => [d, dir * x * H],
  });
  // Each dancing dancer first passes their 2nd corner by the right.
  return { M: build(ctx.D3, 1), W: build(ctx.D1, -1) };
}

function reelsOfThreeStart(ctx) {
  const reels = reelsOfThree(ctx);
  const start = (role) => {
    const { toSet } = reels[role];
    return { p: toSet(REEL_OF_THREE(0)), h: norm(trackTangent(REEL_OF_THREE, toSet, 0)) };
  };
  return { M: start('M'), W: start('W') };
}

function whoStandsAt(perf, point) {
  let best = null;
  let bestDist = Infinity;
  for (const [id, { p }] of perf.state) {
    const d = len(sub(p, point));
    if (d < bestDist) [best, bestDist] = [id, d];
  }
  if (bestDist > 0.05) throw new Error(`Nobody stands at ${point} (closest ${best} at ${bestDist.toFixed(2)} m)`);
  return best;
}

// ---------- building the performance ----------

/** Adds one time through with the dancing couple starting in `place`, beginning at bar time `start`. */
function addTimeThrough(perf, start, place, { stepDown }) {
  const byPlace = (p) => {
    const id = whoStandsAt(perf, stance(p, 'M'));
    const couple = id.split('.')[0];
    return { M: dancerId(couple, 'M'), W: dancerId(couple, 'W') };
  };
  const ctx = {
    place,
    D1: placeD(place),
    D2: placeD(place + 1),
    D3: placeD(place + 2),
    centre: [placeD(place + 1), 0],
    dancing: byPlace(place),
    second: byPlace(place + 1),
    third: byPlace(place + 2),
    stepDown,
  };
  ctx.dancingCouple = ctx.dancing.M.split('.')[0];
  ctx.thirdCouple = ctx.third.M.split('.')[0];
  for (const fig of CRIB.figures) {
    FIGURES[fig.kind](perf, { ...fig, b0: start + fig.bars[0] - 1, b1: start + fig.bars[1] }, ctx);
  }
  if (place + 2 > PLACES) throw new Error('Not enough couples below the dancing couple');
}

/**
 * The whole dance: opening chord, every time through, closing chord.
 * `perf.sections` describes its structure in bar time.
 */
export function createPerformance({ timesThrough = CRIB.timesThrough } = {}) {
  const perf = new Performance();
  const sections = [{ kind: 'chord', name: 'Opening chord', b0: 0, b1: CRIB.chordBars }];
  let start = CRIB.chordBars;
  for (let n = 1; n <= timesThrough; n++) {
    const place = CRIB.dancingCouplePlaces[n - 1];
    const dancingCouple = whoStandsAt(perf, stance(place, 'M')).split('.')[0];
    const stepDown = place === PLACES - 2;
    addTimeThrough(perf, start, place, { stepDown });
    sections.push({
      kind: 'timeThrough', n, name: `Time through ${n}`, dancingCouple, place,
      b0: start, b1: start + CRIB.barsPerTimeThrough,
    });
    start += CRIB.barsPerTimeThrough;
  }
  sections.push({ kind: 'chord', name: 'Closing chord', b0: start, b1: start + CRIB.chordBars });
  perf.sections = sections;
  perf.lengthBars = start + CRIB.chordBars;
  return perf;
}

/**
 * Where bar time `t` falls in the dance: its section, the bar within it (1-based),
 * and during a time through the current and next figure.
 */
export function locate(perf, t) {
  const sections = perf.sections;
  const section = sections.find((s) => t < s.b1) ?? sections[sections.length - 1];
  const bar = Math.min(section.b1 - section.b0, Math.floor(t - section.b0) + 1);
  if (section.kind !== 'timeThrough') return { section, bar, figure: null, nextFigure: null };
  const i = CRIB.figures.findIndex((f) => bar <= f.bars[1]);
  return { section, bar, figure: CRIB.figures[i], nextFigure: CRIB.figures[i + 1] ?? null };
}

export { Performance };
