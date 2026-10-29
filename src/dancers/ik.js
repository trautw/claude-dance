// Small helpers for posing bones in world space, shared by the dancers and the band:
// aim a bone at a point, two-bone IK for arms and legs, rotate or move a bone in world terms.
import * as THREE from 'three';

// Scratch objects, reused every frame.
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _p = new THREE.Quaternion();

/** Rotates `bone` (in world space) so the point `from` on it moves toward `to`. */
export function aim(bone, from, to) {
  const origin = bone.getWorldPosition(_c);
  const f = _a.subVectors(from, origin).normalize();
  const t = _b.subVectors(to, origin).normalize();
  if (f.lengthSq() < 1e-12 || t.lengthSq() < 1e-12) return;
  _q.setFromUnitVectors(f, t);
  bone.parent.getWorldQuaternion(_p);
  const local = _p.clone().invert().multiply(_q).multiply(_p);
  bone.quaternion.premultiply(local);
  bone.updateMatrixWorld(true);
}

/**
 * Two-bone IK: bends root→mid→end so `end` reaches `target`, bending toward `pole`.
 * Near full stretch the limb straightens gradually; out-of-reach targets are reached toward.
 */
export function twoBone(root, mid, end, target, pole) {
  const a0 = root.getWorldPosition(new THREE.Vector3());
  const b0 = mid.getWorldPosition(new THREE.Vector3());
  const c0 = end.getWorldPosition(new THREE.Vector3());
  const l1 = a0.distanceTo(b0);
  const l2 = b0.distanceTo(c0);
  const toTarget = target.clone().sub(a0);
  // Soft limit: approach full extension gradually, so the joint never snaps straight.
  const full = l1 + l2;
  const soft = full * 0.95;
  const raw = toTarget.length();
  const reach = raw <= soft ? raw : soft + (full - soft) * (1 - Math.exp(-(raw - soft) / (full - soft)));
  const d = Math.max(Math.abs(l1 - l2) + 1e-4, Math.min(reach, full - 1e-4));
  const dir = toTarget.normalize();
  const perp = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const bendWanted = a0.clone().addScaledVector(dir, along).addScaledVector(perp, Math.sqrt(Math.max(0, l1 * l1 - along * along)));
  aim(root, b0, bendWanted);
  aim(mid, end.getWorldPosition(new THREE.Vector3()), a0.clone().addScaledVector(dir, d));
}

export function rotateWorld(bone, axis, angle) {
  _q.setFromAxisAngle(axis, angle);
  bone.parent.getWorldQuaternion(_p);
  bone.quaternion.premultiply(_p.clone().invert().multiply(_q).multiply(_p));
  bone.updateMatrixWorld(true);
}

export function moveWorld(bone, delta) {
  bone.parent.updateWorldMatrix(true, false);
  const inv = new THREE.Matrix3().setFromMatrix4(bone.parent.matrixWorld).invert();
  bone.position.add(delta.clone().applyMatrix3(inv));
  bone.updateMatrixWorld(true);
}
