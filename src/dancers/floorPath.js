// The selected dancer's floor path for the current time through (or chord), drawn as a ribbon
// on the floor in their couple's colour: faint where they have been, bright where they are
// going, with a ring under the dancer. Rebuilt when the section or the dancer changes.
import * as THREE from 'three';
import { locate } from '../dance/choreography.js';
import { COUPLE_COLOURS } from './placeholders.js';

const STEP = 1 / 16; // bars between samples
const WIDTH = 0.085;
const LIFT = 0.012; // above the floor boards

/** Where dancer `id` goes during the section containing bar time t: { section, points: [{t, x, z}] }. */
export function floorPath(perf, id, t, toWorld) {
  const { section } = locate(perf, Math.min(t, perf.lengthBars - 1e-6));
  const points = [];
  const n = Math.round((section.b1 - section.b0) / STEP);
  for (let i = 0; i <= n; i++) {
    const bt = section.b0 + i * STEP;
    const w = toWorld(perf.poseAt(id, Math.min(bt, perf.lengthBars)).p);
    points.push({ t: bt, x: w.x, z: w.z });
  }
  return { section, points };
}

export class FloorPath {
  constructor(perf, toWorld) {
    this.perf = perf;
    this.toWorld = toWorld;
    this.object = new THREE.Group();
    this.object.visible = false;
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      uniforms: { uColour: { value: new THREE.Color() }, uBar: { value: 0 } },
      vertexShader: `
        attribute float aBar;
        attribute float aSide;
        varying float vBar;
        varying float vSide;
        void main() {
          vBar = aBar;
          vSide = aSide;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uColour;
        uniform float uBar;
        varying float vBar;
        varying float vSide;
        void main() {
          // Been: faint. To come: bright, fading a little over the next bars.
          float ahead = vBar - uBar;
          float a = ahead < 0.0 ? 0.22 : mix(0.95, 0.55, clamp(ahead / 12.0, 0.0, 1.0));
          // Soft edges across the ribbon.
          a *= smoothstep(1.0, 0.55, abs(vSide));
          // Lightened, so even the darker couple colours stand out on the boards.
          gl_FragColor = vec4(mix(uColour, vec3(1.0), ahead < 0.0 ? 0.15 : 0.35), a);
          #include <colorspace_fragment>
        }`,
    });
    this.ribbon = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.ribbon.renderOrder = 1;
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.42, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false }),
    );
    this.ring.position.y = LIFT;
    this.ring.renderOrder = 1;
    this.object.add(this.ribbon, this.ring);
    this.id = null;
    this.section = null;
    this.points = [];
  }

  /** Shows dancer `id`'s path (null hides it). */
  select(id) {
    this.id = id;
    this.section = null;
    this.object.visible = id !== null;
    if (!id) return;
    const couple = this.perf.dancers.find((d) => d.id === id).couple;
    this.material.uniforms.uColour.value.setHex(COUPLE_COLOURS[couple]);
    this.ring.material.color.setHex(COUPLE_COLOURS[couple]).lerp(new THREE.Color(0xffffff), 0.35);
  }

  update(bar) {
    if (!this.id) return;
    const { section } = locate(this.perf, Math.min(bar, this.perf.lengthBars - 1e-6));
    if (section !== this.section) this.build(bar);
    this.material.uniforms.uBar.value = bar;
    const w = this.toWorld(this.perf.poseAt(this.id, bar).p);
    this.ring.position.set(w.x, LIFT, w.z);
  }

  build(bar) {
    const { section, points } = floorPath(this.perf, this.id, bar, this.toWorld);
    this.section = section;
    this.points = points;
    const pos = [];
    const bars = [];
    const sides = [];
    const index = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[Math.max(0, i - 1)];
      const b = points[Math.min(points.length - 1, i + 1)];
      let dx = b.x - a.x;
      let dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      // Standing still: keep the last direction so the ribbon doesn't twist.
      if (len < 1e-5) [dx, dz] = this.lastDir ?? [1, 0];
      else [dx, dz] = [dx / len, dz / len];
      this.lastDir = [dx, dz];
      const { x, z, t } = points[i];
      pos.push(x - dz * WIDTH, LIFT, z + dx * WIDTH, x + dz * WIDTH, LIFT, z - dx * WIDTH);
      bars.push(t, t);
      sides.push(-1, 1);
      if (i > 0) {
        const k = 2 * i;
        index.push(k - 2, k - 1, k, k - 1, k + 1, k);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aBar', new THREE.Float32BufferAttribute(bars, 1));
    g.setAttribute('aSide', new THREE.Float32BufferAttribute(sides, 1));
    g.setIndex(index);
    this.ribbon.geometry.dispose();
    this.ribbon.geometry = g;
  }
}
