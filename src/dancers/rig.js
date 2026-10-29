// Poses one dancer's skeleton each frame from the dance: the body follows its floor path, legs
// reach the planned footwork by two-bone IK, the kilt or skirt hem trails behind changes of
// speed, and on the chords the bow or curtsey clip plays instead (ADR 0002).
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { FEET, TURNOUT, legPose, planFootwork } from '../dance/footwork.js';
import { leftOf } from '../dance/geometry.js';
import { aim, moveWorld, rotateWorld, twoBone } from './ik.js';
import { BODY } from './proportions.js';
import { tartanGround, tartanTexture } from './tartan.js';

const UP = new THREE.Vector3(0, 1, 0);
const SIDE = { L: 1, R: -1 };
const POINTED = THREE.MathUtils.degToRad(58);
const LEAN_PER_SPEED = THREE.MathUtils.degToRad(4); // forward lean per metre a bar
const HEM_LAG_BARS = 0.14;
const HEM_SWING = 0.22; // metres of hem offset per metre-a-bar change in velocity
const HEM_MAX = 0.16;
// Each dancer's own hair and skin, so the set isn't eight copies of one person.
const LOOKS = {
  'A.M': { hair: 0x3b2414, skin: 0xc8957a }, 'A.W': { hair: 0x8a4a22, skin: 0xe2b49a },
  'B.M': { hair: 0x161009, skin: 0xb07a5e }, 'B.W': { hair: 0xb08850, skin: 0xe8c0a6 },
  'C.M': { hair: 0x7a7570, skin: 0xd4a084 }, 'C.W': { hair: 0x241710, skin: 0x9a6a50 },
  'D.M': { hair: 0x6b2c14, skin: 0xe0ae94 }, 'D.W': { hair: 0x4a2e1a, skin: 0xcf9c80 },
};

export class DancerRig {
  /**
   * @param template the Man or Woman object from dancers.glb
   * @param clip the bow (man) or curtsey (woman) AnimationClip
   * @param toWorld maps a set-frame [d, s] point to world x/z
   */
  constructor({ template, clip, dancer, perf, toWorld }) {
    this.dancer = dancer;
    this.perf = perf;
    this.toWorld = toWorld;
    this.body = BODY[dancer.role];
    this.plan = planFootwork(perf, dancer.id);
    this.object = cloneSkinned(template);
    this.object.position.set(0, 0, 0);
    this.object.rotation.set(0, 0, 0);
    // Bones by name. Loading drops the dots ("thigh.L" is "thighL") and makes names unique
    // across the file (the woman's are "thighL_1"), so look them up without the suffix.
    this.bones = {};
    this.object.traverse((o) => {
      if (o.isBone) this.bones[o.name.replace(/_\d+$/, '')] = o;
      if (o.isSkinnedMesh) {
        o.castShadow = true;
        o.frustumCulled = false;
        this.dress(o);
      }
    });
    this.rest = Object.fromEntries(
      Object.entries(this.bones).map(([n, b]) => [n, { q: b.quaternion.clone(), p: b.position.clone() }]),
    );
    // Where the hem sits on the hem bone, measured at rest.
    this.object.updateMatrixWorld(true);
    this.hemBone = this.bones.kilt ?? this.bones.skirt;
    const hemY = dancer.role === 'M' ? this.body.ankleHeight + this.body.shin + 0.02 : 0.36;
    this.hemLocal = this.hemBone.worldToLocal(new THREE.Vector3(0, hemY, 0));
    this.restHipY = this.bones.thighL.getWorldPosition(new THREE.Vector3()).y;
    this.footLength = this.bones.footL.getWorldPosition(new THREE.Vector3())
      .distanceTo(this.bones.toeL.getWorldPosition(new THREE.Vector3()));

    // The bow/curtsey clip, evaluated directly onto the bones. (AnimationMixer skips writing
    // values it thinks are unchanged, which breaks when bones are reset to rest every frame.)
    this.clipDuration = clip.duration;
    this.clipTracks = clip.tracks.map((track) => {
      const [node, prop] = track.name.split('.');
      return { bone: this.bones[node.replace(/_\d+$/, '')], prop, interpolant: track.createInterpolant() };
    }).filter((c) => c.bone && (c.prop === 'quaternion' || c.prop === 'position'));
  }

  dress(mesh) {
    const couple = this.dancer.couple;
    const look = LOOKS[this.dancer.id];
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const dressed = mats.map((m) => {
      if (m.name === 'Tartan') {
        const t = m.clone();
        t.map = tartanTexture(couple);
        t.color.set(0xffffff);
        t.roughness = 0.8;
        return t;
      }
      if (look && (m.name === 'Hair' || m.name === 'Skin')) {
        return Object.assign(m.clone(), { color: new THREE.Color(m.name === 'Hair' ? look.hair : look.skin) });
      }
      if (m.name === 'Flash') {
        const f = m.clone();
        f.color.set(tartanGround(couple));
        return f;
      }
      return m;
    });
    mesh.material = Array.isArray(mesh.material) ? dressed : dressed[0];
  }

  /** Bar-time window of the bow or curtsey in each chord, if t is in one: progress 0–1. */
  bowProgress(t) {
    for (const s of this.perf.sections) {
      if (s.kind !== 'chord') continue;
      const [b0, b1] = s.b0 === 0 ? [s.b0 + 0.75, s.b0 + 1.75] : [s.b0 + 0.5, s.b0 + 1.5];
      if (t >= b0 && t <= b1) return (t - b0) / (b1 - b0);
    }
    return null;
  }

  update(t) {
    const { p, h } = this.perf.poseAt(this.dancer.id, t);
    const world = this.toWorld(p);
    this.object.position.set(world.x, 0, world.z);
    this.object.rotation.set(0, Math.atan2(h[0], h[1]), 0);
    for (const [n, r] of Object.entries(this.rest)) {
      this.bones[n].quaternion.copy(r.q);
      this.bones[n].position.copy(r.p);
    }
    this.object.updateMatrixWorld(true);

    const bow = this.bowProgress(t);
    if (bow !== null) {
      const time = bow * this.clipDuration;
      for (const { bone, prop, interpolant } of this.clipTracks) bone[prop].fromArray(interpolant.evaluate(time));
      return;
    }

    const forward = new THREE.Vector3(h[0], 0, h[1]);
    const [lx, lz] = leftOf(h);
    const left = new THREE.Vector3(lx, 0, lz);
    const pose = legPose(this.plan, this.body, t);

    // Hips to the height the footwork allows; a slight forward lean with speed.
    moveWorld(this.bones.hips, new THREE.Vector3(0, pose.hipY - this.restHipY, 0));
    const ahead = this.perf.poseAt(this.dancer.id, t + 0.1).p;
    const behind = this.perf.poseAt(this.dancer.id, t - 0.1).p;
    const speed = Math.hypot(ahead[0] - behind[0], ahead[1] - behind[1]) / 0.2;
    if (speed > 0.05) rotateWorld(this.bones.spine, left, LEAN_PER_SPEED * Math.min(speed, 2));

    for (const f of FEET) this.solveLeg(f, pose.feet[f], forward, left);
    this.swingHem(t);
  }

  solveLeg(side, foot, forward, left) {
    const thigh = this.bones[`thigh${side}`];
    const shin = this.bones[`shin${side}`];
    const footBone = this.bones[`foot${side}`];
    const toe = this.bones[`toe${side}`];
    const ankle = this.toWorld(foot.point).setY(foot.ankleY);
    // Knees bend forward and a little out, the way the toes point.
    const pole = forward.clone().multiplyScalar(Math.cos(TURNOUT.step)).addScaledVector(left, SIDE[side] * Math.sin(TURNOUT.step));
    twoBone(thigh, shin, footBone, ankle, pole);

    // The foot: flat in first position, on the ball when stepping, pointed when in the air.
    const turnout = foot.kind === 'stand' ? TURNOUT.stand : TURNOUT.step;
    const along = forward.clone().multiplyScalar(Math.cos(turnout)).addScaledVector(left, SIDE[side] * Math.sin(turnout));
    const anklePos = footBone.getWorldPosition(new THREE.Vector3());
    let toeTarget;
    if (!foot.planted) {
      toeTarget = anklePos.clone().addScaledVector(along, this.footLength * Math.cos(POINTED)).addScaledVector(UP, -this.footLength * Math.sin(POINTED));
    } else {
      const drop = Math.min(this.footLength * 0.98, Math.max(0, anklePos.y - 0.02));
      const reach = Math.sqrt(this.footLength ** 2 - drop * drop);
      toeTarget = anklePos.clone().addScaledVector(along, reach).addScaledVector(UP, -drop);
    }
    aim(footBone, toe.getWorldPosition(new THREE.Vector3()), toeTarget);
  }

  /** Where this dancer's hand (L/R) would rest, and the shoulder it hangs from, as posed now. */
  arm(side) {
    return {
      shoulder: this.bones[`upperarm${side}`].getWorldPosition(new THREE.Vector3()),
      wrist: this.bones[`hand${side}`].getWorldPosition(new THREE.Vector3()),
    };
  }

  /**
   * Reaches hand `side` toward `grip` (world), `weight` of the way from where it hangs.
   * Elbows bend down, back and a little out: low like a dancer's, but never straight along a
   * hanging arm, where the bend would be undefined and the elbow could flip.
   */
  reachHand(side, grip, weight) {
    const upper = this.bones[`upperarm${side}`];
    const fore = this.bones[`forearm${side}`];
    const hand = this.bones[`hand${side}`];
    const { wrist } = this.arm(side);
    // Reach along a slightly lowered arc, so the hand doesn't pass up by the shoulder.
    const goal = wrist.lerp(grip, weight).addScaledVector(UP, -0.12 * Math.sin(Math.PI * weight));
    const h = this.object.rotation.y;
    const forward = new THREE.Vector3(Math.sin(h), 0, Math.cos(h));
    const left = new THREE.Vector3(Math.cos(h), 0, -Math.sin(h));
    const pole = forward.clone().multiplyScalar(-0.55).addScaledVector(left, SIDE[side] * 0.3).addScaledVector(UP, -0.6);
    twoBone(upper, fore, hand, goal, pole);
  }

  /** The hem trails the body's changes of velocity: it swings out on turns and flicks on stops. */
  swingHem(t) {
    const v = (time) => {
      const a = this.perf.poseAt(this.dancer.id, time - 0.05).p;
      const b = this.perf.poseAt(this.dancer.id, time + 0.05).p;
      return [(b[0] - a[0]) / 0.1, (b[1] - a[1]) / 0.1];
    };
    const now = v(t);
    const before = v(t - HEM_LAG_BARS);
    let dx = (before[0] - now[0]) * HEM_SWING;
    let dz = (before[1] - now[1]) * HEM_SWING;
    const m = Math.hypot(dx, dz);
    if (m > HEM_MAX) {
      dx *= HEM_MAX / m;
      dz *= HEM_MAX / m;
    }
    const bone = this.hemBone;
    const hem = bone.localToWorld(this.hemLocal.clone());
    // Lift a little as it swings out, as cloth does.
    const target = hem.clone().add(new THREE.Vector3(dx, Math.hypot(dx, dz) * 0.35, dz));
    aim(bone, hem, target);
  }
}
