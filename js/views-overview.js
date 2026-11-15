'use strict';
/* Overview: the eight headline KPIs plus the operational watchlist. */

const CAT_COLS = [
  {key: 'category', label: 'Category'},
  {key: 'type', label: 'Type', fmt: (v) => badge(v, v === 'Beverage' ? 'info' : 'gold')},
  {key: 'net', label: 'Net sales', num: true, fmt: (v) => inr0(v)},
  {key: 'share', label: 'Share', num: true, fmt: (v) => pct(v, 1)},
];

function kpiCard(o) {
  return `<article class="kpi ${o.tone || ''}">
    <div class="top"><span class="label">${esc(o.label)}</span>
      <span class="ico">${ICON[o.icon] || ICON.trend}</span></div>
    <div class="value">${o.value}</div>
    <div class="foot">${o.delta || ''}${o.note
      ? `<span class="${o.delta ? '' : 'muted'}">${esc(o.note)}</span>` : ''}</div>
    ${o.spark || ''}</article>`;
}

function viewOverview(root) {
  // A KPI only shows a change when an earlier period actually exists in the data.
  const cmp = (cur, prev) => (prev == null ? '' : deltaPill(deltaOf(cur, prev)));
  const t = totals();
  const prev = previousPeriod();
  const pt = prev ? totals(prev.from, prev.to) : null;
  const K = D.kpis;
  const inv = D.inventory_summary;
  const att = attendanceIn();
  const present = att.filter((a) => a.status === 'Present').length;
  const counted = att.filter((a) => ['Present', 'Absent', 'Half Day'].includes(a.status)).length;
  const attPct = counted ? (present / counted) * 100 : D.staff.attendance_pct;
  const pAtt = prev ? attendanceIn(prev.from, prev.to) : [];
  const pPresent = pAtt.filter((a) => a.status === 'Present').length;
  const pCounted = pAtt.filter((a) => ['Present', 'Absent', 'Half Day'].includes(a.status)).length;
  const pAttPct = pCounted ? (pPresent / pCounted) * 100 : null;
  const rev = reviewsIn();
  const avgRating = rev.length ? rev.reduce((a, r) => a + r.rating, 0) / rev.length : 0;
  const pRev = prev ? reviewsIn(prev.from, prev.to) : [];
  const pRating = pRev.length ? pRev.reduce((a, r) => a + r.rating, 0) / pRev.length : null;

  const daily = dailySeries();
  const billMap = new Map(D.daily_bills.filter((b) => inRange(b.date)).map((b) => [b.date, b]));
  const dayRows = daily.map((d) => {
    const b = billMap.get(d.date) || {bills: 0, gross: 0};
    return {date: d.date, net: d.value, bills: b.bills, gross: b.gross};
  });
  const sparkNet = dayRows.map((d) => d.net);
  const sparkGross = dayRows.map((d) => d.gross);
  const sparkBills = dayRows.map((d) => d.bills);
  const costByDay = dayRows.map((d) => {
    const cost = lines(d.date, d.date).reduce((a, l) => a + l.cost, 0);
    return d.net ? (cost / d.net) * 100 : 0;
  });

  const items = itemAgg().sort((a, b) => b.net - a.net);
  const top = items.slice(0, 8);
  const catRows = [...new Set(lines().map((l) => l.category))].map((c) => {
    const rows = lines().filter((l) => l.category === c);
    return {category: c, qty: rows.reduce((a, r) => a + r.qty, 0),
      net: rows.reduce((a, r) => a + r.net, 0),
      type: rows[0] ? rows[0].type : ''};
  }).sort((a, b) => b.net - a.net);
  const payRows = [...new Set(payments().map((p) => p.payment_mode))].map((m) => ({
    label: m, value: payments().filter((p) => p.payment_mode === m).reduce((a, p) => a + p.net, 0),
    bills: payments().filter((p) => p.payment_mode === m).reduce((a, p) => a + p.bills, 0),
  })).sort((a, b) => b.value - a.value);

  const watch = [
    {label: 'Stock alerts', value: inv.low_stock_alerts, note: inv.items_to_reorder + ' to reorder',
      route: 'inventory', tone: 'bad', icon: 'box'},
    {label: 'Expiring items', value: D.expiry.length, note: 'within 31 days',
      route: 'inventory', tone: 'warn', icon: 'clock'},
    {label: 'Overdue actions', value: D.hygiene_summary.overdue_actions, note: 'FSSAI CAPA',
      route: 'hygiene', tone: 'bad', icon: 'alert'},
    {label: 'Replies pending', value: D.review_summary.pending_replies, note: 'Google reviews',
      route: 'reviews', tone: 'warn', icon: 'star'},
  ];

  root.innerHTML = `
  <section class="kpis">
    ${kpiCard({label: 'Total net sales', value: inr0(t.net), icon: 'rupee', tone: 'gold',
      delta: cmp(t.net, pt && pt.net), spark: spark(sparkNet)})}
    ${kpiCard({label: 'Gross sales', value: inr0(t.gross), icon: 'trend',
      delta: cmp(t.gross, pt && pt.gross), spark: spark(sparkGross, 'var(--teal)')})}
    ${kpiCard({label: 'Total orders', value: num(t.bills), icon: 'cart',
      delta: cmp(t.bills, pt && pt.bills), spark: spark(sparkBills, 'var(--good)')})}
    ${kpiCard({label: 'Average order value', value: inr2(t.avg), icon: 'rupee',
      delta: cmp(t.avg, pt && pt.avg)})}
    ${kpiCard({label: 'Food cost %', value: pct(t.cost_pct), icon: 'costing',
      delta: cmp(t.cost_pct, pt && pt.cost_pct), spark: spark(costByDay, 'var(--warn)'),
      note: t.cost_pct > 30 ? 'above 30% target' : 'within target'})}
    ${kpiCard({label: 'Inventory valuation', value: inr0(inv.stock_value), icon: 'box',
      note: inv.ingredients + ' ingredients · physical stock'})}
    ${kpiCard({label: 'Staff attendance', value: pct(attPct, 1), icon: 'staff',
      delta: cmp(attPct, pAttPct), note: num(att.length) + ' records'})}
    ${kpiCard({label: 'Customer average rating', value: avgRating.toFixed(2) + ' ★', icon: 'star',
      delta: cmp(avgRating, pRating), note: num(rev.length) + ' reviews'})}
  </section>

  <section class="grid split" style="margin-bottom:14px">
    <div class="card">
      <div class="card-head">
        <div><h3>Net sales trend</h3><div class="hint">Daily GST-exclusive sales, ${esc(dateLong(state.from))} – ${esc(dateLong(state.to))}</div></div>
        <span class="badge gold">${num(dayRows.length)} trading days</span>
      </div>
      ${lineChart('ovTrend', {data: dayRows.map((d) => ({date: d.date, value: d.net})),
        label: 'Daily net sales', fmt: (v) => compact(v)})}
      <div class="row small muted" style="margin-top:8px">
        <span>Peak day ${esc(dateLong([...dayRows].sort((a, b) => b.net - a.net)[0]?.date))}
        · ${inr0([...dayRows].sort((a, b) => b.net - a.net)[0]?.net)}</span>
        <span class="spacer"></span>${legend([{label: 'Net sales', color: 'var(--gold)'}])}
      </div>
    </div>
    <div class="stack">
      <div class="card">
        <div class="card-head"><div><h3>Food vs beverage</h3>
          <div class="hint">Revenue split for the selected period</div></div></div>
        ${donut([{label: 'Food', value: t.food, color: 'var(--gold)'},
          {label: 'Beverage', value: t.bev, color: 'var(--teal)'}],
          {caption: 'net sales', label: 'Food and beverage split'})}
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Payment mix</h3>
          <div class="hint">Settled bills by channel</div></div></div>
        ${donut(payRows.slice(0, 5), {caption: 'bills value', label: 'Payment mix',
          fmt: (v) => inr0(v)})}
      </div>
    </div>
  </section>

  <div class="section-title"><h2>Operational watchlist</h2><div class="line"></div></div>
  <section class="grid g4" style="margin-bottom:14px">
    ${watch.map((w) => `<a class="kpi ${w.tone === 'bad' ? '' : ''}" href="#/${w.route}"
      style="text-decoration:none;color:inherit">
      <div class="top"><span class="label">${esc(w.label)}</span>
        <span class="ico" style="background:${w.tone === 'bad' ? 'rgba(229,100,92,.13)'
          : 'rgba(224,169,59,.14)'};color:${w.tone === 'bad' ? 'var(--bad)' : 'var(--warn)'}">
          ${ICON[w.icon]}</span></div>
      <div class="value">${num(w.value)}</div>
      <div class="foot"><span class="muted">${esc(w.note)}</span></div></a>`).join('')}
  </section>

  <section class="grid split-even" style="margin-bottom:14px">
    <div class="card">
      <div class="card-head"><div><h3>Top selling items</h3>
        <div class="hint">By net sales in the selected period</div></div>
        <a class="btn btn-ghost btn-sm" href="#/sales"><span>All items</span></a></div>
      ${barList(top.map((i) => ({label: i.name, value: i.net})), {highlight: true})}
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Category performance</h3>
        <div class="hint">Net sales and share of revenue</div></div></div>
      <div class="tbl-holder">${dataTable('ovCat', CAT_COLS, catRows.map((c) =>
        ({...c, share: t.net ? (c.net / t.net) * 100 : 0})), {pageSize: 6})}</div>
    </div>
  </section>

  <section class="grid g3">
    <div class="card">
      <div class="card-head"><div><h3>Hygiene compliance</h3>
        <div class="hint">${num(D.hygiene_summary.checks)} FSSAI checks logged</div></div>
        <a class="btn btn-ghost btn-sm" href="#/hygiene"><span>Open</span></a></div>
      <div class="row" style="gap:14px">${ring(D.hygiene_summary.pass_pct, 'checks passed',
        'var(--teal)')}
        <div class="stack small" style="gap:6px">
          <span>${badge(D.hygiene_summary.failed_checks + ' failed', 'bad')}</span>
          <span>${badge(D.hygiene_summary.overdue_actions + ' overdue actions', 'warn')}</span>
          <span class="muted">Temperature fails: ${num(D.hygiene_summary.temperature_fails)}</span>
        </div></div>
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Guest sentiment</h3>
        <div class="hint">Google review themes (synthetic)</div></div>
        <a class="btn btn-ghost btn-sm" href="#/reviews"><span>Open</span></a></div>
      ${barList(D.review_themes.slice(0, 5).map((r) => ({label: r.complaint_category,
        value: r.reviews})), {fmt: (v) => num(v) + ' reviews', color: 'var(--warn)'})}
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Team &amp; recruitment</h3>
        <div class="hint">People operations snapshot</div></div>
        <a class="btn btn-ghost btn-sm" href="#/staff"><span>Open</span></a></div>
      <dl class="kv">
        <dt>Headcount</dt><dd>${num(D.staff.headcount)}</dd>
        <dt>Attendance</dt><dd>${pct(attPct, 1)}</dd>
        <dt>Open candidates</dt><dd>${num(D.staff.candidates)}</dd>
        <dt>Selected</dt><dd>${num(D.staff.selected)}</dd>
        <dt>Document gaps</dt><dd>${num(D.staff.document_gaps)}</dd>
      </dl>
      <div style="margin-top:10px">${progressBar(attPct)}</div>
    </div>
  </section>`;

  bindTables(root);
  bindLineChart(root, 'ovTrend', {fmt: (v) => inr0(v)});
}
