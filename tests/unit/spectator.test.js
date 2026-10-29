import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collidersFromLayout, cameraReach, resolveCircle } from '../../src/world/collision.js';
import { RADIUS, RUN_SPEED, WALK_SPEED, createSpectator, speedOf, stepSpectator } from '../../src/player/spectator.js';

const layout = JSON.parse(readFileSync(new URL('../../src/world/layout.json', import.meta.url)));
const colliders = collidersFromLayout(layout);
const I = layout.interior;
const DT = 1 / 60;

const walk = (s, input, yaw, seconds) => {
  for (let t = 0; t < seconds; t += DT) stepSpectator(s, input, yaw, DT, colliders);
  return s;
};
const insideHall = (s) =>
  s.x >= I.minX + RADIUS - 1e-6 && s.x <= I.maxX - RADIUS + 1e-6 && s.z >= I.minZ + RADIUS - 1e-6 && s.z <= I.maxZ - RADIUS + 1e-6;

test('the spectator starts on open floor', () => {
  const { x, z } = layout.spectatorStart;
  assert.deepEqual(resolveCircle(x, z, RADIUS, colliders), [x, z]);
});

test('walking and running reach their speeds, relative to where the camera looks', () => {
  const s = walk(createSpectator({ x: 0, z: 0, facing: [1, 0] }), { forward: true }, Math.PI / 2, 1.5);
  assert.ok(Math.abs(speedOf(s) - WALK_SPEED) < 0.05, `walk ${speedOf(s)}`);
  assert.ok(s.x > 1.5 && Math.abs(s.z) < 1e-6, 'moved along +x, the way the camera looks');
  walk(s, { forward: true, run: true }, Math.PI / 2, 1);
  assert.ok(Math.abs(speedOf(s) - RUN_SPEED) < 0.1, `run ${speedOf(s)}`);
  const strafe = walk(createSpectator({ x: 0, z: 0, facing: [1, 0] }), { right: true }, 0, 1);
  assert.ok(strafe.x < -1, 'looking along +z, right is -x');
});

test('the body turns to face the way it moves', () => {
  const s = walk(createSpectator({ x: 0, z: 0, facing: [0, 1] }), { forward: true }, -Math.PI / 2, 1);
  assert.ok(Math.abs(Math.atan2(Math.sin(s.yaw + Math.PI / 2), Math.cos(s.yaw + Math.PI / 2))) < 0.05);
});

test('nobody runs through a wall, whichever way they push', () => {
  for (let k = 0; k < 16; k++) {
    const yaw = (k / 16) * 2 * Math.PI;
    const s = walk(createSpectator({ x: 2, z: 0, facing: [1, 0] }), { forward: true, run: true }, yaw, 8);
    assert.ok(insideHall(s), `heading ${k}: ended at ${s.x.toFixed(2)}, ${s.z.toFixed(2)}`);
  }
});

test('the stage, its steps and the benches are solid', () => {
  const stage = walk(createSpectator({ x: -3, z: 0, facing: [-1, 0] }), { forward: true, run: true }, -Math.PI / 2, 4);
  assert.ok(stage.x >= layout.stage.maxX + RADIUS - 1e-6, `stopped at the stage edge: ${stage.x}`);
  const steps = walk(createSpectator({ x: -3, z: 5.7, facing: [-1, 0] }), { forward: true, run: true }, -Math.PI / 2, 4);
  assert.ok(steps.x >= layout.steps.maxX + RADIUS - 1e-6, `stopped at the steps: ${steps.x}`);
  const bench = walk(createSpectator({ x: layout.benches.xs[0], z: 4, facing: [0, 1] }), { forward: true }, 0, 5);
  const benchFront = I.maxZ - layout.benches.gap - layout.benches.depth;
  assert.ok(bench.z <= benchFront - RADIUS + 1e-6, `stopped at the bench: ${bench.z}`);
});

test('sliding along a wall keeps going', () => {
  // Push diagonally into the end wall (no benches there): slide along it, don't stick.
  const s = walk(createSpectator({ x: 9.5, z: 0, facing: [1, 0] }), { forward: true }, Math.atan2(1, 1), 3);
  assert.ok(s.x > I.maxX - RADIUS - 0.01, 'against the wall');
  assert.ok(s.z > 2, `slid to z = ${s.z}`);
});

test('the camera pulls in rather than poke through a wall or into the stage', () => {
  const nearWall = cameraReach([2, 1.55, 7.0], [0, 0, 1], 3.4, colliders);
  assert.ok(7.0 + nearWall <= I.maxZ - 0.2, `camera stops at ${7 + nearWall}`);
  const overStage = cameraReach([-5.5, 1.55, 0], [-0.9, -0.43, 0], 3.4, colliders);
  const end = [-5.5 - 0.9 * overStage, 1.55 - 0.43 * overStage];
  assert.ok(end[1] > layout.stage.height || end[0] > layout.stage.maxX, 'not inside the stage');
  assert.equal(cameraReach([0, 1.55, 0], [0, 0.2, -0.98], 3.4, colliders), 3.4, 'open floor: full distance');
});
