// Where joined hands meet, from the dance's hand-hold schedule. Pure: given each dancer's
// shoulder positions, says which hands are held at bar time t, how firmly (0–1, easing in and
// out), and the grip point both hands reach for.

/** Hands meet this far below the line between the two shoulders. */
export const GRIP_DROP = 0.22;

const ease = (x) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** Holds active at bar time t: [{ hold, weight }]. */
export function activeHolds(perf, t) {
  const out = [];
  for (const hold of perf.holds) {
    if (t < hold.b0 || t > hold.b1) continue;
    const weight = Math.min(ease((t - hold.b0) / hold.fade), ease((hold.b1 - t) / hold.fade));
    if (weight > 0) out.push({ hold, weight });
  }
  return out;
}

/** Grip point between two shoulders (world [x, y, z] arrays or Vector3-likes). */
export function gripPoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - GRIP_DROP, z: (a.z + b.z) / 2 };
}
