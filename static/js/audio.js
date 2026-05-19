/**
 * audio.js — Soothing celestial pad synthesizer using Tone.js
 *
 * Three layered voices:
 *   pad    — warm custom-harmonic sine (the main body)
 *   sub    — pure sine sub-bass root (depth)
 *   shimmer— detuned high octave (air)
 *
 * Chain: voices → LowPass filter → Chorus → Reverb → Master
 */
class AudioEngine {
  constructor() {
    this.initialized  = false;
    this.activeNotes  = [];
    this.activeSub    = [];
    this.activeShimmer= [];
    this.volume       = -8;
    // Track currently playing chord for toggle-stop
    this.playingKey   = null;
  }

  async init() {
    if (this.initialized) return;
    await Tone.start();

    // ── Master volume
    this.masterVol = new Tone.Volume(this.volume).toDestination();

    // ── Spacious reverb (long tail = cosmic)
    this.reverb = new Tone.Reverb({ decay: 7, preDelay: 0.06, wet: 0.62 });
    await this.reverb.generate();
    this.reverb.connect(this.masterVol);

    // ── Wide stereo chorus
    this.chorus = new Tone.Chorus({ frequency: 0.9, delayTime: 5, depth: 0.7, wet: 0.45 }).start();
    this.chorus.connect(this.reverb);

    // ── Dark low-pass filter — removes harshness, keeps mid warmth
    this.filter = new Tone.Filter({ frequency: 1400, type: 'lowpass', rolloff: -24 });
    this.filter.connect(this.chorus);

    // ── Main pad: custom sine harmonics — warm, not harsh
    //    partials: fundamental strong, gentle 2nd & 3rd, barely-there 4th
    this.padSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'custom',
        partials: [1, 0.45, 0.18, 0.06, 0.02],
      },
      envelope: { attack: 0.55, decay: 1.4, sustain: 0.78, release: 4.2 },
      volume: -5,
    });
    this.padSynth.connect(this.filter);

    // ── Sub layer: pure sine, one octave below root only
    this.subSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.75, decay: 1.8, sustain: 0.65, release: 5.5 },
      volume: -15,
    });
    this.subSynth.connect(this.filter);

    // ── Shimmer: very soft sine one octave up, floaty feel
    // Routed directly to reverb (bypasses chorus) — chorus on high freqs causes distortion
    this.shimmerSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 1.4, decay: 2.0, sustain: 0.22, release: 6.0 },
      volume: -30,
    });
    this.shimmerSynth.connect(this.reverb);

    // ── FFT analyser for audio-reactive visuals (32 bins)
    this.analyser = new Tone.Analyser('fft', 32);
    this.masterVol.connect(this.analyser);

    this.initialized = true;
  }

  /**
   * Returns normalised energy levels {bass, mid, presence} in [0, 1].
   * Used by the canvas to drive audio-reactive visuals.
   */
  getEnergyLevels() {
    if (!this.analyser) return { bass: 0, mid: 0, presence: 0 };
    const fft = this.analyser.getValue(); // Float32Array, dB values (-100..0)
    const norm = db => Math.max(0, (db + 80) / 80);
    const avg  = (arr, lo, hi) => {
      let s = 0; for (let i = lo; i < hi; i++) s += norm(arr[i]);
      return s / (hi - lo);
    };
    return {
      bass:     avg(fft, 0, 3),
      mid:      avg(fft, 3, 10),
      presence: avg(fft, 10, 18),
    };
  }

  /**
   * Play a chord. If the same chord is already playing, stop it (toggle).
   * Returns true if started, false if stopped.
   */
  async playChord(rootSemitone, chordType) {
    if (!this.initialized) await this.init();

    const key = `${rootSemitone}:${chordType}`;

    // Toggle off if same chord
    if (this.playingKey === key) {
      this._releaseAll(0.6);
      this.playingKey = null;
      return false;
    }

    const intervals = CHORD_TYPES[chordType]?.intervals ?? [0, 4, 7];
    const baseFreq  = this._normalizeRootFreq(rootSemitone);

    // Crossfade: pad holds longest so new chord blooms inside the old one;
    // sub fades fast to prevent muddy low-end; shimmer in between.
    const xNow = Tone.now();
    if (this.activeNotes.length)   { this.padSynth.triggerRelease(this.activeNotes,      xNow + 0.4);  this.activeNotes   = []; }
    if (this.activeSub.length)     { this.subSynth.triggerRelease(this.activeSub,         xNow + 0.06); this.activeSub     = []; }
    if (this.activeShimmer.length) { this.shimmerSynth.triggerRelease(this.activeShimmer, xNow + 0.14); this.activeShimmer = []; }

    // Build pad frequencies using actual semitone offsets from C3
    // This keeps chord voicing natural across all extensions
    const padFreqs = intervals.map(i => baseFreq * Math.pow(2, i / 12));

    // Sub: root only, one octave lower
    const subFreq = baseFreq * 0.5;

    // Shimmer: root + 5th one octave up (airy top)
    const shimmerFreqs = [
      baseFreq * 2,
      baseFreq * 2 * Math.pow(2, 7 / 12),
    ];

    const now = Tone.now();
    this.padSynth.triggerAttack(padFreqs, now);
    this.subSynth.triggerAttack([subFreq], now);
    this.shimmerSynth.triggerAttack(shimmerFreqs, now + 0.15); // slight stagger for shimmer

    this.activeNotes   = padFreqs;
    this.activeSub     = [subFreq];
    this.activeShimmer = shimmerFreqs;
    this.playingKey    = key;

    return true;
  }

  stopAll() {
    this._releaseAll(0.18);
    this.playingKey = null;
  }

  _releaseAll(releaseTime = 0.2) {
    const now = Tone.now();
    if (this.activeNotes.length) {
      this.padSynth.triggerRelease(this.activeNotes, now + releaseTime);
      this.activeNotes = [];
    }
    if (this.activeSub.length) {
      this.subSynth.triggerRelease(this.activeSub, now + releaseTime);
      this.activeSub = [];
    }
    if (this.activeShimmer.length) {
      this.shimmerSynth.triggerRelease(this.activeShimmer, now + releaseTime);
      this.activeShimmer = [];
    }
  }

  /**
   * Normalize root frequency so all 12 notes land in the same register (~100–196 Hz).
   *
   * Problem: sequential mapping puts C3 at 130 Hz and Bb3 at 233 Hz — nearly
   * double the frequency, making Bb sound "one octave higher" than C.
   *
   * Fix: notes Ab, A, Bb, B are dropped one octave (÷2) so every root sits
   * within [Ab2, G3] = [104, 196 Hz]. Circle-of-Fifths neighbours then move
   * naturally up a 5th or down a 4th, which is exactly how bass lines work.
   *
   *  C(131) → G(196) → D(147) → A(110) → E(165) → B(123) → F#(185) …
   */
  _normalizeRootFreq(semitone) {
    const s    = ((semitone % 12) + 12) % 12;
    const note = CHROMATIC_NOTES[s];
    let   freq = NOTE_FREQS[note];          // raw C3-based value
    // Ab(8), A(9), Bb(10), B(11) sit too high — bring them to octave 2
    if (s >= 8) freq /= 2;
    return freq;
  }

  setVolume(db) {
    this.volume = db;
    if (this.masterVol) this.masterVol.volume.value = db;
  }
}
