'use strict';
/* Reports, data quality and settings. Every figure shown here is recomputed from the
   same line-level payload the other views use, so reconciliation is visible. */

function viewReports(root) {
  const s = D.summary;
  const t = totals();
  const expenseRows = [
    {item: 'Rent', value: s.rent},
    {item: 'Electricity & utilities', value: s.electricity},
    {item: 'Marketing', value: s.marketing},
    {item: 'Repairs & maintenance', value: s.repairs},
    {item: 'Other operating expenses', value: s.other},
  ];
  const opex = expenseRows.reduce((a, r) => a + r.value, 0);
  const netOperating = s.gross_profit - opex;
  const prev = previousPeriod();
  const hasPrev = !!prev;
  const p = prev ? totals(prev.from, prev.to) : null;
  const rows = [
    {metric: 'Bills', cur: t.bills, old: p && p.bills, fmt: num},
    {metric: 'Gross sales', cur: t.gross, old: p && p.gross, fmt: inr2},
    {metric: 'Discounts', cur: t.discount, old: p && p.discount, fmt: inr2},
    {metric: 'Net sales (ex-GST)', cur: t.net, old: p && p.net, fmt: inr2},
    {metric: 'GST collected', cur: t.gst, old: p && p.gst, fmt: inr2},
    {metric: 'Recipe cost', cur: t.cost, old: p && p.cost, fmt: inr2},
    {metric: 'Gross profit', cur: t.gp, old: p && p.gp, fmt: inr2},
    {metric: 'Average order value', cur: t.avg, old: p && p.avg, fmt: inr2},
  ];

  root.innerHTML = `
  <section class="kpis">
    ${kpiCard({label: 'Net sales', value: inr0(t.net), icon: 'rupee', tone: 'gold',
      note: 'ex-GST'})}
    ${kpiCard({label: 'Gross profit', value: inr0(s.gross_profit), icon: 'costing',
      note: pct(t.margin_pct, 1) + ' margin'})}
    ${kpiCard({label: 'Operating expenses', value: inr0(opex), icon: 'reports',
      note: 'rent, utilities, marketing, repairs'})}
    ${kpiCard({label: 'Net operating profit', value: inr0(netOperating), icon: 'trend',
      note: pct(t.net ? (netOperating / t.net) * 100 : 0, 1) + ' of net sales'})}
  </section>

  <section class="grid split" style="margin-bottom:14px">
    <div class="card">
      <div class="card-head"><div><h3>Profit and loss (selected period)</h3>
        <div class="hint">Revenue, cost of goods and operating expenses kept separate</div></div>
        <button class="btn btn-ghost btn-sm" id="printReport">${svg('<path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/>')}<span>Print</span></button></div>
      <div class="tbl-holder"><table><tbody>
        <tr><td>Food sales</td><td class="num mono">${inr2(s.food_sales)}</td></tr>
        <tr><td>Beverage sales</td><td class="num mono">${inr2(s.beverage_sales)}</td></tr>
        <tr><td><b>Net sales</b></td><td class="num mono"><b>${inr2(t.net)}</b></td></tr>
        <tr><td>Less: recipe cost</td><td class="num mono">(${inr2(t.cost)})</td></tr>
        <tr><td><b>Gross profit</b></td><td class="num mono"><b>${inr2(s.gross_profit)}</b></td></tr>
        ${expenseRows.map((e) => `<tr><td>Less: ${esc(e.item)}</td>
          <td class="num mono">(${inr2(e.value)})</td></tr>`).join('')}
        <tr><td><b>Net operating profit</b></td>
          <td class="num mono"><b>${inr2(netOperating)}</b></td></tr>
      </tbody></table></div>
      <div class="small muted" style="margin-top:10px">
        Food cost ${pct(s.cost_pct)} · GST collected ${inr2(t.gst)} (5% on taxable value).
        Operating expenses are the sample planning figures, not audited accounts.</div>
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Period comparison</h3>
        <div class="hint">${hasPrev ? `${dateLabel(prev.from)} – ${dateLabel(prev.to)} vs the selected range`
    : 'The selected range starts at the beginning of the sample data — no earlier period exists'}</div></div></div>
      <div class="tbl-holder"><table><thead><tr><th>Metric</th><th class="num">Previous</th>
        <th class="num">Current</th><th class="num">Change</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td>${esc(r.metric)}</td>
      <td class="num mono">${r.old == null ? '—' : r.fmt(r.old)}</td>
      <td class="num mono">${r.fmt(r.cur)}</td>
      <td class="num">${r.old == null ? '<span class="muted small">n/a</span>'
    : deltaPill(deltaOf(r.cur, r.old))}</td></tr>`).join('')}
      </tbody></table></div>
    </div>
  </section>

  <section class="grid split">
    <div class="card">
      <div class="card-head"><div><h3>Monthly roll-up</h3>
        <div class="hint">Full sample period, independent of the date filter</div></div>
        <button class="btn btn-ghost btn-sm" id="monthCsv">${svg('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>')}<span>CSV</span></button></div>
      <div class="tbl-holder">${dataTable('rpMonth', [
        {key: 'month', label: 'Month', fmt: (v) => dateLong(v).slice(3)},
        {key: 'bills', label: 'Bills', num: true, fmt: (v) => num(v)},
        {key: 'food_sales', label: 'Food', num: true, fmt: (v) => inr0(v)},
        {key: 'beverage_sales', label: 'Beverage', num: true, fmt: (v) => inr0(v)},
        {key: 'net_sales', label: 'Net sales', num: true, fmt: (v) => inr0(v)},
      ], D.monthly, {pageSize: 12})}</div>
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Weekly roll-up</h3>
        <div class="hint">Calendar weeks (1–7, 8–14, 15–21, 22–28, 29–end)</div></div></div>
      <div class="tbl-holder">${dataTable('rpWeek', [
        {key: 'label', label: 'Week', fmt: (v, r) => `<b>${esc(v)}</b>
          <div class="small muted">${dateLabel(r.week_start)} – ${dateLabel(r.week_end)}</div>`},
        {key: 'bills', label: 'Bills', num: true, fmt: (v) => num(v)},
        {key: 'net_sales', label: 'Net sales', num: true, fmt: (v) => inr0(v)},
      ], D.weekly, {pageSize: 12})}</div>
    </div>
  </section>

  <div class="card" style="margin-top:14px">
    <div class="card-head"><div><h3>Download</h3>
      <div class="hint">Exports reflect the current date and category filters</div></div></div>
    <div class="row wrap">
      <button class="btn btn-gold" id="dlItems">Sales line report (CSV)</button>
      <button class="btn" id="dlDaily">Daily sales summary (CSV)</button>
      <button class="btn" id="dlFull">Full dataset (JSON)</button>
    </div>
  </div>`;

  bindTables(root);
  $('#printReport', root).addEventListener('click', () => window.print());
  $('#monthCsv', root).addEventListener('click', () => {
    downloadCSV('versova_monthly_sales.csv', ['Month', 'Bills', 'Food', 'Beverage', 'NetSales'],
      D.monthly.map((m) => [m.month, m.bills, m.food_sales, m.beverage_sales, m.net_sales]));
    toast('Monthly roll-up exported');
  });
  $('#dlItems', root).addEventListener('click', () => {
    downloadCSV(`versova_sales_lines_${state.from}_${state.to}.csv`,
      ['Date', 'Item', 'Category', 'Type', 'Qty', 'NetSales', 'RecipeCost'],
      lines().map((l) => [l.date, l.name, l.category, l.type, l.qty, l.net.toFixed(2),
        l.cost.toFixed(2)]));
    toast('Sales lines exported');
  });
  $('#dlDaily', root).addEventListener('click', () => {
    downloadCSV(`versova_daily_sales_${state.from}_${state.to}.csv`,
      ['Date', 'Bills', 'Gross', 'Discount', 'Taxable', 'GST', 'Net'],
      D.daily_bills.filter((b) => inRange(b.date)).map((b) => [b.date, b.bills, b.gross,
        b.discount, b.taxable, b.gst, b.net]));
    toast('Daily summary exported');
  });
  $('#dlFull', root).addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(D)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'versova_dataset.json';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Full dataset downloaded');
  });
}

function viewQuality(root) {
  const rows = lines();
  const bills = payments();
  const zeroQty = rows.filter((r) => !(r.qty > 0)).length;
  const neg = rows.filter((r) => r.net < 0).length;
  const noDate = rows.filter((r) => !r.date).length;
  const lineNet = rows.reduce((a, r) => a + r.net, 0);
  const billNet = bills.reduce((a, b) => a + b.net, 0);
  const diff = Math.abs(lineNet - billNet);
  const gaps = [];
  for (let d = state.from; d <= state.to; d = shiftDays(d, 1)) {
    if (!dailySeries().some((x) => x.date === d)) gaps.push(d);
  }
  const checks = [
    {check: 'Line-level net sales vs payment totals', value: inr2(lineNet),
      expected: inr2(billNet), ok: diff < 1},
    {check: 'Lines with zero or negative quantity', value: num(zeroQty), expected: '0',
      ok: zeroQty === 0},
    {check: 'Negative line values', value: num(neg), expected: '0', ok: neg === 0},
    {check: 'Lines missing a date', value: num(noDate), expected: '0', ok: noDate === 0},
    {check: 'Days with no bills', value: num(gaps.length), expected: '0', ok: !gaps.length},
    {check: 'Food + beverage = net sales', value: inr2(totals().food + totals().bev),
      expected: inr2(totals().net), ok: Math.abs(totals().food + totals().bev
        - totals().net) < 1},
  ];
  const passing = checks.filter((c) => c.ok).length;

  root.innerHTML = `
  <section class="kpis">
    ${kpiCard({label: 'Checks passing', value: passing + ' / ' + checks.length, icon: 'check',
      tone: 'gold', note: 'recomputed on every filter change'})}
    ${kpiCard({label: 'Bills in range', value: num(bills.reduce((a, b) => a + b.bills, 0)),
      icon: 'cart', note: 'from the payments table'})}
    ${kpiCard({label: 'Item-day lines', value: num(rows.length), icon: 'reports',
      note: 'distinct item lines in range'})}
    ${kpiCard({label: 'Rounding difference', value: inr2(Math.abs(D.summary.round_off || 0)),
      icon: 'alert', note: 'invoice round-off carried in the bill header'})}
  </section>

  <div class="card">
    <div class="card-head"><div><h3>Reconciliation</h3>
      <div class="hint">Same rules as the Python and SQL test suites</div></div></div>
    <div class="tbl-holder"><table><thead><tr><th>Check</th><th class="num">Value</th>
      <th class="num">Expected</th><th>Result</th></tr></thead><tbody>
      ${checks.map((c) => `<tr><td>${esc(c.check)}</td><td class="num mono">${c.value}</td>
        <td class="num mono">${c.expected}</td>
        <td>${badge(c.ok ? 'Pass' : 'Review', c.ok ? 'good' : 'bad')}</td></tr>`).join('')}
    </tbody></table></div>
  </div>

  <div class="card" style="margin-top:14px">
    <div class="card-head"><div><h3>Data provenance</h3>
      <div class="hint">What is synthetic and what came from the business</div></div></div>
    <dl class="kv">
      <dt>Source</dt><dd>Excel workbook, PostgreSQL schema and Python modules in the
        Versova Vibes Restaurant System</dd>
      <dt>Period</dt><dd>${dateLong(D.period.start)} – ${dateLong(D.period.end)}</dd>
      <dt>Closing stock</dt><dd>From the bar closing stock sheet dated 31-10-2026; other
        operational figures are synthetic</dd>
      <dt>Reviews</dt><dd>${esc(D.review_source)}</dd>
      <dt>Money format</dt><dd>Indian digit grouping, INR, ex-GST for net sales</dd>
    </dl>
    <div class="notice" style="margin-top:12px">
      ${svg('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>')}
      <span>${esc(D.disclaimer)}</span></div>
  </div>`;
}

function viewSettings(root) {
  const role = state.role || 'Owner';
  root.innerHTML = `
  <section class="grid split">
    <div class="card">
      <div class="card-head"><div><h3>Appearance</h3>
        <div class="hint">Stored in this browser only</div></div></div>
      <div class="stack">
        <div class="row"><span>Theme</span><span class="spacer"></span>
          <div class="seg" id="themeChoice">
            <button data-theme="dark" class="${state.theme === 'dark' ? 'active' : ''}">Dark</button>
            <button data-theme="light" class="${state.theme === 'light' ? 'active' : ''}">Light</button>
          </div></div>
        <div class="row"><span>Default landing view</span><span class="spacer"></span>
          <div class="seg" id="landingChoice">
            ${['overview', 'sales', 'costing'].map((r) => `<button data-route="${r}"
              class="${(localStorage.getItem('vv.landing') || 'overview') === r ? 'active' : ''}">
              ${r[0].toUpperCase() + r.slice(1)}</button>`).join('')}
          </div></div>
        <div class="row"><span>Date range</span><span class="spacer"></span>
          <span class="mono small">${state.from} → ${state.to}</span></div>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Role view</h3>
        <div class="hint">This static site hides nothing at the file level — the role selector
          only changes what is emphasised. Row-level security lives in PostgreSQL.</div></div></div>
      <div class="row wrap" id="roleChoice">
        ${['Owner', 'Restaurant Manager', 'Accountant', 'Store Manager', 'HR Manager',
    'Kitchen Manager'].map((r) => `<button class="btn btn-ghost btn-sm ${r === role
    ? 'btn-gold' : ''}" data-role="${esc(r)}">${esc(r)}</button>`).join('')}
      </div>
      <div class="small muted" style="margin-top:10px">
        Salary fields are excluded from this public export for every role. The database layer
        enforces the real boundary with role grants and vw_payroll.</div>
    </div>
  </section>

  <div class="card" style="margin-top:14px">
    <div class="card-head"><div><h3>About this dashboard</h3>
      <div class="hint">Static build, no backend, no tracking</div></div></div>
    <dl class="kv">
      <dt>Business</dt><dd>${esc(D.business)}</dd>
      <dt>Currency</dt><dd>${esc(D.currency)} · Indian digit grouping</dd>
      <dt>Build</dt><dd>Generated from the project's sample database by
        <span class="mono">tools/build_static_site.py</span></dd>
      <dt>Hosting</dt><dd>GitHub Pages, rebuilt on every publish</dd>
    </dl>
    <div class="notice" style="margin-top:12px">
      ${svg('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>')}
      <span>${esc(D.disclaimer)}</span></div>
  </div>`;

  $$('#themeChoice button', root).forEach((b) => b.addEventListener('click', () => {
    setTheme(b.dataset.theme);
    $$('#themeChoice button', root).forEach((x) => x.classList.toggle('active', x === b));
  }));
  $$('#landingChoice button', root).forEach((b) => b.addEventListener('click', () => {
    localStorage.setItem('vv.landing', b.dataset.route);
    $$('#landingChoice button', root).forEach((x) => x.classList.toggle('active', x === b));
    toast('Default view saved');
  }));
  $$('#roleChoice button', root).forEach((b) => b.addEventListener('click', () => {
    state.role = b.dataset.role;
    localStorage.setItem('vv.role', state.role);
    $$('#roleChoice button', root).forEach((x) => x.classList.toggle('btn-gold', x === b));
    toast('Viewing as ' + state.role);
  }));
}
