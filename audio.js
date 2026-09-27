/* audio.js — every sound is synthesised on the fly, so the page ships no audio files. */

const Sfx = (() => {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let drone = null;
  let enabled = true;

  function boot() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch (e) {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);

    const len = Math.floor(ctx.sampleRate * 2);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  /* Browsers only allow audio after a gesture, so every entry point resumes first. */
  function live() {
    if (!enabled) return null;
    const c = boot();
    if (!c) return null;
    if (c.state === 'suspended') c.resume();
    return c;
  }

  function tone(c, { type = 'sine', freq = 440, to = null, dur = 0.2, gain = 0.2, delay = 0, curve = 'exp' }) {
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to !== null) {
      if (curve === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
      else osc.frequency.linearRampToValueAtTime(to, t0 + dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.02, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    return osc;
  }

  function noise(c, { dur = 0.3, gain = 0.2, from = 6000, to = 300, q = 1, delay = 0, type = 'lowpass' }) {
    const t0 = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  return {
    get enabled() { return enabled; },
    set enabled(v) {
      enabled = !!v;
      if (!enabled) this.droneStop();
      if (enabled) this.unlock();
    },

    unlock() { live(); },

    /* A wedge passing the pointer. Fires dozens of times a spin, so keep it cheap. */
    tick() {
      const c = live();
      if (!c) return;
      tone(c, { type: 'square', freq: 1500 + Math.random() * 260, to: 700, dur: 0.035, gain: 0.05 });
    },

    click() {
      const c = live();
      if (!c) return;
      tone(c, { type: 'triangle', freq: 660, to: 880, dur: 0.07, gain: 0.08 });
    },

    whoosh() {
      const c = live();
      if (!c) return;
      noise(c, { dur: 1.1, gain: 0.1, from: 900, to: 4200, q: 0.8, type: 'bandpass' });
    },

    /* Impact when a pick locks in: sub drop, crack, a hard clack. */
    land() {
      const c = live();
      if (!c) return;
      tone(c, { type: 'sine', freq: 190, to: 38, dur: 0.5, gain: 0.5 });
      noise(c, { dur: 0.28, gain: 0.3, from: 5600, to: 200 });
      tone(c, { type: 'square', freq: 420, to: 260, dur: 0.06, gain: 0.12 });
    },

    thud() {
      const c = live();
      if (!c) return;
      tone(c, { type: 'sine', freq: 120, to: 38, dur: 0.3, gain: 0.35 });
    },

    /* Both sides full: a stadium horn, not a temple bell. */
    horn() {
      const c = live();
      if (!c) return;
      const t0 = c.currentTime;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.7);
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(320, t0);
      f.frequency.exponentialRampToValueAtTime(1900, t0 + 0.14);
      f.frequency.exponentialRampToValueAtTime(520, t0 + 1.5);
      [73.42, 110, 146.83, 220].forEach((freq) => {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = freq * (1 + (Math.random() - 0.5) * 0.005);
        o.connect(f);
        o.start(t0);
        o.stop(t0 + 1.8);
      });
      f.connect(g).connect(master);
      noise(c, { dur: 0.22, gain: 0.13, from: 4200, to: 320 });
    },

    /* Low bed that sits under the spin. */
    droneStart() {
      const c = live();
      if (!c || drone) return;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.09, c.currentTime + 0.5);
      const a = c.createOscillator();
      const b = c.createOscillator();
      a.type = 'sawtooth'; b.type = 'sawtooth';
      a.frequency.value = 55; b.frequency.value = 55.7;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 340;
      a.connect(f); b.connect(f);
      f.connect(g).connect(master);
      a.start(); b.start();
      drone = { a, b, g };
    },

    droneStop() {
      if (!drone || !ctx) return;
      const { a, b, g } = drone;
      drone = null;
      const t = ctx.currentTime;
      try {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        a.stop(t + 0.4);
        b.stop(t + 0.4);
      } catch (e) { /* context already torn down */ }
    }
  };
})();
