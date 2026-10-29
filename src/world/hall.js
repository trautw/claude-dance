// Loads the Blender-built hall, dresses its materials with procedural textures, and lights it.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import layout from './layout.json';

/** Long, slightly wavy grain streaks, near white so the per-board vertex colour shows through. */
function woodGrainTexture() {
  const W = 1024;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#e8e8e8';
  g.fillRect(0, 0, W, H);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    const y = rand() * H;
    const amp = 2 + rand() * 6;
    const freq = (1 + rand() * 3) * ((2 * Math.PI) / W);
    const phase = rand() * 10;
    const shade = Math.floor(150 + rand() * 90);
    g.strokeStyle = `rgba(${shade},${shade},${shade},${0.08 + rand() * 0.22})`;
    g.lineWidth = 0.6 + rand() * 2.2;
    g.beginPath();
    for (let x = 0; x <= W; x += 16) {
      const yy = y + Math.sin(x * freq + phase) * amp;
      if (x === 0) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
  }
  // A few knots.
  for (let i = 0; i < 14; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const grad = g.createRadialGradient(x, y, 0, x, y, 6 + rand() * 8);
    grad.addColorStop(0, 'rgba(90,90,90,0.55)');
    grad.addColorStop(1, 'rgba(90,90,90,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(x, y, 18, 6, 0, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function dressMaterials(root) {
  const grain = woodGrainTexture();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    o.receiveShadow = true;
    switch (m.name) {
      case 'FloorWood':
        m.map = grain;
        m.roughness = 0.4;
        m.envMapIntensity = 0.45;
        break;
      case 'Curtain':
        o.material = new THREE.MeshPhysicalMaterial({
          name: 'Curtain', color: m.color, roughness: 0.75, sheen: 1, sheenRoughness: 0.45, side: THREE.DoubleSide,
          sheenColor: new THREE.Color(0.9, 0.25, 0.25),
        });
        break;
      case 'WindowNight':
        m.envMapIntensity = 0.25;
        break;
      case 'BenchWood':
      case 'StageWood':
        o.castShadow = true;
        break;
      default:
        break;
    }
  });
}

function addLights(scene, renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.28;
  scene.background = new THREE.Color(0x0b0806);

  scene.add(new THREE.HemisphereLight(0xffe0bd, 0x3a2414, 0.45));

  // The lamps together read as one soft key from above; this one casts the dancers' shadows.
  const key = new THREE.DirectionalLight(0xffd9a8, 1.6);
  key.position.set(-1.5, 12, 3);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 7, bottom: -7, near: 4, far: 20 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key, key.target);

  for (const [x, z] of layout.lamps) {
    const lamp = new THREE.PointLight(0xffc488, 9, 0, 2);
    lamp.position.set(x, layout.lampHang - 0.15, z);
    scene.add(lamp);
  }
  // A soft pool of light over the set, so the dancers stand out from the walls.
  const pool = new THREE.SpotLight(0xffe2bd, 30, 0, 0.62, 1, 2);
  pool.position.set(0, 6.2, 0);
  pool.target.position.set(0, 0, 0);
  scene.add(pool, pool.target);
  // Warm wash on the stage for the band.
  const stageLight = new THREE.SpotLight(0xffd2a0, 60, 0, 0.75, 0.6, 2);
  stageLight.position.set(-4.5, 5.6, 0);
  stageLight.target.position.set(-8.8, layout.stage.height, 0);
  scene.add(stageLight, stageLight.target);
}

export async function loadHall(scene, renderer) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/hall.glb`);
  dressMaterials(gltf.scene);
  scene.add(gltf.scene);
  addLights(scene, renderer);
  return gltf.scene;
}

export { layout };
