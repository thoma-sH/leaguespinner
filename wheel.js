/* wheel.js — the wheel and the confetti. One RAF loop drives both. */

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU = Math.PI * 2;

const INK = '#101014';
const PAPER = '#efece5';

/* Evenly spaced hues right around the circle. Lightness is nudged per hue so
   yellow does not glare and blue does not go murky, which keeps the near-black
   labels legible on every wedge. */
function wedgeColor(i, n, muted) {
  const h = (i / n) * 360;
  const l = 62 - 7 * Math.cos(((h - 55) * Math.PI) / 180);
  return muted ? `hsl(${h.toFixed(1)} 28% 42%)` : `hsl(${h.toFixed(1)} 74% ${l.toFixed(1)}%)`;
}

const SPECTRUM = ['#e2453c', '#e8892a', '#e6c528', '#5cbd47', '#2f9fd6', '#4a5fd0', '#9b4fd0'];

/* ---------- confetti ---------- */

class Fx {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.parts = [];
    this.w = 0;
    this.h = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = this.c.clientWidth;
    this.h = this.c.clientHeight;
    this.c.width = Math.floor(this.w * dpr);
    this.c.height = Math.floor(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  burst(x, y, opts = {}) {
    const n = REDUCED ? 8 : (opts.count || 90);
    const colors = opts.colors || SPECTRUM.concat([PAPER]);
    for (let i = 0; i < n; i++) {
      const ang = opts.dir !== undefined
        ? opts.dir + (Math.random() - 0.5) * (opts.spread || 1.2)
        : Math.random() * TAU;
      const sp = (opts.speed || 5) * (0.35 + Math.random());
      this.parts.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - (opts.lift || 1.5),
        g: 0.15 + Math.random() * 0.1,
        life: 1,
        decay: 0.008 + Math.random() * 0.012,
        w: 3 + Math.random() * 5,
        h: 3 + Math.random() * 7,
        rot: Math.random() * TAU,
        vr: (Math.random() - 0.5) * 0.3,
        color: colors[(Math.random() * colors.length) | 0]
      });
    }
  }

  /* Falls across the page when both sides are full. */
  rain(colors) {
    const n = REDUCED ? 12 : 130;
    for (let i = 0; i < n; i++) {
      this.parts.push({
        x: Math.random() * this.w,
        y: -20 - Math.random() * this.h * 0.6,
        vx: (Math.random() - 0.5) * 1.4,
        vy: 1.6 + Math.random() * 2.6,
        g: 0.02,
        life: 1,
        decay: 0.0035 + Math.random() * 0.004,
        w: 4 + Math.random() * 6,
        h: 4 + Math.random() * 8,
        rot: Math.random() * TAU,
        vr: (Math.random() - 0.5) * 0.24,
        color: colors[(Math.random() * colors.length) | 0]
      });
    }
  }

  step() {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.w, this.h);
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= p.decay;
      if (p.life <= 0 || p.y > this.h + 40) {
        this.parts.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.min(1, p.life);
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

/* ---------- the wheel ---------- */

class Wheel {
  constructor(canvas, hooks = {}) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks;
    this.entries = [];
    this.rot = -Math.PI / 2;
    this.spinning = false;
    this.winner = -1;
    this.target = '#dc4436';
    this.flare = 0;
    this.lastTickIndex = -1;
    this.size = 0;
    this.resize();
    if (window.ResizeObserver) {
      new ResizeObserver(() => this.resize()).observe(canvas);
    } else {
      window.addEventListener('resize', () => this.resize());
    }
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const box = Math.max(120, Math.min(this.c.clientWidth, this.c.clientHeight) || this.c.clientWidth);
    this.size = box;
    this.c.width = Math.floor(box * dpr);
    this.c.height = Math.floor(box * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setEntries(list) {
    this.entries = list.slice();
    this.winner = -1;
  }

  /* The side this spin is filling — the landed wedge fills with its colour. */
  setTarget(color) { this.target = color; }

  get seg() { return TAU / Math.max(1, this.entries.length); }

  indexAt(rot) {
    const n = this.entries.length;
    if (!n) return -1;
    let local = (-Math.PI / 2 - rot) % TAU;
    if (local < 0) local += TAU;
    return Math.floor(local / this.seg) % n;
  }

  /* Resolves with the landed index once the wheel has fully settled. */
  spin(index) {
    if (this.spinning || !this.entries.length) return Promise.resolve(-1);
    const n = this.entries.length;
    const win = index === undefined ? Math.floor(Math.random() * n) : index;
    const seg = this.seg;
    const turns = REDUCED ? 1 : 5 + Math.floor(Math.random() * 3);
    const jitter = (Math.random() - 0.5) * seg * 0.62;

    let target = -Math.PI / 2 - (win * seg + seg / 2) + jitter;
    while (target <= this.rot + TAU * turns) target += TAU;

    const start = this.rot;
    const delta = target - start;
    const dur = REDUCED ? 1200 : 5000 + Math.random() * 900;
    const t0 = performance.now();

    this.spinning = true;
    this.winner = -1;
    this.lastTickIndex = this.indexAt(start);

    return new Promise((resolve) => {
      const frame = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        const eased = 1 - Math.pow(1 - t, 4.2);
        let wobble = 0;
        if (!REDUCED && t > 0.86) {
          const k = (t - 0.86) / 0.14;
          wobble = Math.sin(k * Math.PI * 2.2) * (1 - k) * seg * 0.09;
        }
        this.rot = start + delta * eased + wobble;

        const idx = this.indexAt(this.rot);
        if (idx !== this.lastTickIndex) {
          this.lastTickIndex = idx;
          if (this.hooks.onTick) this.hooks.onTick();
        }

        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          this.rot = target;
          this.winner = this.indexAt(target);
          this.flare = 1;
          this.spinning = false;
          resolve(this.winner);
        }
      };
      requestAnimationFrame(frame);
    });
  }

  fitText(text, max, baseSize) {
    const { ctx } = this;
    let size = baseSize;
    const face = (px) => `${px}px Anton, "Arial Narrow", Impact, sans-serif`;
    ctx.font = face(size);
    while (ctx.measureText(text).width > max && size > 9) {
      size -= 1;
      ctx.font = face(size);
    }
    let out = text;
    if (ctx.measureText(out).width > max) {
      while (out.length > 2 && ctx.measureText(out + '…').width > max) out = out.slice(0, -1);
      out += '…';
    }
    return out;
  }

  draw() {
    const { ctx } = this;
    const s = this.size;
    const cx = s / 2;
    const cy = s / 2;
    const R = s / 2 - s * 0.055;
    const n = this.entries.length;
    const seg = this.seg;
    const hubR = R * 0.115;

    ctx.clearRect(0, 0, s, s);
    if (this.flare > 0) this.flare = Math.max(0, this.flare - 0.022);

    /* hard offset shadow — printed, not glowing */
    ctx.beginPath();
    ctx.arc(cx + s * 0.013, cy + s * 0.018, R, 0, TAU);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();

    /* the disc */
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fillStyle = PAPER;
    ctx.fill();

    /* an empty wheel still reads as a wheel: a muted spectrum, no labels */
    const blanks = n ? 0 : 12;
    for (let i = 0; i < blanks; i++) {
      const a0 = -Math.PI / 2 + (i / blanks) * TAU;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a0, a0 + TAU / blanks);
      ctx.closePath();
      ctx.fillStyle = wedgeColor(i, blanks, true);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R);
      ctx.lineWidth = Math.max(1, s * 0.0035);
      ctx.strokeStyle = INK;
      ctx.stroke();
    }

    for (let i = 0; i < n; i++) {
      const a0 = this.rot + i * seg;
      const a1 = a0 + seg;
      const isWin = i === this.winner;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a0, a1);
      ctx.closePath();
      ctx.fillStyle = isWin ? this.target : wedgeColor(i, n, false);
      ctx.fill();

      /* wedge divider */
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R);
      ctx.lineWidth = Math.max(1, s * 0.0035);
      ctx.strokeStyle = INK;
      ctx.stroke();

      const base = Math.max(11, Math.min(s * 0.056, (TAU * R / n) * 0.62));
      const label = this.fitText(this.entries[i].toUpperCase(), R - hubR - s * 0.055, base);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a0 + seg / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isWin ? PAPER : INK;
      ctx.fillText(label, R - s * 0.036, 0);
      ctx.restore();
    }

    /* outline the landed wedge, so a blue win never blurs into a blue neighbour */
    if (this.winner >= 0 && this.winner < n) {
      const a0 = this.rot + this.winner * seg;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a0, a0 + seg);
      ctx.closePath();
      ctx.lineWidth = Math.max(2, s * 0.009);
      ctx.strokeStyle = PAPER;
      ctx.stroke();
    }

    /* the rim */
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.lineWidth = Math.max(2, s * 0.013);
    ctx.strokeStyle = INK;
    ctx.stroke();

    /* hub */
    ctx.beginPath();
    ctx.arc(cx, cy, hubR, 0, TAU);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.lineWidth = Math.max(2, s * 0.008);
    ctx.strokeStyle = PAPER;
    ctx.stroke();

    /* one hard ring thrown off on landing */
    if (this.flare > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, R * (1 + (1 - this.flare) * 0.11), 0, TAU);
      ctx.lineWidth = Math.max(2, s * 0.007);
      ctx.strokeStyle = `rgba(239,236,229,${this.flare * 0.8})`;
      ctx.stroke();
    }

    /* the pointer, biting into the rim */
    const apex = cy - R + s * 0.006;
    ctx.beginPath();
    ctx.moveTo(cx, apex);
    ctx.lineTo(cx - s * 0.028, apex - s * 0.05);
    ctx.lineTo(cx + s * 0.028, apex - s * 0.05);
    ctx.closePath();
    ctx.fillStyle = PAPER;
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, s * 0.004);
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
}
