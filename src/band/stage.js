// The band on the stage: four Blender-made musicians at their instruments, posed every frame
// from bar time by the playing plan (playing.js). Each musician has a station, a frame on the
// stage floor facing the hall (layout.json); instrument positions in that frame come from
// band.json, the same numbers the Blender build used.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { arrange } from '../audio/arrangement.js';
import { aim, moveWorld, rotateWorld, twoBone } from '../dancers/ik.js';
import { BODY } from '../dancers/proportions.js';
import { tartanTexture } from '../dancers/tartan.js';
import layout from '../world/layout.json';
import BAND from './band.json';
import { bellowsAt, bowAt, planPlaying, strikeAt } from './playing.js';

const UP = new THREE.Vector3(0, 1, 0);
const SEATED_HIP = BAND.seatHeight + 0.06; // hip joints just above the seat
const v3 = (a) => new THREE.Vector3(...a);
const lerp3 = (a, b, k) => a.clone().lerp(b, k);
const ROLL = 0.32; // the fiddle's top turned toward the player's right, radians
const beat = (t) => 0.5 - 0.5 * Math.cos(4 * Math.PI * t); // 0 on each beat, 1 between

/** Where each piano key's middle is across the keyboard (x in the pianist's frame). */
function keyX(midi) {
  const P = BAND.piano;
  const at = (m) => {
    const pc = ((m % 12) + 12) % 12;
    const black = [1, 3, 6, 8, 10].includes(pc);
    const whiteBelow = (n) => {
      let w = 0;
      for (let k = P.lowestMidi; k < n; k++) if (![1, 3, 6, 8, 10].includes(k % 12)) w++;
      return w;
    };
    const i = whiteBelow(m);
    return black ? (P.middleWhite - i) * P.whiteWidth : (P.middleWhite - i - 0.5) * P.whiteWidth;
  };
  const lo = Math.floor(midi);
  return at(lo) + (at(lo + 1) - at(lo)) * (midi - lo);
}

/** One musician: a clone of a Blender character on a station, with helpers for posing. */
class Player {
  constructor(template, station, { role, hair, skin }) {
    this.station = station;
    this.body = BODY[role];
    this.object = cloneSkinned(template);
    this.object.position.set(0, 0, 0);
    this.object.rotation.set(0, 0, 0);
    station.add(this.object);
    this.bones = {};
    this.object.traverse((o) => {
      if (o.isBone) this.bones[o.name.replace(/_\d+$/, '')] = o;
      if (o.isSkinnedMesh) {
        o.castShadow = true;
        o.frustumCulled = false;
        const dress = (m) => {
          if (m.name === 'Tartan') return Object.assign(m.clone(), { map: tartanTexture('band'), color: new THREE.Color(0xffffff) });
          if (m.name === 'Hair') return Object.assign(m.clone(), { color: new THREE.Color(hair) });
          if (m.name === 'Skin' && skin) return Object.assign(m.clone(), { color: new THREE.Color(skin) });
          return m;
        };
        o.material = Array.isArray(o.material) ? o.material.map(dress) : dress(o.material);
      }
    });
    this.rest = Object.entries(this.bones).map(([, b]) => [b, b.quaternion.clone(), b.position.clone()]);
    station.updateMatrixWorld(true);
    this.restHipY = this.station.worldToLocal(this.bones.thighL.getWorldPosition(new THREE.Vector3())).y;
    this.footLength = this.bones.footL.getWorldPosition(new THREE.Vector3())
      .distanceTo(this.bones.toeL.getWorldPosition(new THREE.Vector3()));
    const q = station.getWorldQuaternion(new THREE.Quaternion());
    this.forward = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    this.left = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  }

  /** A point in this musician's frame, in world space. */
  at(x, y, z) {
    return this.station.localToWorld(new THREE.Vector3(x, y, z));
  }

  dir(x, y, z) {
    return new THREE.Vector3(x, y, z).applyQuaternion(this.station.quaternion).normalize();
  }

  reset() {
    for (const [b, q, p] of this.rest) {
      b.quaternion.copy(q);
      b.position.copy(p);
    }
    this.object.updateMatrixWorld(true);
  }

  /** Sits down: hips onto the seat, ankles where given (local), feet flat unless toes are lifted. */
  sit(ankles, toeLift = { L: 0, R: 0 }) {
    moveWorld(this.bones.hips, UP.clone().multiplyScalar(SEATED_HIP - this.restHipY));
    for (const side of ['L', 'R']) {
      const ankle = this.at(...ankles[side]);
      twoBone(this.bones[`thigh${side}`], this.bones[`shin${side}`], this.bones[`foot${side}`], ankle,
        this.forward.clone().add(UP));
      this.flatFoot(side, toeLift[side]);
    }
  }

  stand() {
    for (const side of ['L', 'R']) this.flatFoot(side, 0);
  }

  flatFoot(side, lift) {
    const foot = this.bones[`foot${side}`];
    const ankle = foot.getWorldPosition(new THREE.Vector3());
    const drop = Math.max(0, ankle.y - this.station.position.y - 0.02 - lift);
    const reach = Math.sqrt(Math.max(0, this.footLength ** 2 - drop * drop));
    aim(foot, this.bones[`toe${side}`].getWorldPosition(new THREE.Vector3()),
      ankle.clone().addScaledVector(this.forward, reach).addScaledVector(UP, -Math.min(drop, this.footLength)));
  }

  lean(angle) {
    rotateWorld(this.bones.spine, this.left, angle);
  }

  /** A little nod on each beat, as players keep time. */
  nod(t, depth = 0.05) {
    rotateWorld(this.bones.head, this.left, depth * beat(t));
  }

  /** Hand to `target` (world); elbows bend toward `pole` (world direction). */
  reach(side, target, pole) {
    twoBone(this.bones[`upperarm${side}`], this.bones[`forearm${side}`], this.bones[`hand${side}`], target, pole);
  }

  elbowsOut(side, back = 0.3, down = 1) {
    const s = side === 'L' ? 1 : -1;
    return UP.clone().multiplyScalar(-down).addScaledVector(this.left, 0.7 * s).addScaledVector(this.forward, -back);
  }
}

function placeStation(root, { x, z, facing }) {
  const station = new THREE.Group();
  station.position.set(x, layout.stage.height, z);
  station.rotation.y = Math.atan2(facing[0], facing[1]);
  root.add(station);
  station.updateMatrixWorld(true);
  return station;
}

function prop(gltf, name, parent) {
  const o = gltf.scene.getObjectByName(name).clone();
  o.position.set(0, 0, 0);
  o.rotation.set(0, 0, 0);
  o.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  parent.add(o);
  return o;
}

export async function loadBandStage(perf) {
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/band.glb`);
  const plan = planPlaying(arrange(perf));
  const root = new THREE.Group();
  root.name = 'Band';
  const B = layout.band;
  const musician = gltf.scene.getObjectByName('Musician');
  const fiddlerTemplate = gltf.scene.getObjectByName('Fiddler');

  // --- accordion ---
  const accSt = placeStation(root, B.accordion);
  prop(gltf, 'Chair', accSt);
  const accordionist = new Player(musician, accSt, { role: 'M', hair: 0x2a1a0e });
  const treble = prop(gltf, 'AccordionTreble', root);
  const bass = prop(gltf, 'AccordionBass', root);
  const bellows = prop(gltf, 'Bellows', root);

  // --- fiddle ---
  const fidSt = placeStation(root, B.fiddle);
  const fiddler = new Player(fiddlerTemplate, fidSt, { role: 'W', hair: 0x120b07 });
  const fiddle = prop(gltf, 'Fiddle', root);
  const bow = prop(gltf, 'Bow', root);

  // --- piano ---
  const pianoSt = placeStation(root, B.piano);
  prop(gltf, 'Stool', pianoSt);
  prop(gltf, 'Piano', pianoSt);
  const pianist = new Player(musician, pianoSt, { role: 'M', hair: 0x8c857c, skin: 0xb07a5e });

  // --- drums ---
  const drumSt = placeStation(root, B.drums);
  prop(gltf, 'Stool', drumSt);
  prop(gltf, 'DrumKit', drumSt);
  const drummer = new Player(musician, drumSt, { role: 'M', hair: 0x6b2c14, skin: 0xa86e52 });
  const sticks = { L: prop(gltf, 'Stick', root), R: prop(gltf, 'Stick', root) };

  const A = BAND.accordion;
  const P = BAND.piano;
  const D = BAND.drums;
  const F = BAND.fiddle;
  const zAxis = new THREE.Vector3(0, 0, 1);
  const basis = new THREE.Matrix4();

  function playAccordion(t) {
    const p = accordionist;
    p.reset();
    p.sit({ L: [0.13, 0.08, 0.4], R: [-0.13, 0.08, 0.4] });
    p.lean(0.06);
    p.nod(t);
    const open = bellowsAt(t);
    const xT = -0.03;
    const cy = 0.86;
    const cz = 0.14;
    // The instrument rocks a touch with the bellows.
    const q = accSt.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(zAxis, 0.04 * (open - 0.15)));
    for (const part of [treble, bass, bellows]) part.quaternion.copy(q);
    const origin = p.at(xT, cy, cz);
    const across = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    treble.position.copy(origin);
    bellows.position.copy(origin);
    bellows.scale.set(open, 1, 1);
    bass.position.copy(origin).addScaledVector(across, open);
    // Right hand on the keyboard: low notes at the top; a small press on each note.
    const s = strikeAt(plan.accordion, t);
    const midi = s.from === null ? 74 : s.from + (s.to - s.from) * s.blend;
    const span = A.keysTop - A.keysBottom;
    const y = cy + A.keysTop - Math.min(1, Math.max(0, (midi - 62) / 26)) * span;
    const keys = p.at(xT - A.trebleWidth - 0.045 + 0.012 * (1 - s.lift) * (1 - s.rest), y, cz + 0.14);
    p.reach('R', keys, p.elbowsOut('R', 0.2));
    p.reach('L', bass.position.clone().addScaledVector(across, A.bassWidth + 0.04).addScaledVector(p.forward, 0.1), p.elbowsOut('L', 0.2));
  }

  function playFiddle(t) {
    const p = fiddler;
    p.reset();
    p.stand();
    // A gentle sway with the music, head down onto the chinrest.
    rotateWorld(p.bones.spine, p.forward, 0.025 * Math.sin(Math.PI * t));
    rotateWorld(p.bones.neck, p.forward, -0.22);
    rotateWorld(p.bones.head, UP, 0.45);
    rotateWorld(p.bones.head, p.left, 0.12 + 0.03 * beat(t));
    // The fiddle: on the left collarbone, pointing out to the left and a little up, its top
    // rolled toward the player's right.
    const fz = p.dir(0.68, 0.12, 0.72);
    const up0 = UP.clone().addScaledVector(fz, -UP.dot(fz)).normalize();
    let fy = up0.clone().applyAxisAngle(fz, ROLL);
    if (fy.dot(p.left) > 0) fy = up0.clone().applyAxisAngle(fz, -ROLL);
    const fx = new THREE.Vector3().crossVectors(fy, fz);
    fiddle.position.copy(p.at(0.07, 1.31, 0.12));
    fiddle.quaternion.setFromRotationMatrix(basis.makeBasis(fx, fy, fz));
    const inFiddle = (v) => fiddle.position.clone().addScaledVector(fx, v[0]).addScaledVector(fy, v[1]).addScaledVector(fz, v[2]);
    // The bow, across the strings at the contact point, tilted to the string being played.
    const { p: along, midi } = bowAt(plan.bow, t);
    const string = Math.min(3, Math.max(0, (midi - 55) / 7));
    const tilt = (string - 1.5) * 0.12;
    let u = fx.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(fy, Math.sin(tilt));
    const n = fx.clone().multiplyScalar(-Math.sin(tilt)).addScaledVector(fy, Math.cos(tilt));
    if (u.dot(p.left) < 0) u = u.negate();
    const frog = inFiddle(F.contact).addScaledVector(u, -along).addScaledVector(n, 0.019);
    bow.position.copy(frog);
    bow.quaternion.setFromRotationMatrix(basis.makeBasis(u, n, new THREE.Vector3().crossVectors(u, n)));
    p.reach('R', frog.clone().addScaledVector(u, 0.02).addScaledVector(n, 0.03),
      UP.clone().multiplyScalar(-0.5).addScaledVector(p.left, -1).addScaledVector(p.forward, -0.2));
    p.reach('L', inFiddle([0, -0.005, F.neck[2] - 0.06]), UP.clone().negate().addScaledVector(p.left, -0.5));
  }

  function playPiano(t) {
    const p = pianist;
    p.reset();
    p.sit({ L: [0.14, 0.08, 0.36], R: [-0.12, 0.08, 0.38] });
    p.lean(0.12);
    p.nod(t, 0.04);
    for (const side of ['L', 'R']) {
      const s = strikeAt(plan.piano[side], t);
      const restAt = p.at(side === 'L' ? 0.16 : -0.16, 0.66, 0.26);
      let hand = restAt;
      if (s.from !== null) {
        const midi = s.from + (s.to - s.from) * s.blend;
        const onKeys = p.at(keyX(midi), P.keyTop + 0.05 + 0.05 * s.lift, P.front + 0.01);
        hand = lerp3(onKeys, restAt, s.rest);
      }
      p.reach(side, hand, p.elbowsOut(side, 0.4));
    }
  }

  const strikeTip = {
    snare: v3(D.snare.at).add(new THREE.Vector3(0, 0.006, -0.04)),
    ride: v3(D.ride.at).add(new THREE.Vector3(0.06, 0.03, -0.12)),
    crash: v3(D.crash.at).add(new THREE.Vector3(-0.06, 0.03, -0.12)),
  };

  function playDrums(t) {
    const p = drummer;
    p.reset();
    const kick = strikeAt(plan.drums.kick, t);
    p.sit({ L: [0.3, 0.09, 0.3], R: [D.pedal[0], 0.09, D.pedal[2] - 0.13] }, { L: 0, R: 0.05 * kick.lift });
    p.lean(0.1);
    p.nod(t);
    for (const side of ['L', 'R']) {
      const s = strikeAt(plan.drums[side], t);
      const sx = side === 'L' ? 1 : -1;
      const rest = v3([sx * 0.08 + 0.06, 0.68, 0.3]);
      let tip = rest;
      if (s.from !== null) tip = lerp3(lerp3(strikeTip[s.from], strikeTip[s.to], s.blend), rest, s.rest);
      // The stick runs back from the tip toward the drummer's side; it pivots up at the wrist.
      const tipW = drumSt.localToWorld(tip.clone());
      const toward = p.at(sx * 0.24, 0.8, 0.0).sub(tipW).normalize();
      const grip = tipW.clone().addScaledVector(toward, BAND.stick.length - BAND.stick.grip);
      let dir = toward.clone().negate();
      const axis = new THREE.Vector3().crossVectors(dir, UP).normalize();
      dir = dir.applyAxisAngle(axis, 0.85 * s.lift);
      grip.addScaledVector(UP, 0.07 * s.lift);
      sticks[side].position.copy(grip);
      sticks[side].quaternion.setFromUnitVectors(zAxis, dir);
      p.reach(side, grip.clone().addScaledVector(dir, -0.06), p.elbowsOut(side, 0.3));
    }
  }

  const players = { accordion: accordionist, fiddle: fiddler, piano: pianist, drums: drummer };
  return {
    object: root,
    players,
    sticks,
    bow,
    bellows,
    /** Every bone and held instrument, for tests: [x, y, z, ...] rounded. */
    snapshot() {
      const out = [];
      const add = (o) => out.push(...o.position.toArray(), ...o.quaternion.toArray(), o.scale.x);
      for (const p of Object.values(players)) for (const [b] of p.rest) add(b);
      for (const o of [sticks.L, sticks.R, bow, bellows, fiddle, treble, bass]) add(o);
      return out.map((v) => Math.round(v * 1e5) / 1e5);
    },
    /** Poses the whole band for bar time t. */
    update(t) {
      playAccordion(t);
      playFiddle(t);
      playPiano(t);
      playDrums(t);
    },
  };
}
