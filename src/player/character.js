// The spectator's body: the Blender-built figure (spectator.glb) and its idle, walk and run
// clips, blended by how fast the spectator moves. Walk and run share one phase, advanced by
// distance travelled, so the feet keep pace with the floor at every speed in between.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RUN_SPEED, WALK_SPEED, speedOf } from './spectator.js';
import { tartanTexture } from '../dancers/tartan.js';

// The speeds the clips were made at (blender/build_spectator.py), so a cycle covers
// speed × clip length metres.
const CLIP_SPEED = { walk: WALK_SPEED, run: RUN_SPEED };
const STILL = 0.12; // below this (m/s) the spectator stands
const SETTLE = 8; // how quickly the blend follows the speed (1/s)

export async function loadSpectatorCharacter() {
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/spectator.glb`);
  const object = gltf.scene.getObjectByName('Spectator');
  object.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    o.castShadow = true;
    o.frustumCulled = false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const dressed = mats.map((m) => {
      if (m.name !== 'Tartan') return m;
      const t = m.clone();
      t.map = tartanTexture('spectator');
      t.color.set(0xffffff);
      t.roughness = 0.8;
      return t;
    });
    o.material = Array.isArray(o.material) ? dressed : dressed[0];
  });
  return new SpectatorCharacter(object, gltf.animations);
}

class SpectatorCharacter {
  constructor(object, clips) {
    this.object = object;
    this.mixer = new THREE.AnimationMixer(object);
    this.actions = {};
    for (const name of ['idle', 'walk', 'run']) {
      const action = this.mixer.clipAction(clips.find((c) => c.name === name));
      action.play();
      this.actions[name] = action;
    }
    // Walk and run are posed by phase, not by the mixer's clock.
    this.actions.walk.setEffectiveTimeScale(0);
    this.actions.run.setEffectiveTimeScale(0);
    this.phase = 0;
    this.speed = 0;
    this.weights = { idle: 1, walk: 0, run: 0 };
  }

  /** Poses the figure for the spectator after `dt` seconds. */
  update(spectator, dt) {
    this.object.position.set(spectator.x, 0, spectator.z);
    this.object.rotation.y = spectator.yaw;
    this.speed += (speedOf(spectator) - this.speed) * (1 - Math.exp(-SETTLE * dt));
    const moving = THREE.MathUtils.smoothstep(this.speed, STILL, 0.6);
    const running = THREE.MathUtils.clamp((this.speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED), 0, 1);
    const { walk, run } = this.actions;
    const cycle = THREE.MathUtils.lerp(
      CLIP_SPEED.walk * walk.getClip().duration, CLIP_SPEED.run * run.getClip().duration, running,
    );
    this.phase = (this.phase + (this.speed * dt) / cycle) % 1;
    walk.time = this.phase * walk.getClip().duration;
    run.time = this.phase * run.getClip().duration;
    this.weights = { idle: 1 - moving, walk: moving * (1 - running), run: moving * running };
    for (const [name, w] of Object.entries(this.weights)) this.actions[name].setEffectiveWeight(w);
    this.mixer.update(dt);
  }
}
