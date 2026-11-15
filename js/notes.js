'use strict';
/* Notes Studio.

   Notes are the operator's working memory: a promotion idea, a stock alert, a staff
   reminder. Each note also carries a decorative pattern derived deterministically from
   its text and category, so the same note always looks the same and the note itself
   stays perfectly readable beside it.

   Persistence: localStorage key `vv.notes`, JSON array. The static site has no backend,
   so notes live in this browser only; the note editor states that plainly. */

const Notes = (() => {
  const KEY = 'vv.notes';
  const MAX = 200;

  const CATEGORIES = [
    {id: 'operations', label: 'Operations', kind: 'rings', hue: 42},
    {id: 'sales', label: 'Sales & Promotions', kind: 'wave', hue: 42},
    {id: 'inventory', label: 'Inventory', kind: 'lattice', hue: 36},
    {id: 'staff', label: 'Staff', kind: 'rings', hue: 196},
    {id: 'customer', label: 'Customer Feedback', kind: 'sparks', hue: 158},
    {id: 'compliance', label: 'FSSAI & Compliance', kind: 'lattice', hue: 30},
    {id: 'marketing', label: 'Marketing', kind: 'wave', hue: 282},
    {id: 'idea', label: 'Idea', kind: 'sparks', hue: 322},
  ];

  const STYLES = [
    {id: 'auto', label: 'Auto (from category)'},
    {id: 'wave', label: 'Flowing wave'},
    {id: 'lattice', label: 'Geometric lattice'},
    {id: 'rings', label: 'Circular flow'},
    {id: 'sparks', label: 'Drifting particles'},
  ];

  const TONES = {
    gold: {hue: 42, light: 68},
    amber: {hue: 32, light: 62},
    emerald: {hue: 158, light: 60},
    teal: {hue: 190, light: 62},
    violet: {hue: 276, light: 68},
    rose: {hue: 336, light: 66},
  };

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(raw) ? raw.filter((n) => n && typeof n.text === 'string') : [];
    } catch (err) {
      return [];
    }
  }

  function persist(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    } catch (err) {
      /* quota or private mode — the studio still works for this session */
    }
  }

  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  const categoryOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];

  /* Deterministic visual parameters for a note: same text + category + style, same art. */
  function specFor(note) {
    const cat = categoryOf(note.category);
    const hash = fnv1a((note.text || '') + '|' + cat.id);
    const tone = TONES[note.tone] || null;
    const kind = note.style && note.style !== 'auto' ? note.style : cat.kind;
    return {
      hash,
      kind,
      hue: tone ? tone.hue : cat.hue + ((hash >> 9) % 22) - 11,
      seed: (hash % 1000) / 137,
      waves: 2 + (hash % 3),
      amplitude: 8 + ((hash >> 5) % 22),
      density: 0.55 + ((hash >> 11) % 40) / 100,
    };
  }

  function rand(seed) {
    const v = Math.sin(seed * 12.9898) * 43758.5453;
    return v - Math.floor(v);
  }

  /* Static, deterministic render into a small canvas. No animation loop per card. */
  function paint(canvas, spec, opts = {}) {
    if (!canvas || !canvas.getContext) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = opts.width || canvas.clientWidth || 120;
    const ch = opts.height || canvas.clientHeight || 78;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    const g = canvas.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cw, ch);

    const grad = g.createLinearGradient(0, 0, cw, ch);
    grad.addColorStop(0, `hsla(${spec.hue},60%,16%,.9)`);
    grad.addColorStop(1, `hsla(${spec.hue + 24},55%,10%,.92)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, cw, ch);

    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';

    if (spec.kind === 'wave') {
      for (let row = 0; row < spec.waves; row += 1) {
        g.beginPath();
        for (let x = 0; x <= cw; x += 4) {
          const y = ch * (0.28 + row * 0.19)
            + Math.sin(x * 0.045 + spec.seed + row * 1.4) * spec.amplitude * 0.55
            + Math.sin(x * 0.014 + spec.seed * 2) * 5;
          if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.strokeStyle = `hsla(${spec.hue + row * 10},88%,70%,${0.62 - row * 0.13})`;
        g.lineWidth = 1.7;
        g.stroke();
      }
    } else if (spec.kind === 'lattice') {
      const gap = 14 + (spec.hash % 6);
      for (let x = gap; x < cw; x += gap) {
        for (let y = gap; y < ch; y += gap) {
          const p = 0.45 + 0.55 * Math.abs(Math.sin(x * 0.05 + y * 0.07 + spec.seed));
          const size = 1.4 + p * 2.6;
          g.strokeStyle = `hsla(${spec.hue},80%,68%,${0.16 + p * 0.34})`;
          g.lineWidth = 1;
          g.strokeRect(x - size, y - size, size * 2, size * 2);
        }
      }
    } else if (spec.kind === 'rings') {
      const cx = cw * 0.5;
      const cy = ch * 0.52;
      for (let i = 1; i <= 5; i += 1) {
        const r = i * (6 + (spec.hash % 5)) + Math.sin(spec.seed + i) * 3;
        g.strokeStyle = `hsla(${spec.hue + i * 5},85%,70%,${0.5 - i * 0.07})`;
        g.lineWidth = 1.4;
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.stroke();
      }
      g.fillStyle = `hsla(${spec.hue},90%,74%,.75)`;
      g.beginPath();
      g.arc(cx, cy, 2.6, 0, Math.PI * 2);
      g.fill();
    } else {
      const n = Math.round(26 * spec.density) + 8;
      for (let i = 0; i < n; i += 1) {
        const px = rand(spec.seed + i * 1.7) * cw;
        const py = rand(spec.seed * 3 + i * 2.3) * ch;
        const r = 0.7 + rand(spec.seed + i) * 2.1;
        g.fillStyle = `hsla(${spec.hue + (i % 5) * 8},88%,72%,${0.25 + rand(i + spec.seed) * 0.5})`;
        g.beginPath();
        g.arc(px, py, r, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalCompositeOperation = 'source-over';

    /* a soft vignette keeps the card edge legible on any background */
    const vg = g.createRadialGradient(cw / 2, ch / 2, 4, cw / 2, ch / 2, Math.max(cw, ch) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,.42)');
    g.fillStyle = vg;
    g.fillRect(0, 0, cw, ch);
  }

  function normalise(input) {
    const text = (input.text || '').trim();
    const title = (input.title || '').trim() || text.split('\n')[0].slice(0, 54);
    return {
      id: input.id || 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title,
      text,
      category: categoryOf(input.category).id,
      style: STYLES.some((s) => s.id === input.style) ? input.style : 'auto',
      tone: TONES[input.tone] ? input.tone : 'gold',
      pinned: !!input.pinned,
      created: input.created || new Date().toISOString(),
      updated: new Date().toISOString(),
    };
  }

  function save(input) {
    const list = load();
    const note = normalise(input);
    const i = list.findIndex((n) => n.id === note.id);
    if (i >= 0) note.created = list[i].created;
    if (input.id && i >= 0) list[i] = note; else list.unshift(note);
    persist(list);
    if (typeof Atmo !== 'undefined') {
      const spec = specFor(note);
      Atmo.motif({kind: spec.kind, hue: spec.hue, seed: spec.seed});
    }
    return note;
  }

  function remove(id) {
    persist(load().filter((n) => n.id !== id));
  }

  function togglePin(id) {
    const list = load();
    const n = list.find((x) => x.id === id);
    if (!n) return null;
    n.pinned = !n.pinned;
    n.updated = new Date().toISOString();
    persist(list);
    return n;
  }

  function sorted() {
    return load().sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return String(b.updated || b.created).localeCompare(String(a.updated || a.created));
    });
  }

  return {CATEGORIES, STYLES, TONES, load, sorted, save, remove, togglePin, specFor, paint,
    hash: fnv1a, categoryOf};
})();
