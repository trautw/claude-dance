// Turns the tune and the dance's structure into a list of note events for the band.
// Times are in bar time, the same timeline the dancers use, so music and dance share one clock.
//
// Event: { bar, dur, inst, midi?, vel }   (dur in bars)

import { EIGHTHS_PER_BAR, TUNE, chordTones, parseBar } from './tune.js';

const E = 1 / EIGHTHS_PER_BAR;
const PHRASE = 8;

/** Small deterministic random so the band sounds the same every time. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Moves each tone into [lo, lo + 12). */
const voice = (tones, lo) => tones.map((t) => lo + ((((t - lo) % 12) + 12) % 12)).sort((a, b) => a - b);

export function arrange(perf) {
  const rand = seeded(1959);
  const events = [];
  const add = (bar, dur, inst, vel, midi) =>
    events.push({ bar, dur, inst, vel: Math.min(1, vel * (0.95 + rand() * 0.1)), midi });

  const parsed = TUNE.bars.map((b) => ({ notes: parseBar(b.notes), chords: b.chords }));

  for (const section of perf.sections) {
    if (section.kind === 'chord') {
      if (section.b0 === 0) openingChord(add, section.b0);
      else closingChord(add, section.b0);
      continue;
    }
    parsed.forEach(({ notes, chords }, i) => {
      const bar0 = section.b0 + i;
      const phraseEnd = i % PHRASE === PHRASE - 1;

      // Melody: accordion leads, fiddle doubles it. Downbeats lean, off-beats lift.
      for (const n of notes) {
        if (n.midi === null) continue;
        const accent = n.eighth % 4 === 0 ? 1 : n.eighth % 2 === 0 ? 0.88 : 0.74;
        add(bar0 + n.eighth * E, n.eighths * E, 'accordion', accent, n.midi);
        add(bar0 + n.eighth * E, n.eighths * E, 'fiddle', accent * 0.8, n.midi);
      }

      // Piano vamp: bass on each beat, chord on each off-beat.
      for (const half of [0, 1]) {
        const chord = chords[Math.min(half, chords.length - 1)];
        const tones = chordTones(chord);
        const bass = half === 1 && chords.length === 1 ? tones[2] : tones[0];
        add(bar0 + half * 0.5, 0.22, 'piano', 0.9, voice([bass], 38)[0]);
        for (const t of voice(tones, 57)) add(bar0 + half * 0.5 + 0.25, 0.18, 'piano', 0.55, t);
      }

      // Drums: kick on the beats, snare on the off-beats, a light hat between; a roll to close each phrase.
      for (let k = 0; k < EIGHTHS_PER_BAR; k++) {
        const at = bar0 + k * E;
        if (k % 4 === 0) add(at, E, 'kick', k === 0 ? 1 : 0.85);
        if (phraseEnd && k >= 4) {
          add(at, E / 2, 'snare', 0.35 + 0.08 * (k - 4));
          add(at + E / 2, E / 2, 'snare', 0.4 + 0.08 * (k - 4));
          continue;
        }
        if (k % 4 === 2) add(at, E, 'snare', 0.7);
        if (k % 2 === 1) add(at, E, 'hat', 0.35);
      }
    });
  }
  events.sort((a, b) => a.bar - b.bar);
  return events;
}

function heldChord(add, bar, dur, name, vel) {
  const tones = chordTones(name);
  for (const t of voice(tones, 62)) add(bar, dur, 'accordion', vel, t);
  add(bar, dur, 'fiddle', vel * 0.8, voice([tones[0]], 74)[0]);
  add(bar, dur, 'piano', vel, voice([tones[0]], 38)[0]);
  for (const t of voice(tones, 57)) add(bar, dur, 'piano', vel * 0.7, t);
}

function snareRoll(add, from, to, v0, v1) {
  const step = E / 2;
  const n = Math.round((to - from) / step);
  for (let i = 0; i < n; i++) add(from + i * step, step, 'snare', v0 + ((v1 - v0) * i) / n);
}

/** The chord for the bow and curtsey, then a drum pickup into bar 1. */
function openingChord(add, b0) {
  snareRoll(add, b0, b0 + 0.75, 0.15, 0.6);
  add(b0 + 0.75, 1, 'crash', 0.8);
  add(b0 + 0.75, E, 'kick', 1);
  heldChord(add, b0 + 0.75, 0.875, 'D', 0.95);
  add(b0 + 1.75, E, 'snare', 0.6);
  add(b0 + 1.875, E, 'snare', 0.75);
}

/** Dominant then tonic: the final chord for the closing bow. */
function closingChord(add, b0) {
  heldChord(add, b0, 0.4, 'A7', 0.9);
  add(b0, E, 'kick', 0.9);
  snareRoll(add, b0 + 0.125, b0 + 0.5, 0.3, 0.7);
  heldChord(add, b0 + 0.5, 1.25, 'D', 1);
  add(b0 + 0.5, 1.5, 'crash', 0.9);
  add(b0 + 0.5, E, 'kick', 1);
}
