// The spectator: walks or runs relative to where the camera looks, turns to face the way they
// move, and can't pass the walls, stage or benches. Pure state + step, no rendering.
import { resolveCircle } from '../world/collision.js';

export const WALK_SPEED = 1.7; // m/s
export const RUN_SPEED = 4.2;
export const RADIUS = 0.3;
const ACCEL = 9; // how quickly velocity follows input (1/s)
const TURN = 10; // how quickly the body turns toward travel (1/s)

export function createSpectator({ x, z, facing }) {
  return { x, z, vx: 0, vz: 0, yaw: Math.atan2(facing[0], facing[1]) };
}

/**
 * Advances the spectator by `dt` seconds.
 * input: { forward, back, left, right, run } booleans; cameraYaw: the way the camera looks,
 * as an angle where direction = (sin yaw, cos yaw) in world x/z.
 */
export function stepSpectator(s, input, cameraYaw, dt, colliders) {
  const fx = Math.sin(cameraYaw);
  const fz = Math.cos(cameraYaw);
  // Right of a direction (fx, fz) on the floor, seen from above with y up.
  const rx = -fz;
  const rz = fx;
  let mx = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
  let mr = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const mag = Math.hypot(mx, mr);
  if (mag > 0) {
    mx /= mag;
    mr /= mag;
  }
  const speed = input.run ? RUN_SPEED : WALK_SPEED;
  const tx = (fx * mx + rx * mr) * speed;
  const tz = (fz * mx + rz * mr) * speed;
  const k = 1 - Math.exp(-ACCEL * dt);
  s.vx += (tx - s.vx) * k;
  s.vz += (tz - s.vz) * k;

  const [x, z] = resolveCircle(s.x + s.vx * dt, s.z + s.vz * dt, RADIUS, colliders);
  // Whatever a wall took away from the move is taken off the velocity too.
  if (dt > 0) {
    s.vx = (x - s.x) / dt;
    s.vz = (z - s.z) / dt;
  }
  s.x = x;
  s.z = z;

  const moving = Math.hypot(s.vx, s.vz);
  if (moving > 0.15) {
    const want = Math.atan2(s.vx, s.vz);
    const d = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
    s.yaw += d * (1 - Math.exp(-TURN * dt));
  }
  return s;
}

export const speedOf = (s) => Math.hypot(s.vx, s.vz);
