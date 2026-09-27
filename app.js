/* app.js — one screen. Players in, wheel spins, blue and red fill up. */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const LANES = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];
const MAX_ROSTER = 16;
const STORE_KEY = 'grandline.draft.v4';
const SIDES = [
  { name: 'Blue side', color: '#2f7ad6' },
  { name: 'Red side', color: '#dc4436' }
];
const BENCH_COLOR = '#90909a';

const state = {
  roster: [],
  format: 'auto',
  lanes: true,
  sound: true,
  /* draft */
  pool: [],
  seq: [],
  teams: [[], []],
  laneSets: [[], []],
  bench: [],
  total: 0,
  done: false,
  busy: false
};

let wheel;
let fx;

/* ---------- persistence (per-viewer convenience only) ---------- */

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      roster: state.roster,
      format: state.format,
      lanes: state.lanes,
      sound: state.sound
    }));
  } catch (e) { /* blocked or private storage — the page works without it */ }
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (Array.isArray(d.roster)) state.roster = d.roster.slice(0, MAX_ROSTER);
    if (d.format) state.format = d.format;
    if (typeof d.lanes === 'boolean') state.lanes = d.lanes;
    if (typeof d.sound === 'boolean') state.sound = d.sound;
  } catch (e) { /* ignore unreadable storage */ }
}

/* ---------- the split ---------- */

/* A fixed size the roster cannot fill falls back to an even split, so the
   plan can never ask for more slots than there are players. */
function plan() {
  const n = state.roster.length;
  const s = Number(state.format);
  if (state.format === 'auto' || !s || n < s * 2) {
    const b = Math.floor(n / 2);
    return { a: n - b, b, bench: 0 };
  }
  return { a: s, b: s, bench: n - s * 2 };
}

/* Slots alternate, so neither side can be handed the whole pool. */
function buildSequence(a, b, bench) {
  const seq = [];
  let ra = a;
  let rb = b;
  let turn = 0;
  while (ra + rb > 0) {
    const side = ra > rb ? 0 : rb > ra ? 1 : turn % 2;
    if (side === 0) ra--; else rb--;
    seq.push(side);
    turn++;
  }
  for (let i = 0; i < bench; i++) seq.push('B');
  return seq;
}

const sideSize = (side) => (side === 0 ? plan().a : plan().b);
const ready = () => state.roster.length >= 4;

function resetDraft() {
  const p = plan();
  state.pool = shuffle(state.roster);
  state.seq = ready() ? buildSequence(p.a, p.b, p.bench) : [];
  state.total = state.seq.length;
  state.teams = [[], []];
  state.laneSets = [shuffle(LANES).slice(0, p.a), shuffle(LANES).slice(0, p.b)];
  state.bench = [];
  state.done = false;
  state.busy = false;
  wheel.setEntries(state.pool);
  render();
}

/* ---------- render ---------- */

function render(fresh) {
  renderRoster();
  renderSides(fresh);
  renderBench();
  renderControls();
  renderTally();
}

function renderTally() {
  const n = state.roster.length;
  const p = plan();
  const bits = [`${n} player${n === 1 ? '' : 's'}`];
  if (ready()) bits.push(`${p.a}v${p.b}`);
  if (p.bench) bits.push(`${p.bench} spectating`);
  $('#playerCount').textContent = bits.join(' · ');
}

function renderRoster() {
  const n = state.roster.length;
  $('#rosterChips').innerHTML = state.roster.map((name, i) => `
    <li class="chip">
      <span class="chip-name">${esc(name)}</span>
      <button type="button" class="chip-x" data-drop="${i}" aria-label="Remove ${esc(name)}">×</button>
    </li>`).join('');

  /* a size only offers itself when the roster can fill it */
  $$('#formatSel option').forEach((opt) => {
    const need = opt.value === 'auto' ? 4 : Number(opt.value) * 2;
    opt.disabled = n < need;
  });
  if ($('#formatSel').selectedOptions[0]?.disabled) {
    state.format = 'auto';
    $('#formatSel').value = 'auto';
  }
}

function renderSides(fresh) {
  [0, 1].forEach((side) => {
    const el = side === 0 ? $('#crewA') : $('#crewB');
    const members = state.teams[side];
    const size = ready() ? sideSize(side) : 2;
    const rows = [];
    for (let i = 0; i < size; i++) {
      const name = members[i];
      const lane = state.lanes ? state.laneSets[side][i] : null;
      rows.push(`<li class="row ${name ? 'is-filled' : ''} ${name && name === fresh ? 'is-fresh' : ''}">
        <span class="row-num">${i + 1}</span>
        <span class="row-name">${name ? esc(name) : '—'}</span>
        ${name && i === 0 ? '<span class="row-cap" title="First pick">C</span>' : '<span></span>'}
        <span class="row-lane">${name && lane ? lane : ''}</span>
      </li>`);
    }
    el.innerHTML = `
      <header class="side-head">
        <h2 class="side-name">${SIDES[side].name}</h2>
        <span class="side-count">${members.length} / ${size}</span>
      </header>
      <ol class="rows">${rows.join('')}</ol>`;
  });
}

function renderBench() {
  const row = $('#reserveRow');
  if (!state.bench.length) {
    row.hidden = true;
    return;
  }
  row.hidden = false;
  $('#reserveNames').innerHTML = state.bench
    .map((n) => `<span class="tag">${esc(n)}</span>`).join('');
}

function renderControls() {
  const btn = $('#spinBtn');
  const label = btn.querySelector('span');
  const picked = state.total - state.seq.length;
  const n = state.roster.length;
  const short = !ready();

  label.textContent = state.done ? 'Copy teams' : 'Spin';
  btn.disabled = state.busy || (!state.done && short);
  $('#resetBtn').hidden = picked === 0;

  const status = $('#status');
  status.classList.toggle('is-set', state.done);
  if (short) {
    const need = 4 - n;
    status.textContent = n === 0
      ? 'Add at least 4 players'
      : `${need} more player${need === 1 ? '' : 's'} to start`;
  } else if (state.done) {
    status.textContent = 'Teams are set';
  } else {
    status.textContent = `Pick ${picked + 1} of ${state.total}`;
  }
}

/* ---------- roster editing ---------- */

function addNames(raw) {
  const parts = String(raw).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  let added = 0;
  for (const part of parts) {
    if (state.roster.length >= MAX_ROSTER) break;
    const base = part.slice(0, 18);
    let name = base;
    let n = 2;
    while (state.roster.some((x) => x.toLowerCase() === name.toLowerCase())) {
      name = `${base} ${n++}`;
    }
    state.roster.push(name);
    added++;
  }
  if (added) {
    Sfx.click();
    resetDraft();
    save();
  }
  return added;
}

/* ---------- spinning ---------- */

function impact() {
  const shell = $('#shell');
  shell.classList.remove('shake');
  void shell.offsetWidth;
  shell.classList.add('shake');
  const flash = $('#flash');
  flash.classList.add('on');
  setTimeout(() => flash.classList.remove('on'), 90);
  const box = $('#wheel').getBoundingClientRect();
  fx.burst(box.left + box.width / 2, box.top + box.height * 0.04, {
    dir: Math.PI / 2, spread: 2.4, speed: 7, count: 100
  });
}

function showPick(name, target) {
  const card = $('#pickCard');
  const bench = target === 'B';
  card.style.setProperty('--pick', bench ? BENCH_COLOR : SIDES[target].color);
  $('#pickName').textContent = name;
  $('#pickSide').textContent = bench ? 'Spectating' : SIDES[target].name;
  card.hidden = false;
}

async function runPick(idx, noSpin) {
  const target = state.seq[0];
  const name = noSpin ? state.pool[0] : wheel.entries[idx];

  showPick(name, target);
  await wait(REDUCED ? 600 : 1400);
  $('#pickCard').hidden = true;

  state.seq.shift();
  state.pool = state.pool.filter((x) => x !== name);
  if (target === 'B') state.bench.push(name);
  else state.teams[target].push(name);

  wheel.setEntries(state.pool);
  state.busy = false;

  if (state.seq.length === 0) {
    state.done = true;
    render(name);
    Sfx.horn();
    fx.rain([SIDES[0].color, SIDES[1].color, '#f0ede6']);
    return;
  }
  render(name);
}

async function doSpin() {
  if (state.busy || state.done || state.seq.length === 0) return;
  state.busy = true;
  renderControls();
  Sfx.unlock();

  /* the landed wedge fills with the colour of the side it is feeding */
  const target = state.seq[0];
  wheel.setTarget(target === 'B' ? BENCH_COLOR : SIDES[target].color);

  /* One player for one slot needs no theatre. */
  if (state.pool.length === 1) {
    Sfx.land();
    impact();
    await runPick(0, true);
    return;
  }

  document.body.classList.add('is-spinning');
  Sfx.whoosh();
  Sfx.droneStart();

  const idx = await wheel.spin();

  document.body.classList.remove('is-spinning');
  Sfx.droneStop();
  Sfx.land();
  impact();
  await runPick(idx, false);
}

/* ---------- export ---------- */

function teamsText() {
  const out = ['**THE GRAND LINE DRAFT**', ''];
  [0, 1].forEach((side) => {
    out.push(`**${SIDES[side].name.toUpperCase()}**`);
    state.teams[side].forEach((name, i) => {
      const laneName = state.lanes ? state.laneSets[side][i] : null;
      const lane = laneName ? ` — ${laneName}` : '';
      const cap = i === 0 ? ' (C)' : '';
      out.push(`${i + 1}. ${name}${cap}${lane}`);
    });
    out.push('');
  });
  if (state.bench.length) out.push(`Spectating: ${state.bench.join(', ')}`);
  return out.join('\n').trim();
}

async function copyTeams() {
  const text = teamsText();
  const label = $('#spinBtn').querySelector('span');
  try {
    await navigator.clipboard.writeText(text);
    Sfx.click();
    label.textContent = 'Copied';
    setTimeout(() => { if (state.done) label.textContent = 'Copy teams'; }, 2000);
  } catch (e) {
    /* Clipboard blocked in this frame — hand over the text instead. */
    $('#copyOut').hidden = false;
    $('#copyText').value = text;
    $('#copyText').select();
  }
}

/* ---------- wiring ---------- */

function setSound(on) {
  state.sound = on;
  Sfx.enabled = on;
  const btn = $('#soundBtn');
  btn.setAttribute('aria-pressed', String(on));
  btn.classList.toggle('is-off', !on);
  btn.title = on ? 'Sound on' : 'Sound off';
  save();
}

function wire() {
  $('#addForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#nameInput');
    if (addNames(input.value)) input.value = '';
    input.focus();
  });

  $('#rosterChips').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-drop]');
    if (!btn) return;
    state.roster.splice(Number(btn.dataset.drop), 1);
    Sfx.click();
    resetDraft();
    save();
  });

  $('#clearBtn').addEventListener('click', () => {
    state.roster = [];
    resetDraft();
    save();
    $('#nameInput').focus();
  });

  $('#formatSel').addEventListener('change', (e) => {
    state.format = e.target.value;
    Sfx.click();
    resetDraft();
    save();
  });

  $('#lanesToggle').addEventListener('change', (e) => {
    state.lanes = e.target.checked;
    Sfx.click();
    renderSides();
    save();
  });

  $('#spinBtn').addEventListener('click', () => {
    if (state.done) copyTeams();
    else doSpin();
  });
  $('#resetBtn').addEventListener('click', () => {
    Sfx.click();
    $('#copyOut').hidden = true;
    resetDraft();
  });
  $('#wheel').addEventListener('click', () => doSpin());
  $('#soundBtn').addEventListener('click', () => setSound(!state.sound));

  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.target.closest('input, textarea, button, select')) return;
    if (state.busy || state.done || !state.seq.length) return;
    e.preventDefault();
    doSpin();
  });
}

/* ---------- boot ---------- */

function boot(restored) {
  load();
  if (restored && restored.state) Object.assign(state, restored.state);

  wheel = new Wheel($('#wheel'), { onTick: () => Sfx.tick() });
  fx = new Fx($('#fx'));

  wire();
  $('#formatSel').value = state.format;
  $('#lanesToggle').checked = state.lanes;
  setSound(state.sound);

  if (restored && restored.state && state.pool.length) {
    wheel.setEntries(state.pool);
    state.busy = false;
    render();
  } else {
    resetDraft();
  }

  /* An empty roster means the first thing to do is type — but never pop a
     keyboard open on touch. */
  if (!state.roster.length && window.matchMedia('(pointer: fine)').matches) {
    $('#nameInput').focus({ preventScroll: true });
  }

  const loop = () => {
    wheel.draw();
    fx.step();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

/* Republished pages hand the open tab its state back. */
try {
  window.claude?.hot?.snapshot(() => ({ state: { ...state, busy: false } }));
} catch (e) { /* not running inside an artifact host */ }

if (window.claude?.hot?.ready) window.claude.hot.ready((data) => boot(data));
else boot(window.claude?.hot?.data ?? null);
