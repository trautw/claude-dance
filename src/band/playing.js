// How the band moves, as a pure function of bar time, planned from the same note events the
// band plays (src/audio/arrangement.js). Sticks land, piano hands drop and bows turn exactly
// on the notes heard; nothing moves unless bar time does, so pausing freezes the band and every
// speed stays in time.
//
// A "strike" list is the hits one hand (or foot) makes: { t, key } where key says where (a
// drum, or a pitch for a piano hand). strikeAt() says where the hand is between hits and how
// high it is lifted. The bow is planned as strokes: down and up in turn, a slur of two short
// notes per stroke, a long note to itself.

const ROLL_STEP = 1 / 16 + 1e-6; // snare notes this short are a roll, played hand to hand
const REST_GAP = 1.5; // bars without a hit after which a hand settles to rest
const FULL_LIFT_GAP = 0.25; // a hand lifts fully only with this much time between hits

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const byTime = (a, b) => a.t - b.t;

/** Splits the arrangement into what each player's hands do. */
export function planPlaying(events) {
  const of = (inst) => events.filter((e) => e.inst === inst);

  // Drums: right hand on the ride (the hat part), left on the snare, both in rolls; the left
  // takes the crash; the right foot plays the kick.
  const drums = { L: [], R: [], kick: [] };
  let nextRollHand = 'R';
  for (const e of events) {
    if (e.inst === 'hat') drums.R.push({ t: e.bar, key: 'ride' });
    else if (e.inst === 'crash') drums.L.push({ t: e.bar, key: 'crash' });
    else if (e.inst === 'kick') drums.kick.push({ t: e.bar, key: 'pedal' });
    else if (e.inst === 'snare') {
      if (e.dur <= ROLL_STEP) {
        drums[nextRollHand].push({ t: e.bar, key: 'snare' });
        nextRollHand = nextRollHand === 'R' ? 'L' : 'R';
      } else {
        drums.L.push({ t: e.bar, key: 'snare' });
        nextRollHand = 'R';
      }
    }
  }
  for (const k of Object.keys(drums)) drums[k].sort(byTime);

  // Piano: bass notes in the left hand, each chord (notes struck together) in the right.
  const piano = { L: [], R: [] };
  const chords = new Map();
  for (const e of of('piano')) {
    if (e.midi < 55) piano.L.push({ t: e.bar, key: e.midi });
    else chords.set(e.bar, [...(chords.get(e.bar) ?? []), e.midi]);
  }
  for (const [t, notes] of chords) piano.R.push({ t, key: notes.reduce((a, b) => a + b, 0) / notes.length });
  piano.R.sort(byTime);

  // Accordion: the right hand follows the melody (held chords: their middle note).
  const melody = new Map();
  for (const e of of('accordion')) melody.set(e.bar, [...(melody.get(e.bar) ?? []), e.midi]);
  const accordion = [...melody].map(([t, notes]) => ({ t, key: notes.reduce((a, b) => a + b, 0) / notes.length })).sort(byTime);

  return { drums, piano, accordion, bow: planBow(of('fiddle')) };
}

/**
 * Where a hand is at bar time t, given its hits: `from` and `to` keys with `blend` 0–1 between
 * them, `lift` 0 (on the drum or key) to 1 (fully raised) and `rest` 0–1 toward resting.
 */
export function strikeAt(hits, t) {
  const i = lastAtOrBefore(hits, t);
  const prev = hits[i];
  const next = hits[i + 1];
  if (!prev && !next) return { from: null, to: null, blend: 0, lift: 0, rest: 1 };
  if (!prev) {
    // Before the first hit: rest, then come up and in for it.
    const r = 1 - smooth(next.t - 0.6, next.t - 0.2, t);
    return { from: next.key, to: next.key, blend: 0, lift: liftBefore(next.t - t), rest: r };
  }
  if (!next) {
    const r = smooth(prev.t + 0.1, prev.t + 0.5, t);
    return { from: prev.key, to: prev.key, blend: 0, lift: liftAfter(t - prev.t) * (1 - r), rest: r };
  }
  const gap = next.t - prev.t;
  if (gap > REST_GAP) {
    const r = smooth(prev.t + 0.1, prev.t + 0.5, t) * (1 - smooth(next.t - 0.6, next.t - 0.2, t));
    const lift = t - prev.t < next.t - t ? liftAfter(t - prev.t) : liftBefore(next.t - t);
    const half = t - prev.t > gap / 2;
    return { from: half ? next.key : prev.key, to: next.key, blend: half ? 1 : 0, lift: lift * (1 - r), rest: r };
  }
  const u = (t - prev.t) / gap;
  // Up quickly after the hit, then down onto the next: the strike is the faster half.
  const shape = u < 0.45 ? Math.sin((Math.PI / 2) * (u / 0.45)) : Math.cos((Math.PI / 2) * ((u - 0.45) / 0.55)) ** 1.5;
  return { from: prev.key, to: next.key, blend: smooth(0.1, 0.8, u), lift: shape * Math.min(1, gap / FULL_LIFT_GAP), rest: 0 };
}

const liftAfter = (dt) => Math.sin(Math.PI * Math.min(1, dt / 0.25) / 2) * smooth(0, 0.05, dt);
const liftBefore = (dt) => Math.sin(Math.PI * Math.min(1, dt / 0.2) / 2);

function lastAtOrBefore(list, t) {
  let lo = 0;
  let hi = list.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].t <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

// ---------- the bow ----------

export const BOW = { near: 0.1, far: 0.62 }; // contact point from the frog, metres

/** Strokes { t (= t0), t0, t1, p0, p1, midi }: contact point along the bow moves p0 → p1. */
function planBow(notes) {
  notes = [...notes].sort((a, b) => a.bar - b.bar);
  const strokes = [];
  let p = 0.3;
  let down = true;
  for (let i = 0; i < notes.length; i++) {
    const a = notes[i];
    let end = a.bar + a.dur;
    const b = notes[i + 1];
    // Slur two short notes that follow straight on into one stroke.
    if (a.dur < 0.2 && b && b.dur < 0.2 && Math.abs(b.bar - end) < 1e-6) {
      end = b.bar + b.dur;
      i++;
    }
    const travel = Math.min(0.42, Math.max(0.12, (end - a.bar) * 0.9));
    // Down-bow draws the bow toward the frog's side (contact moves toward the tip).
    let target = down ? p + travel : p - travel;
    if (target > BOW.far || target < BOW.near) {
      target = Math.min(BOW.far, Math.max(BOW.near, target));
    }
    strokes.push({ t: a.bar, t0: a.bar, t1: end, p0: p, p1: target, midi: a.midi, down });
    p = target;
    down = !down;
  }
  return strokes;
}

/** The bow at bar time t: `p` contact point from the frog (metres), `midi` the note's string. */
export function bowAt(strokes, t) {
  const i = lastAtOrBefore(strokes, t);
  if (i < 0) return { p: strokes[0]?.p0 ?? 0.3, midi: strokes[0]?.midi ?? 69, moving: false };
  const s = strokes[i];
  if (t >= s.t1) return { p: s.p1, midi: s.midi, moving: false };
  const u = (t - s.t0) / (s.t1 - s.t0);
  // Even speed through the stroke, easing only at the very ends.
  const e = u < 0.1 ? (u * u) / 0.2 : u > 0.9 ? 1 - ((1 - u) * (1 - u)) / 0.2 : 0.05 + (u - 0.1) * (0.9 / 0.8);
  return { p: s.p0 + (s.p1 - s.p0) * e, midi: s.midi, moving: true };
}

/** Accordion bellows opening (metres between the ends): out for two bars, in for two. */
export function bellowsAt(t) {
  const phase = (((t - 2) % 4) + 4) % 4; // turn round at the start of each four-bar phrase half
  const tri = phase < 2 ? phase / 2 : 2 - phase / 2;
  return 0.07 + 0.17 * (tri * tri * (3 - 2 * tri));
}
