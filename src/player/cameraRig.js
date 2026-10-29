// Third-person camera over the spectator's shoulder, kept inside the hall, plus the gallery
// view looking down on the whole set. Switching eases between the two.
import * as THREE from 'three';
import { cameraReach } from '../world/collision.js';

const EYE_HEIGHT = 1.55;
const SHOULDER = 0.6; // camera sits a little to the right of the head
const DISTANCE = 3.4;
const PITCH_MIN = -0.35;
const PITCH_MAX = 1.25;
const SENSITIVITY = 0.0024;
const BLEND_SECONDS = 0.9;

// Gallery: high on the long wall, as a teacher on a balcony would watch.
const GALLERY_POSITION = new THREE.Vector3(-0.2, 6.0, 4.6);
const GALLERY_TARGET = new THREE.Vector3(-0.2, 0, -0.3);

export class CameraRig {
  constructor(camera, colliders, startYaw) {
    this.camera = camera;
    this.colliders = colliders;
    this.yaw = startYaw; // look direction = (sin yaw, cos yaw)
    this.pitch = 0.26; // positive looks down
    this.reach = DISTANCE;
    this.gallery = false;
    this.blend = 0; // 0 = third person, 1 = gallery
    this.thirdPosition = new THREE.Vector3();
    this.thirdQuaternion = new THREE.Quaternion();
    this.galleryQuaternion = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(GALLERY_POSITION, GALLERY_TARGET, new THREE.Vector3(0, 1, 0)),
    );
  }

  look(dx, dy) {
    this.yaw -= dx * SENSITIVITY;
    this.pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, this.pitch + dy * SENSITIVITY));
  }

  toggleGallery() {
    this.gallery = !this.gallery;
  }

  get mode() {
    return this.gallery ? 'gallery' : 'third-person';
  }

  update(spectator, dt) {
    const pivot = [spectator.x, EYE_HEIGHT, spectator.z];
    const cp = Math.cos(this.pitch);
    const forward = [Math.sin(this.yaw) * cp, -Math.sin(this.pitch), Math.cos(this.yaw) * cp];
    const right = [-Math.cos(this.yaw), 0, Math.sin(this.yaw)];
    const shoulder = [pivot[0] + right[0] * SHOULDER, pivot[1], pivot[2] + right[2] * SHOULDER];
    const back = forward.map((v) => -v);
    // Pull in at once when something is in the way; ease back out when it clears.
    const allowed = cameraReach(shoulder, back, DISTANCE, this.colliders);
    this.reach = allowed < this.reach ? allowed : this.reach + (allowed - this.reach) * (1 - Math.exp(-4 * dt));
    this.thirdPosition.set(...shoulder.map((v, i) => v + back[i] * this.reach));
    const target = new THREE.Vector3(...shoulder.map((v, i) => v + forward[i] * 4));
    this.thirdQuaternion.setFromRotationMatrix(
      new THREE.Matrix4().lookAt(this.thirdPosition, target, new THREE.Vector3(0, 1, 0)),
    );

    const step = dt / BLEND_SECONDS;
    this.blend = Math.min(1, Math.max(0, this.blend + (this.gallery ? step : -step)));
    const e = this.blend * this.blend * (3 - 2 * this.blend);
    this.camera.position.lerpVectors(this.thirdPosition, GALLERY_POSITION, e);
    this.camera.quaternion.slerpQuaternions(this.thirdQuaternion, this.galleryQuaternion, e);
  }
}
