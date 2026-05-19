# Cosmic Chord Circle

> An interactive, audio-reactive Circle of Fifths explorer — where music theory meets the cosmos.

**[Live Demo](https://pulseprogrammer.github.io/cosmic-chord-circle)**

---

## What Is This?

Cosmic Chord Circle is a fully interactive music theory tool built on the **Circle of Fifths**. Every one of the 12 root notes floats as a glowing planet in a dark celestial space. Hover any note and its entire chord universe expands outward in three orbital rings — triads, seventh chords, and extended chords — like branches of a neuron firing in deep space.

Click any chord to hear it played through a layered warm pad synthesizer. The cosmos responds — particles pulse, the circle breathes, and chords crossfade cinematically into one another.

---

## Features

### Music Theory
- All **12 Circle of Fifths** root notes always visible, color-coded by position
- **22 chord types** across 3 orbital rings per note:
  - **Inner ring** — Triads: maj, min, aug, dim, sus2, sus4
  - **Middle ring** — 7th chords: maj7, min7, dom7, mMaj7, dim7, half-dim7
  - **Outer ring** — Extended: maj9, min9, dom9, add9, maj11, min11, maj13, dom13, 6, m6
- **22 scales and modes** including Major, Natural Minor, Dorian, Phrygian, Lydian, Mixolydian, Locrian, Harmonic Minor, Melodic Minor, Whole Tone, Diminished, Pentatonic Major/Minor, Blues, Arabian, Hungarian Minor, Persian, Super Locrian, Neapolitan Major/Minor
- Scale filter dims out-of-key nodes and auto-assigns correct chord quality per scale degree
- Configurable **root / tonic** across all 12 chromatic notes

### Audio Engine
- Three-layer warm celestial pad synthesizer via [Tone.js](https://tonejs.github.io/):
  - **Pad** — custom harmonic sine oscillator (warm body)
  - **Sub** — pure sine one octave below (depth and grounding)
  - **Shimmer** — soft sine one octave above, bypasses chorus to stay clean
- Spacious **reverb** (7-second cosmic tail) + stereo **chorus** + low-pass filter at 1400 Hz
- Smooth **crossfade** between chords — new chord blooms inside the fading old one
- Real-time **FFT analysis** driving audio-reactive visuals
- Volume control from -30 dB to 0 dB

### Visuals
- Drifting **starfield** with parallax and occasional shooting stars
- **Electro-nerve connections** between harmonically related nodes with traveling impulse particles
- **Spring camera** — subtle zoom and pan on every click
- **Shockwave rings** radiating outward on chord trigger
- Smooth **scale ambient tint** — each mode carries its own color mood (Phrygian = dark red, Lydian = violet, Blues = deep indigo)
- Satellite clusters **push neighboring nodes apart** when hovered, creating natural breathing space
- Circle cinematically **re-centres** when the panel is toggled open or closed
- **FFT energy bars** (Bass / Mid / Air) rendered directly on the canvas
- Full **Retina / HiDPI** support via `devicePixelRatio` scaling

### Responsive
- Desktop: settings panel on the right, circle offset to fill remaining canvas
- Mobile (640 px and below): panel slides up from the bottom as a sheet; only triads shown on hover for a clean small-screen experience
- Touch events fully supported

---

## How to Use

| Action | Result |
|--------|--------|
| Hover a note | Satellite chord rings expand outward |
| Click a note | Plays the root major chord |
| Click a satellite | Plays that chord variant |
| Click again | Toggles the chord off |
| Space bar | Stops playback immediately |
| Scale selector | Filters nodes to a key; auto-assigns chord quality |
| Tonic grid | Sets the key centre for scale highlighting |
| Volume slider | Master volume from -30 dB to 0 dB |
| Panel toggle | Collapses or expands the settings panel |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Rendering | HTML5 Canvas 2D API |
| Audio | Tone.js 14.8.49 |
| Fonts | Inter via Google Fonts |
| Deployment | GitHub Pages |
| Local server | Python 3 http.server |

No build step. No dependencies to install. Pure vanilla JavaScript.

---

## Run Locally

```bash
git clone https://github.com/PulseProgrammer/cosmic-chord-circle.git
cd cosmic-chord-circle
python3 serve.py
```

Open **http://localhost:8080** in your browser.

Audio requires a user gesture (click) before it initialises — this is a browser security requirement.

---

## Project Structure

```
cosmic-chord-circle/
├── index.html              # Single-page app shell + panel UI
├── serve.py                # Local dev server
├── static/
│   ├── css/
│   │   └── style.css       # Dark space aesthetic + glassmorphic panel
│   └── js/
│       ├── theory.js       # Music theory data: notes, chords, scales, intervals
│       ├── audio.js        # Tone.js synthesizer engine + FFT analyser
│       ├── canvas.js       # Full rendering engine
│       └── app.js          # Master coordinator — wires UI, canvas, and audio
└── README.md
```

---

## Design Notes

**Circle of Fifths** — Adjacent nodes are a perfect fifth apart, the most consonant interval after the octave, making it the ideal structure for exploring harmonic relationships.

**Layered synth** — A single oscillator sounds thin. Layering a warm custom-harmonic pad, a sub sine for body, and a shimmer octave for air creates a full, celestial sound without harshness.

**Outward satellite expansion** — Placing chords on orbital rings outside each root node mirrors the physical intuition of zooming into a harmonic universe. Edge nodes fan inward to stay within the canvas.

---

## License

MIT — free to use, fork, and build upon.

---

Made with music theory, canvas math, and a lot of reverb.
