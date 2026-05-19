/**
 * app.js — Master coordinator
 * Connects Canvas renderer, Audio engine, and right-panel UI.
 */
(function () {

  const state = {
    selectedScale: 'None (All Chords)',
    tonicSemitone: 0,
  };

  let cosmos = null;
  const audio = new AudioEngine();

  // DOM refs
  const canvasEl     = document.getElementById('cosmos');
  const panelEl      = document.getElementById('panel');
  const toggleBtn    = document.getElementById('panel-toggle');
  const scaleSelect  = document.getElementById('scale-select');
  const tonicGrid    = document.getElementById('tonic-grid');
  const chordNameEl  = document.getElementById('chord-name');
  const chordNotesEl = document.getElementById('chord-notes');
  const volumeSlider = document.getElementById('volume-slider');

  // ── Boot ────────────────────────────────────
  function init() {
    buildTonicGrid();
    buildScaleOptions();
    cosmos = new CosmicCanvas(canvasEl, onChordTriggered, () => {}, audio);
    bindPanelEvents();
    bindKeyboard();
    applyScaleToCanvas();
    tickFftMeter();
  }

  // ── Chord click handler ──────────────────────
  async function onChordTriggered(rootNode, chordType) {
    // If scale is active, derive correct chord quality for this degree
    let resolvedType = chordType;
    if (state.selectedScale !== 'None (All Chords)' && chordType === 'Major') {
      const intervals = SCALES[state.selectedScale];
      if (intervals) {
        const degreeSt = ((rootNode.semitone - state.tonicSemitone) % 12 + 12) % 12;
        if (intervals.includes(degreeSt)) {
          resolvedType = getChordQualityForDegree(intervals, degreeSt);
        }
      }
    }

    const started = await audio.playChord(rootNode.semitone, resolvedType);

    if (started) {
      const label = buildChordLabel(rootNode.name, resolvedType);
      const notes = getChordNotes(rootNode.semitone, resolvedType);
      chordNameEl.textContent  = label;
      chordNotesEl.textContent = notes.join('  ·  ');
      // Trigger generative aurora mood blobs
      cosmos.triggerChordMood(rootNode, resolvedType);
    } else {
      chordNameEl.textContent  = '—';
      chordNotesEl.textContent = 'Stopped';
    }
  }

  // ── Panel UI ────────────────────────────────
  function buildTonicGrid() {
    CHROMATIC_NOTES.forEach((note, i) => {
      const btn = document.createElement('button');
      btn.className    = 'tonic-btn' + (i === 0 ? ' active' : '');
      btn.textContent  = note;
      btn.dataset.semitone = i;
      btn.addEventListener('click', () => {
        state.tonicSemitone = i;
        document.querySelectorAll('.tonic-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyScaleToCanvas();
      });
      tonicGrid.appendChild(btn);
    });
  }

  function buildScaleOptions() {
    Object.keys(SCALES).forEach(name => {
      const opt       = document.createElement('option');
      opt.value       = name;
      opt.textContent = name;
      scaleSelect.appendChild(opt);
    });
  }

  function bindPanelEvents() {
    toggleBtn.addEventListener('click', () => {
      panelEl.classList.toggle('collapsed');
      toggleBtn.textContent = panelEl.classList.contains('collapsed') ? '⟩' : '⟨';
      cosmos.notifyPanelToggle();
    });

    scaleSelect.addEventListener('change', () => {
      state.selectedScale = scaleSelect.value;
      applyScaleToCanvas();
    });

    volumeSlider.addEventListener('input', () => {
      audio.setVolume(parseFloat(volumeSlider.value));
    });
  }

  function applyScaleToCanvas() {
    const semitoneSet = getActiveScaleSemitones(state.selectedScale, state.tonicSemitone);
    cosmos.setActiveScale(semitoneSet);
    cosmos.setScaleMood(state.selectedScale);
  }

  // ── Spacebar stop ────────────────────────────
  function bindKeyboard() {
    document.addEventListener('keydown', e => {
      if (e.code === 'Space') {
        e.preventDefault(); // stop page scroll
        audio.stopAll();
        chordNameEl.textContent  = '—';
        chordNotesEl.textContent = 'Stopped';
      }
    });
  }

  // ── FFT meter — reads cosmos.energy and animates 3 bars ──
  const fftBars = {
    bass:     document.getElementById('fft-bass'),
    mid:      document.getElementById('fft-mid'),
    presence: document.getElementById('fft-presence'),
  };

  function tickFftMeter() {
    if (cosmos) {
      const { bass, mid, presence } = cosmos.energy;
      if (fftBars.bass)     fftBars.bass.style.transform     = `scaleY(${0.05 + bass * 0.95})`;
      if (fftBars.mid)      fftBars.mid.style.transform      = `scaleY(${0.05 + mid * 0.95})`;
      if (fftBars.presence) fftBars.presence.style.transform = `scaleY(${0.05 + presence * 0.95})`;
    }
    requestAnimationFrame(tickFftMeter);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
