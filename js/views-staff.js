'use strict';
/* Staff management and recruitment. Attendance % = present / (present + absent + half day). */

function attendanceSeries() {
  const byDate = new Map();
  for (const a of attendanceIn()) {
    if (!['Present', 'Absent', 'Half Day'].includes(a.status)) continue;
    const row = byDate.get(a.date) || {present: 0, total: 0};
    row.total += 1;
    if (a.status === 'Present') row.present += 1;
    byDate.set(a.date, row);
  }
  return [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, r]) => ({date, value: r.total ? (r.present / r.total) * 100 : 0}));
}

function viewStaff(root) {
  const S = D.staff;
  const att = attendanceIn();
  const present = att.filter((a) => a.status === 'Present').length;
  const counted = att.filter((a) => ['Present', 'Absent', 'Half Day'].includes(a.status)).length;
  const attPct = counted ? (present / counted) * 100 : S.attendance_pct;
  const byDept = {};
  for (const a of att) {
    if (!['Present', 'Absent', 'Half Day'].includes(a.status)) continue;
    const d = byDept[a.department] || {present: 0, total: 0};
    d.total += 1;
    if (a.status === 'Present') d.present += 1;
    byDept[a.department] = d;
  }
  const deptRows = Object.entries(byDept).map(([department, r]) => ({department,
    records: r.total, present: r.present, pct: r.total ? (r.present / r.total) * 100 : 0}));
  const empRows = D.employees;
  const docsOk = empRows.filter((e) => e.documents_complete === true
    || String(e.documents_complete).toLowerCase() === 'yes').length;

  root.innerHTML = `
  <section class="kpis">
    ${kpiCard({label: 'Headcount', value: num(S.headcount), icon: 'staff', tone: 'gold',
      note: S.active + ' active'})}
    ${kpiCard({label: 'Attendance', value: pct(attPct, 1), icon: 'check',
      note: num(att.length) + ' records in range'})}
    ${kpiCard({label: 'Overtime hours', value: num2(S.overtime_hours), icon: 'clock',
      note: 'from attendance register'})}
    ${kpiCard({label: 'Document gaps', value: num(S.document_gaps), icon: 'alert',
      note: docsOk + ' employees complete'})}
  </section>

  <section class="grid split" style="margin-bottom:14px">
    <div class="card">
      <div class="card-head"><div><h3>Daily attendance</h3>
        <div class="hint">Share of staff present each day</div></div></div>
      ${lineChart('stAtt', {data: attendanceSeries(), color: 'var(--teal)',
        label: 'Daily attendance', fmt: (v) => v.toFixed(0) + '%'})}
      <div class="small muted" style="margin-top:6px">
        Present ${num(att.filter((a) => a.status === 'Present').length)}
        · Absent ${num(att.filter((a) => a.status === 'Absent').length)}
        · Half day ${num(att.filter((a) => a.status === 'Half Day').length)}</div>
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Attendance by department</h3>
        <div class="hint">Selected period</div></div></div>
      <div class="tbl-holder">${dataTable('stDept', [
        {key: 'department', label: 'Department'},
        {key: 'records', label: 'Records', num: true, fmt: (v) => num(v)},
        {key: 'present', label: 'Present', num: true, fmt: (v) => num(v)},
        {key: 'pct', label: 'Attendance', num: true,
          fmt: (v) => badge(pct(v, 1), v >= 95 ? 'good' : v >= 90 ? 'warn' : 'bad')},
      ], deptRows.sort((a, b) => b.pct - a.pct), {pageSize: 8})}</div>
    </div>
  </section>

  <div class="section-title"><h2>Employee directory</h2><div class="line"></div></div>
  <div class="card">
    <div class="card-head"><div><h3>${num(empRows.length)} employees</h3>
      <div class="hint">Salary fields are not part of this public sample export</div></div></div>
    <div class="tbl-holder">${dataTable('stEmp', [
      {key: 'name', label: 'Employee', fmt: (v, r) => `<b>${esc(v)}</b>
        <div class="small muted">${esc(r.emp_id)}</div>`},
      {key: 'designation', label: 'Designation'},
      {key: 'department', label: 'Department'},
      {key: 'date_of_joining', label: 'Joined', fmt: (v) => dateLong(v)},
      {key: 'default_shift', label: 'Shift'},
      {key: 'fssai_training', label: 'FoSTaC', fmt: (v) => badge(v === true || v === 'Yes'
        ? 'Trained' : 'Due', v === true || v === 'Yes' ? 'good' : 'warn')},
      {key: 'status', label: 'Status', fmt: (v) => badge(v)},
    ], empRows, {pageSize: 10, exportName: 'versova_employees'})}</div>
  </div>

  <div class="section-title"><h2>Attendance register</h2><div class="line"></div></div>
  <div class="card">
    <div class="tbl-holder">${dataTable('stAttReg', [
      {key: 'date', label: 'Date', fmt: (v) => dateLabel(v)},
      {key: 'emp_id', label: 'Employee ID'},
      {key: 'name', label: 'Name'},
      {key: 'department', label: 'Department'},
      {key: 'shift', label: 'Shift'},
      {key: 'status', label: 'Status', fmt: (v) => badge(v)},
    ], att, {pageSize: 12, exportName: 'versova_attendance'})}</div>
  </div>`;

  bindTables(root);
  bindLineChart(root, 'stAtt', {fmt: (v) => v.toFixed(0) + '%'});
}

function viewRecruitment(root) {
  const cand = D.candidates;
  const S = D.staff;
  const rate = S.candidates ? (S.selected / S.candidates) * 100 : 0;
  const byStatus = cand.reduce((acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc; }, {});
  const bySource = cand.reduce((acc, c) => { acc[c.source] = (acc[c.source] || 0) + 1; return acc; }, {});
  const open = cand.filter((c) => /pending|interview/i.test(c.status));

  root.innerHTML = `
  <section class="kpis">
    ${kpiCard({label: 'Candidates', value: num(S.candidates), icon: 'recruitment', tone: 'gold',
      note: num(open.length) + ' still in pipeline'})}
    ${kpiCard({label: 'Selected', value: num(S.selected), icon: 'check',
      note: pct(rate, 1) + ' selection rate'})}
    ${kpiCard({label: 'On hold', value: num(S.on_hold), icon: 'clock', note: 'awaiting decision'})}
    ${kpiCard({label: 'Open positions', value: num(D.recruitment.length), icon: 'users',
      note: 'positions with candidates'})}
  </section>

  <section class="grid split" style="margin-bottom:14px">
    <div class="card">
      <div class="card-head"><div><h3>Hiring funnel by position</h3>
        <div class="hint">Candidates, interviews and outcomes</div></div></div>
      <div class="tbl-holder">${dataTable('recFunnel', [
        {key: 'position', label: 'Position'},
        {key: 'candidates', label: 'Candidates', num: true, fmt: (v) => num(v)},
        {key: 'interviewed', label: 'Interviewed', num: true, fmt: (v) => num(v)},
        {key: 'selected', label: 'Selected', num: true, fmt: (v) => num(v)},
        {key: 'rejected', label: 'Rejected', num: true, fmt: (v) => num(v)},
        {key: 'pending', label: 'Pending', num: true, fmt: (v) => num(v)},
        {key: 'selection_rate_pct', label: 'Rate', num: true, fmt: (v) => pct(v, 0)},
      ], D.recruitment, {pageSize: 10, exportName: 'versova_recruitment'})}</div>
    </div>
    <div class="stack">
      <div class="card">
        <div class="card-head"><div><h3>Pipeline status</h3>
          <div class="hint">All candidates in the tracker</div></div></div>
        ${donut(Object.entries(byStatus).map(([label, value]) => ({label, value})),
        {caption: 'candidates', label: 'Candidate status split', fmt: (v) => num(v)})}
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Source mix</h3>
          <div class="hint">Where applicants came from</div></div></div>
        ${barList(Object.entries(bySource).map(([label, value]) => ({label, value}))
        .sort((a, b) => b.value - a.value), {fmt: (v) => num(v) + ' candidates'})}
      </div>
    </div>
  </section>

  <div class="section-title"><h2>Candidate tracker</h2><div class="line"></div></div>
  <div class="card">
    <div class="tbl-holder">${dataTable('recCand', [
      {key: 'name', label: 'Candidate', fmt: (v, r) => `<b>${esc(v)}</b>
        <div class="small muted">${esc(r.candidate_id)}</div>`},
      {key: 'position', label: 'Position'},
      {key: 'source', label: 'Source'},
      {key: 'applied_date', label: 'Applied', fmt: (v) => dateLabel(v)},
      {key: 'interview_date', label: 'Interview', fmt: (v) => v ? dateLabel(v) : '—'},
      {key: 'experience_years', label: 'Experience', num: true, fmt: (v) => num2(v) + ' yrs'},
      {key: 'status', label: 'Status', fmt: (v) => badge(v)},
    ], cand, {pageSize: 12, exportName: 'versova_candidates'})}</div>
  </div>`;

  bindTables(root);
}
