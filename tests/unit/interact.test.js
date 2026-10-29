import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPerformance } from '../../src/dance/choreography.js';
import { floorPath } from '../../src/dancers/floorPath.js';
import { SELECT_RANGE, interactionAt } from '../../src/player/interact.js';

const layout = JSON.parse(readFileSync(new URL('../../src/world/layout.json', import.meta.url)));
const EAST = Math.PI / 2; // looking along +x
const dancers = [
  { id: 'A.M', x: 2, z: 0 },
  { id: 'A.W', x: 2, z: 1.2 },
  { id: 'B.M', x: -2, z: 0 },
];

test('E selects the dancer looked at, the nearest-looking one when several are in view', () => {
  assert.deepEqual(interactionAt({ x: 0, z: 0 }, layout, { yaw: EAST, dancers }), { kind: 'dancer', id: 'A.M', selected: false });
  const towardWoman = Math.atan2(2, 1.2);
  assert.equal(interactionAt({ x: 0, z: 0 }, layout, { yaw: towardWoman, dancers }).id, 'A.W');
});

test('nobody is selected out of range or behind', () => {
  const far = [{ id: 'A.M', x: SELECT_RANGE + 0.1, z: 0 }];
  assert.equal(interactionAt({ x: 0, z: 0 }, layout, { yaw: EAST, dancers: far }), null);
  assert.equal(interactionAt({ x: 0, z: 0 }, layout, { yaw: -EAST, dancers: [dancers[0]] }), null);
});

test('E on the selected dancer deselects; looking elsewhere, E clears the selection', () => {
  assert.deepEqual(interactionAt({ x: 0, z: 0 }, layout, { yaw: EAST, dancers, selected: 'A.M' }), { kind: 'dancer', id: 'A.M', selected: true });
  assert.equal(interactionAt({ x: 0, z: 0 }, layout, { yaw: EAST, dancers, selected: 'B.M' }).id, 'A.M'); // switches
  assert.deepEqual(interactionAt({ x: 0, z: 5 }, layout, { yaw: 0, dancers, selected: 'B.M' }), { kind: 'clear', id: 'B.M' });
});

test('a dancer looked at comes before the band; the band before clearing', () => {
  const zone = layout.band.zone;
  const at = { x: (zone.minX + zone.maxX) / 2, z: 0 };
  assert.deepEqual(interactionAt(at, layout, { yaw: 0, dancers: [], selected: 'A.M' }), { kind: 'band' });
  const near = [{ id: 'A.M', x: at.x + 1, z: 0 }];
  assert.equal(interactionAt(at, layout, { yaw: EAST, dancers: near }).kind, 'dancer');
});

test('the floor path covers the whole time through and passes through the dancer', () => {
  const perf = createPerformance();
  const toWorld = ([d, s]) => ({ x: d, z: s });
  const t = perf.sections[3].b0 + 17.3;
  const { section, points } = floorPath(perf, 'B.W', t, toWorld);
  assert.equal(section, perf.sections[3]);
  assert.equal(points[0].t, section.b0);
  assert.equal(points[points.length - 1].t, section.b1);
  const [d, s] = perf.poseAt('B.W', points[100].t).p;
  assert.ok(Math.abs(points[100].x - d) < 1e-9 && Math.abs(points[100].z - s) < 1e-9);
});
