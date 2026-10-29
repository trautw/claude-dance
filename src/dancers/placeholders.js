// Capsule stand-ins for the dancers: couple colour on the body, a nose to show facing.
import * as THREE from 'three';

export const COUPLE_COLOURS = { A: 0xc0392b, B: 0x2e6fd8, C: 0x2e9e5b, D: 0xe0a526 };

export function createPlaceholderDancer({ couple, role }) {
  const group = new THREE.Group();
  const colour = COUPLE_COLOURS[couple];
  const height = role === 'M' ? 1.8 : 1.65;
  const radius = 0.2;

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, height - 2 * radius, 6, 16),
    new THREE.MeshStandardMaterial({ color: role === 'M' ? colour : 0xf4f1ea, roughness: 0.6 }),
  );
  body.position.y = height / 2;
  group.add(body);

  if (role === 'W') {
    const sash = new THREE.Mesh(
      new THREE.TorusGeometry(radius + 0.01, 0.035, 8, 24),
      new THREE.MeshStandardMaterial({ color: colour, roughness: 0.5 }),
    );
    sash.rotation.x = Math.PI / 2;
    sash.position.y = height * 0.62;
    group.add(sash);
  }

  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.07, 0.18, 12),
    new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.4 }),
  );
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, height * 0.82, radius + 0.06);
  group.add(nose);

  group.traverse((o) => {
    o.castShadow = true;
  });
  return group;
}
