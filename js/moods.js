'use strict';
/* Visual moods: one data object per atmosphere, applied as CSS variables + canvas params.
   Presentation only — no business value is read or written here. */

const MOODS = {
  champagne: {
    label: 'Champagne Luxury',
    note: 'Charcoal light, champagne gold flow — the house default',
    swatch: ['#171F2B', '#D4AF65'],
    hues: [42, 36, 50, 30],
    bg: [[212, 175, 101], [140, 108, 54], [86, 68, 40]],
    drift: 0.95, density: 1, bloom: 1, wave: 1.1,
    css: {a: '#D4AF65', b: '#F0D99B', glow: 'rgba(212,175,101,.16)'},
  },
  midnight: {
    label: 'Midnight Lounge',
    note: 'Deep navy, slow violet light — late service',
    swatch: ['#0A0B14', '#7C6BD8'],
    hues: [268, 282, 250, 300],
    bg: [[124, 107, 216], [70, 60, 140], [30, 34, 70]],
    drift: 0.65, density: 0.8, bloom: 1.3, wave: 0.8,
    css: {a: '#8E7BE6', b: '#BCA9FF', glow: 'rgba(124,107,216,.20)'},
  },
  ocean: {
    label: 'Ocean Flow',
    note: 'Turquoise currents over deep blue',
    swatch: ['#061620', '#37D2C4'],
    hues: [186, 196, 172, 205],
    bg: [[55, 210, 196], [32, 120, 150], [12, 50, 76]],
    drift: 1.15, density: 1.05, bloom: 0.95, wave: 1.4,
    css: {a: '#37D2C4', b: '#9BE9E2', glow: 'rgba(55,210,196,.16)'},
  },
  emerald: {
    label: 'Emerald Elegance',
    note: 'Emerald flow with restrained gold',
    swatch: ['#08160F', '#21B58A'],
    hues: [158, 148, 168, 42],
    bg: [[33, 181, 138], [26, 110, 84], [40, 58, 40]],
    drift: 0.85, density: 0.95, bloom: 1.0, wave: 1.05,
    css: {a: '#21B58A', b: '#9FE8D2', glow: 'rgba(33,181,138,.16)'},
  },
  sunset: {
    label: 'Sunset Energy',
    note: 'Warm amber drift for service peaks',
    swatch: ['#190C08', '#F28A4B'],
    hues: [24, 14, 36, 4],
    bg: [[242, 138, 75], [190, 90, 48], [86, 44, 40]],
    drift: 1.3, density: 1.2, bloom: 1.25, wave: 1.2,
    css: {a: '#F2A15B', b: '#FFD2A6', glow: 'rgba(242,138,75,.18)'},
  },
  minimal: {
    label: 'Minimal Focus',
    note: 'Almost still — contrast first, no distraction',
    swatch: ['#0E1116', '#9AA5B5'],
    hues: [212, 206, 220],
    bg: [[150, 162, 180], [90, 100, 118], [40, 46, 58]],
    drift: 0.18, density: 0.28, bloom: 0.5, wave: 0.5,
    css: {a: '#9AA5B5', b: '#CFD6E2', glow: 'rgba(154,165,181,.10)'},
  },
};

const MOOD_ORDER = ['champagne', 'midnight', 'ocean', 'emerald', 'sunset', 'minimal'];
const MOOD_FALLBACK = 'champagne';

function moodValid(name) {
  return Object.prototype.hasOwnProperty.call(MOODS, name);
}

function currentMood() {
  const name = document.documentElement.dataset.mood;
  return moodValid(name) ? name : MOOD_FALLBACK;
}

/* Applies a mood to the document: dataset flag for CSS, --atmo-* variables for the
   ambient wash, and a bubbling event so the canvas can retarget its palette. */
function applyMood(name, opts = {}) {
  const key = moodValid(name) ? name : MOOD_FALLBACK;
  const m = MOODS[key];
  const root = document.documentElement;
  root.dataset.mood = key;
  root.style.setProperty('--atmo-a', m.css.a);
  root.style.setProperty('--atmo-b', m.css.b);
  root.style.setProperty('--atmo-glow', m.css.glow);
  if (opts.persist !== false) localStorage.setItem('vv.mood', key);
  document.dispatchEvent(new CustomEvent('vv:mood', {detail: {mood: key}}));
  return key;
}

function savedMood() {
  const stored = localStorage.getItem('vv.mood');
  return moodValid(stored) ? stored : MOOD_FALLBACK;
}

document.addEventListener('vv:mood', (e) => {
  if (typeof Atmo !== 'undefined' && Atmo.setMood) Atmo.setMood(e.detail.mood);
});
