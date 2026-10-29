// What the spectator can interact with from where they stand (pressing E), first match wins:
// a dancer nearby in the direction they look (select them, or deselect them if already
// selected); the band, from the floor in front of the stage (pause or resume); otherwise, with
// a dancer selected, clearing the selection.

export const SELECT_RANGE = 3.5; // metres
export const SELECT_CONE = (32 * Math.PI) / 180; // either side of where the spectator looks

/**
 * @param {{x: number, z: number}} at the spectator
 * @param layout the hall layout
 * @param {object} [o]
 * @param {number} [o.yaw] where the spectator looks: direction (sin yaw, cos yaw) in x/z
 * @param {{id: string, x: number, z: number}[]} [o.dancers] where the dancers are now
 * @param {string|null} [o.selected] the selected dancer's id
 */
export function interactionAt({ x, z }, layout, { yaw = 0, dancers = [], selected = null } = {}) {
  const dancer = dancerInView({ x, z }, yaw, dancers);
  if (dancer) return { kind: 'dancer', id: dancer.id, selected: dancer.id === selected };
  const zone = layout.band.zone;
  if (x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ) return { kind: 'band' };
  if (selected) return { kind: 'clear', id: selected };
  return null;
}

/** The dancer in range that the spectator looks most nearly at, if any is inside the cone. */
function dancerInView({ x, z }, yaw, dancers) {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  let best = null;
  let bestScore = Infinity;
  for (const d of dancers) {
    const dx = d.x - x;
    const dz = d.z - z;
    const dist = Math.hypot(dx, dz);
    if (dist > SELECT_RANGE || dist < 1e-6) continue;
    const angle = Math.acos(Math.min(1, Math.max(-1, (dx * fx + dz * fz) / dist)));
    if (angle > SELECT_CONE) continue;
    // Mostly the one looked at; nearer breaks near-ties.
    const score = angle + 0.06 * dist;
    if (score < bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}
