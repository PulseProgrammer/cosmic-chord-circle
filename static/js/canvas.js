/**
 * canvas.js — Cosmic Circle of Fifths rendering engine
 *
 * Key features:
 *  - Circle centered LEFT of the panel so right-side nodes are never hidden
 *  - Generous hit detection radius on all nodes + satellites
 *  - Satellites stay open while cursor is anywhere in the cluster zone
 *  - Drifting starfield + breathing nebulae + shooting stars
 *  - Generative aurora blobs triggered by chord play (mood-matched hues)
 *  - Scale-ambient tint that persists while a scale is active
 *  - Spring camera zoom on click
 */

// Desktop panel width to offset the circle center leftward
const PANEL_W_DESKTOP = 280;

class CosmicCanvas {
  constructor(canvasEl, onNodeClick, onNodeHover, audioEngine) {
    this.canvas      = canvasEl;
    this.ctx         = canvasEl.getContext('2d');
    this.onNodeClick  = onNodeClick  || (() => {});
    this.onNodeHover  = onNodeHover  || (() => {});
    this.audioEngine  = audioEngine  || null;
    // Smoothed audio energy levels for reactive visuals
    this.energy = { bass: 0, mid: 0, presence: 0 };

    this.time          = 0;
    this.nodes         = [];
    this.stars         = [];
    this.particles     = [];
    this.shockwaves    = [];
    this.shootingStars = [];

    this.hoveredNode    = null;
    this.expandedNode   = null;
    this.satellites     = [];
    this.hoveredSat     = null;
    this._collapseTimer = null;
    this._touchMode     = false;
    this._panelOffsetY  = 0;

    this.activeScaleSet = null;
    this.mouseX = -9999;
    this.mouseY = -9999;

    // Camera spring state
    this.cam = { x: 0, y: 0, zoom: 1, tx: 0, ty: 0, tz: 1 };

    // Scale ambient mood (persists while scale is active)
    this.scaleMood = { hue: 210, sat: 25, lit: 12, alpha: 0, targetAlpha: 0 };

    this._resize();
    this._initNodes();
    this._initStars();
    this._bindEvents();
    this._animate();
  }

  // ─────────────────────────────────────────────
  //  Setup & resize
  // ─────────────────────────────────────────────

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width  = this.canvas.offsetWidth  * dpr;
    this.canvas.height = this.canvas.offsetHeight * dpr;
    this.ctx.scale(dpr, dpr);
    this.W = this.canvas.offsetWidth;
    this.H = this.canvas.offsetHeight;

    // Portrait mobile: W<=640. Landscape mobile: small H (phone rotated sideways)
    const isMobile = this.W <= 640 || (this.H <= 500 && this.W <= 1024);
    const panelEl = document.getElementById('panel');
    const panelCollapsed = panelEl?.classList.contains('collapsed') ?? false;
    // When panel is open offset centre leftward; when collapsed use full canvas
    const panelOffsetX = (isMobile || panelCollapsed) ? 0 : PANEL_W_DESKTOP;
    // Mobile panel is a bottom sheet; reserve less when collapsed (only 44px nub shows)
    const panelOffsetY = isMobile ? (panelCollapsed ? 44 : Math.min(this.H * 0.42, 320)) : 0;
    this._panelOffsetY = panelOffsetY;

    this.targetCx         = (this.W - panelOffsetX) / 2;
    this.targetCy         = (this.H - panelOffsetY) / 2;
    this.targetMainRadius = Math.min(this.W - panelOffsetX, this.H - panelOffsetY) * (isMobile ? 0.30 : 0.37);

    // First call: snap so nothing starts at 0,0
    if (!this._layoutReady) {
      this.cx         = this.targetCx;
      this.cy         = this.targetCy;
      this.mainRadius = this.targetMainRadius;
      this._layoutReady = true;
      if (this.nodes.length) this._positionNodes();
    }
  }

  _initNodes() {
    this.nodes = CIRCLE_OF_FIFTHS.map((note, i) => {
      const hue = Math.round((i / 12) * 360);
      return {
        index:      i,
        name:       note.name,
        semitone:   note.semitone,
        baseX: 0, baseY: 0, x: 0, y: 0,
        radius:     28,
        hue,
        color:      `hsl(${hue},85%,62%)`,
        dimmed:     false,
        pulsePhase: Math.random() * Math.PI * 2,
        angle:      0,
      };
    });
    this._positionNodes();
  }

  _positionNodes() {
    const isMobile = this.W <= 640 || (this.H <= 500 && this.W <= 1024);
    this.nodes.forEach((n, i) => {
      n.angle  = (i / 12) * Math.PI * 2 - Math.PI / 2;
      n.baseX  = this.cx + this.mainRadius * Math.cos(n.angle);
      n.baseY  = this.cy + this.mainRadius * Math.sin(n.angle);
      n.radius = isMobile ? 18 : 28;
    });
  }

  _initStars() {
    this.stars = Array.from({ length: 240 }, () => ({
      x:           Math.random() * (this.W || 1440),
      y:           Math.random() * (this.H || 900),
      size:        Math.random() * 1.5 + 0.2,
      phase:       Math.random() * Math.PI * 2,
      twinkleSpd:  Math.random() * 0.018 + 0.004,
      vx:          (Math.random() - 0.5) * 0.05,
      vy:          (Math.random() - 0.5) * 0.035,
    }));
  }

  _bindEvents() {
    window.addEventListener('resize', () => this._resize());

    this.canvas.addEventListener('mousemove', e => {
      const r = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left;
      this.mouseY = e.clientY - r.top;
      this._updateHover();
    });

    this.canvas.addEventListener('mouseleave', () => {
      // Touch browsers fire a synthetic mouseleave after touchend — ignore it
      if (this._touchMode) return;
      this.mouseX = -9999; this.mouseY = -9999;
      this.hoveredNode = null; this.hoveredSat = null;
      this._collapseSatellites();
      this.canvas.style.cursor = 'default';
    });

    this.canvas.addEventListener('click', () => {
      if (this.hoveredSat) {
        this.onNodeClick(this.expandedNode, this.hoveredSat.chordType);
        this._triggerShockwave(this.hoveredSat.x, this.hoveredSat.y, this.hoveredSat.color);
        this._springCamera(this.hoveredSat.x, this.hoveredSat.y);
      } else if (this.hoveredNode && !this.hoveredNode.dimmed) {
        this.onNodeClick(this.hoveredNode, 'Major');
        this._triggerShockwave(this.hoveredNode.x, this.hoveredNode.y, this.hoveredNode.color);
        this._springCamera(this.hoveredNode.x, this.hoveredNode.y);
      }
    });

    this.canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      this._touchMode = true;
      // Mobile browsers require AudioContext.resume() to be called synchronously
      // inside a user-gesture handler. Fire-and-forget here so it's ready.
      if (typeof Tone !== 'undefined') Tone.start().catch(() => {});
      const t = e.touches[0];
      const r = this.canvas.getBoundingClientRect();
      this.mouseX = t.clientX - r.left;
      this.mouseY = t.clientY - r.top;
      this._updateHover();
      if (this.hoveredSat) {
        this.onNodeClick(this.expandedNode, this.hoveredSat.chordType);
        this._triggerShockwave(this.hoveredSat.x, this.hoveredSat.y, this.hoveredSat.color);
        this._springCamera(this.hoveredSat.x, this.hoveredSat.y);
      } else if (this.hoveredNode && !this.hoveredNode.dimmed) {
        this.onNodeClick(this.hoveredNode, 'Major');
        this._triggerShockwave(this.hoveredNode.x, this.hoveredNode.y, this.hoveredNode.color);
        this._springCamera(this.hoveredNode.x, this.hoveredNode.y);
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = e.touches[0];
      const r = this.canvas.getBoundingClientRect();
      this.mouseX = t.clientX - r.left;
      this.mouseY = t.clientY - r.top;
      this._updateHover();
    }, { passive: false });
  }

  // ─────────────────────────────────────────────
  //  Hover — stable satellite detection
  // ─────────────────────────────────────────────

  _updateHover() {
    const mx = this.mouseX, my = this.mouseY;

    // Priority 1: satellite hit (generous radius)
    const isMob = this.W <= 640 || (this.H <= 500 && this.W <= 1024);
    this.hoveredSat = null;
    for (const s of this.satellites) {
      if (dist(mx, my, s.x, s.y) < s.radius + (isMob ? 28 : 16)) {
        this.hoveredSat = s;
        this.canvas.style.cursor = 'pointer';
        return;
      }
    }

    // Priority 2: within expanded cluster zone
    if (this.expandedNode) {
      const nodeR2   = this.expandedNode.radius;
      const clusterR = Math.max(SATELLITE_RINGS[2].radius * (this.mainRadius / 280), nodeR2 + 80) + 60;
      if (dist(mx, my, this.expandedNode.baseX, this.expandedNode.baseY) < clusterR) {
        // If cursor is over a DIFFERENT root node, switch expansion to it
        for (const n of this.nodes) {
          if (!n.dimmed && n !== this.expandedNode && dist(mx, my, n.x, n.y) < n.radius + 22) {
            this._expandSatellites(n);
            this.hoveredNode = n;
            this.canvas.style.cursor = 'pointer';
            this.onNodeHover(n);
            return;
          }
        }
        // Still within same cluster — keep open
        this.hoveredNode = this.expandedNode;
        this.canvas.style.cursor = 'pointer';
        return;
      }
      this._collapseSatellites();
      this.hoveredNode = null;
    }

    // Priority 3: root node hit (generous radius)
    let found = null;
    for (const n of this.nodes) {
      if (!n.dimmed && dist(mx, my, n.x, n.y) < n.radius + 22) {
        found = n; break;
      }
    }

    if (found !== this.hoveredNode) {
      this.hoveredNode = found;
      if (found) {
        this._expandSatellites(found);
        this.canvas.style.cursor = 'pointer';
        this.onNodeHover(found);
      } else {
        this.canvas.style.cursor = 'default';
      }
    } else if (!found) {
      this.canvas.style.cursor = 'default';
    }
  }

  // ─────────────────────────────────────────────
  //  Satellites
  // ─────────────────────────────────────────────

  _expandSatellites(rootNode) {
    if (this._collapseTimer) { clearTimeout(this._collapseTimer); this._collapseTimer = null; }
    this.expandedNode = rootNode;
    this.satellites   = [];
    const isMobile = this.W <= 640 || (this.H <= 500 && this.W <= 1024);
    const scale = this.mainRadius / 280;
    const nodeR = rootNode.radius; // 18 on mobile, 28 on desktop
    // Per-ring minimum clearance from node edge (ensures ring 0 is always outside node glow)
    const ringMins = [nodeR + 24, nodeR + 50, nodeR + 80];

    // Fan direction: outward from circle centre for interior nodes;
    // inward (toward circle centre) for boundary nodes whose outer ring
    // tip would leave the visible canvas.
    const outward  = Math.atan2(rootNode.baseY - this.cy, rootNode.baseX - this.cx);
    const outerR   = Math.max(SATELLITE_RINGS[2].radius * scale, ringMins[2]);
    const tipX     = rootNode.baseX + outerR * Math.cos(outward);
    const tipY     = rootNode.baseY + outerR * Math.sin(outward);
    const edgePad  = isMobile ? 40 : 55;
    const yBound   = this.H - this._panelOffsetY;
    const rBound   = this.W - (isMobile ? edgePad : PANEL_W_DESKTOP + edgePad);
    const offScreen = tipX < edgePad || tipX > rBound || tipY < edgePad || tipY > yBound - edgePad;
    const fanAngle  = offScreen
      ? Math.atan2(this.cy - rootNode.baseY, this.cx - rootNode.baseX)  // inward
      : outward;                                                          // outward
    this._fanAngle = fanAngle;

    const rings = SATELLITE_RINGS;

    rings.forEach((ring, ri) => {
      const count  = ring.chords.length;
      // Tighter arcs reduce bleed onto adjacent Circle-of-Fifths nodes.
      const spread   = ri === 2 ? Math.PI * 1.48 : Math.PI * 1.22;
      const startA   = fanAngle - spread / 2;
      const rNominal = Math.max(ring.radius * scale, ringMins[ri]);

      ring.chords.forEach((chordType, i) => {
        const t     = count > 1 ? i / (count - 1) : 0.5;
        const angle = startA + t * spread;
        const ux = Math.cos(angle), uy = Math.sin(angle);

        // Collision-safe radius: pull the satellite inward if its ray would
        // land inside the glow zone of any other Circle-of-Fifths root node.
        let r = rNominal;
        const safeMin = isMobile ? 0 : 44; // root-node glow clearance in px
        for (const other of this.nodes) {
          if (other === rootNode) continue;
          const dx   = other.baseX - rootNode.baseX;
          const dy   = other.baseY - rootNode.baseY;
          const dot  = dx * ux + dy * uy;
          const disc = dot * dot - (dx * dx + dy * dy) + safeMin * safeMin;
          if (disc < 0) continue;          // ray misses this node's safe zone
          const tEntry = dot - Math.sqrt(disc);
          if (tEntry > 0 && tEntry < r) {
            r = Math.max(0, tEntry - 4);   // park just outside the safe zone
          }
        }

        let   x = rootNode.baseX + r * ux;
        let   y = rootNode.baseY + r * uy;

        // Safety clamp — keep satellites inside the visible canvas area
        const pad = 28;
        const rightBound = this.W - (isMobile ? pad : PANEL_W_DESKTOP + pad);
        x = Math.max(pad, Math.min(rightBound, x));
        y = Math.max(pad, Math.min(yBound - pad, y));

        const hue = (rootNode.hue + ri * 28 + i * 9) % 360;
        this.satellites.push({
          x, y, baseX: x, baseY: y,
          radius:   ri === 2 ? (isMobile ? 7 : 8) : ri === 1 ? (isMobile ? 9 : 11) : (isMobile ? 11 : 13),
          chordType,
          label:    CHORD_TYPES[chordType]?.label ?? chordType,
          color:    `hsl(${hue},80%,65%)`,
          ringIdx:  ri,
          angle,
          alpha:    0, scale: 0.1,
          phase:    Math.random() * Math.PI * 2,
          dying:    false,
        });
      });
    });
  }

  _collapseSatellites() {
    this.satellites.forEach(s => s.dying = true);
    this._collapseTimer = setTimeout(() => {
      this.satellites   = [];
      this.expandedNode = null;
      this._collapseTimer = null;
    }, 320);
  }

  // ─────────────────────────────────────────────
  //  Camera spring
  // ─────────────────────────────────────────────

  _springCamera(x, y) {
    this.cam.tx = (x - this.cx) * 0.05;
    this.cam.ty = (y - this.cy) * 0.05;
    this.cam.tz = 1.065;
    if (this._camTimer) clearTimeout(this._camTimer);
    this._camTimer = setTimeout(() => {
      this.cam.tx = 0; this.cam.ty = 0; this.cam.tz = 1;
    }, 400);
  }

  // ─────────────────────────────────────────────
  //  Public API
  // ─────────────────────────────────────────────

  /** Call whenever the side panel is toggled — sets new targets, circle eases cinematically. */
  notifyPanelToggle() {
    this._resize();
  }

  setActiveScale(semitoneSet) {
    this.activeScaleSet = semitoneSet;
    this.nodes.forEach(n => { n.dimmed = semitoneSet ? !semitoneSet.has(n.semitone) : false; });
    if (this.expandedNode && this.expandedNode.dimmed) this._collapseSatellites();
  }

  /** No-op — aurora blobs removed. Kept so app.js call doesn't throw. */
  triggerChordMood() {}

  /**
   * Set ambient scale mood tint. Called when scale selector changes.
   */
  setScaleMood(scaleName) {
    const m = SCALE_MOODS[scaleName] || SCALE_MOODS['None (All Chords)'];
    this.scaleMood.hue  = m.hue;
    this.scaleMood.sat  = m.sat;
    this.scaleMood.lit  = m.lit;
    this.scaleMood.targetAlpha = (scaleName === 'None (All Chords)') ? 0.015 : 0.055;
  }

  // ─────────────────────────────────────────────
  //  Animation loop
  // ─────────────────────────────────────────────

  _animate() {
    requestAnimationFrame(() => this._animate());
    this._update();
    this._draw();
  }

  _update() {
    this.time += 0.012;

    // ── Cinematic layout easing (panel open/close) ────────────────
    if (this.targetCx !== undefined) {
      const dx = this.targetCx - this.cx;
      const dy = this.targetCy - this.cy;
      const dr = this.targetMainRadius - this.mainRadius;
      if (Math.abs(dx) + Math.abs(dy) + Math.abs(dr) > 0.08) {
        this.cx         += dx * 0.052;
        this.cy         += dy * 0.052;
        this.mainRadius += dr * 0.052;
        this._positionNodes();
      }
    }

    // Float root nodes gently + repel from the expanded cluster
    this.nodes.forEach((n, i) => {
      let targetPX = 0, targetPY = 0;
      if (this.expandedNode) {
        if (n !== this.expandedNode) {
          // Push neighbours away from the hovered node to open up space
          const dx = n.baseX - this.expandedNode.baseX;
          const dy = n.baseY - this.expandedNode.baseY;
          const d  = Math.sqrt(dx * dx + dy * dy);
          const threshold = this.mainRadius * 0.90;
          if (d > 0 && d < threshold) {
            const strength = (1 - d / threshold) * 58;
            targetPX = (dx / d) * strength;
            targetPY = (dy / d) * strength;
          }
        } else {
          // Push expanded node outward from circle centre
          const nx = n.baseX - this.cx, ny = n.baseY - this.cy;
          const nd = Math.sqrt(nx * nx + ny * ny) || 1;
          targetPX = (nx / nd) * 22;
          targetPY = (ny / nd) * 22;
        }
      }
      n.pushX = ((n.pushX ?? 0) * 0.87) + (targetPX * 0.13);
      n.pushY = ((n.pushY ?? 0) * 0.87) + (targetPY * 0.13);
      n.x = n.baseX + Math.sin(this.time * 0.6 + i * 1.4) * 3.5 + n.pushX;
      n.y = n.baseY + Math.cos(this.time * 0.45 + i * 1.1) * 3.5 + n.pushY;
    });

    // Drift stars
    this.stars.forEach(s => {
      s.x = (s.x + s.vx + this.W) % this.W;
      s.y = (s.y + s.vy + this.H) % this.H;
      s.phase += s.twinkleSpd;
    });

    // Animate satellites in/out, tracking expanded node's push offset
    const nodePX = this.expandedNode?.pushX ?? 0;
    const nodePY = this.expandedNode?.pushY ?? 0;
    this.satellites.forEach(s => {
      s.alpha += s.dying ? -0.08 : Math.min(0, s.alpha - 1) === 0 ? 0 : 0.08;
      s.alpha  = Math.max(0, Math.min(1, s.dying ? s.alpha : s.alpha + 0.08));
      s.scale  = Math.max(0, Math.min(1, s.dying ? s.scale - 0.07 : s.scale + 0.07));
      const px = s.dying ? 0 : nodePX;
      const py = s.dying ? 0 : nodePY;
      s.x = s.baseX + px + Math.sin(this.time * 0.9 + s.phase) * 1.8;
      s.y = s.baseY + py + Math.cos(this.time * 0.7 + s.phase) * 1.8;
    });

    // Nerve particles
    if (Math.random() < 0.38) this._spawnParticle();
    this.particles    = this.particles.filter(p => p.update());
    this.shockwaves   = this.shockwaves.filter(s => s.update());

    // Shooting stars
    if (Math.random() < 0.003) this.shootingStars.push(new ShootingStar(this.W, this.H));
    this.shootingStars = this.shootingStars.filter(s => s.update());

    // Scale mood tint blend
    this.scaleMood.alpha += (this.scaleMood.targetAlpha - this.scaleMood.alpha) * 0.012;

    // Audio-reactive energy (smoothed low-pass)
    if (this.audioEngine && this.audioEngine.initialized) {
      const raw = this.audioEngine.getEnergyLevels();
      this.energy.bass     += (raw.bass     - this.energy.bass)     * 0.14;
      this.energy.mid      += (raw.mid      - this.energy.mid)      * 0.10;
      this.energy.presence += (raw.presence - this.energy.presence) * 0.08;
    } else {
      // Gentle decay when silent
      this.energy.bass     *= 0.96;
      this.energy.mid      *= 0.96;
      this.energy.presence *= 0.96;
    }

    // Camera spring
    const e = 0.07;
    this.cam.x    += (this.cam.tx - this.cam.x) * e;
    this.cam.y    += (this.cam.ty - this.cam.y) * e;
    this.cam.zoom += (this.cam.tz - this.cam.zoom) * e;
  }

  _spawnParticle() {
    const active = this.nodes.filter(n => !n.dimmed);
    if (active.length < 2) return;
    const i = Math.floor(Math.random() * active.length);
    const j = (i + 1 + Math.floor(Math.random() * 2)) % active.length;
    // Particles travel faster when audio has presence energy
    this.particles.push(new NerveParticle(active[i], active[j], 1 + this.energy.presence * 1.8));
  }

  _triggerShockwave(x, y, color) {
    for (let r = 0; r < 3; r++) this.shockwaves.push(new Shockwave(x, y, color, r * 90));
  }

  // ─────────────────────────────────────────────
  //  Drawing
  // ─────────────────────────────────────────────

  _draw() {
    const ctx = this.ctx;
    const { W, H } = this;

    // Deep space background (outside camera — always full canvas)
    const bg = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, Math.max(W, H) * 0.85);
    bg.addColorStop(0,    '#0d1224');
    bg.addColorStop(0.55, '#080c18');
    bg.addColorStop(1,    '#03050c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Scale ambient tint
    this._drawScaleMood(ctx);

    // Stars + shooting stars (outside camera for parallax)
    this._drawStars(ctx);
    this.shootingStars.forEach(s => s.draw(ctx));

    // Everything else inside camera spring
    ctx.save();
    ctx.translate(this.cx + this.cam.x, this.cy + this.cam.y);
    ctx.scale(this.cam.zoom, this.cam.zoom);
    ctx.translate(-this.cx, -this.cy);

    this._drawConnections(ctx);
    this.particles.forEach(p => p.draw(ctx));
    this.shockwaves.forEach(s => s.draw(ctx));
    if (this.expandedNode) this._drawOrbitRings(ctx);
    this.satellites.forEach(s => this._drawSatellite(ctx, s));
    this.nodes.forEach(n => this._drawNode(ctx, n));

    ctx.restore();

    // FFT energy display — drawn outside camera transform so it's always stable
    this._drawFftDisplay(ctx);
  }

  /**
   * Small FFT energy display in the bottom-left of the canvas.
   * Three glowing bars (Bass / Mid / Air) + a pulsing center ring.
   * Drawn outside the camera transform so it's always visible.
   */
  _drawFftDisplay(ctx) {
    const { bass, mid, presence } = this.energy;

    // ── Three spectrum bars — bottom-left corner ──────────────────
    const barW  = 5;
    const maxH  = 38;
    const gap   = 9;
    const baseX = 22;
    const baseY = this.H - 18;

    const bands = [
      { val: bass,     color: '#ff4466', label: 'B' },
      { val: mid,      color: '#6ea8ff', label: 'M' },
      { val: presence, color: '#78ffd6', label: 'A' },
    ];

    ctx.save();
    bands.forEach((b, i) => {
      const h     = Math.max(2, b.val * maxH);
      const x     = baseX + i * (barW + gap);
      const alpha = 0.35 + b.val * 0.65;

      // Bar fill
      ctx.globalAlpha = alpha;
      ctx.shadowBlur  = 8 + b.val * 12;
      ctx.shadowColor = b.color;
      ctx.fillStyle   = b.color;
      ctx.fillRect(x, baseY - h, barW, h);

      // Tiny label
      ctx.globalAlpha    = 0.35;
      ctx.shadowBlur     = 0;
      ctx.fillStyle      = '#ffffff';
      ctx.font           = '7px "Inter", monospace';
      ctx.textAlign      = 'center';
      ctx.textBaseline   = 'top';
      ctx.fillText(b.label, x + barW / 2, baseY + 3);
    });
    ctx.restore();
  }

  _drawScaleMood(ctx) {
    const a = this.scaleMood.alpha;
    if (a < 0.003) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const { hue: h, sat: s, lit: l } = this.scaleMood;
    const g = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, this.mainRadius * 2.2);
    g.addColorStop(0,   `hsla(${h},${s}%,${l + 16}%,${a})`);
    g.addColorStop(0.5, `hsla(${h},${s}%,${l}%,${a * 0.45})`);
    g.addColorStop(1,   `hsla(${h},${s}%,${l}%,0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.restore();
  }

  _drawStars(ctx) {
    this.stars.forEach(s => {
      const a = 0.2 + 0.6 * Math.abs(Math.sin(s.phase));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle   = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  _drawConnections(ctx) {
    const active = this.nodes.filter(n => !n.dimmed);
    const drawn  = new Set();
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i], b = active[j];
        const cd = Math.min(Math.abs(a.index - b.index), 12 - Math.abs(a.index - b.index));
        if (cd > 3) continue;
        const key = `${Math.min(a.index,b.index)}-${Math.max(a.index,b.index)}`;
        if (drawn.has(key)) continue;
        drawn.add(key);

        const alpha = 0.05 + (3 - cd) * 0.04;
        const grad  = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0, colorAlpha(a.color, alpha));
        grad.addColorStop(1, colorAlpha(b.color, alpha));

        ctx.save();
        ctx.strokeStyle = grad;
        ctx.lineWidth   = 1;
        ctx.shadowBlur  = 5;
        ctx.shadowColor = a.color;
        const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.07;
        const my = (a.y + b.y) / 2 - (b.x - a.x) * 0.07;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(mx, my, b.x, b.y);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  _drawOrbitRings(ctx) {
    const n        = this.expandedNode;
    const scale    = this.mainRadius / 280;
    const nodeR    = n.radius;
    const ringMins = [nodeR + 24, nodeR + 50, nodeR + 80];
    const atc      = this._fanAngle ?? 0;
    ctx.save();
    SATELLITE_RINGS.forEach((ring, ri) => {
      const spread = ri === 2 ? Math.PI * 1.48 : Math.PI * 1.22;
      const startA = atc - spread / 2;
      const rArc   = Math.max(ring.radius * scale, ringMins[ri]);
      ctx.strokeStyle = `hsla(${n.hue},70%,60%,${0.07 - ri * 0.015})`;
      ctx.lineWidth   = 0.5;
      ctx.setLineDash([3, 9]);
      ctx.beginPath();
      ctx.arc(n.baseX + (n.pushX ?? 0), n.baseY + (n.pushY ?? 0), rArc, startA, startA + spread);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.restore();
  }

  _drawSatellite(ctx, s) {
    if (s.alpha <= 0) return;
    const r     = s.radius * s.scale;
    const isHov = s === this.hoveredSat;

    ctx.save();
    ctx.globalAlpha = s.alpha;

    if (this.expandedNode) {
      ctx.strokeStyle = colorAlpha(s.color, 0.2);
      ctx.lineWidth   = 0.7;
      ctx.shadowBlur  = 4; ctx.shadowColor = s.color;
      ctx.beginPath();
      ctx.moveTo(this.expandedNode.x, this.expandedNode.y);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
    }

    const glowR = r * 2.2;
    const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, glowR);
    grd.addColorStop(0,   colorAlpha(s.color, 0.42));
    grd.addColorStop(0.5, colorAlpha(s.color, 0.10));
    grd.addColorStop(1,   colorAlpha(s.color, 0));
    ctx.fillStyle   = grd;
    ctx.shadowBlur  = isHov ? 20 : 6;
    ctx.shadowColor = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, glowR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle   = isHov ? '#ffffff' : s.color;
    ctx.shadowBlur  = isHov ? 18 : 6;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.font         = `bold ${Math.max(7, Math.round(7 + r * 0.6))}px "Inter", sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    // Dark stroke outline so label reads over any glow colour
    ctx.shadowBlur   = 0;
    ctx.strokeStyle  = 'rgba(0,0,0,0.82)';
    ctx.lineWidth    = 2.8;
    ctx.strokeText(s.label, s.x, s.y);
    ctx.fillStyle    = '#ffffff';
    ctx.fillText(s.label, s.x, s.y);
    ctx.restore();
  }

  _drawNode(ctx, n) {
    const isHov  = n === this.hoveredNode || n === this.expandedNode;
    const dimmed = n.dimmed;
    const pulse  = 1 + 0.06 * Math.sin(this.time * 1.4 + n.pulsePhase)
                     + this.energy.bass * 0.14;
    const r      = n.radius * pulse * (isHov ? 1.2 : 1);
    const alpha  = dimmed ? 0.17 : 1;
    const glow   = dimmed ? 0 : (isHov ? 32 : 14);

    ctx.save();
    ctx.globalAlpha = alpha;

    if (!dimmed) {
      const halo = ctx.createRadialGradient(n.x, n.y, r, n.x, n.y, r * 4.5);
      halo.addColorStop(0,   colorAlpha(n.color, 0.18));
      halo.addColorStop(0.6, colorAlpha(n.color, 0.06));
      halo.addColorStop(1,   colorAlpha(n.color, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r * 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const g = ctx.createRadialGradient(n.x - r * 0.3, n.y - r * 0.35, r * 0.05, n.x, n.y, r);
    g.addColorStop(0,   '#ffffff');
    g.addColorStop(0.3, n.color);
    g.addColorStop(1,   dimmed ? '#111624' : n.color.replace('62%','28%'));
    ctx.fillStyle   = g;
    ctx.shadowBlur  = glow;
    ctx.shadowColor = n.color;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = dimmed ? 'rgba(255,255,255,0.07)' : colorAlpha(n.color, 0.75);
    ctx.lineWidth   = 1.5;
    ctx.shadowBlur  = 0;
    ctx.stroke();

    ctx.fillStyle    = dimmed ? 'rgba(255,255,255,0.28)' : '#ffffff';
    ctx.shadowBlur   = dimmed ? 0 : 5;
    ctx.shadowColor  = '#ffffff';
    ctx.font         = `bold ${Math.round(r * 0.68)}px "Inter", monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(n.name, n.x, n.y);
    ctx.restore();
  }
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

function colorAlpha(hslStr, alpha) {
  return hslStr.replace('hsl(', 'hsla(').replace(')', `,${alpha})`);
}

function dist(x1, y1, x2, y2) {
  const dx = x1 - x2, dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

// ─────────────────────────────────────────────
//  Nerve particle (impulse on connection line)
// ─────────────────────────────────────────────
class NerveParticle {
  constructor(from, to, speedMult = 1) {
    this.from = from; this.to = to;
    this.progress = 0;
    this.speed    = (0.004 + Math.random() * 0.004) * speedMult;
    this.size     = Math.random() * 2 + 0.8;
    this.alpha    = 0.6 + Math.random() * 0.4;
    this.cx = (from.x + to.x) / 2 + (to.y - from.y) * (Math.random() * 0.18 - 0.09);
    this.cy = (from.y + to.y) / 2 - (to.x - from.x) * (Math.random() * 0.18 - 0.09);
  }
  update() { this.progress += this.speed; return this.progress < 1; }
  draw(ctx) {
    const t = this.progress, it = 1 - t;
    const x = it*it*this.from.x + 2*it*t*this.cx + t*t*this.to.x;
    const y = it*it*this.from.y + 2*it*t*this.cy + t*t*this.to.y;
    ctx.save();
    ctx.globalAlpha = this.alpha * Math.sin(t * Math.PI);
    ctx.shadowBlur  = 10;
    ctx.shadowColor = this.from.color;
    ctx.fillStyle   = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ─────────────────────────────────────────────
//  Shockwave ring
// ─────────────────────────────────────────────
class Shockwave {
  constructor(x, y, color, delay = 0) {
    this.x = x; this.y = y; this.color = color;
    this.radius = 5; this.maxR = 270;
    this.alpha  = 0; this.started = false;
    this._delay = delay;
  }
  update() {
    if (this._delay > 0) { this._delay -= 16; return true; }
    if (!this.started) { this.started = true; this.alpha = 0.88; }
    this.radius += 6;
    this.alpha   = 0.88 * (1 - this.radius / this.maxR);
    return this.alpha > 0.004;
  }
  draw(ctx) {
    if (!this.started || this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 2;
    ctx.shadowBlur  = 18; ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// ─────────────────────────────────────────────
//  Shooting star
// ─────────────────────────────────────────────
class ShootingStar {
  constructor(W, H) {
    this.x  = Math.random() * W;
    this.y  = Math.random() * H * 0.5;
    const a = Math.PI / 4 + (Math.random() - 0.5) * 0.5;
    this.vx = Math.cos(a) * (7 + Math.random() * 8);
    this.vy = Math.sin(a) * (7 + Math.random() * 8);
    this.alpha = 0.9; this.W = W; this.H = H;
  }
  update() {
    this.x += this.vx; this.y += this.vy; this.alpha -= 0.022;
    return this.alpha > 0 && this.x < this.W + 200 && this.y < this.H + 200;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    const g = ctx.createLinearGradient(this.x, this.y, this.x - this.vx * 8, this.y - this.vy * 8);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = g; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 8, this.y - this.vy * 8);
    ctx.stroke();
    ctx.restore();
  }
}
