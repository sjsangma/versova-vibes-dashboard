'use strict';
/* Sales analytics: daily / weekly / monthly, mix, hourly and item performance. */

const SALES_GRAN = {mode: 'daily'};

function salesSeries(mode) {
  const rows = dailySeries();
  if (mode === 'daily') return rows.map((r) => ({label: dateLabel(r.date), value: r.value}));
  const buckets = new Map();
  for (const r of rows) {
    let key;
    if (mode === 'weekly') {
      const idx = Math.floor((dayDiff(D.period.start, r.date) - 1) / 7);
      key = 'Week ' + (idx + 1);
    } else {
      const [y, m] = r.date.split('-').map(Number);
      key = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB',
        {month: 'short', year: 'numeric'});
    }
    buckets.set(key, (buckets.get(key) || 0) + r.value);
  }
  return [...buckets.entries()].map(([label, value]) => ({label, value}));
}

const ITEM_COLS = [
  {key: 'name', label: 'Item', fmt: (v, r) => `<b>${esc(v)}</b>
    <div class="small muted">${esc(r.category)}</div>`},
  {key: 'type', label: 'Type', fmt: (v) => badge(v, v === 'Beverage' ? 'info' : 'gold')},
  {key: 'qty', label: 'Qty sold', num: true, fmt: (v) => num2(v)},
  {key: 'net', label: 'Net sales', num: true, fmt: (v) => inr0(v)},
  {key: 'share', label: 'Share', num: true, fmt: (v) => pct(v, 1)},
  {key: 'cost', label: 'Recipe cost', num: true, fmt: (v) => inr0(v)},
  {key: 'food_cost_pct', label: 'Cost %', num: true,
    fmt: (v) => badge(pct(v, 1), v > 35 ? 'bad' : v > 30 ? 'warn' : 'good')},
  {key: 'gross_profit', label: 'Gross profit', num: true, fmt: (v) => inr0(v)},
];

function viewSales(root) {
  const t = totals();
  const items = itemAgg().sort((a, b) => b.net - a.net);
  const itemRows = items.map((i) => ({...i, share: t.net ? (i.net / t.net) * 100 : 0}));
  const top = itemRows.slice(0, 10);
  const slow = [...itemRows].sort((a, b) => a.qty - b.qty).slice(0, 10);
  const payRows = [...new Set(payments().map((p) => p.payment_mode))].map((m) => {
    const rows = payments().filter((p) => p.payment_mode === m);
    return {mode: m, bills: rows.reduce((a, p) => a + p.bills, 0),
      net: rows.reduce((a, p) => a + p.net, 0)};
  }).sort((a, b) => b.net - a.net);
  const hourly = D.hourly.map((h) => ({label: String(h.hour).length > 2
    ? String(h.hour) : h.hour + ':00', value: h.net, bills: h.bills}));
  const catRows = D.categories.filter((c) => !state.cat || c.category === state.cat);
  const series = salesSeries(SALES_GRAN.mode);
  const best = [...items].sort((a, b) => b.gross_profit - a.gross_profit)[0];
  const worst = [...items].sort((a, b) => a.gross_profit - b.gross_profit)[0];

  root.innerHTML = `
  <section class="kpis">
    ${kpiCard({label: 'Net sales', value: inr0(t.net), icon: 'rupee', tone: 'gold',
      note: 'ex-GST line revenue'})}
    ${kpiCard({label: 'Food sales', value: inr0(t.food), icon: 'recipes',
      note: pct(t.net ? (t.food / t.net) * 100 : 0, 1) + ' of net sales'})}
    ${kpiCard({label: 'Beverage sales', value: inr0(t.bev), icon: 'costing',
      note: pct(t.net ? (t.bev / t.net) * 100 : 0, 1) + ' of net sales'})}
    ${kpiCard({label: 'Bills', value: num(t.bills), icon: 'cart',
      note: 'AOV ' + inr2(t.avg)})}
  </section>
  <section class="kpis" style="grid-template-columns:repeat(4,minmax(0,1fr))">
    ${kpiCard({label: 'Gross sales', value: inr0(t.gross), icon: 'trend'})}
    ${kpiCard({label: 'Discounts', value: inr0(t.discount), icon: 'rupee',
      note: pct(t.gross ? (t.discount / t.gross) * 100 : 0, 1) + ' of gross'})}
    ${kpiCard({label: 'GST collected', value: inr0(t.gst), icon: 'reports',
      note: '5% on taxable value'})}
    ${kpiCard({label: 'Gross profit', value: inr0(t.gp), icon: 'costing',
      note: pct(t.margin_pct, 1) + ' margin'})}
  </section>

  <div class="card" style="margin-bottom:14px">
    <div class="card-head">
      <div><h3>Sales over time</h3><div class="hint">Net sales grouped by ${
        SALES_GRAN.mode === 'daily' ? 'day' : SALES_GRAN.mode === 'weekly'
        ? 'calendar week (1–7, 8–14, …)' : 'month'}</div></div>
      <div class="row"><div class="seg" id="granSwitch">
        ${['daily', 'weekly', 'monthly'].map((m) => `<button data-gran="${m}"
          class="${SALES_GRAN.mode === m ? 'active' : ''}">${m[0].toUpperCase() + m.slice(1)}</button>`)
          .join('')}</div></div>
    </div>
    <div id="salesTrend">${lineChart('saTrend', {data: series, label: 'Net sales trend',
      fmt: (v) => compact(v)})}</div>
    <div class="row small muted" style="margin-top:8px">
      <span>Best gross profit: <b>${esc(best ? best.name : '–')}</b> ${inr0(best ? best.gross_profit : 0)}</span>
      <span class="spacer"></span>
      <span>Weakest: <b>${esc(worst ? worst.name : '–')}</b> ${inr0(worst ? worst.gross_profit : 0)}</span>
    </div>
  </div>

  <section class="grid split" style="margin-bottom:14px">
    <div class="card">
      <div class="card-head"><div><h3>Top 10 items</h3>
        <div class="hint">Ranked by net sales</div></div></div>
      ${barList(top.map((i) => ({label: i.name, value: i.net})), {highlight: true})}
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Slow movers</h3>
        <div class="hint">Lowest quantity sold — review menu or pricing</div></div></div>
      ${barList(slow.map((i) => ({label: i.name, value: i.qty})),
        {fmt: (v) => num2(v) + ' sold', color: 'var(--warn)'})}
    </div>
  </section>

  <section class="grid split" style="margin-bottom:14px">
    <div class="card">
      <div class="card-head"><div><h3>Sales by hour</h3>
        <div class="hint">From bill timestamps for the full sample month</div></div></div>
      ${columnChart('saHour', {data: hourly, label: 'Sales by hour', fmt: (v) => inr0(v)})}
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Category revenue</h3>
        <div class="hint">Net sales by menu category</div></div></div>
      <div class="tbl-holder">${dataTable('saCat', CAT_COLS, catRows.map((c) => ({
        category: c.category, type: c.item_type, net: c.net_sales, share: c.share_pct})),
        {pageSize: 10})}</div>
    </div>
  </section>

  <div class="section-title"><h2>Item performance</h2><div class="line"></div></div>
  <div class="card">
    <div class="card-head"><div><h3>${num(itemRows.length)} items sold in range</h3>
      <div class="hint">Sort any column, filter from the toolbar, export to CSV</div></div>
      <button class="btn btn-ghost btn-sm" id="itemsCsv">${svg('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>')}<span>Export items</span></button>
    </div>
    <div class="tbl-holder">${dataTable('saItems', ITEM_COLS, itemRows, {pageSize: 12})}</div>
  </div>

  <div class="section-title"><h2>Payments</h2><div class="line"></div></div>
  <div class="card">
    <div class="tbl-holder">${dataTable('saPay', [
      {key: 'mode', label: 'Channel'},
      {key: 'bills', label: 'Bills', num: true, fmt: (v) => num(v)},
      {key: 'net', label: 'Value', num: true, fmt: (v) => inr2(v)},
      {key: 'share', label: 'Share', num: true, fmt: (v) => pct(v, 1)},
    ], payRows.map((p) => ({...p, share: t.net ? (p.net / t.net) * 100 : 0})), {pageSize: 6})}</div>
  </div>`;

  bindTables(root);
  bindLineChart(root, 'saTrend', {fmt: (v) => inr0(v)});
  $('#itemsCsv', root).addEventListener('click', () => {
    downloadCSV(`versova_items_${state.from}_${state.to}.csv`,
      ['Item', 'Category', 'Type', 'Qty', 'NetSales', 'Share%', 'RecipeCost', 'Cost%', 'GrossProfit'],
      itemRows.map((i) => [i.name, i.category, i.type, i.qty.toFixed(2), i.net.toFixed(2),
        i.share.toFixed(2), i.cost.toFixed(2), i.food_cost_pct.toFixed(2),
        i.gross_profit.toFixed(2)]));
    toast('Item report exported');
  });
  $$('#granSwitch button', root).forEach((b) => b.addEventListener('click', () => {
    SALES_GRAN.mode = b.dataset.gran;
    const series = salesSeries(SALES_GRAN.mode);
    $('#salesTrend', root).innerHTML = lineChart('saTrend', {data: series,
      label: 'Net sales trend', fmt: (v) => compact(v)});
    bindLineChart(root, 'saTrend', {fmt: (v) => inr0(v)});
    $$('#granSwitch button', root).forEach((x) => x.classList.toggle('active', x === b));
  }));
}
