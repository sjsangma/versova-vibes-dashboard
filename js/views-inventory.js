'use strict';
/* Inventory: valuation, reorder, expiry, ledger movements, wastage and cold-chain logs. */

const INV_COLS = [
  {key: 'ingredient', label: 'Ingredient', fmt: (v, r) => `<b>${esc(v)}</b>
    <div class="small muted">${esc(r.category)} · ${esc(r.base_unit)}</div>`},
  {key: 'opening_qty', label: 'Opening', num: true, fmt: (v) => num2(v)},
  {key: 'purchase_qty', label: 'Purchased', num: true, fmt: (v) => num2(v)},
  {key: 'consumption_qty', label: 'Consumed', num: true, fmt: (v) => num2(v)},
  {key: 'wastage_qty', label: 'Wastage', num: true, fmt: (v) => num2(v)},
  {key: 'book_closing', label: 'Book', num: true, fmt: (v) => num2(v)},
  {key: 'physical_qty', label: 'Physical', num: true, fmt: (v) => num2(v)},
  {key: 'variance_qty', label: 'Variance', num: true,
    fmt: (v) => `<span style="color:${Math.abs(v) > 0.5 ? 'var(--bad)' : 'var(--muted)'}">${num2(v)}</span>`},
  {key: 'closing_value', label: 'Value', num: true, fmt: (v) => inr0(v)},
  {key: 'status', label: 'Status', fmt: (v) => badge(v)},
];

function viewInventory(root) {
  const S = D.inventory_summary;
  const reg = D.inventory_register;
  const reorder = D.reorder.slice().sort((a, b) => b.order_value - a.order_value);
  const expiry = D.expiry.slice().sort((a, b) => a.days_cover - b.days_cover);
  const warm = D.wastage.slice().sort((a, b) => b.value - a.value);
  const movers = D.movements.slice(-140).reverse();
  const tempDaily = D.temperature_daily.map((d) => ({date: d.date, value: d.min_c,
    label: dateLabel(d.date)}));

  root.innerHTML = `
  <section class="kpis">
    ${kpiCard({label: 'Inventory valuation', value: inr0(S.stock_value), icon: 'box', tone: 'gold',
      note: num(S.ingredients) + ' ingredients at physical count'})}
    ${kpiCard({label: 'Items to reorder', value: num(S.items_to_reorder), icon: 'alert',
      note: inr0(S.reorder_value) + ' suggested order value'})}
    ${kpiCard({label: 'Out of stock', value: num(S.out_of_stock), icon: 'box',
      note: num(S.low_stock_alerts) + ' total alerts'})}
    ${kpiCard({label: 'Wastage value', value: inr0(D.wastage_summary.value), icon: 'leaf',
      note: D.wastage_summary.entries + ' entries · top: ' + D.wastage_summary.top_reason})}
  </section>

  <section class="grid split" style="margin-bottom:14px">
    <div class="card">
      <div class="card-head"><div><h3>Reorder list</h3>
        <div class="hint">Physical stock at or below reorder level, ranked by order value</div></div>
        <span class="badge warn">${num(reorder.length)} items</span></div>
      <div class="tbl-holder">${dataTable('invReorder', [
        {key: 'ingredient', label: 'Ingredient', fmt: (v, r) => `<b>${esc(v)}</b>
          <div class="small muted">${esc(r.category)}</div>`},
        {key: 'physical_qty', label: 'On hand', num: true, fmt: (v, r) => `${num2(v)} ${esc(r.base_unit)}`},
        {key: 'reorder_level', label: 'Reorder at', num: true, fmt: (v) => num2(v)},
        {key: 'shortfall', label: 'Shortfall', num: true, fmt: (v) => num2(v)},
        {key: 'order_value', label: 'Order value', num: true, fmt: (v) => inr0(v)},
        {key: 'stock_status', label: 'Status', fmt: (v) => badge(v)},
      ], reorder, {pageSize: 8, exportName: 'versova_reorder'})}</div>
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Expiry watch</h3>
        <div class="hint">Perishables to use first (FEFO), by days of cover</div></div>
        <span class="badge bad">${num(expiry.length)} items</span></div>
      <div class="tbl-holder">${dataTable('invExpiry', [
        {key: 'ingredient', label: 'Ingredient', fmt: (v, r) => `<b>${esc(v)}</b>
          <div class="small muted">${esc(r.category)}</div>`},
        {key: 'physical_qty', label: 'On hand', num: true, fmt: (v, r) => `${num2(v)} ${esc(r.base_unit)}`},
        {key: 'days_cover', label: 'Days cover', num: true,
          fmt: (v) => badge(num(v) + ' d', v <= 10 ? 'bad' : v <= 20 ? 'warn' : 'muted')},
        {key: 'advice', label: 'Action', fmt: (v) => esc(v)},
      ], expiry, {pageSize: 8, exportName: 'versova_expiry'})}</div>
    </div>
  </section>

  <section class="grid g3" style="margin-bottom:14px">
    <div class="card">
      <div class="card-head"><div><h3>Stock variance</h3>
        <div class="hint">Physical count vs ledger closing</div></div></div>
      <div class="row" style="gap:16px">${ring(Math.max(0, 100 - Math.abs(S.variance_value)
        / Math.max(1, S.stock_value) * 100), 'accuracy', 'var(--teal)')}
        <div class="stack small">
          <span>${num(S.variance_items)} items differ</span>
          <span class="muted">Net variance ${inr2(S.variance_value)}</span>
          <span class="muted">Ledger gaps: ${num(S.ledger_gap_items)}</span></div></div>
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Wastage drivers</h3>
        <div class="hint">Value lost by reason</div></div></div>
      ${barList(Object.entries(D.wastage.reduce((acc, w) => {
        acc[w.reason] = (acc[w.reason] || 0) + w.value; return acc;
      }, {})).map(([label, value]) => ({label, value})).sort((a, b) => b.value - a.value),
      {color: 'var(--warn)'})}
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Cold chain</h3>
        <div class="hint">Minimum fridge / freezer reading per day (°C)</div></div></div>
      ${lineChart('invTemp', {data: tempDaily, height: 170, color: 'var(--teal)',
        label: 'Daily minimum temperature', fmt: (v) => v.toFixed(1) + '°'})}
      <div class="small muted" style="margin-top:6px">
        ${num(D.hygiene_summary.temperature_readings)} readings ·
        ${num(D.hygiene_summary.temperature_fails)} outside range</div>
    </div>
  </section>

  <div class="section-title"><h2>Stock register</h2><div class="line"></div></div>
  <div class="card">
    <div class="card-head"><div><h3>${num(reg.length)} SKUs</h3>
      <div class="hint">Opening + purchases − consumption − wastage ± adjustments = book closing;
        physical count is the verified figure</div></div>
      <button class="btn btn-ghost btn-sm" id="regCsv">${svg('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>')}<span>Export register</span></button></div>
    <div class="tbl-holder">${dataTable('invReg', INV_COLS, reg, {pageSize: 12})}</div>
  </div>

  <section class="grid split" style="margin-top:14px">
    <div class="card">
      <div class="card-head"><div><h3>Recent stock movements</h3>
        <div class="hint">Last 140 ledger entries — search from the toolbar</div></div></div>
      <div class="tbl-holder">${dataTable('invMoves', [
        {key: 'date', label: 'Date', fmt: (v) => dateLabel(v)},
        {key: 'ingredient', label: 'Ingredient'},
        {key: 'reference', label: 'Reference'},
        {key: 'qty_in', label: 'In', num: true, fmt: (v) => v ? num2(v) : '—'},
        {key: 'qty_out', label: 'Out', num: true, fmt: (v) => v ? num2(v) : '—'},
      ], movers, {pageSize: 8, exportName: 'versova_movements'})}</div>
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Wastage register</h3>
        <div class="hint">${num(D.wastage.length)} entries · ${inr0(D.wastage_summary.value)} total
          · ${D.wastage_summary.anomalies} anomalies flagged by the 5× median rule</div></div></div>
      <div class="tbl-holder">${dataTable('invWaste', [
        {key: 'date', label: 'Date', fmt: (v) => dateLabel(v)},
        {key: 'ingredient', label: 'Ingredient'},
        {key: 'reason', label: 'Reason', fmt: (v) => badge(v)},
        {key: 'qty', label: 'Qty', num: true, fmt: (v, r) => `${num2(v)} ${esc(r.unit)}`},
        {key: 'value', label: 'Value', num: true, fmt: (v) => inr2(v)},
      ], warm, {pageSize: 8, exportName: 'versova_wastage'})}</div>
    </div>
  </section>`;

  bindTables(root);
  bindLineChart(root, 'invTemp', {fmt: (v) => v.toFixed(1) + '°C'});
  $('#regCsv', root).addEventListener('click', () => {
    downloadCSV('versova_stock_register.csv', ['Ingredient', 'Category', 'Unit', 'Opening',
      'Purchases', 'Consumption', 'Wastage', 'Adjustment', 'BookClosing', 'Physical', 'Variance',
      'Rate', 'Value', 'ReorderLevel', 'Status'],
    reg.map((r) => [r.ingredient, r.category, r.base_unit, r.opening_qty, r.purchase_qty,
      r.consumption_qty, r.wastage_qty, r.adjustment_qty, r.book_closing, r.physical_qty,
      r.variance_qty, r.rate, r.closing_value, r.reorder_level, r.status]));
    toast('Stock register exported');
  });
}
