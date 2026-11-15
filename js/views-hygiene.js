'use strict';
/* FSSAI hygiene and food safety. Completion of a checklist is evidence, not legal compliance. */

function viewHygiene(root) {
  const H = D.hygiene_summary;
  const items = D.hygiene_items;
  const capa = D.capa.slice().sort((a, b) => (a.overdue === b.overdue ? 0 : a.overdue ? -1 : 1));
  const cleaning = D.cleaning.slice().reverse();
  const days = D.hygiene_days || [];
  const tempDaily = (D.temperature_daily || []).map((d) => ({date: d.date,
    value: d.min_c, label: (d.date || '').slice(8)}));
  const areas = (D.hygiene_areas || []).map((a) => ({area: a.area, checks: a.checks,
    pass: a.passed, pct: a.pass_pct})).sort((a, b) => a.pct - b.pct);

  root.innerHTML = `
  <section class="kpis">
    ${kpiCard({label: 'Checklist pass rate', value: pct(H.pass_pct, 1), icon: 'shield',
      tone: 'gold', note: num(H.checks) + ' checks · ' + num(H.failed_checks) + ' failed'})}
    ${kpiCard({label: 'Temperature readings', value: num(H.temperature_readings), icon: 'temp',
      note: num(H.temperature_fails) + ' outside the safe range'})}
    ${kpiCard({label: 'Open corrective actions', value: num(H.open_actions), icon: 'alert',
      note: num(H.overdue_actions) + ' overdue'})}
    ${kpiCard({label: 'Licence valid to', value: dateLong(H.licence.valid_upto), icon: 'reports',
      note: H.licence.licence_type + ' · ' + num(H.licence.days_to_expiry) + ' days left'})}
  </section>

  <section class="grid split" style="margin-bottom:14px">
    <div class="card">
      <div class="card-head"><div><h3>Daily checklist completion</h3>
        <div class="hint">Share of checks passed per day</div></div></div>
      ${lineChart('hyDays', {data: days.map((d) => ({label: (d.date || '').slice(8),
        value: d.completion_pct})), color: 'var(--good)', label: 'Daily checklist completion',
        fmt: (v) => v.toFixed(0) + '%'})}
    </div>
    <div class="card">
      <div class="card-head"><div><h3>By area</h3>
        <div class="hint">Lowest performing areas first</div></div></div>
      <div class="tbl-holder">${dataTable('hyAreas', [
        {key: 'area', label: 'Area'},
        {key: 'checks', label: 'Checks', num: true, fmt: (v) => num(v)},
        {key: 'pass', label: 'Passed', num: true, fmt: (v) => num(v)},
        {key: 'pct', label: 'Pass rate', num: true,
          fmt: (v) => badge(pct(v, 1), v >= 95 ? 'good' : v >= 85 ? 'warn' : 'bad')},
      ], areas, {pageSize: 9})}</div>
    </div>
  </section>

  <section class="grid split" style="margin-bottom:14px">
    <div class="card">
      <div class="card-head"><div><h3>Cold chain by equipment</h3>
        <div class="hint">Readings, excursions and range</div></div></div>
      <div class="tbl-holder">${dataTable('hyTemp', [
        {key: 'equipment', label: 'Equipment'},
        {key: 'readings', label: 'Readings', num: true, fmt: (v) => num(v)},
        {key: 'min_c', label: 'Min °C', num: true, fmt: (v) => num2(v)},
        {key: 'avg_c', label: 'Avg °C', num: true, fmt: (v) => num2(v)},
        {key: 'max_c', label: 'Max °C', num: true, fmt: (v) => num2(v)},
        {key: 'fails', label: 'Excursions', num: true,
          fmt: (v) => badge(num(v), v > 0 ? 'warn' : 'good')},
      ], D.temperatures, {pageSize: 8, exportName: 'versova_temperatures'})}</div>
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Corrective actions</h3>
        <div class="hint">Open items need an owner and a closure date</div></div></div>
      <div class="tbl-holder">${dataTable('hyCapa', [
        {key: 'action_id', label: 'ID'},
        {key: 'issue', label: 'Issue', fmt: (v) => `<span class="small">${esc(v)}</span>`},
        {key: 'severity', label: 'Severity', fmt: (v) => badge(v)},
        {key: 'due_date', label: 'Due', fmt: (v) => dateLabel(v)},
        {key: 'status', label: 'Status', fmt: (v) => badge(v)},
      ], capa, {pageSize: 8, exportName: 'versova_capa'})}</div>
    </div>
  </section>

  <div class="section-title"><h2>Checklist register</h2><div class="line"></div></div>
  <div class="card">
    <div class="card-head"><div><h3>${num(items.length)} checks</h3>
      <div class="hint">Digital record of date, shift, area, result and responsible employee</div></div>
      <button class="btn btn-ghost btn-sm" id="hyCsv">${svg('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>')}<span>Export</span></button></div>
    <div class="tbl-holder">${dataTable('hyItems', [
      {key: 'date', label: 'Date', fmt: (v) => dateLabel(v)},
      {key: 'shift', label: 'Shift'},
      {key: 'area', label: 'Area'},
      {key: 'checklist_item', label: 'Check', fmt: (v) => `<span class="small">${esc(v)}</span>`},
      {key: 'result', label: 'Result', fmt: (v) => badge(v)},
      {key: 'checked_by', label: 'Checked by'},
    ], items, {pageSize: 12})}</div>
  </div>

  <section class="grid split" style="margin-top:14px">
    <div class="card">
      <div class="card-head"><div><h3>Cleaning schedule</h3>
        <div class="hint">${num(cleaning.length)} records in range</div></div></div>
      <div class="tbl-holder">${dataTable('hyClean', [
        {key: 'date', label: 'Date', fmt: (v) => dateLabel(v)},
        {key: 'task', label: 'Task', fmt: (v) => `<span class="small">${esc(v)}</span>`},
        {key: 'frequency', label: 'Frequency'},
        {key: 'status', label: 'Status', fmt: (v) => badge(v)},
      ], cleaning, {pageSize: 8, exportName: 'versova_cleaning'})}</div>
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Licence and training</h3>
        <div class="hint">Renewal reminders from the compliance register</div></div></div>
      <dl class="kv">
        <dt>Licence number</dt><dd class="mono">${esc(H.licence.licence_no)}</dd>
        <dt>Type</dt><dd>${esc(H.licence.licence_type)}</dd>
        <dt>Issued</dt><dd>${dateLong(H.licence.issued_on)}</dd>
        <dt>Valid until</dt><dd>${dateLong(H.licence.valid_upto)}</dd>
        <dt>FoSTaC supervisor</dt><dd>${esc(H.licence.fostac_supervisor)}</dd>
        <dt>Next training due</dt><dd>${dateLong(H.licence.next_training_due)}</dd>
        <dt>Renewal reminder</dt><dd>${dateLong(H.licence.renewal_reminder)}</dd>
      </dl>
      <div class="notice" style="margin-top:12px">
        ${svg('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>')}
        <span>Records are evidence of monitoring only. Confirm current FSSAI requirements and
          inspection checklists before treating any checklist as proof of compliance.</span></div>
    </div>
  </section>`;

  bindTables(root);
  bindLineChart(root, 'hyDays', {fmt: (v) => v.toFixed(0) + '%'});
  $('#hyCsv', root).addEventListener('click', () => {
    downloadCSV('versova_hygiene_checklist.csv', ['Date', 'Shift', 'Area', 'Check', 'Result',
      'CheckedBy'],
    items.map((r) => [r.date, r.shift, r.area, r.checklist_item, r.result, r.checked_by]));
    toast('Hygiene register exported');
  });
}
