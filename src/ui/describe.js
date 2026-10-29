// What the HUD and the timeline say about a moment in the dance, as plain text.
import { locate } from '../dance/choreography.js';
import { CRIB } from '../dance/crib.js';

const BOW = 'Bow and curtsey';

/**
 * Every HUD field for bar time t: `section` (time through and dancing couple, or the chord),
 * `couple` (dancing couple, or null), `bar` and `bars` (bar within the section), and the
 * current and next figure.
 */
export function describeHud(perf, t) {
  const { section, bar, figure, nextFigure } = locate(perf, Math.min(t, perf.lengthBars - 1e-6));
  const ended = t >= perf.lengthBars - 1e-6;
  if (section.kind === 'chord') {
    const opening = section.b0 === 0;
    return {
      section: section.name,
      couple: null,
      bar: ended ? section.b1 - section.b0 : bar,
      bars: section.b1 - section.b0,
      figure: BOW,
      next: opening ? CRIB.figures[0].name : null,
      ended,
    };
  }
  const last = section.n === CRIB.timesThrough;
  return {
    section: `Time through ${section.n}/${CRIB.timesThrough}`,
    couple: section.dancingCouple,
    bar,
    bars: CRIB.barsPerTimeThrough,
    figure: figure.name,
    // After the last figure: the next time through starts again, or the closing chord.
    next: nextFigure?.name ?? (last ? `Closing chord · ${BOW.toLowerCase()}` : CRIB.figures[0].name),
    ended: false,
  };
}

/** The timeline's hover label for bar time t. */
export function describe(perf, t) {
  const { section, bar, figure } = locate(perf, t);
  if (section.kind === 'chord') return { title: section.name, detail: '' };
  return {
    title: `${section.name} · Bar ${bar}`,
    detail: `Couple ${section.dancingCouple} dancing · ${figure.name}`,
  };
}
