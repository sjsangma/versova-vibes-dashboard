'use strict';
/* Versova Vibes dashboard core. All sales maths is unchanged from the original static
   edition: net sales are GST-exclusive line totals, recipe cost is the line cost. */
const D = DATA;
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => (
  {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

const inr0 = (v) => '₹' + Math.round(Number(v || 0)).toLocaleString('en-IN');
const inr = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', {maximumFractionDigits: 0});
const inr2 = (v) => '₹' + Number(v || 0).toLocaleString('en-IN',
  {minimumFractionDigits: 2, maximumFractionDigits: 2});
const pct = (v, dp = 2) => (v == null || Number.isNaN(Number(v)) ? '–'
  : Number(v).toFixed(dp) + '%');
const num = (v) => Number(v || 0).toLocaleString('en-IN');
const num2 = (v) => Number(v || 0).toLocaleString('en-IN',
  {minimumFractionDigits: 2, maximumFractionDigits: 2});
const compact = (v) => {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1e7) return '₹' + (n / 1e7).toFixed(2) + ' Cr';
  if (Math.abs(n) >= 1e5) return '₹' + (n / 1e5).toFixed(2) + ' L';
  if (Math.abs(n) >= 1e3) return '₹' + (n / 1e3).toFixed(1) + 'k';
  return inr0(n);
};
const dateLabel = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB',
    {day: '2-digit', month: 'short'});
};
const dateLong = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB',
    {day: '2-digit', month: 'short', year: 'numeric'});
};
const shiftDays = (iso, days) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};
const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1;

const state = {
  from: D.period.start, to: D.period.end, cat: '', route: 'overview',
  q: '', sort: {}, page: {}, theme: 'dark', role: 'Owner',
};

/* ---------- data access ---------- */
const inRange = (d, from = state.from, to = state.to) => d >= from && d <= to;
function lines(from = state.from, to = state.to) {
  return D.lines.filter((l) => inRange(l.date, from, to) && (!state.cat || l.category === state.cat));
}
function payments(from = state.from, to = state.to) {
  return D.payments.filter((p) => inRange(p.date, from, to));
}
function totals(from = state.from, to = state.to) {
  const rows = lines(from, to);
  const t = {net: 0, cost: 0, qty: 0, food: 0, bev: 0, gross: 0, discount: 0, gst: 0};
  for (const r of rows) {
    t.net += r.net; t.cost += r.cost; t.qty += r.qty;
    if (r.type === 'Beverage') t.bev += r.net; else t.food += r.net;
  }
  for (const b of D.daily_bills) {
    if (!inRange(b.date, from, to)) continue;
    t.gross += b.gross; t.discount += b.discount; t.gst += b.gst;
  }
  t.bills = payments(from, to).reduce((a, p) => a + p.bills, 0);
  t.avg = t.bills ? t.net / t.bills : 0;
  t.cost_pct = t.net ? (t.cost / t.net) * 100 : 0;
  t.gp = t.net - t.cost;
  t.margin_pct = t.net ? (t.gp / t.net) * 100 : 0;
  return t;
}
function itemAgg(from = state.from, to = state.to) {
  const map = new Map();
  for (const l of lines(from, to)) {
    const row = map.get(l.name) || {name: l.name, category: l.category, type: l.type,
      qty: 0, net: 0, cost: 0};
    row.qty += l.qty; row.net += l.net; row.cost += l.cost;
    map.set(l.name, row);
  }
  for (const r of map.values()) {
    r.food_cost_pct = r.net ? (r.cost / r.net) * 100 : 0;
    r.gross_profit = r.net - r.cost;
  }
  return [...map.values()];
}
const dailySeries = (from = state.from, to = state.to) => {
  const map = new Map();
  for (const l of lines(from, to)) map.set(l.date, (map.get(l.date) || 0) + l.net);
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({date, value}));
};
const reviewsIn = (from = state.from, to = state.to) =>
  D.reviews.filter((r) => inRange(r.date, from, to));
const attendanceIn = (from = state.from, to = state.to) =>
  D.attendance.filter((a) => inRange(a.date, from, to));

function previousPeriod() {
  const days = dayDiff(state.from, state.to);
  const to = shiftDays(state.from, -1);
  if (to < D.period.start) return null;
  const from = shiftDays(to, -(days - 1));
  return {from: from < D.period.start ? D.period.start : from, to};
}
function deltaOf(cur, prev) {
  if (prev == null || !isFinite(prev) || prev === 0) return {dir: 'flat', text: 'no prior period'};
  const change = ((cur - prev) / Math.abs(prev)) * 100;
  if (Math.abs(change) < 0.05) return {dir: 'flat', text: '0.0% vs prior'};
  return {dir: change > 0 ? 'up' : 'down',
    text: (change > 0 ? '+' : '') + change.toFixed(1) + '% vs prior'};
}

/* ---------- icons ---------- */
const svg = (p, extra = '') => `<svg viewBox="0 0 24 24" ${extra}>${p}</svg>`;
const ICON = {
  overview: svg('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="11" width="7" height="10" rx="1.5"/><rect x="3" y="15" width="7" height="6" rx="1.5"/>'),
  sales: svg('<path d="M3 3v18h18"/><path d="m7 14 4-5 4 3 4-6"/>'),
  costing: svg('<path d="M12 2v20"/><path d="M17 6.5c0-2-2-3.5-5-3.5S7 4.5 7 6.5s2 3 5 3.5 5 1.5 5 3.8-2 3.7-5 3.7-5-1.6-5-3.8"/>'),
  recipes: svg('<path d="M4 5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M15 3v5h5"/><path d="M8 13h8M8 17h5"/>'),
  inventory: svg('<path d="m21 8-9-5-9 5 9 5 9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/>'),
  staff: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/>'),
  recruitment: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="m17 11 2 2 4-4"/>'),
  reviews: svg('<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3z"/>'),
  hygiene: svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>'),
  marketing: svg('<path d="m3 11 18-8v18l-18-8z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>'),
  reports: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>'),
  quality: svg('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H1a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 2.6 7a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 7 2.6h.1A1.7 1.7 0 0 0 8.3 1V1a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 15 2.6a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  alert: svg('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>'),
  check: svg('<path d="m5 13 4 4L19 7"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  trend: svg('<path d="m3 17 6-6 4 4 8-8"/><path d="M17 7h4v4"/>'),
  cart: svg('<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.4 11.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 7H6"/>'),
  rupee: svg('<path d="M6 3h12M6 8h12M15 21 6 12h3a5 5 0 0 0 0-10"/>'),
  users: svg('<path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/>'),
  star: svg('<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3z"/>'),
  box: svg('<path d="m21 8-9-5-9 5 9 5 9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/>'),
  leaf: svg('<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8a10 10 0 0 1-10 10z"/><path d="M2 21c0-3 1.9-5.4 4-6"/>'),
  notes: svg('<path d="M5 4h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M14 4v5h5"/><path d="M8 13h7M8 16.5h5"/>'),
};

/* ---------- small UI atoms ---------- */
const deltaPill = (d) => `<span class="delta ${d.dir}">${d.dir === 'up' ? '▲'
  : d.dir === 'down' ? '▼' : '•'} ${esc(d.text)}</span>`;
const badge = (label, tone) => `<span class="badge ${tone || toneFor(label)}">${esc(label)}</span>`;
function toneFor(v) {
  const s = String(v || '').toLowerCase();
  if (/overdue|expired|out of stock|critical|fail|high|rejected|negative|short|out/.test(s)) return 'bad';
  if (/watch|low|pending|due|half|medium|hold|partial|scheduled|review/.test(s)) return 'warn';
  if (/ok|healthy|settled|closed|complete|paid|active|positive|published|selected|pass|good/.test(s)) return 'good';
  return 'muted';
}
const emptyState = (title, note) => `<div class="empty"><b>${esc(title)}</b>${esc(note || '')}</div>`;
const progressBar = (v, tone = '') => `<div class="progress"><i style="width:${Math.max(0,
  Math.min(100, Number(v) || 0))}%;${tone ? 'background:' + tone : ''}"></i></div>`;
const ring = (v, label, tone) => {
  const p = Math.max(0, Math.min(100, Number(v) || 0));
  const r = 48, c = 2 * Math.PI * r;
  return `<div class="ring"><svg width="118" height="118" viewBox="0 0 118 118">
    <circle cx="59" cy="59" r="${r}" fill="none" stroke="var(--card2)" stroke-width="9"/>
    <circle cx="59" cy="59" r="${r}" fill="none" stroke="${tone || 'var(--gold)'}"
      stroke-width="9" stroke-linecap="round" stroke-dasharray="${c}"
      stroke-dashoffset="${c * (1 - p / 100)}"/></svg>
    <div class="val">${p.toFixed(0)}%<div class="small muted" style="font-weight:500">${esc(label || '')}</div></div></div>`;
};

/* ---------- table engine ---------- */
const TABLE_DEFS = {};
const CSV_REG = {};
function dataTable(id, cols, rows, opts = {}) {
  TABLE_DEFS[id] = {cols, rows, opts};
  const pageSize = opts.pageSize || 10;
  const q = (state.q || '').toLowerCase().trim();
  let data = rows.slice();
  if (q) {
    data = data.filter((r) => cols.some((c) => String(r[c.key] ?? '').toLowerCase().includes(q)));
  }
  const sortKey = state.sort[id];
  if (sortKey) {
    const col = cols.find((c) => c.key === sortKey);
    const dir = state.sort[id + ':dir'] === 'asc' ? 1 : -1;
    data.sort((a, b) => (col && col.num ? (Number(a[sortKey]) || 0) - (Number(b[sortKey]) || 0)
      : String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''))) * dir);
  }
  const pages = Math.max(1, Math.ceil(data.length / pageSize));
  const page = Math.min(state.page[id] || 1, pages);
  state.page[id] = page;
  const slice = data.slice((page - 1) * pageSize, page * pageSize);
  const head = cols.map((c) => `<th class="${c.num ? 'num' : ''}" data-tbl="${id}"
    data-key="${c.key}" scope="col">${esc(c.label)}${sortKey === c.key
    ? `<span class="arrow">${state.sort[id + ':dir'] === 'asc' ? '▲' : '▼'}</span>` : ''}</th>`).join('');
  const body = slice.length ? slice.map((r) => '<tr>' + cols.map((c) => {
    const f = c.fmt || ((v) => esc(v));
    return `<td class="${c.num ? 'num' : ''}">${f(r[c.key], r)}</td>`;
  }).join('') + '</tr>').join('') : `<tr><td colspan="${cols.length}">
    ${emptyState('No matching rows', q ? 'Nothing matches “' + q + '” in this table.' : 'No records for this period.')}
    </td></tr>`;
  let pager = '';
  if (pages > 1) {
    const nums = [];
    const start = Math.max(1, Math.min(page - 2, pages - 4));
    for (let i = start; i <= Math.min(pages, start + 4); i++) {
      nums.push(`<button data-page="${id}" data-n="${i}" class="${i === page ? 'active' : ''}">${i}</button>`);
    }
    pager = `<div class="pager"><button data-page="${id}" data-n="${page - 1}"
      ${page === 1 ? 'disabled' : ''} aria-label="Previous page">‹</button>
      ${nums.join('')}<button data-page="${id}" data-n="${page + 1}"
      ${page === pages ? 'disabled' : ''} aria-label="Next page">›</button></div>`;
  }
  const exportBtn = opts.exportName ? `<button class="btn btn-ghost btn-sm" data-csv="${id}">
    ${svg('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>')}<span>CSV</span></button>` : '';
  if (opts.exportName) {
    CSV_REG[id] = {name: `${opts.exportName}_${state.from}_${state.to}.csv`,
      head: cols.map((c) => c.label), rows: data.map((r) => cols.map((c) => r[c.key]))};
  }
  return `<div class="table-wrap"><table data-table="${id}"><thead><tr>${head}</tr></thead>
    <tbody>${body}</tbody></table></div>
    <div class="table-foot"><span>${num(data.length)} row${data.length === 1 ? '' : 's'}${
    q ? ' · filtered' : ''}${data.length !== rows.length ? ' of ' + num(rows.length) : ''}</span>
    ${exportBtn}${pager}</div>`;
}
function bindTables(root) {
  $$('th[data-tbl]', root).forEach((th) => th.addEventListener('click', () => {
    const id = th.dataset.tbl, key = th.dataset.key;
    if (state.sort[id] === key) state.sort[id + ':dir'] = state.sort[id + ':dir'] === 'asc' ? 'desc' : 'asc';
    else { state.sort[id] = key; state.sort[id + ':dir'] = 'desc'; }
    redraw(id);
  }));
  $$('button[data-page]', root).forEach((b) => b.addEventListener('click', () => {
    state.page[b.dataset.page] = Number(b.dataset.n);
    redraw(b.dataset.page);
  }));
  $$('button[data-csv]', root).forEach((b) => b.addEventListener('click', () => {
    const cfg = CSV_REG[b.dataset.csv];
    if (cfg) { downloadCSV(cfg.name, cfg.head, cfg.rows); toast('CSV downloaded'); }
  }));
}
function redraw(id) {
  const def = TABLE_DEFS[id];
  if (!def) return;
  const target = document.querySelector(`[data-table="${id}"]`);
  if (!target) return;
  const holder = target.closest('.tbl-holder');
  const html = dataTable(id, def.cols, def.rows, def.opts);
  if (holder) {
    holder.innerHTML = html;
    bindTables(holder);
  }
}

/* ---------- files, toasts, modal ---------- */
function downloadCSV(name, head, rows) {
  const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
    .join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}
function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'err' ? ' err' : '');
  el.innerHTML = svg(type === 'err' ? '<path d="M12 8v5M12 16h.01"/>' : '<path d="m5 13 4 4L19 7"/>')
    + `<span>${esc(msg)}</span>`;
  $('#toastRoot').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .25s'; }, 2600);
  setTimeout(() => el.remove(), 2900);
}
function openModal(html, opts = {}) {
  closeModal();
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${
    esc(opts.label || 'Details')}">${html}</div>`;
  $('#modalRoot').appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back) closeModal(); });
  $$('[data-close]', back).forEach((b) => b.addEventListener('click', closeModal));
  const first = $('button, input, select, a[href]', back);
  if (first) first.focus();
  return back;
}
function closeModal() { $('#modalRoot').innerHTML = ''; }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
