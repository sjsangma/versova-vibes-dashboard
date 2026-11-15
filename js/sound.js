'use strict';
/* Opt-in audio.

   Hard rule: nothing is created, scheduled or resumed before the user clicks the sound
   control. The AudioContext itself is constructed inside that click handler, which is
   also what browsers require for playback to be allowed.

   Two independent buses — a soft ambient pad and short interface feedback — each with its
   own toggle, sharing one volume and one mute. Preferences are stored in `vv.sound`, but
   `enabled` is deliberately never restored: a reload always starts silent. */

const Sound = (() => {
  const KEY = 'vv.sound';
  const defaults = {enabled: false, ambient: true, ui: true, volume: 45, muted: false};
  let prefs = Object.assign({}, defaults);
  let ctx = null;
  let master = null;
  let ambientBus = null;
  let uiBus = null;
  let pad = null;
  let lastBlip = 0;

  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || '{}');
    prefs = Object.assign({}, defaults, {
      ambient: stored.ambient !== false,
      ui: stored.ui !== false,
      volume: Number.isFinite(stored.volume) ? Math.max(0, Math.min(100, stored.volume)) : 45,
      muted: !!stored.muted,
    });
  } catch (err) { /* keep defaults */ }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ambient: prefs.ambient, ui: prefs.ui,
        volume: prefs.volume, muted: prefs.muted}));
    } catch (err) { /* ignore quota errors */ }
  }

  function build() {
    if (ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    ctx = new Ctx();
    master = ctx.createGain();
    master.gain.value = prefs.muted ? 0 : (prefs.volume / 100) * 0.5;
    master.connect(ctx.destination);

    ambientBus = ctx.createGain();
    ambientBus.gain.value = prefs.ambient ? 0.34 : 0;
    ambientBus.connect(master);

    uiBus = ctx.createGain();
    uiBus.gain.value = prefs.ui ? 1 : 0;
    uiBus.connect(master);

    /* A three-voice pad through a lowpass and a short delay tail. Cheap to run: three
       oscillators and two delayed copies, no buffers, no convolver. */
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 780;
    lp.Q.value = 0.6;
    lp.connect(ambientBus);

    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(ambientBus);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.06;
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain);
    lfoGain.connect(lp.frequency);
    lfo.start();

    const voices = [
      {freq: 110.0, type: 'sine', gain: 0.18},
      {freq: 164.81, type: 'sine', gain: 0.11},
      {freq: 220.0, type: 'triangle', gain: 0.075},
      {freq: 329.63, type: 'sine', gain: 0.045},
    ];
    pad = voices.map((v, i) => {
      const osc = ctx.createOscillator();
      osc.type = v.type;
      osc.frequency.value = v.freq;
      osc.detune.value = i % 2 ? 4 : -4;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(v.gain, ctx.currentTime + 4 + i);
      osc.connect(g);
      g.connect(lp);
      g.connect(delay);
      osc.start();
      return {osc, g};
    });
  }

  function resume() {
    if (ctx && ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      Promise.resolve(ctx.resume()).catch(() => {});
    }
  }

  function applyMix() {
    if (!ctx) return;
    const now = ctx.currentTime;
    master.gain.setTargetAtTime(prefs.muted ? 0 : (prefs.volume / 100) * 0.5, now, 0.05);
    ambientBus.gain.setTargetAtTime(prefs.ambient ? 0.34 : 0, now, 0.12);
    uiBus.gain.setTargetAtTime(prefs.ui ? 1 : 0, now, 0.05);
  }

  function enable() {
    build();
    if (!ctx) return state();
    resume();
    prefs.enabled = true;
    applyMix();
    return state();
  }

  function disable() {
    prefs.enabled = false;
    if (ctx) applyMix();
    return state();
  }

  function setAmbient(on) {
    prefs.ambient = !!on;
    applyMix();
    persist();
    return state();
  }

  function setUi(on) {
    prefs.ui = !!on;
    applyMix();
    persist();
    return state();
  }

  function setVolume(v) {
    prefs.volume = Math.max(0, Math.min(100, Number(v) || 0));
    applyMix();
    persist();
    return state();
  }

  function setMuted(m) {
    prefs.muted = !!m;
    applyMix();
    persist();
    return state();
  }

  /* One short blip. `kind` shifts pitch and length; never plays unless enabled. */
  function play(kind = 'tap') {
    if (!ctx || !prefs.enabled || prefs.muted || !prefs.ui) return;
    const now = ctx.currentTime;
    if (now - lastBlip < 0.045) return;
    lastBlip = now;
    const map = {
      tap: {freq: 660, len: 0.09, gain: 0.10},
      select: {freq: 520, len: 0.12, gain: 0.10},
      open: {freq: 392, len: 0.16, gain: 0.09},
      ok: {freq: 784, len: 0.14, gain: 0.09},
      err: {freq: 240, len: 0.18, gain: 0.10},
    };
    const v = map[kind] || map.tap;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(v.freq, now);
    osc.frequency.exponentialRampToValueAtTime(v.freq * 0.72, now + v.len);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(v.gain, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + v.len);
    osc.connect(g);
    g.connect(uiBus);
    osc.start(now);
    osc.stop(now + v.len + 0.02);
  }

  function state() {
    return {
      enabled: prefs.enabled, ambient: prefs.ambient, ui: prefs.ui,
      volume: prefs.volume, muted: prefs.muted,
      context: ctx ? ctx.state : 'none',
    };
  }

  return {enable, disable, setAmbient, setUi, setVolume, setMuted, play, state,
    get enabled() { return prefs.enabled; }, get prefs() { return Object.assign({}, prefs); }};
})();
