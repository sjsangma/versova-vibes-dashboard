'use strict';
/* Dependency-free SVG charts. Series colours use CSS custom properties so they follow
   the active theme without re-rendering. */

const PALETTE = ['var(--gold)', 'var(--teal)', 'var(--good)', 'var(--warn)',
  'var(--bad)', 'var(--muted)'];

function sparkPath(values, w = 82, h = 30) {
  if (!values || !values.length) return '';
  const max = Math.max(...values), min = Math.min(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  return values.map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(
    h - ((v - min) / span) * (h - 4) - 2).toFixed(1)}`).join(' ');
}
function spark(values, tone) {
  if (!values || values.length < 2) return '';
  const color = tone || PALETTE[0];
  return `<svg class="spark" viewBox="0 0 82 30" preserveAspectRatio="none" aria-hidden="true">
    <path d="${sparkPath(values)}" fill="none" stroke="${color}" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function lineChart(id, cfg) {
  const data = cfg.data || [];
  if (!data.length) return emptyState('No data in range', 'Pick a wider date range.');
  const W = 720, H = cfg.height || 260, pad = {t: 12, r: 10, b: 26, l: 46};
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const values = data.map((d) => d.value);
  const max = Math.max(...values) * 1.08 || 1;
  const step = data.length > 1 ? iw / (data.length - 1) : iw;
  const x = (i) => pad.l + i * step;
  const y = (v) => pad.t + ih - (v / max) * ih;
  const ticks = 4;
  const grid = [];
  for (let i = 0; i <= ticks; i++) {
    const v = (max / ticks) * i, yy = y(v);
    grid.push(`<line class="grid-line" x1="${pad.l}" x2="${W - pad.r}" y1="${yy}" y2="${yy}"/>
      <text x="${pad.l - 8}" y="${yy + 3}" text-anchor="end">${cfg.fmt ? cfg.fmt(v, true) : compact(v)}</text>`);
  }
  const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.value).toFixed(1)}`);
  const area = `M${pad.l},${pad.t + ih} L` + pts.join(' L') + ` L${x(data.length - 1)},${pad.t + ih} Z`;
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));
  const labels = data.map((d, i) => (i % labelEvery === 0 || i === data.length - 1)
    ? `<text x="${x(i)}" y="${H - 7}" text-anchor="middle">${esc(d.label || dateLabel(d.date))}</text>` : '').join('');
  return `<div class="chart-holder" data-chart="${id}" style="position:relative">
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cfg.label || 'Trend chart')}">
      <defs><linearGradient id="${id}-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${cfg.color || PALETTE[0]}" stop-opacity=".28"/>
        <stop offset="100%" stop-color="${cfg.color || PALETTE[0]}" stop-opacity="0"/>
      </linearGradient></defs>
      ${grid.join('')}
      <path d="${area}" fill="url(#${id}-fill)"/>
      <path class="series" d="M${pts.join(' L')}" stroke="${cfg.color || PALETTE[0]}"/>
      ${labels}
      <line class="hover-line" x1="0" x2="0" y1="${pad.t}" y2="${pad.t + ih}"
        stroke="var(--muted)" stroke-dasharray="3 3" opacity="0"/>
      <circle class="hover-dot" r="4" fill="${cfg.color || PALETTE[0]}" stroke="var(--card)"
        stroke-width="2" opacity="0"/>
      <rect class="hit" x="${pad.l}" y="${pad.t}" width="${iw}" height="${ih}" fill="transparent"/>
    </svg>
    <div class="chart-tip" hidden></div>
    <script type="application/json" class="chart-data">${JSON.stringify(
      data.map((d) => ({label: d.label || dateLabel(d.date), value: d.value})))}</script>
  </div>`;
}

function bindLineChart(root, id, cfg) {
  const holder = $(`[data-chart="${id}"]`, root);
  if (!holder) return;
  const svgEl = $('svg', holder), tip = $('.chart-tip', holder);
  const raw = JSON.parse($('.chart-data', holder).textContent);
  const line = $('.hover-line', holder), dot = $('.hover-dot', holder);
  const box = () => svgEl.getBoundingClientRect();
  const move = (ev) => {
    const rect = box();
    const rel = (ev.clientX - rect.left) / rect.width;
    const idx = Math.max(0, Math.min(raw.length - 1,
      Math.round(rel * (raw.length - 1))));
    const pt = raw[idx];
    const left = (idx / Math.max(1, raw.length - 1)) * rect.width;
    const yv = svgEl.viewBox.baseVal;
    const max = Math.max(...raw.map((d) => d.value)) * 1.08 || 1;
    const yPix = (yv.height - 26 - 12 - (pt.value / max) * (yv.height - 38)) / yv.height * rect.height;
    line.setAttribute('x1', left); line.setAttribute('x2', left);
    line.setAttribute('opacity', '.6');
    dot.setAttribute('cx', (46 + (left / rect.width) * (yv.width - 56)));
    dot.setAttribute('cy', (12 + ((yv.height - 38) - (pt.value / max) * (yv.height - 38))));
    dot.setAttribute('opacity', '1');
    tip.hidden = false;
    tip.innerHTML = `<b>${esc(pt.label)}</b><span>${cfg.fmt ? cfg.fmt(pt.value)
      : inr2(pt.value)}</span>`;
    tip.style.left = Math.min(rect.width - 120, Math.max(0, left - 55)) + 'px';
    tip.style.top = Math.max(0, yPix - 46) + 'px';
  };
  svgEl.addEventListener('mousemove', move);
  svgEl.addEventListener('mouseleave', () => {
    tip.hidden = true; line.setAttribute('opacity', '0'); dot.setAttribute('opacity', '0');
  });
  svgEl.addEventListener('touchstart', (e) => { if (e.touches[0]) move(e.touches[0]); },
    {passive: true});
}

function barList(rows, opts = {}) {
  if (!rows.length) return emptyState('Nothing to show', 'No rows in this period.');
  const max = Math.max(...rows.map((r) => Math.abs(r.value))) || 1;
  return `<div class="bars">${rows.map((r, i) => `<div class="bar-row">
    <span title="${esc(r.label)}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
      ${esc(r.label)}</span>
    <span class="mono muted">${opts.fmt ? opts.fmt(r.value) : inr0(r.value)}</span>
    <div class="bar-track"><div class="bar-fill" style="width:${(Math.abs(r.value) / max * 100)
      .toFixed(1)}%;${opts.color ? 'background:' + opts.color : (i === 0 && opts.highlight
      ? 'background:var(--gold)' : '')}"></div></div></div>`).join('')}</div>`;
}

function columnChart(id, cfg) {
  const data = cfg.data || [];
  if (!data.length) return emptyState('No data', 'Nothing recorded in this range.');
  const W = 720, H = cfg.height || 220, pad = {t: 10, r: 8, b: 26, l: 40};
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const max = cfg.max || Math.max(...data.map((d) => d.value)) || 1;
  const bw = iw / data.length;
  const bars = data.map((d, i) => {
    const h = (d.value / max) * ih;
    return `<rect x="${(pad.l + i * bw + bw * .18).toFixed(1)}" y="${(pad.t + ih - h).toFixed(1)}"
      width="${(bw * .64).toFixed(1)}" height="${h.toFixed(1)}" rx="3"
      fill="${cfg.color || PALETTE[1]}" opacity="${d.value ? '.85' : '.25'}">
      <title>${esc(d.label)}: ${cfg.fmt ? cfg.fmt(d.value) : inr0(d.value)}</title></rect>
      <text x="${(pad.l + i * bw + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle"
        ${data.length > 14 ? 'style="font-size:8px"' : ''}>${esc(d.label)}</text>`;
  }).join('');
  const gridY = [0, .5, 1].map((f) => {
    const v = max * f, yy = pad.t + ih - f * ih;
    return `<line class="grid-line" x1="${pad.l}" x2="${W - pad.r}" y1="${yy}" y2="${yy}"/>
      <text x="${pad.l - 6}" y="${yy + 3}" text-anchor="end">${
        cfg.tickFmt ? cfg.tickFmt(v) : compact(v)}</text>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img"
    aria-label="${esc(cfg.label || 'Column chart')}">${gridY}${bars}</svg>`;
}

function donut(rows, opts = {}) {
  const total = rows.reduce((a, r) => a + Math.max(0, r.value), 0);
  if (!total) return emptyState('No mix to show', 'No payments in this range.');
  const r = 60, cx = 76, cy = 76, c = 2 * Math.PI * r;
  let offset = 0;
  const segs = rows.map((row, i) => {
    const frac = Math.max(0, row.value) / total;
    const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="${row.color || PALETTE[i % PALETTE.length]}" stroke-width="16"
      stroke-dasharray="${(frac * c).toFixed(2)} ${c.toFixed(2)}"
      stroke-dashoffset="${(-offset * c).toFixed(2)}"
      transform="rotate(-90 ${cx} ${cy})"><title>${esc(row.label)}: ${
      opts.fmt ? opts.fmt(row.value) : inr0(row.value)} (${(frac * 100).toFixed(1)}%)</title></circle>`;
    offset += frac;
    return seg;
  }).join('');
  return `<div class="row" style="gap:20px;align-items:center;flex-wrap:wrap">
    <svg class="chart" viewBox="0 0 152 152" style="width:152px;height:152px;flex:0 0 152px"
      role="img" aria-label="${esc(opts.label || 'Composition')}">${segs}
      <text x="76" y="71" text-anchor="middle" style="font-size:15px;font-weight:600;
        fill:var(--text)">${compact(total)}</text>
      <text x="76" y="88" text-anchor="middle" style="font-size:9px">${esc(opts.caption || 'total')}</text>
    </svg>
    <div style="flex:1;min-width:150px" class="stack">
      ${rows.map((row, i) => `<div class="row small" style="gap:8px">
        <i style="width:8px;height:8px;border-radius:2px;background:${
        row.color || PALETTE[i % PALETTE.length]};display:inline-block"></i>
        <span>${esc(row.label)}</span>
        <b class="mono" style="margin-left:auto">${(row.value / total * 100).toFixed(1)}%</b>
      </div>`).join('')}
    </div></div>`;
}

function legend(items) {
  return `<div class="legend">${items.map((i) => `<span><i style="background:${
    i.color}"></i>${esc(i.label)}</span>`).join('')}</div>`;
}

function ratingBars(dist) {
  const total = dist.reduce((a, d) => a + d.count, 0) || 1;
  return `<div class="stack" style="gap:7px">${[5, 4, 3, 2, 1].map((star) => {
    const row = dist.find((d) => d.rating === star) || {count: 0};
    return `<div class="row small" style="gap:9px">
      <span style="width:26px;color:var(--muted)">${star}★</span>
      <div class="progress" style="flex:1"><i style="width:${(row.count / total * 100).toFixed(1)}%;
        background:${star >= 4 ? 'var(--good)' : star === 3 ? 'var(--warn)' : 'var(--bad)'}"></i></div>
      <span class="mono muted" style="width:44px;text-align:right">${num(row.count)}</span></div>`;
  }).join('')}</div>`;
}
