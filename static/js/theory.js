/**
 * theory.js — Music theory data: notes, chords, scales, intervals
 */

// Circle of Fifths order
const CIRCLE_OF_FIFTHS = [
  { name: 'C',  semitone: 0  },
  { name: 'G',  semitone: 7  },
  { name: 'D',  semitone: 2  },
  { name: 'A',  semitone: 9  },
  { name: 'E',  semitone: 4  },
  { name: 'B',  semitone: 11 },
  { name: 'F#', semitone: 6  },
  { name: 'C#', semitone: 1  },
  { name: 'Ab', semitone: 8  },
  { name: 'Eb', semitone: 3  },
  { name: 'Bb', semitone: 10 },
  { name: 'F',  semitone: 5  },
];

// Chromatic notes (sharps)
const CHROMATIC_NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// C3 = 130.81 Hz — lower octave for warm, deep pad tone
const BASE_FREQ = 130.81;
const NOTE_FREQS = {};
CHROMATIC_NOTES.forEach((note, i) => {
  NOTE_FREQS[note] = BASE_FREQ * Math.pow(2, i / 12);
});

/**
 * All chord types with semitone intervals and satellite ring assignment.
 * ring 0 = triads (inner), ring 1 = sevenths (mid), ring 2 = extended (outer)
 */
const CHORD_TYPES = {
  // Ring 0 — Triads
  'Major':    { label: 'maj',    intervals: [0, 4, 7],                ring: 0 },
  'Minor':    { label: 'min',    intervals: [0, 3, 7],                ring: 0 },
  'Aug':      { label: 'aug',    intervals: [0, 4, 8],                ring: 0 },
  'Dim':      { label: 'dim',    intervals: [0, 3, 6],                ring: 0 },
  'Sus2':     { label: 'sus2',   intervals: [0, 2, 7],                ring: 0 },
  'Sus4':     { label: 'sus4',   intervals: [0, 5, 7],                ring: 0 },

  // Ring 1 — Seventh chords
  'Maj7':     { label: 'maj7',   intervals: [0, 4, 7, 11],            ring: 1 },
  'Min7':     { label: 'min7',   intervals: [0, 3, 7, 10],            ring: 1 },
  'Dom7':     { label: '7',      intervals: [0, 4, 7, 10],            ring: 1 },
  'MinMaj7':  { label: 'mMaj7',  intervals: [0, 3, 7, 11],            ring: 1 },
  'Dim7':     { label: 'dim7',   intervals: [0, 3, 6, 9],             ring: 1 },
  'HalfDim7': { label: 'ø7',     intervals: [0, 3, 6, 10],            ring: 1 },

  // Ring 2 — Extended chords
  'Maj9':     { label: 'maj9',   intervals: [0, 4, 7, 11, 14],        ring: 2 },
  'Min9':     { label: 'min9',   intervals: [0, 3, 7, 10, 14],        ring: 2 },
  'Dom9':     { label: '9',      intervals: [0, 4, 7, 10, 14],        ring: 2 },
  'Add9':     { label: 'add9',   intervals: [0, 4, 7, 14],            ring: 2 },
  'Maj11':    { label: 'maj11',  intervals: [0, 4, 7, 11, 14, 17],    ring: 2 },
  'Min11':    { label: 'min11',  intervals: [0, 3, 7, 10, 14, 17],    ring: 2 },
  'Maj13':    { label: 'maj13',  intervals: [0, 4, 7, 11, 14, 17, 21],ring: 2 },
  'Dom13':    { label: '13',     intervals: [0, 4, 7, 10, 14, 17, 21],ring: 2 },
  '6':        { label: '6',      intervals: [0, 4, 7, 9],             ring: 2 },
  'm6':       { label: 'm6',     intervals: [0, 3, 7, 9],             ring: 2 },
};

// Satellite ring layout: radius and chord list per ring.
// Radii are kept conservative so satellites never reach adjacent Circle-of-Fifths nodes.
const SATELLITE_RINGS = [
  { radius: 55,  chords: ['Major','Minor','Aug','Dim','Sus2','Sus4'] },
  { radius: 95,  chords: ['Maj7','Min7','Dom7','MinMaj7','Dim7','HalfDim7'] },
  { radius: 148, chords: ['Maj9','Min9','Dom9','Add9','Maj11','Min11','Maj13','Dom13','6','m6'] },
];

/** All scales/modes available in the UI */
const SCALES = {
  'None (All Chords)':         null,
  'Major (Ionian)':            [0, 2, 4, 5, 7, 9, 11],
  'Natural Minor (Aeolian)':   [0, 2, 3, 5, 7, 8, 10],
  'Dorian':                    [0, 2, 3, 5, 7, 9, 10],
  'Phrygian':                  [0, 1, 3, 5, 7, 8, 10],
  'Lydian':                    [0, 2, 4, 6, 7, 9, 11],
  'Mixolydian':                [0, 2, 4, 5, 7, 9, 10],
  'Locrian':                   [0, 1, 3, 5, 6, 8, 10],
  'Harmonic Minor':            [0, 2, 3, 5, 7, 8, 11],
  'Melodic Minor':             [0, 2, 3, 5, 7, 9, 11],
  'Whole Tone':                [0, 2, 4, 6, 8, 10],
  'Diminished (Half-Whole)':   [0, 1, 3, 4, 6, 7, 9, 10],
  'Diminished (Whole-Half)':   [0, 2, 3, 5, 6, 8, 9, 11],
  'Pentatonic Major':          [0, 2, 4, 7, 9],
  'Pentatonic Minor':          [0, 3, 5, 7, 10],
  'Blues':                     [0, 3, 5, 6, 7, 10],
  'Arabian':                   [0, 2, 4, 5, 6, 8, 10],
  'Hungarian Minor':           [0, 2, 3, 6, 7, 8, 11],
  'Persian':                   [0, 1, 4, 5, 6, 8, 11],
  'Super Locrian (Altered)':   [0, 1, 3, 4, 6, 8, 10],
  'Neapolitan Major':          [0, 1, 3, 5, 7, 9, 11],
  'Neapolitan Minor':          [0, 1, 3, 5, 7, 8, 11],
};

/**
 * Infer chord quality (Major/Minor/Dim/Aug) for a scale degree
 * by checking which thirds/fifths exist within the scale.
 */
function getChordQualityForDegree(scaleIntervals, degreeSemitone) {
  const set = new Set(scaleIntervals.map(i => i % 12));
  const minThird  = (degreeSemitone + 3) % 12;
  const majThird  = (degreeSemitone + 4) % 12;
  const perfFifth = (degreeSemitone + 7) % 12;
  const dimFifth  = (degreeSemitone + 6) % 12;
  const augFifth  = (degreeSemitone + 8) % 12;

  if (set.has(majThird) && set.has(perfFifth)) return 'Major';
  if (set.has(minThird) && set.has(perfFifth)) return 'Minor';
  if (set.has(minThird) && set.has(dimFifth))  return 'Dim';
  if (set.has(majThird) && set.has(augFifth))  return 'Aug';
  return 'Major';
}

/** Active semitones for a scale+tonic, or null if "None" */
function getActiveScaleSemitones(scaleName, tonicSemitone) {
  const intervals = SCALES[scaleName];
  if (!intervals) return null;
  return new Set(intervals.map(i => (i + tonicSemitone) % 12));
}

/** Human-readable chord name, e.g. "Cmaj9", "F#m", "Bbdom7" */
function buildChordLabel(rootName, chordType) {
  if (chordType === 'Major') return rootName;
  if (chordType === 'Minor') return rootName + 'm';
  const label = CHORD_TYPES[chordType]?.label ?? chordType;
  return rootName + label;
}

/** Get note names for a chord (for display) */
function getChordNotes(rootSemitone, chordType) {
  const intervals = CHORD_TYPES[chordType]?.intervals ?? [0, 4, 7];
  return intervals.map(i => CHROMATIC_NOTES[((rootSemitone + i) % 12 + 12) % 12]);
}

/**
 * Chord mood descriptors — drive the generative aurora color blobs.
 * hueShift: degrees to rotate from the root node's hue (null = use root hue directly)
 * sat: saturation % for blobs
 * warmth: 0 (cold/dark) → 1 (warm/bright) — controls blob brightness
 */
const CHORD_MOODS = {
  'Major':    { hueShift: null, sat: 68, warmth: 0.82 },
  'Minor':    { hueShift: 215, sat: 75, warmth: 0.30 },
  'Aug':      { hueShift: 275, sat: 85, warmth: 0.62 },
  'Dim':      { hueShift: 350, sat: 82, warmth: 0.15 },
  'Sus2':     { hueShift: 185, sat: 60, warmth: 0.60 },
  'Sus4':     { hueShift: 165, sat: 62, warmth: 0.58 },
  'Maj7':     { hueShift: 12,  sat: 65, warmth: 0.88 },
  'Min7':     { hueShift: 225, sat: 75, warmth: 0.32 },
  'Dom7':     { hueShift: 28,  sat: 80, warmth: 0.72 },
  'MinMaj7':  { hueShift: 268, sat: 82, warmth: 0.40 },
  'Dim7':     { hueShift: 355, sat: 88, warmth: 0.10 },
  'HalfDim7': { hueShift: 8,   sat: 80, warmth: 0.18 },
  'Maj9':     { hueShift: 48,  sat: 60, warmth: 0.90 },
  'Min9':     { hueShift: 238, sat: 70, warmth: 0.36 },
  'Dom9':     { hueShift: 34,  sat: 76, warmth: 0.74 },
  'Add9':     { hueShift: 55,  sat: 58, warmth: 0.80 },
  'Maj11':    { hueShift: 68,  sat: 55, warmth: 0.92 },
  'Min11':    { hueShift: 248, sat: 72, warmth: 0.42 },
  'Maj13':    { hueShift: 58,  sat: 58, warmth: 0.95 },
  'Dom13':    { hueShift: 38,  sat: 78, warmth: 0.78 },
  '6':        { hueShift: 18,  sat: 68, warmth: 0.74 },
  'm6':       { hueShift: 208, sat: 72, warmth: 0.38 },
};

/**
 * Scale mood — ambient background tint when a scale is active.
 * hue/sat/lit define the central color wash.
 */
const SCALE_MOODS = {
  'None (All Chords)':         { hue: 210, sat: 25, lit: 12 },
  'Major (Ionian)':            { hue: 46,  sat: 72, lit: 22 },
  'Natural Minor (Aeolian)':   { hue: 224, sat: 76, lit: 18 },
  'Dorian':                    { hue: 162, sat: 70, lit: 20 },
  'Phrygian':                  { hue: 4,   sat: 82, lit: 16 },
  'Lydian':                    { hue: 272, sat: 74, lit: 26 },
  'Mixolydian':                { hue: 32,  sat: 76, lit: 22 },
  'Locrian':                   { hue: 348, sat: 88, lit: 12 },
  'Harmonic Minor':            { hue: 284, sat: 80, lit: 18 },
  'Melodic Minor':             { hue: 252, sat: 72, lit: 20 },
  'Whole Tone':                { hue: 182, sat: 65, lit: 26 },
  'Diminished (Half-Whole)':   { hue: 338, sat: 80, lit: 14 },
  'Diminished (Whole-Half)':   { hue: 318, sat: 78, lit: 14 },
  'Pentatonic Major':          { hue: 52,  sat: 62, lit: 24 },
  'Pentatonic Minor':          { hue: 202, sat: 68, lit: 20 },
  'Blues':                     { hue: 212, sat: 88, lit: 18 },
  'Arabian':                   { hue: 14,  sat: 82, lit: 20 },
  'Hungarian Minor':           { hue: 292, sat: 84, lit: 18 },
  'Persian':                   { hue: 22,  sat: 88, lit: 16 },
  'Super Locrian (Altered)':   { hue: 258, sat: 82, lit: 16 },
  'Neapolitan Major':          { hue: 102, sat: 70, lit: 22 },
  'Neapolitan Minor':          { hue: 312, sat: 80, lit: 18 },
};
