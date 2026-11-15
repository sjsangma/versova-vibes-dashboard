'use strict';
/* Versova Vibes static dashboard - all aggregation happens in the browser from line-level
   sales, so the date and category filters are exact rather than pre-computed snapshots. */
const $ = (id) => document.getElementById(id);
const inr = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', {maximumFractionDigits: 0});
const inr2 = (v) => '₹' + Number(v || 0).toLocaleString('en-IN',
  {minimumFractionDigits: 2, maximumFractionDigits: 2});
const pct = (v) => (v == null ? '–' : Number(v).toFixed(2) + '%');
const num = (v) => Number(v || 0).toLocaleString('en-IN');

const state = {from: DATA.period.start, to: DATA.period.end, cat: '', sort: {}};

function between(d) { return d >= state.from && d <= state.to; }
function catOk(c) { return !state.cat || c === state.cat; }
function lines() { return DATA.lines.filter((l) => between(l.date) && catOk(l.category)); }

function itemAgg() {
  const map = new Map();
  for (const l of lines()) {
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

function totals() {
  const rows = lines();
  const t = {net: 0, cost: 0, qty: 0, food: 0, bev: 0};
  for (const r of rows) {
    t.net += r.net; t.cost += r.cost; t.qty += r.qty;
    if (r.type === 'Beverage') t.bev += r.net; else t.food += r.net;
  }
  t.bills = DATA.payments.filter((p) => between(p.date)).reduce((a, p) => a + p.bills, 0);
  t.avg = t.bills ? t.net / t.bills : 0;
  t.cost_pct = t.net ? (t.cost / t.net) * 100 : 0;
  t.gp = t.net - t.cost;
  return t;
}

function card(k, v, s) {
  return `<div class="kpi"><div class="k">${k}</div><div class="v">${v}</div>
          <div class="s">${s || ''}</div></div>`;
}

function renderKpis() {
  const t = totals();
  $('kpis').innerHTML = [
    card('Net sales (ex-GST)', inr(t.net), state.from + ' to ' + state.to),
    card('Food sales', inr(t.food), t.net ? pct(t.food / t.net * 100) + ' of net' : ''),
    card('Beverage sales', inr(t.bev), t.net ? pct(t.bev / t.net * 100) + ' of net' : ''),
    card('Bills', num(t.bills), 'Average bill ' + inr2(t.avg)),
    card('Food cost', pct(t.cost_pct), inr(t.cost) + ' recipe cost'),
    card('Gross profit', inr(t.gp), t.net ? pct(t.gp / t.net * 100) + ' margin' : ''),
    card('Items sold', num(t.qty), 'across ' + itemAgg().length + ' items'),
    card('Wastage (period)', inr(DATA.wastage_summary.value), DATA.wastage_summary.entries + ' entries'),
  ].join('');
}

/* ---------- charts ---------- */
function axis(svg, w, h, pad) {
  svg.innerHTML = `<line x1="${pad.l}" y1="${h - pad.b}" x2="${w - pad.r}" y2="${h - pad.b}"
      stroke="#C9D0DC"/><line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${h - pad.b}"
      stroke="#C9D0DC"/>`;
}

function drawDaily() {
  const svg = $('chartDaily'); const w = 620, h = 240;
  const pad = {l: 48, r: 10, t: 12, b: 26};
  const byDay = new Map();
  for (const l of lines()) byDay.set(l.date, (byDay.get(l.date) || 0) + l.net);
  const days = [...byDay.keys()].sort();
  const vals = days.map((d) => byDay.get(d));
  const max = Math.max(1, ...vals);
  const x = (i) => pad.l + (days.length < 2 ? 0 : i * (w - pad.l - pad.r) / (days.length - 1));
  const y = (v) => h - pad.b - (v / max) * (h - pad.t - pad.b);
  axis(svg, w, h, pad);
  if (!days.length) { svg.innerHTML += '<text x="60" y="120">No sales in this range</text>'; return; }
  const pts = days.map((d, i) => `${x(i)},${y(vals[i])}`).join(' ');
  const area = `M${x(0)},${h - pad.b} L` + pts.split(' ').join(' L') + ` L${x(days.length - 1)},${h - pad.b} Z`;
  svg.innerHTML += `<path d="${area}" fill="#0F6E6E" opacity="0.10"/>
    <polyline points="${pts}" fill="none" stroke="#0F6E6E" stroke-width="2"/>
    <text x="${pad.l}" y="${h - 8}">${state.from}</text>
    <text x="${w - pad.r - 58}" y="${h - 8}">${state.to}</text>
    <text x="${pad.l - 6}" y="${pad.t + 4}" text-anchor="end">${inr(max)}</text>
    <text x="${pad.l - 6}" y="${h - pad.b}" text-anchor="end">0</text>`;
  days.forEach((d, i) => {
    svg.innerHTML += `<circle cx="${x(i)}" cy="${y(vals[i])}" r="2.5" fill="#1F3864">
      <title>${d}: ${inr2(vals[i])}</title></circle>`;
  });
}

function drawTop() {
  const svg = $('chartItems'); const w = 620, h = 240;
  const rows = itemAgg().sort((a, b) => b.net - a.net).slice(0, 10);
  svg.innerHTML = '';
  if (!rows.length) { svg.innerHTML = '<text x="20" y="40">No items in this range</text>'; return; }
  const max = Math.max(...rows.map((r) => r.net));
  const barH = Math.min(19, (h - 16) / rows.length - 3);
  rows.forEach((r, i) => {
    const y = 10 + i * ((h - 16) / rows.length);
    const len = (r.net / max) * (w - 250);
    svg.innerHTML += `<rect x="150" y="${y}" width="${len}" height="${barH}" rx="3" fill="#BF8F00">
      <title>${r.name}: ${inr2(r.net)}</title></rect>
      <text x="145" y="${y + barH - 3}" text-anchor="end">${r.name.length > 22 ? r.name.slice(0, 21) + '…' : r.name}</text>
      <text x="${155 + len}" y="${y + barH - 3}">${inr(r.net)}</text>`;
  });
}

function splitBars() {
  const t = totals();
  const rows = [['Food', t.food, '#1F3864'], ['Beverage', t.bev, '#0F6E6E']];
  const total = t.net || 1;
  $('split').innerHTML = rows.map(([label, value, colour]) => `
    <div style="display:flex;align-items:center;gap:10px;margin:6px 0">
      <span style="width:78px">${label}</span>
      <div style="flex:1;background:#EEF2F9;border-radius:4px;height:16px;overflow:hidden">
        <div style="width:${(value / total * 100).toFixed(1)}%;background:${colour};height:100%"></div>
      </div><b>${inr(value)}</b><span class="hint">${pct(value / total * 100)}</span>
    </div>`).join('');
}

function payMix() {
  const map = new Map();
  for (const p of DATA.payments.filter((p) => between(p.date))) {
    const row = map.get(p.payment_mode) || {mode: p.payment_mode, bills: 0, net: 0};
    row.bills += p.bills; row.net += p.net; map.set(p.payment_mode, row);
  }
  const rows = [...map.values()].sort((a, b) => b.net - a.net);
  const total = rows.reduce((a, r) => a + r.net, 0) || 1;
  $('paymix').innerHTML = rows.map((r) => `
    <div style="display:flex;align-items:center;gap:10px;margin:6px 0">
      <span style="width:96px">${r.mode}</span>
      <div style="flex:1;background:#EEF2F9;border-radius:4px;height:16px;overflow:hidden">
        <div style="width:${(r.net / total * 100).toFixed(1)}%;background:#BF8F00;height:100%"></div>
      </div><b>${inr(r.net)}</b><span class="hint">${r.bills} bills</span>
    </div>`).join('') || '<p class="hint">No payments in range</p>';
}

/* ---------- tables ---------- */
const F = {
  money: inr, money2: inr2, pct: pct, num: num,
  text: (v) => (v == null ? '' : String(v)),
  tag: (v) => `<span class="tag ${/low|short|expired|overdue|fail/i.test(v) ? 'bad'
      : /ok|settled|closed|complete|healthy/i.test(v) ? 'good' : ''}">${v}</span>`,
};

function table(id, cols, rows) {
  const el = $(id);
  if (!el) return;
  const sortKey = state.sort[id];
  let data = rows.slice();
  if (sortKey) {
    const col = cols.find((c) => c.key === sortKey);
    const dir = state.sort[id + ':dir'] === 'asc' ? 1 : -1;
    data.sort((a, b) => {
      const x = a[sortKey], y = b[sortKey];
      return (col && col.num ? (Number(x) - Number(y)) : String(x).localeCompare(String(y))) * dir;
    });
  }
  el.innerHTML = '<thead><tr>' + cols.map((c) =>
      `<th class="${c.num ? 'num' : ''}" data-table="${id}" data-key="${c.key}">${c.label}</th>`).join('')
    + '</tr></thead><tbody>' + data.map((r) => '<tr>' + cols.map((c) => {
      const fmt = c.fmt || F.text;
      return `<td class="${c.num ? 'num' : ''}">${fmt(r[c.key], r)}</td>`;
    }).join('') + '</tr>').join('') + '</tbody>';
  el.querySelectorAll('th').forEach((th) => th.addEventListener('click', () => {
    const key = th.dataset.key, tid = th.dataset.table;
    if (state.sort[tid] === key) {
      state.sort[tid + ':dir'] = state.sort[tid + ':dir'] === 'asc' ? 'desc' : 'asc';
    } else {
      state.sort[tid] = key; state.sort[tid + ':dir'] = 'desc';
    }
    renderTables();
  }));
}

function renderTables() {
  table('tblItems', [
    {key: 'name', label: 'Item'},
    {key: 'category', label: 'Category'},
    {key: 'type', label: 'Type'},
    {key: 'qty', label: 'Qty', num: true, fmt: (v) => num(v)},
    {key: 'net', label: 'Net sales', num: true, fmt: F.money2},
    {key: 'cost', label: 'Recipe cost', num: true, fmt: F.money2},
    {key: 'food_cost_pct', label: 'Cost %', num: true, fmt: F.pct},
    {key: 'gross_profit', label: 'Gross profit', num: true, fmt: F.money2},
  ], itemAgg());

  table('tblRecipes', [
    {key: 'recipe_name', label: 'Recipe'},
    {key: 'type', label: 'Type'},
    {key: 'selling_price', label: 'Menu price', num: true, fmt: F.money2},
    {key: 'recipe_cost', label: 'Cost / portion', num: true, fmt: F.money2},
    {key: 'food_cost_pct', label: 'Food cost %', num: true, fmt: F.pct},
    {key: 'gross_profit', label: 'Gross profit', num: true, fmt: F.money2},
    {key: 'flag', label: 'Flag', fmt: F.tag},
  ], DATA.recipes);

  table('tblReorder', [
    {key: 'ingredient', label: 'Ingredient'},
    {key: 'category', label: 'Category'},
    {key: 'physical_qty', label: 'On hand', num: true, fmt: (v) => Number(v).toFixed(2)},
    {key: 'reorder_level', label: 'Reorder at', num: true, fmt: (v) => Number(v).toFixed(2)},
    {key: 'shortfall', label: 'Shortfall', num: true, fmt: (v) => Number(v).toFixed(2)},
    {key: 'order_value', label: 'Order value', num: true, fmt: F.money},
    {key: 'stock_status', label: 'Status', fmt: F.tag},
  ], DATA.reorder);

  table('tblExpiry', [
    {key: 'ingredient', label: 'Ingredient'},
    {key: 'physical_qty', label: 'On hand', num: true, fmt: (v) => Number(v).toFixed(2)},
    {key: 'base_unit', label: 'Unit'},
    {key: 'days_cover', label: 'Days cover', num: true, fmt: (v) => Number(v).toFixed(1)},
    {key: 'advice', label: 'Advice'},
  ], DATA.expiry);

  table('tblInv', [
    {key: 'ingredient', label: 'Ingredient'},
    {key: 'category', label: 'Category'},
    {key: 'physical_qty', label: 'On hand', num: true, fmt: (v) => Number(v).toFixed(2)},
    {key: 'base_unit', label: 'Unit'},
    {key: 'reorder_level', label: 'Reorder at', num: true, fmt: (v) => Number(v).toFixed(2)},
    {key: 'max_stock', label: 'Max', num: true, fmt: (v) => Number(v).toFixed(2)},
    {key: 'closing_value', label: 'Value', num: true, fmt: F.money2},
    {key: 'stock_status', label: 'Status', fmt: F.tag},
  ], DATA.inventory);

  const dated = DATA.reviews.filter((r) => between(r.date));
  const themeMap = new Map();
  for (const r of dated) {
    const k = r.complaint_category || 'No complaint';
    const row = themeMap.get(k) || {complaint_category: k, reviews: 0, rating_sum: 0,
                                    open_replies: 0};
    row.reviews += 1; row.rating_sum += r.rating;
    if (r.response_status !== 'Responded') row.open_replies += 1;
    themeMap.set(k, row);
  }
  const themes = [...themeMap.values()].map((r) => ({...r,
    avg_rating: r.reviews ? r.rating_sum / r.reviews : 0,
    share_pct: dated.length ? r.reviews / dated.length * 100 : 0}))
    .sort((a, b) => b.reviews - a.reviews);

  table('tblThemes', [
    {key: 'complaint_category', label: 'Theme'},
    {key: 'reviews', label: 'Reviews', num: true, fmt: num},
    {key: 'avg_rating', label: 'Avg rating', num: true, fmt: (v) => Number(v).toFixed(2)},
    {key: 'open_replies', label: 'Unanswered', num: true, fmt: num},
    {key: 'share_pct', label: 'Share', num: true, fmt: F.pct},
  ], themes);

  table('tblReviews', [
    {key: 'date', label: 'Date'},
    {key: 'customer_name', label: 'Customer'},
    {key: 'rating', label: 'Rating', num: true, fmt: (v) => '★'.repeat(v)},
    {key: 'sentiment', label: 'Sentiment'},
    {key: 'complaint_category', label: 'Theme'},
    {key: 'response_status', label: 'Reply', fmt: F.tag},
    {key: 'review_text', label: 'Comment', fmt: (v) => String(v || '').slice(0, 80)},
  ], DATA.reviews.filter((r) => between(r.date)));

  table('tblAreas', [
    {key: 'area', label: 'Area'},
    {key: 'checks', label: 'Checks', num: true, fmt: num},
    {key: 'passed', label: 'Passed', num: true, fmt: num},
    {key: 'failed', label: 'Failed', num: true, fmt: num},
    {key: 'unverified', label: 'Unverified', num: true, fmt: num},
    {key: 'pass_pct', label: 'Pass %', num: true, fmt: F.pct},
  ], DATA.hygiene_areas);

  table('tblCapa', [
    {key: 'action_id', label: 'ID'},
    {key: 'source', label: 'Source'},
    {key: 'issue', label: 'Issue'},
    {key: 'severity', label: 'Severity'},
    {key: 'due_date', label: 'Due'},
    {key: 'status', label: 'Status', fmt: (v, r) => r.overdue ? F.tag('overdue') : F.tag(v)},
  ], DATA.capa);

  table('tblCampaigns', [
    {key: 'name', label: 'Campaign'},
    {key: 'type', label: 'Type'},
    {key: 'channel', label: 'Channel'},
    {key: 'start_date', label: 'Start'},
    {key: 'end_date', label: 'End'},
    {key: 'budget', label: 'Budget', num: true, fmt: F.money},
    {key: 'amount_spent', label: 'Spent', num: true, fmt: F.money},
    {key: 'budget_used_pct', label: 'Used', num: true, fmt: F.pct},
    {key: 'status', label: 'Status'},
  ], DATA.campaigns);
}

/* ---------- sections ---------- */
function renderStaff() {
  const rows = DATA.attendance.filter((a) => between(a.date));
  const count = (s) => rows.filter((a) => a.status === s).length;
  const present = count('Present'), absent = count('Absent'), half = count('Half Day');
  const base = present + absent + half;
  $('attStats').innerHTML = `
    <div class="kpis" style="grid-template-columns:repeat(2,1fr)">
      ${card('Attendance %', base ? pct(present / base * 100) : '–', 'Present / (Present + Absent + Half Day)')}
      ${card('Present days', num(present), 'of ' + num(rows.length) + ' marked days')}
      ${card('Absent days', num(absent), half + ' half days')}
      ${card('Headcount', num(DATA.staff.headcount), 'active: ' + DATA.staff.active)}
    </div>`;
  table('recStats', [
    {key: 'position', label: 'Position'},
    {key: 'candidates', label: 'Candidates', num: true, fmt: num},
    {key: 'interviewed', label: 'Interviewed', num: true, fmt: num},
    {key: 'selected', label: 'Selected', num: true, fmt: num},
    {key: 'rejected', label: 'Rejected', num: true, fmt: num},
    {key: 'on_hold', label: 'On hold', num: true, fmt: num},
    {key: 'selection_rate_pct', label: 'Select %', num: true, fmt: F.pct},
  ], DATA.recruitment);
}

function renderReviews() {
  const rows = DATA.reviews.filter((r) => between(r.date));
  const colours = ['#1E7B45', '#4C9A63', '#BF8F00', '#D0722A', '#B3261E'];
  $('ratingDist').innerHTML = [5, 4, 3, 2, 1].map((star, i) => {
    const n = rows.filter((r) => r.rating === star).length;
    const share = rows.length ? (n / rows.length) * 100 : 0;
    return `<div style="display:flex;align-items:center;gap:10px;margin:5px 0">
      <span style="width:58px">${'★'.repeat(star)}</span>
      <div style="flex:1;background:#EEF2F9;border-radius:4px;height:14px;overflow:hidden">
        <div style="width:${share.toFixed(1)}%;background:${colours[i]};height:100%"></div></div>
      <b>${n}</b><span class="hint">${share.toFixed(1)}%</span></div>`;
  }).join('') + `<p class="note" style="margin-top:10px">Average rating
      ${(rows.length ? rows.reduce((a, r) => a + r.rating, 0) / rows.length : 0).toFixed(2)} / 5 ·
      ${rows.filter((r) => r.response_status !== 'Responded').length} replies pending</p>`;
}

function drawHygiene() {
  const svg = $('chartHygiene'); const w = 620, h = 200;
  const pad = {l: 42, r: 10, t: 12, b: 24};
  const rows = DATA.hygiene_days.filter((d) => between(d.date));
  svg.innerHTML = '';
  if (!rows.length) { svg.innerHTML = '<text x="20" y="40">No checklists in this range</text>'; return; }
  axis(svg, w, h, pad);
  const x = (i) => pad.l + i * (w - pad.l - pad.r) / Math.max(1, rows.length - 1);
  const y = (v) => h - pad.b - (v / 100) * (h - pad.t - pad.b);
  const pts = rows.map((r, i) => `${x(i)},${y(r.completion_pct)}`).join(' ');
  svg.innerHTML += `<line x1="${pad.l}" y1="${y(100)}" x2="${w - pad.r}" y2="${y(100)}"
      stroke="#1E7B45" stroke-dasharray="4 3"/>
    <polyline points="${pts}" fill="none" stroke="#1F3864" stroke-width="2"/>
    <text x="${pad.l - 6}" y="${pad.t + 4}" text-anchor="end">100%</text>
    <text x="${pad.l - 6}" y="${h - pad.b}" text-anchor="end">0%</text>`;
  rows.forEach((r, i) => {
    svg.innerHTML += `<circle cx="${x(i)}" cy="${y(r.completion_pct)}" r="2.5" fill="#0F6E6E">
      <title>${r.date}: ${r.passed}/${r.checks} passed</title></circle>`;
  });
}

function renderQuality() {
  const t = totals();
  const full = DATA.kpis;
  const isFull = state.from === DATA.period.start && state.to === DATA.period.end;
  const rows = isFull ? [
    {check: 'Net sales (browser vs Python)', browser: inr2(t.net), python: inr2(full.net_sales),
     result: Math.abs(t.net - full.net_sales) < 1 ? 'match' : 'differs'},
    {check: 'Recipe cost', browser: inr2(t.cost), python: inr2(full.recipe_cost),
     result: Math.abs(t.cost - full.recipe_cost) < 1 ? 'match' : 'differs'},
    {check: 'Food cost %', browser: pct(t.cost_pct), python: pct(full.cost_pct),
     result: Math.abs(t.cost_pct - full.cost_pct) < 0.01 ? 'match' : 'differs'},
    {check: 'Bills', browser: num(t.bills), python: num(full.bills),
     result: t.bills === full.bills ? 'match' : 'differs'},
  ] : [
    {check: 'Net sales, recipe cost, bills', browser: 'filtered view',
     python: inr2(full.net_sales), result: 'full period only'},
  ];
  rows.push(
    {check: 'Inventory value (as at period end)', browser: inr2(DATA.inventory_summary.stock_value),
     python: inr2(DATA.summary.inventory_value), result: 'period end'},
    {check: 'Stock alerts (low or out)', browser: num(DATA.reorder.length),
     python: num(DATA.inventory_summary.low_stock_alerts), result: DATA.reorder.length ===
       DATA.inventory_summary.low_stock_alerts ? 'match' : 'differs'},
    {check: 'Wastage value', browser: inr2(DATA.wastage_summary.value),
     python: inr2(DATA.summary.wastage_value), result: 'period total'},
    {check: 'Hygiene pass %', browser: pct(DATA.hygiene_summary.pass_pct),
     python: pct(DATA.summary.hygiene_pass_pct), result: 'period total'},
  );
  table('tblQuality', [
    {key: 'check', label: 'Check'},
    {key: 'browser', label: 'This page', num: true},
    {key: 'python', label: 'Python / SQL', num: true},
    {key: 'result', label: 'Result', fmt: F.tag},
  ], rows);
}

/* ---------- wiring ---------- */
function renderAll() {
  renderKpis(); drawDaily(); drawTop(); splitBars(); payMix();
  renderTables(); renderStaff(); renderReviews(); drawHygiene(); renderQuality();
}

function csvExport() {
  const rows = itemAgg();
  const head = ['item', 'category', 'type', 'qty', 'net_sales', 'recipe_cost',
                'food_cost_pct', 'gross_profit'];
  const body = rows.map((r) => [r.name, r.category, r.type, r.qty.toFixed(2), r.net.toFixed(2),
    r.cost.toFixed(2), r.food_cost_pct.toFixed(2), r.gross_profit.toFixed(2)]);
  const csv = [head, ...body].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`)
    .join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));
  const a = document.createElement('a');
  a.href = url; a.download = `versova_items_${state.from}_${state.to}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function shiftDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function init() {
  $('disclaimer').textContent = DATA.disclaimer + ' Period: ' + DATA.period.start +
    ' to ' + DATA.period.end + '.';
  const q = new URLSearchParams(location.search);
  const qf = q.get('from'); const qt = q.get('to'); const qc = q.get('cat');
  if (qf && qf >= DATA.period.start && qf <= DATA.period.end) state.from = qf;
  if (qt && qt >= DATA.period.start && qt <= DATA.period.end) state.to = qt;
  if (state.from > state.to) state.from = state.to;
  $('from').min = $('to').min = DATA.period.start;
  $('from').max = $('to').max = DATA.period.end;
  $('from').value = state.from; $('to').value = state.to;
  const cats = [...new Set(DATA.lines.map((l) => l.category))].sort();
  for (const c of cats) {
    const o = document.createElement('option'); o.value = c; o.textContent = c;
    $('cat').appendChild(o);
  }
  $('quick').innerHTML = '<label>Quick range</label><div style="display:flex;gap:6px">' +
    '<button data-range="all">Full period</button><button data-range="7">Last 7</button>' +
    '<button data-range="14">Last 14</button></div>';
  $('quick').addEventListener('click', (e) => {
    const r = e.target.dataset.range; if (!r) return;
    if (r === 'all') { state.from = DATA.period.start; state.to = DATA.period.end; }
    else { state.from = shiftDays(DATA.period.end, -(Number(r) - 1)); state.to = DATA.period.end; }
    $('from').value = state.from; $('to').value = state.to; renderAll();
  });
  $('from').addEventListener('change', () => {
    state.from = $('from').value || DATA.period.start;
    if (state.from > state.to) { state.to = state.from; $('to').value = state.to; }
    renderAll();
  });
  $('to').addEventListener('change', () => {
    state.to = $('to').value || DATA.period.end;
    if (state.to < state.from) { state.from = state.to; $('from').value = state.from; }
    renderAll();
  });
  if (qc && cats.includes(qc)) { state.cat = qc; $('cat').value = qc; }
  $('cat').addEventListener('change', () => { state.cat = $('cat').value; renderAll(); });
  $('csv').addEventListener('click', csvExport);
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
