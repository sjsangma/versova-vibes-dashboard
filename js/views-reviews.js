'use strict';
/* Google review management. Replies are drafts only: nothing is published from here. */

function reviewThemes(rows) {
  const map = new Map();
  for (const r of rows) {
    if (r.sentiment !== 'Negative' && !r.complaint_category) continue;
    const key = r.complaint_category || 'General';
    const row = map.get(key) || {theme: key, reviews: 0, sum: 0, open: 0};
    row.reviews += 1; row.sum += r.rating;
    if (r.response_status !== 'Replied' && r.response_status !== 'Responded') row.open += 1;
    map.set(key, row);
  }
  return [...map.values()].map((r) => ({...r, avg: r.sum / r.reviews,
    share: rows.length ? (r.reviews / rows.length) * 100 : 0}))
    .sort((a, b) => b.reviews - a.reviews);
}

function draftReply(r) {
  const name = r.customer_name ? r.customer_name.split(' ')[0] : 'there';
  if (r.rating >= 4) {
    return `Hi ${name}, thank you so much for the kind words! We are delighted you enjoyed your visit ` +
      `to Versova Vibes Cafe & Bar and have shared your feedback with the whole team. ` +
      `We look forward to welcoming you back soon.`;
  }
  const area = (r.complaint_category || 'your experience').toLowerCase();
  return `Hi ${name}, thank you for taking the time to review us and we are sorry that ${area} ` +
    `fell short of expectations. Your feedback has been passed to our restaurant manager and we ` +
    `are reviewing it with the team this week. We would value the chance to make it right — ` +
    `please write to us at guestcare@versovavibes.example and we will follow up personally.`;
}

function viewReviews(root) {
  const rows = reviewsIn().slice().sort((a, b) => b.date.localeCompare(a.date));
  const summary = D.review_summary;
  const avg = rows.length ? rows.reduce((a, r) => a + r.rating, 0) / rows.length : 0;
  const pending = rows.filter((r) => r.response_status !== 'Replied'
    && r.response_status !== 'Responded').length;
  const negative = rows.filter((r) => r.rating <= 2).length;
  const dist = [5, 4, 3, 2, 1].map((rating) => ({rating,
    count: rows.filter((r) => r.rating === rating).length}));
  const themes = reviewThemes(rows);
  const monthly = new Map();
  for (const r of rows) {
    const key = r.date.slice(0, 7);
    const row = monthly.get(key) || {count: 0, sum: 0};
    row.count += 1; row.sum += r.rating;
    monthly.set(key, row);
  }

  root.innerHTML = `
  <section class="kpis">
    ${kpiCard({label: 'Average rating', value: avg.toFixed(2) + ' ★', icon: 'star', tone: 'gold',
      note: num(rows.length) + ' reviews in range'})}
    ${kpiCard({label: 'Five-star share', value: pct(rows.length
      ? rows.filter((r) => r.rating === 5).length / rows.length * 100 : 0, 1), icon: 'star',
      note: 'of reviews in range'})}
    ${kpiCard({label: 'Awaiting reply', value: num(pending), icon: 'clock',
      note: 'drafts require management approval'})}
    ${kpiCard({label: 'Negative reviews', value: num(negative), icon: 'alert',
      note: '1–2 stars'})}
  </section>

  <section class="grid g3" style="margin-bottom:14px">
    <div class="card">
      <div class="card-head"><div><h3>Rating distribution</h3>
        <div class="hint">All reviews in the selected range</div></div></div>
      ${ratingBars(dist)}
      <div class="small muted" style="margin-top:10px">${esc(D.review_source)}</div>
    </div>
    <div class="card">
      <div class="card-head"><div><h3>What guests mention</h3>
        <div class="hint">Complaint themes from filtered reviews</div></div></div>
      ${themes.length ? barList(themes.slice(0, 6).map((t) => ({label: t.theme, value: t.reviews})),
        {fmt: (v) => num(v) + ' reviews', color: 'var(--warn)'})
        : emptyState('No complaint themes', 'No negative themes in this range.')}
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Rating by month</h3>
        <div class="hint">Average rating trend</div></div></div>
      ${columnChart('rvMonth', {data: [...monthly.entries()].sort()
        .map(([m, v]) => ({label: m, value: v.sum / v.count})), height: 190, max: 5,
        label: 'Average rating by month', fmt: (v) => v.toFixed(2) + '★',
        tickFmt: (v) => v.toFixed(1)})}
      <div class="small muted" style="margin-top:6px">
        ${summary.responded_pct}% of all reviews have a published reply</div>
    </div>
  </section>

  <div class="section-title"><h2>Review inbox</h2><div class="line"></div></div>
  <div class="card">
    <div class="card-head"><div><h3>${num(rows.length)} reviews</h3>
      <div class="hint">Draft a reply, review it, then publish from the Google Business Profile</div></div>
      <button class="btn btn-ghost btn-sm" id="revCsv">${svg('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>')}<span>Export</span></button></div>
    <div class="tbl-holder">${dataTable('rvList', [
      {key: 'date', label: 'Date', fmt: (v) => dateLabel(v)},
      {key: 'customer_name', label: 'Guest'},
      {key: 'rating', label: 'Rating', num: true, fmt: (v) => `<span style="color:${
        v >= 4 ? 'var(--good)' : v === 3 ? 'var(--warn)' : 'var(--bad)'}">${'★'.repeat(v)}</span>`},
      {key: 'review_text', label: 'Review', fmt: (v) => `<span class="small">${esc(
        String(v || '').slice(0, 96))}${String(v || '').length > 96 ? '…' : ''}</span>`},
      {key: 'sentiment', label: 'Sentiment', fmt: (v) => badge(v)},
      {key: 'complaint_category', label: 'Theme', fmt: (v) => v ? badge(v, 'muted') : '—'},
      {key: 'response_status', label: 'Reply', fmt: (v) => badge(v)},
      {key: 'action', label: '', fmt: (v, r) => `<button class="btn btn-ghost btn-sm"
        data-draft="${esc(r.date)}|${esc(r.customer_name)}">Draft</button>`},
    ], rows, {pageSize: 12, exportName: 'versova_reviews'})}</div>
  </div>`;

  bindTables(root);
  $('#revCsv', root).addEventListener('click', () => {
    downloadCSV('versova_reviews.csv', ['Date', 'Guest', 'Rating', 'Review', 'Sentiment',
      'Theme', 'ReplyStatus'],
    rows.map((r) => [r.date, r.customer_name, r.rating, r.review_text, r.sentiment,
      r.complaint_category, r.response_status]));
    toast('Review export ready');
  });
  root.onclick = (e) => {
    const b = e.target.closest('[data-draft]');
    if (!b) return;
    const [date, guest] = b.dataset.draft.split('|');
    const r = rows.find((x) => x.date === date && x.customer_name === guest);
    if (!r) return;
    openModal(`<button class="icon-btn modal-close" data-close aria-label="Close">✕</button>
      <h2>Draft reply</h2>
      <div class="sub">${esc(r.customer_name)} · ${esc(dateLong(r.date))} · ${r.rating}★
        · ${esc(r.complaint_category || 'general')}</div>
      <div class="card" style="background:var(--card2);margin-bottom:12px">
        <p class="small">${esc(r.review_text)}</p></div>
      <label class="small muted" for="draftText">Suggested response (editable)</label>
      <textarea id="draftText" rows="6" style="width:100%;margin-top:6px;padding:10px;
        border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--text);
        resize:vertical">${esc(draftReply(r))}</textarea>
      <div class="notice" style="margin:12px 0 0">
        ${svg('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>')}
        <span>This is a draft only. Nothing is posted to Google — a manager must approve and
          publish it from the Google Business Profile.</span></div>
      <div class="modal-foot"><button class="btn" data-close>Discard</button>
        <button class="btn btn-gold" id="copyDraft">Copy draft</button></div>`,
    {label: 'Draft reply'});
    $('#copyDraft').addEventListener('click', async () => {
      const text = $('#draftText').value;
      try {
        await navigator.clipboard.writeText(text);
        toast('Draft copied — publish from Google Business Profile');
      } catch (_) {
        toast('Copy blocked by the browser; select the text manually', 'err');
      }
      closeModal();
    });
  };
}
