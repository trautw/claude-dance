// What the spectator and the camera can't pass through, derived from the shared hall layout.
// Positions are world metres; boxes are axis-aligned { minX, maxX, minY, maxY, minZ, maxZ }.

export function collidersFromLayout(L) {
  const I = L.interior;
  const b = L.benches;
  const benchBoxes = b.xs.flatMap((x) =>
    [[I.minZ + b.gap, I.minZ + b.gap + b.depth], [I.maxZ - b.gap - b.depth, I.maxZ - b.gap]].map(([minZ, maxZ]) => ({
      minX: x - b.length / 2, maxX: x + b.length / 2, minY: 0, maxY: b.seat, minZ, maxZ,
    })),
  );
  return {
    interior: { minX: I.minX, maxX: I.maxX, minY: 0, maxY: I.height, minZ: I.minZ, maxZ: I.maxZ },
    obstacles: [
      { ...L.stage, minY: 0, maxY: L.stage.height },
      { ...L.steps, minY: 0, maxY: L.stage.height },
      ...benchBoxes,
    ],
  };
}

/** Pushes a circle (x, z, radius) out of walls and obstacles. Returns the corrected [x, z]. */
export function resolveCircle(x, z, r, { interior, obstacles }) {
  for (let pass = 0; pass < 3; pass++) {
    x = Math.min(interior.maxX - r, Math.max(interior.minX + r, x));
    z = Math.min(interior.maxZ - r, Math.max(interior.minZ + r, z));
    for (const o of obstacles) {
      const cx = Math.min(o.maxX, Math.max(o.minX, x));
      const cz = Math.min(o.maxZ, Math.max(o.minZ, z));
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-12) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        z = cz + (dz / d) * r;
      } else {
        // Centre inside the box: leave by the nearest face.
        const exits = [
          [o.minX - r - x, 0], [o.maxX + r - x, 0], [0, o.minZ - r - z], [0, o.maxZ + r - z],
        ].sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
        x += exits[0][0];
        z += exits[0][1];
      }
    }
  }
  return [x, z];
}

/** Distance along a ray (origin o, unit direction d, both [x, y, z]) to a box, or Infinity. */
export function rayEnterBox(o, d, box) {
  let t0 = -Infinity;
  let t1 = Infinity;
  for (const [axis, lo, hi] of [[0, box.minX, box.maxX], [1, box.minY, box.maxY], [2, box.minZ, box.maxZ]]) {
    if (Math.abs(d[axis]) < 1e-9) {
      if (o[axis] < lo || o[axis] > hi) return Infinity;
      continue;
    }
    const a = (lo - o[axis]) / d[axis];
    const b = (hi - o[axis]) / d[axis];
    t0 = Math.max(t0, Math.min(a, b));
    t1 = Math.min(t1, Math.max(a, b));
  }
  return t1 >= Math.max(t0, 0) && t0 > 0 ? t0 : Infinity;
}

/** Distance along a ray from inside a box to where it leaves. */
export function rayExitBox(o, d, box) {
  let t = Infinity;
  for (const [axis, lo, hi] of [[0, box.minX, box.maxX], [1, box.minY, box.maxY], [2, box.minZ, box.maxZ]]) {
    if (d[axis] > 1e-9) t = Math.min(t, (hi - o[axis]) / d[axis]);
    else if (d[axis] < -1e-9) t = Math.min(t, (lo - o[axis]) / d[axis]);
  }
  return t;
}

const CAMERA_MARGIN = 0.25;

/**
 * How far the camera may sit from `pivot` along direction `back` (unit, pointing from the
 * pivot toward the camera) without leaving the hall or entering an obstacle.
 */
export function cameraReach(pivot, back, wanted, colliders) {
  const I = colliders.interior;
  const inner = {
    minX: I.minX + CAMERA_MARGIN, maxX: I.maxX - CAMERA_MARGIN,
    minY: 0.3, maxY: I.maxY - 0.6,
    minZ: I.minZ + CAMERA_MARGIN, maxZ: I.maxZ - CAMERA_MARGIN,
  };
  let reach = Math.min(wanted, rayExitBox(pivot, back, inner));
  for (const o of colliders.obstacles) {
    const grown = {
      minX: o.minX - CAMERA_MARGIN, maxX: o.maxX + CAMERA_MARGIN, minY: o.minY, maxY: o.maxY + CAMERA_MARGIN,
      minZ: o.minZ - CAMERA_MARGIN, maxZ: o.maxZ + CAMERA_MARGIN,
    };
    reach = Math.min(reach, rayEnterBox(pivot, back, grown));
  }
  return Math.max(0.1, reach);
}
