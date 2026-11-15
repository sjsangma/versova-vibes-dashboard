'use strict';
/* Marketing: campaigns, scheduling and engagement from the social media calendar. */

function viewMarketing(root) {
  const M = D.marketing;
  const posts = D.posts.slice().sort((a, b) => b.date.localeCompare(a.date));
  const campaigns = D.campaigns.slice().sort((a, b) => b.start_date.localeCompare(a.start_date));
  const engagementOf = (p) => p.reach ? ((p.likes + p.comments + p.shares + p.saves) / p.reach)
    * 100 : 0;
  const byChannel = {};
  for (const p of posts) {
    const c = byChannel[p.channel] || {reach: 0, engagement: 0, posts: 0, enquiries: 0};
    c.posts += 1; c.reach += p.reach; c.enquiries += p.enquiries;
    c.engagement += p.likes + p.comments + p.shares + p.saves;
    byChannel[p.channel] = c;
  }
  const byType = {};
  for (const p of posts) {
    const t = byType[p.post_type] || {posts: 0, reach: 0, engagement: 0};
    t.posts += 1; t.reach += p.reach;
    t.engagement += p.likes + p.comments + p.shares + p.saves;
    byType[p.post_type] = t;
  }
  const typeRows = Object.entries(byType).map(([label, v]) => ({label,
    value: v.reach ? (v.engagement / v.reach) * 100 : 0, posts: v.posts}))
    .sort((a, b) => b.value - a.value);

  root.innerHTML = `
  <section class="kpis">
    ${kpiCard({label: 'Campaign spend', value: inr0(M.spend), icon: 'megaphone', tone: 'gold',
      note: pct(M.budget ? (M.spend / M.budget) * 100 : 0, 1) + ' of ' + inr0(M.budget)})}
    ${kpiCard({label: 'Reach', value: num(M.reach), icon: 'share',
      note: num(M.posts) + ' posts published'})}
    ${kpiCard({label: 'Engagement rate', value: pct(M.engagement_rate_pct), icon: 'star',
      note: 'likes, comments, saves and shares / reach'})}
    ${kpiCard({label: 'Enquiries', value: num(M.enquiries), icon: 'users',
      note: inr2(M.cost_per_enquiry) + ' per enquiry'})}
  </section>

  <section class="grid split" style="margin-bottom:14px">
    <div class="card">
      <div class="card-head"><div><h3>Channel mix</h3>
        <div class="hint">Reach by approved channel</div></div></div>
      ${donut(Object.entries(byChannel).map(([label, v]) => ({label, value: v.reach})),
      {caption: 'reach', label: 'Reach by channel', fmt: (v) => num(v)})}
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Format performance</h3>
        <div class="hint">Engagement rate by content type</div></div></div>
      ${barList(typeRows.map((t) => ({label: t.label, value: t.value})),
      {fmt: (v) => pct(v, 2)})}
      <div class="small muted" style="margin-top:10px">
        ${num(M.consenting_customers)} customers have opted in to promotional messaging</div>
    </div>
  </section>

  <div class="section-title"><h2>Campaigns</h2><div class="line"></div></div>
  <div class="card">
    <div class="card-head"><div><h3>${num(campaigns.length)} campaigns</h3>
      <div class="hint">Budget consumption and status</div></div>
      <button class="btn btn-ghost btn-sm" id="mkCsv">${svg('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>')}<span>Export</span></button></div>
    <div class="tbl-holder">${dataTable('mkCamp', [
      {key: 'name', label: 'Campaign', fmt: (v, r) => `<b>${esc(v)}</b>
        <div class="small muted">${esc(r.type)} · ${esc(r.channel)}</div>`},
      {key: 'start_date', label: 'From', fmt: (v) => dateLabel(v)},
      {key: 'end_date', label: 'To', fmt: (v) => dateLabel(v)},
      {key: 'budget', label: 'Budget', num: true, fmt: (v) => inr0(v)},
      {key: 'amount_spent', label: 'Spent', num: true, fmt: (v) => inr0(v)},
      {key: 'budget_used_pct', label: 'Used', num: true,
        fmt: (v) => badge(pct(v, 0), v > 100 ? 'bad' : v > 85 ? 'warn' : 'good')},
      {key: 'status', label: 'Status', fmt: (v) => badge(v)},
    ], campaigns, {pageSize: 10})}</div>
  </div>

  <div class="section-title"><h2>Content calendar</h2><div class="line"></div></div>
  <div class="card">
    <div class="card-head"><div><h3>${num(posts.length)} posts</h3>
      <div class="hint">Scheduled and published posts with engagement. Nothing is published
        automatically — the calendar is the approval record.</div></div></div>
    <div class="tbl-holder">${dataTable('mkPosts', [
      {key: 'date', label: 'Date', fmt: (v) => dateLabel(v)},
      {key: 'channel', label: 'Channel'},
      {key: 'post_type', label: 'Format', fmt: (v) => badge(v, 'muted')},
      {key: 'caption', label: 'Caption', fmt: (v) => `<span class="small">${esc(v)}</span>`},
      {key: 'reach', label: 'Reach', num: true, fmt: (v) => num(v)},
      {key: 'engagement', label: 'Engagement', num: true, fmt: (v, r) => num(r.likes + r.comments
        + r.shares + r.saves)},
      {key: 'eng_pct', label: 'Rate', num: true, fmt: (v) => pct(v, 2)},
      {key: 'enquiries', label: 'Enquiries', num: true, fmt: (v) => num(v)},
      {key: 'status', label: 'Status', fmt: (v) => badge(v)},
    ], posts.map((p) => ({...p, eng_pct: engagementOf(p)})),
    {pageSize: 12, exportName: 'versova_marketing_posts'})}</div>
  </div>

  <div class="notice" style="margin-top:14px">
    ${svg('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>')}
    <span>Broadcasts to customers require recorded consent and must follow each platform's
      messaging policy. This dashboard reports the calendar; it does not send messages.</span></div>`;

  bindTables(root);
  $('#mkCsv', root).addEventListener('click', () => {
    downloadCSV('versova_campaigns.csv', ['Campaign', 'Type', 'Channel', 'Start', 'End',
      'Budget', 'Spent', 'Status'],
    campaigns.map((c) => [c.name, c.type, c.channel, c.start_date, c.end_date, c.budget,
      c.amount_spent, c.status]));
    toast('Campaign report exported');
  });
}
