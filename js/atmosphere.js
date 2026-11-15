'use strict';
/* Generative atmosphere layer.

   One fixed canvas behind the shell draws a flow field of light: particles drifting
   along a divergence-free sine field, a cursor comet, click ripples, a KPI light sweep
   and per-note motifs. Everything here is decorative: it never reads business data,
   never receives pointer events and never blocks a control.

   Budgets: particle count is derived from viewport area and capped; the loop stops when
   the tab is hidden and when the user asks for reduced motion. */

const Atmo = (() => {
  const reduceQuery = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : {matches: false, addEventListener() {}};
  let canvas = null;
  let ctx = null;
  let w = 0;
  let h = 0;
  let dpr = 1;
  let moodName = 'champagne';
  let parts = [];
  let ripples = [];
  let pulses = [];
  let motif = null;
  let comet = [];
  let running = false;
  let rafId = 0;
  let lastT = 0;
  let time = 0;
  let frames = 0;
  let reduced = false;
  let enabled = true;

  const settings = () => (typeof MOODS !== 'undefined' && MOODS[moodName]) || {
    hues: [42, 36, 50], bg: [[212, 175, 101], [140, 108, 54], [86, 68, 40]],
    drift: 1, density: 1, bloom: 1, wave: 1,
  };

  const isLight = () => document.documentElement.dataset.theme === 'light';
  const areaBudget = () => {
    const base = Math.round((w * h) / 15000);
    return Math.min(150, Math.max(40, base));
  };
  const hueFor = (i) => {
    const {hues} = settings();
    return hues[i % hues.length] + (Math.random() * 8 - 4);
  };

  /* ---------- particles ---------- */
  function makeParticle(seed = {}) {
    const {hues} = settings();
    const hue = seed.hue != null ? seed.hue : hues[Math.floor(Math.random() * hues.length)];
    return {
      x: seed.x != null ? seed.x : Math.random() * w,
      y: seed.y != null ? seed.y : Math.random() * h,
      px: 0, py: 0,
      speed: 0.5 + Math.random() * 1.5,
      hue: hue + (Math.random() * 8 - 4),
      alpha: 0.1 + Math.random() * 0.32,
      width: 0.5 + Math.random() * 1.3,
      age: 0,
      life: 260 + Math.random() * 520,
      seed: Math.random() * 6.28,
    };
  }

  function seedField() {
    const target = Math.round(areaBudget() * settings().density);
    parts = [];
    for (let i = 0; i < target; i += 1) {
      const p = makeParticle();
      p.px = p.x;
      p.py = p.y;
      parts.push(p);
    }
  }

  function angleAt(x, y, t, seed) {
    const nx = x / (w || 1);
    const ny = y / (h || 1);
    const wave = settings().wave;
    return Math.sin(nx * 3.1 + t * 0.22 + seed) * 1.7 * wave
      + Math.cos(ny * 2.4 - t * 0.17 + seed * 1.7) * 1.5 * wave
      + Math.sin((nx + ny) * 1.9 + t * 0.11) * 0.9;
  }

  function stepParticle(p, dt, drift) {
    p.px = p.x;
    p.py = p.y;
    const a = angleAt(p.x, p.y, time, p.seed);
    p.x += Math.cos(a) * p.speed * drift * dt * 0.06;
    p.y += Math.sin(a) * p.speed * drift * dt * 0.06;

    const m = 60;
    if (p.x < -m) { p.x = w + m; p.px = p.x; }
    if (p.x > w + m) { p.x = -m; p.px = p.x; }
    if (p.y < -m) { p.y = h + m; p.py = p.y; }
    if (p.y > h + m) { p.y = -m; p.py = p.y; }

    p.age += dt;
    if (p.age > p.life) {
      p.age = 0;
      p.x = Math.random() * w;
      p.y = Math.random() * h;
      p.px = p.x;
      p.py = p.y;
      p.hue = hueFor(Math.floor(Math.random() * 4));
    }
  }

  /* ---------- background wash ---------- */
  function paintWash(t) {
    const light = isLight();
    const {bg, bloom} = settings();
    const dark = '#0B0E13';
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);
    if (!light) {
      ctx.fillStyle = dark;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    const blobs = [
      [0.18 + Math.sin(t * 0.06) * 0.06, 0.22 + Math.cos(t * 0.05) * 0.05, 0.62],
      [0.82 + Math.cos(t * 0.045) * 0.05, 0.30 + Math.sin(t * 0.07) * 0.06, 0.55],
      [0.50 + Math.sin(t * 0.032) * 0.09, 0.88 + Math.cos(t * 0.04) * 0.04, 0.68],
    ];
    blobs.forEach((b, i) => {
      const c = bg[i % bg.length];
      const x = b[0] * w;
      const y = b[1] * h;
      const r = b[2] * Math.max(w, h) * 0.62;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const alpha = (light ? 0.05 : 0.075) * bloom;
      g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${alpha})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
  }

  /* ---------- cursor comet ---------- */
  function drawComet(now) {
    if (comet.length < 2) return;
    const light = isLight();
    comet = comet.filter((p) => now - p.t < 900);
    if (comet.length < 2) return;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i < comet.length; i += 1) {
      const a = comet[i - 1];
      const b = comet[i];
      const age = Math.min(1, (now - b.t) / 900);
      const fade = 1 - age;
      const hue = settings().hues[0] + Math.sin(b.x * 0.01 + time * 0.4) * 14;
      const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      grad.addColorStop(0, `hsla(${hue},78%,${light ? 46 : 68}%,${0.30 * fade})`);
      grad.addColorStop(1, `hsla(${hue + 16},82%,${light ? 52 : 76}%,${0.06 * fade})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = (light ? 2 : 2.6) * (0.5 + fade);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------- ripples ---------- */
  function drawRipples(dt) {
    const light = isLight();
    ripples = ripples.filter((r) => r.r < r.max);
    ctx.globalCompositeOperation = 'lighter';
    for (const r of ripples) {
      r.r += (r.max - r.r) * 0.055 * dt * 0.06 + 1.1;
      const k = 1 - r.r / r.max;
      if (k <= 0) continue;
      const hue = r.hue != null ? r.hue : settings().hues[0];
      ctx.strokeStyle = `hsla(${hue},${light ? 60 : 82}%,${light ? 42 : 70}%,${0.34 * k * k})`;
      ctx.lineWidth = 1 + 2.2 * k;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      if (r.ring) {
        ctx.strokeStyle = `hsla(${hue + 12},80%,${light ? 46 : 78}%,${0.18 * k})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r * 0.62, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------- KPI light sweep ---------- */
  function drawPulses(dt) {
    const light = isLight();
    pulses = pulses.filter((p) => p.t < 1);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of pulses) {
      p.t += dt / 1100;
      const y = p.t * h;
      const band = 120 + p.t * 60;
      const g = ctx.createLinearGradient(0, y - band, 0, y + band);
      const hue = settings().hues[0];
      const a = 0.10 * Math.sin(Math.PI * p.t);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, `hsla(${hue},85%,${light ? 42 : 72}%,${a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y - band, w, band * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------- note motifs ---------- */
  function drawMotif(now) {
    if (!motif) return;
    const left = (motif.until - now) / 1000;
    if (left <= 0) { motif = null; return; }
    const env = Math.min(1, left / 2.4);
    const t = (now - motif.start) / 1000;
    const light = isLight();
    const hue = motif.hue;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    if (motif.kind === 'wave') {
      const rows = 3;
      for (let r = 0; r < rows; r += 1) {
        ctx.beginPath();
        const off = r * 26 + t * 16;
        for (let x = -20; x <= w + 20; x += 18) {
          const y = h * (0.34 + r * 0.09)
            + Math.sin(x * 0.006 + t * 1.1 + motif.seed + r) * (16 + r * 7)
            + Math.sin(off * 0.01) * 6;
          if (x === -20) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `hsla(${hue + r * 8},82%,${light ? 44 : 70}%,${0.24 * env})`;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    } else if (motif.kind === 'lattice') {
      const gap = 56;
      for (let x = gap; x < w; x += gap) {
        for (let y = gap; y < h; y += gap) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 1.6 + x * 0.01 + y * 0.012);
          const size = 2 + pulse * 5;
          ctx.strokeStyle = `hsla(${hue},78%,${light ? 48 : 66}%,${0.12 * env * pulse})`;
          ctx.lineWidth = 1;
          ctx.strokeRect(x - size, y - size, size * 2, size * 2);
        }
      }
    } else if (motif.kind === 'rings') {
      const cx = w * 0.5;
      const cy = h * 0.5;
      for (let i = 0; i < 5; i += 1) {
        const r = ((t * 46 + i * 74) % 340);
        const a = 0.20 * env * (1 - r / 340);
        ctx.strokeStyle = `hsla(${hue + i * 6},80%,${light ? 46 : 70}%,${a})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      for (let i = 0; i < 26; i += 1) {
        const px = (cx0(motif.seed, i) * w + t * (8 + (i % 5) * 3)) % (w + 40) - 20;
        const py = h - ((t * (26 + (i % 7) * 6) + i * 37) % (h + 60));
        const a = 0.30 * env * (0.4 + 0.6 * Math.sin(i + t * 2));
        ctx.fillStyle = `hsla(${hue + (i % 4) * 10},85%,${light ? 50 : 74}%,${Math.max(0, a)})`;
        ctx.beginPath();
        ctx.arc(px, py, 1.4 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function cx0(seed, i) {
    const v = Math.sin(seed * (i + 1) * 12.9898) * 43758.5453;
    return v - Math.floor(v);
  }

  /* ---------- frame ---------- */
  function frame(now) {
    if (!running) return;
    const dt = Math.min(64, now - (lastT || now));
    lastT = now;
    time += dt * 0.001;
    frames += 1;

    const light = isLight();
    paintWash(time);

    const drift = settings().drift * (reduced ? 0.08 : 1);
    ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';
    for (const p of parts) {
      stepParticle(p, dt, drift);
      const dx = p.x - p.px;
      const dy = p.y - p.py;
      if (Math.abs(dx) + Math.abs(dy) < 0.05) continue;
      const fade = Math.min(1, p.age / 900) * Math.min(1, (p.life - p.age) / 900);
      ctx.strokeStyle = `hsla(${p.hue},${light ? 55 : 80}%,${light ? 40 : 66}%,${p.alpha * fade * (light ? 0.5 : 1)})`;
      ctx.lineWidth = p.width;
      ctx.beginPath();
      ctx.moveTo(p.px, p.py);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    drawComet(now);
    drawRipples(dt);
    drawPulses(dt);
    drawMotif(now);

    if (reduced) { running = false; return; }
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (running || !ctx || reduced) return;
    if (document.hidden) return;
    running = true;
    lastT = 0;
    rafId = requestAnimationFrame(frame);
  }

  /* Reduced motion: one composed still frame, redrawn on resize or mood change. */
  function drawStill() {
    const was = running;
    running = true;
    lastT = performance.now() - 16;
    frame(performance.now());
    running = was;
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedField();
    if (!running) { if (reduced) drawStill(); else paintWash(time); }
  }

  /* ---------- public API ---------- */
  function init() {
    canvas = document.getElementById('atmo');
    if (!canvas) return;
    ctx = canvas.getContext('2d', {alpha: true});
    if (!ctx) return;
    moodName = typeof currentMood === 'function' ? currentMood() : 'champagne';
    resize();
    seedField();
    window.addEventListener('resize', () => {
      clearTimeout(init.resizeT);
      init.resizeT = setTimeout(resize, 160);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop(); else if (!reduced) start();
    });
    if (reduceQuery.addEventListener) {
      reduceQuery.addEventListener('change', (e) => {
        reduced = e.matches;
        if (reduced) { stop(); drawStill(); }
        else start();
      });
    }
    document.addEventListener('vv:theme', () => { if (!running) { if (reduced) drawStill(); else paintWash(time); } });
    reduced = !!reduceQuery.matches;
    if (reduced) drawStill(); else start();
  }

  function setMood(name) {
    if (!name) return;
    moodName = name;
    seedField();
    ripples = [];
    if (reduced) drawStill(); else start();
  }

  function trail(x, y) {
    if (!enabled || reduced) return;
    if (moodName === 'minimal') return;
    comet.push({x, y, t: performance.now()});
    if (comet.length > 24) comet.shift();
  }

  function ripple(x, y, opts = {}) {
    if (!enabled) return;
    ripples.push({
      x, y,
      r: opts.ring ? 6 : 2,
      max: opts.max || 190,
      hue: opts.hue,
      ring: opts.ring !== false,
    });
    if (ripples.length > 14) ripples.shift();
    if (!running && !reduced) start();
  }

  function pulse() {
    if (!enabled || reduced) return;
    pulses.push({t: 0});
    if (pulses.length > 3) pulses.shift();
    if (!running) start();
  }

  function motifAt(spec = {}) {
    if (!enabled) return;
    const now = performance.now();
    motif = {
      kind: spec.kind || 'wave',
      hue: spec.hue != null ? spec.hue : settings().hues[0],
      seed: spec.seed != null ? spec.seed : Math.random() * 3,
      start: now,
      until: now + (spec.ms || 5200),
    };
    if (!running && !reduced) start();
  }

  function setEnabled(on) {
    enabled = !!on;
    if (!enabled) { ripples = []; pulses = []; comet = []; motif = null; }
  }

  function stats() {
    return {running, particles: parts.length, mood: moodName, frames, reduced, enabled,
      ripples: ripples.length};
  }

  return {init, setMood, trail, ripple, pulse, motif: motifAt, setEnabled, stats,
    get mood() { return moodName; }, refresh: () => resize()};
})();
