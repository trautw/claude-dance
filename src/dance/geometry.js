// Set geometry in the "set frame": points are [d, s] in metres.
//   d runs down the set: 0 at 1st place (the top, nearest the band), growing toward 4th place.
//   s runs across: +s is on your left when you face the top.
// The men's side is s < 0, i.e. on the left of the set as seen from the band.
// The frame maps to world space without mirroring (see toWorld), so shoulders stay right.

export const PLACE_SPACING = 1.2;
export const SIDE_OFFSET = 0.9;
export const PLACES = 4;

export const placeD = (place) => (place - 1) * PLACE_SPACING;
export const sideS = (role) => (role === 'M' ? -SIDE_OFFSET : SIDE_OFFSET);
export const stance = (place, role) => [placeD(place), sideS(role)];
/** Heading of a dancer standing on their own side, facing across the set. */
export const facingIn = (role) => (role === 'M' ? [0, 1] : [0, -1]);

export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const scale = (a, k) => [a[0] * k, a[1] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
export const len = (a) => Math.hypot(a[0], a[1]);
export const dist = (a, b) => len(sub(a, b));
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const norm = (a) => {
  const l = len(a);
  return l > 1e-9 ? [a[0] / l, a[1] / l] : [0, 0];
};
/** Direction on your left / right when heading along h. */
export const leftOf = (h) => [h[1], -h[0]];
export const rightOf = (h) => [-h[1], h[0]];
export const angleOf = (v) => Math.atan2(v[1], v[0]);
export const fromAngle = (phi, r = 1) => [Math.cos(phi) * r, Math.sin(phi) * r];

export const clamp01 = (t) => Math.min(1, Math.max(0, t));
export const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** Rotate heading a toward b by fraction t (shortest way). */
export function slerpHeading(a, b, t) {
  let da = angleOf(b) - angleOf(a);
  da = Math.atan2(Math.sin(da), Math.cos(da));
  return fromAngle(angleOf(a) + da * t);
}

/** Cubic Hermite point between p0 and p1 with end tangents t0, t1. */
export function hermite(p0, t0, p1, t1, u) {
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  return [
    h00 * p0[0] + h10 * t0[0] + h01 * p1[0] + h11 * t1[0],
    h00 * p0[1] + h10 * t0[1] + h01 * p1[1] + h11 * t1[1],
  ];
}

/**
 * Open curve through points (uniform in u), with given start and end tangents
 * expressed per unit of u over the whole curve.
 */
export function curveThrough(points, startTangent, endTangent) {
  const n = points.length - 1;
  const tangents = points.map((p, i) => {
    if (i === 0) return scale(startTangent, 1 / n);
    if (i === n) return scale(endTangent, 1 / n);
    return scale(sub(points[i + 1], points[i - 1]), 0.5);
  });
  return (u) => {
    const x = Math.min(n - 1e-9, Math.max(0, u * n));
    const i = Math.floor(x);
    return hermite(points[i], tangents[i], points[i + 1], tangents[i + 1], x - i);
  };
}

/**
 * Closed track through keyed points [[phase, [x, y]], ...] with period `period`.
 * Phases need not be evenly spaced; tangents follow non-uniform Catmull-Rom.
 */
export function closedTrack(keys, period) {
  const n = keys.length;
  const ph = (i) => keys[((i % n) + n) % n][0] + Math.floor(i / n) * period;
  const pt = (i) => keys[((i % n) + n) % n][1];
  const tan = (i) => scale(sub(pt(i + 1), pt(i - 1)), 1 / (ph(i + 1) - ph(i - 1)));
  return (phase) => {
    const p = ((((phase - keys[0][0]) % period) + period) % period) + keys[0][0];
    let i = 0;
    while (i < n - 1 && keys[i + 1][0] <= p) i++;
    const dt = ph(i + 1) - ph(i);
    return hermite(pt(i), scale(tan(i), dt), pt(i + 1), scale(tan(i + 1), dt), (p - ph(i)) / dt);
  };
}

/** Maps track-local [x, y] (y = left of x) into the set frame. */
export function localFrame(origin, xAxis, unit) {
  const e = norm(xAxis);
  const l = leftOf(e);
  return (p) => add(origin, scale(add(scale(e, p[0]), scale(l, p[1])), unit));
}
