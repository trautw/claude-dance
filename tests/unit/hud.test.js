import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPerformance } from '../../src/dance/choreography.js';
import { describeHud } from '../../src/ui/describe.js';

const perf = createPerformance();
const at = (n, bar) => perf.sections[n].b0 + bar - 1; // start of `bar` in time through n

test('the opening chord: bow and curtsey, then the first figure', () => {
  const h = describeHud(perf, 0.4);
  assert.deepEqual(h, {
    section: 'Opening chord', couple: null, bar: 1, bars: 2,
    figure: 'Bow and curtsey', next: 'Turn right hand', ended: false,
  });
  assert.equal(describeHud(perf, 1.99).bar, 2);
});

test('each time through names its dancing couple: A, A, B, B, C, C, D, D', () => {
  const couples = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => describeHud(perf, at(n, 1)).couple);
  assert.deepEqual(couples, ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D']);
  assert.equal(describeHud(perf, at(3, 1)).section, 'Time through 3/8');
});

test('bars and figures follow the crib, including right at a boundary', () => {
  const h = describeHud(perf, at(4, 9));
  assert.equal(h.bar, 9);
  assert.equal(h.bars, 40);
  assert.equal(h.figure, 'Half diagonal reel of four with 1st corners');
  assert.equal(h.next, 'Half diagonal reel of four with 2nd corners');
  assert.equal(describeHud(perf, at(4, 9) - 0.01).figure, 'Turn left hand 1¼ to face 1st corners');
  assert.equal(describeHud(perf, at(4, 40) + 0.5).bar, 40);
});

test('after the last figure comes the next time through, or the closing chord', () => {
  assert.equal(describeHud(perf, at(2, 35)).next, 'Turn right hand');
  assert.equal(describeHud(perf, at(8, 35)).next, 'Closing chord · bow and curtsey');
});

test('the end of the dance is the end of the closing chord', () => {
  const end = describeHud(perf, perf.lengthBars);
  assert.equal(end.section, 'Closing chord');
  assert.equal(end.bar, 2);
  assert.equal(end.figure, 'Bow and curtsey');
  assert.equal(end.next, null);
  assert.equal(end.ended, true);
  assert.equal(describeHud(perf, perf.lengthBars - 0.5).ended, false);
});
