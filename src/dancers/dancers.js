// Loads the Blender-built dancers and makes one rigged, dressed figure per dancer in the set.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { activeHolds, gripPoint } from '../dance/holds.js';
import { DancerRig } from './rig.js';

export async function loadDancers({ perf, toWorld }) {
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/dancers.glb`);
  const templates = { M: gltf.scene.getObjectByName('Man'), W: gltf.scene.getObjectByName('Woman') };
  const clips = {
    M: gltf.animations.find((a) => a.name === 'bow'),
    W: gltf.animations.find((a) => a.name === 'curtsey'),
  };
  return perf.dancers.map((dancer) => new DancerRig({
    template: templates[dancer.role], clip: clips[dancer.role], dancer, perf, toWorld,
  }));
}

/**
 * Poses every dancer for bar time t: bodies and feet first, then joined hands, which need
 * both partners' shoulders where they now are.
 */
export function poseDancers(rigs, perf, t) {
  for (const r of rigs) r.update(t);
  if (!rigs.length) return;
  const byId = new Map(rigs.map((r) => [r.dancer.id, r]));
  for (const { hold, weight } of activeHolds(perf, t)) {
    const a = byId.get(hold.a);
    const b = byId.get(hold.b);
    const grip = gripPoint(a.arm(hold.aHand).shoulder, b.arm(hold.bHand).shoulder);
    const target = a.object.position.clone().set(grip.x, grip.y, grip.z);
    a.reachHand(hold.aHand, target, weight);
    b.reachHand(hold.bHand, target, weight);
  }
}
