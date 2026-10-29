// "The Hall at Clachan": an original 40-bar reel in D major, written for this project to fit
// Mairi's Wedding's 5 × 8-bar phrases (one per group of figures).
//
// Melody notation is a small subset of ABC: one bar per string, eighth notes by default,
// a trailing number multiplies the length (d2 = quarter note), z is a rest.
// C–B is the octave from middle C, c–b the octave above; ' raises and , lowers an octave.
// The key signature (F♯, C♯) applies unless a note carries ^ (sharp), _ (flat) or = (natural).
// `chords` gives one chord per half bar, or one for the whole bar.

export const KEY_SIGNATURE = { F: 1, C: 1 };
export const EIGHTHS_PER_BAR = 8;

const A_PART = [
  ['FAdA fAdA', 'D'],
  ['FAdf afed', 'D'],
  ['gbgb ageg', 'G'],
  ['fage cAce', 'A'],
  ['FAdA fAdA', 'D'],
  ['FAdf a2fa', 'D'],
  ['gbag fdec', 'G A'],
];

export const TUNE = {
  title: 'The Hall at Clachan',
  type: 'Reel',
  bars: [
    // 1–8: turn, cast, turn to corners
    ...A_PART,
    ['d2fe d2z2', 'D'],
    // 9–16: first two half reels
    ['a2fa d\'afa', 'D'],
    ['bgbd\' bagf', 'G'],
    ['afdf adfa', 'D'],
    ['gfec A2ce', 'A'],
    ['a2fa d\'afa', 'D'],
    ['bgbd\' bage', 'G'],
    ['fgaf ecAc', 'Em A'],
    ['d2fe d2D2', 'D'],
    // 17–24: second two half reels
    ['fa2f a2fa', 'D'],
    ['gb2g b2ag', 'G'],
    ['fa2f adfa', 'D'],
    ['ecAc ecAe', 'A'],
    ['fa2f a2fa', 'D'],
    ['gb2g bd\'ba', 'G'],
    ['gfeg fedc', 'Em A'],
    ['d2dA d4', 'D'],
    // 25–32: reels of three, lower and darker
    ['Bdfd Bdfd', 'Bm'],
    ['GBdB GBdB', 'G'],
    ['FAdA FAdA', 'D'],
    ['EAcA EAce', 'A'],
    ['Bdfd bfdB', 'Bm'],
    ['GBdg bgdB', 'G'],
    ['EGBe cABc', 'Em A'],
    ['d2fd AdFA', 'D'],
    // 33–40: circle, back to the opening strain
    ...A_PART,
    ['d2fe d4', 'D'],
  ].map(([notes, chords]) => ({ notes, chords: chords.split(' ') })),
};

const LETTER_SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Parses one bar of melody into [{ eighth, eighths, midi | null }]. */
export function parseBar(text) {
  const notes = [];
  let at = 0;
  for (const m of text.matchAll(/([_^=]?)([A-Ga-gz])([,']*)(\d*)/g)) {
    const [, accidental, letter, octaveMarks, len] = m;
    const eighths = len ? Number(len) : 1;
    let midi = null;
    if (letter !== 'z') {
      const upper = letter.toUpperCase();
      let octave = letter === upper ? 4 : 5;
      for (const c of octaveMarks) octave += c === "'" ? 1 : -1;
      const shift = accidental === '^' ? 1 : accidental === '_' ? -1 : accidental === '=' ? 0 : (KEY_SIGNATURE[upper] ?? 0);
      midi = 12 * (octave + 1) + LETTER_SEMITONES[upper] + shift;
    }
    notes.push({ eighth: at, eighths, midi });
    at += eighths;
  }
  return notes;
}

const CHORD_ROOTS = { D: 62, E: 64, G: 67, A: 69, B: 71 };

/** MIDI notes of a chord name like 'D', 'Bm', 'A7': [root, third, fifth(, seventh)] in octave 4. */
export function chordTones(name) {
  const root = CHORD_ROOTS[name[0]] - 12;
  const minor = name.includes('m');
  const tones = [root, root + (minor ? 3 : 4), root + 7];
  if (name.includes('7')) tones.push(root + 10);
  return tones;
}
