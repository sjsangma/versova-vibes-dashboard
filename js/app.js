'use strict';
/* Router, shell controls and cross-view wiring. */

const NAV = [
  {group: 'Performance'},
  {route: 'overview', label: 'Overview', icon: 'overview', view: viewOverview,
    sub: 'Revenue, margin and operating signals at a glance'},
  {route: 'sales', label: 'Sales Analytics', icon: 'sales', view: viewSales,
    sub: 'Daily, weekly and monthly trade, mix and item performance'},
  {group: 'Kitchen & cost'},
  {route: 'costing', label: 'Food Costing', icon: 'costing', view: viewCosting,
    sub: 'Recipe margins, cost percentages and repricing'},
  {route: 'recipes', label: 'Recipe Management', icon: 'recipes', view: viewRecipes,
    sub: 'Ingredient lines, yields, allergens and storage'},
  {route: 'inventory', label: 'Inventory', icon: 'inventory', view: viewInventory,
    sub: 'Stock cover, reorder alerts, wastage and cold chain'},
  {group: 'People'},
  {route: 'staff', label: 'Staff Management', icon: 'staff', view: viewStaff,
    sub: 'Attendance, shifts and the employee directory'},
  {route: 'recruitment', label: 'Recruitment', icon: 'recruitment', view: viewRecruitment,
    sub: 'Pipeline, interviews and selection'},
  {group: 'Experience & compliance'},
  {route: 'reviews', label: 'Customer Reviews', icon: 'reviews', view: viewReviews,
    sub: 'Ratings, complaint themes and reply drafts'},
  {route: 'hygiene', label: 'FSSAI Hygiene', icon: 'hygiene', view: viewHygiene,
    sub: 'Checklists, temperature logs, CAPA and licence dates'},
  {route: 'marketing', label: 'Marketing', icon: 'marketing', view: viewMarketing,
    sub: 'Campaigns, content calendar and engagement'},
  {group: 'Workspace'},
  {route: 'notes', label: 'Notes Studio', icon: 'notes', view: viewNotes,
    sub: 'Working notes whose patterns are generated from their own text'},
  {group: 'Reporting'},
  {route: 'reports', label: 'Reports', icon: 'reports', view: viewReports,
    sub: 'Profit and loss, period comparison and downloads'},
  {route: 'quality', label: 'Data Quality', icon: 'quality', view: viewQuality,
    sub: 'Reconciliation between line-level and bill-level totals'},
  {route: 'settings', label: 'Settings', icon: 'settings', view: viewSettings,
    sub: 'Appearance, landing view and role emphasis'},
];
const ico = (name) => (ICON[name] || ICON.alert)
  .replace('<svg ', '<svg class="nav-ico" aria-hidden="true" ');
const ROUTES = {};
for (const n of NAV) if (n.route) ROUTES[n.route] = n;

function setTheme(theme) {
  state.theme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = state.theme;
  localStorage.setItem('vv.theme', state.theme);
  if ($('#themeIcon')) {
    $('#themeIcon').innerHTML = state.theme === 'dark'
      ? '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'
      : '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
  }
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) meta.content = state.theme === 'dark' ? 'dark light' : 'light dark';
}

function renderNav() {
  $('#nav').innerHTML = NAV.map((n) => {
    if (n.group) return `<div class="nav-group">${esc(n.group)}</div>`;
    const active = state.route === n.route ? ' active' : '';
    return `<a class="nav-link${active}" href="#/${n.route}" data-route="${n.route}"
      data-label="${esc(n.label)}"${active ? ' aria-current="page"' : ''}>
      ${ico(n.icon)}<span>${esc(n.label)}</span></a>`;
  }).join('');
}

function notificationList() {
  const out = [];
  const reorder = D.inventory_summary.items_to_reorder;
  if (reorder) out.push({tone: 'bad', route: 'inventory', icon: 'inventory',
    title: reorder + ' items to reorder', note: 'Physical stock at or below reorder level'});
  if (D.expiry.length) out.push({tone: 'warn', route: 'inventory', icon: 'alert',
    title: D.expiry.length + ' perishables need using first', note: 'FEFO expiry watch'});
  if (D.hygiene_summary.overdue_actions) out.push({tone: 'bad', route: 'hygiene', icon: 'hygiene',
    title: D.hygiene_summary.overdue_actions + ' corrective actions overdue',
    note: 'FSSAI CAPA register'});
  if (D.review_summary.pending_replies) out.push({tone: 'info', route: 'reviews', icon: 'reviews',
    title: D.review_summary.pending_replies + ' reviews awaiting reply',
    note: 'Drafts need management approval'});
  if (D.staff.document_gaps) out.push({tone: 'warn', route: 'staff', icon: 'staff',
    title: D.staff.document_gaps + ' employee document gaps', note: 'Hiring checklist'});
  if (!out.length) out.push({tone: 'good', route: 'overview', icon: 'quality',
    title: 'Nothing needs attention', note: 'All monitored registers are clear'});
  return out;
}

function togglePanel(id) {
  const el = document.getElementById(id);
  const open = el.classList.contains('open');
  closePanels();
  if (open) return;
  el.classList.add('open');
}

function closePanels() {
  $$('.popover').forEach((p) => p.classList.remove('open'));
  $('#searchResults').classList.remove('open');
  $('#bellBtn').setAttribute('aria-expanded', 'false');
  $('#profileBtn').setAttribute('aria-expanded', 'false');
  ['#moodBtn', '#soundBtn'].forEach((sel) => {
    const b = $(sel);
    if (b) b.setAttribute('aria-expanded', 'false');
  });
}

/* ---------- visual moods, notes and opt-in sound ---------- */
function renderMoodGrid() {
  const grid = $('#moodGrid');
  if (!grid) return;
  const now = currentMood();
  grid.innerHTML = MOOD_ORDER.map((k) => {
    const m = MOODS[k];
    const on = k === now;
    return `<button class="mood-card${on ? ' active' : ''}" data-mood="${esc(k)}"
      aria-pressed="${on}" title="${esc(m.note)}">
      <span class="mood-dot" style="background:radial-gradient(circle at 32% 26%,${m.swatch[1]},
        ${m.swatch[0]});color:${m.css.a}" aria-hidden="true"></span>
      <span><b>${esc(m.label)}</b><span>${esc(m.note)}</span></span></button>`;
  }).join('');
}

function syncSoundPanel() {
  const st = Sound.state();
  const set = (sel, on) => { const el = $(sel); if (el) el.setAttribute('aria-checked', String(on)); };
  set('#soundToggle', st.enabled);
  set('#soundAmbient', st.ambient);
  set('#soundUi', st.ui);
  const vol = $('#soundVolume');
  if (vol) vol.value = String(st.volume);
  const wave = $('#soundWave');
  if (wave) wave.style.opacity = st.enabled && !st.muted ? '1' : '0';
  const btn = $('#soundBtn');
  if (btn) btn.setAttribute('aria-label', st.enabled ? 'Sound: on' : 'Sound: off');
}

function placePopover(btn, panel) {
  panel.style.left = '0px';
  panel.style.right = 'auto';
  panel.style.top = Math.round(btn.getBoundingClientRect().bottom + 10) + 'px';
  const w = panel.getBoundingClientRect().width;
  const r = btn.getBoundingClientRect();
  const left = Math.max(12, Math.min(Math.round(r.left), window.innerWidth - w - 12));
  panel.style.left = Math.round(left) + 'px';
}

function wireAtmosphere() {
  applyMood(savedMood(), {persist: false});
  renderMoodGrid();
  Atmo.init();
  syncSoundPanel();

  const moodBtn = $('#moodBtn');
  if (moodBtn) {
    moodBtn.addEventListener('click', () => {
      const wasOpen = $('#moodPanel').classList.contains('open');
      closePanels();
      if (!wasOpen) {
        $('#moodPanel').classList.add('open');
        moodBtn.setAttribute('aria-expanded', 'true');
        placePopover(moodBtn, $('#moodPanel'));
        Sound.play('open');
      }
    });
  }

  const grid = $('#moodGrid');
  if (grid) {
    grid.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mood]');
      if (!b) return;
      const key = applyMood(b.dataset.mood);
      renderMoodGrid();
      Atmo.ripple(window.innerWidth * 0.72, 110, {hue: MOODS[key].hues[0], max: 300});
      Sound.play('select');
      toast(MOODS[key].label + ' mood applied');
    });
  }

  const soundBtn = $('#soundBtn');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      const wasOpen = $('#soundPanel').classList.contains('open');
      closePanels();
      if (!wasOpen) {
        syncSoundPanel();
        $('#soundPanel').classList.add('open');
        soundBtn.setAttribute('aria-expanded', 'true');
        placePopover(soundBtn, $('#soundPanel'));
      }
    });
  }

  const toggle = $('#soundToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      if (Sound.enabled) { Sound.disable(); toast('Sound off'); }
      else { Sound.enable(); toast('Sound on — ambient pad only'); }
      syncSoundPanel();
    });
  }
  const amb = $('#soundAmbient');
  if (amb) amb.addEventListener('click', () => {
    Sound.setAmbient(!Sound.prefs.ambient);
    syncSoundPanel();
  });
  const ui = $('#soundUi');
  if (ui) ui.addEventListener('click', () => {
    Sound.setUi(!Sound.prefs.ui);
    syncSoundPanel();
    Sound.play('tap');
  });
  const vol = $('#soundVolume');
  if (vol) vol.addEventListener('input', () => Sound.setVolume(vol.value));

  const notesBtn = $('#notesBtn');
  if (notesBtn) notesBtn.addEventListener('click', () => {
    if (state.route === 'notes') render(); else location.hash = '#/notes';
    Sound.play('open');
  });

  /* Cursor trail and click ripples. Both are pointer-priced and fully passive. */
  let lastMove = 0;
  document.addEventListener('pointermove', (e) => {
    const now = performance.now();
    if (now - lastMove < 42) return;
    lastMove = now;
    if (e.pointerType === 'mouse') Atmo.trail(e.clientX, e.clientY);
  }, {passive: true});
  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    Atmo.ripple(e.clientX, e.clientY, {max: 170});
    if (e.target.closest('a, button, .kpi, .chip')) Sound.play('tap');
  }, {passive: true});
  document.addEventListener('click', (e) => {
    if (e.target.closest('.nav-link')) Sound.play('open');
  });
  const main = $('#main');
  if (main) {
    main.addEventListener('click', (e) => {
      if (e.target.closest('.kpi')) { Atmo.pulse(); Atmo.ripple(e.clientX, e.clientY, {max: 240}); }
    });
  }
}

function renderNotifications() {
  const rows = notificationList();
  $('#notifPanel').innerHTML = `<div class="pop-head"><b>Notification centre</b>
    <span class="badge muted">${rows.length}</span></div>
    ${rows.map((r) => `<a class="pop-row" href="#/${r.route}">
      <span class="pop-ico ${r.tone}">${ico(r.icon)}</span>
      <span><b>${esc(r.title)}</b><span class="small muted">${esc(r.note)}</span></span></a>`).join('')}
    <div class="pop-foot small muted">Generated from the same registers the modules display.</div>`;
  const badge = $('#bellBtn .count');
  if (badge) {
    badge.textContent = String(rows.length > 9 ? '9+' : rows.length);
    badge.hidden = !rows.length;
  }
}

function renderProfile() {
  $('#profilePanel').innerHTML = `<div class="pop-head"><b>${esc(state.role)}</b>
    <span class="badge">read-only</span></div>
    <div class="pop-row"><span class="small">Versova Vibes Cafe &amp; Bar<br>
      Versova, Mumbai · INR ₹ · Asia/Kolkata</span></div>
    <div class="pop-row small muted">Salary data is excluded from this public export. Row-level
      security is enforced by PostgreSQL role grants and vw_payroll.</div>
    <a class="pop-row" href="#/settings"><span class="small">Appearance, role and landing view</span></a>
    <a class="pop-row" href="#/quality"><span class="small">Data provenance and reconciliation</span></a>
    <div class="pop-foot small muted">Period ${esc(D.period.start)} → ${esc(D.period.end)}</div>`;
}

function searchIndex() {
  const idx = [];
  for (const i of itemAgg().sort((a, b) => b.net - a.net)) idx.push({kind: 'Item',
    label: i.name, note: i.category + ' · ' + inr0(i.net), route: 'sales'});
  for (const r of D.recipes) idx.push({kind: 'Recipe', label: r.recipe_name,
    note: pct(r.food_cost_pct, 1) + ' food cost', route: 'recipes'});
  for (const e of D.employees) idx.push({kind: 'Employee', label: e.name,
    note: e.designation + ' · ' + e.department, route: 'staff'});
  for (const g of D.inventory_register) idx.push({kind: 'Stock', label: g.ingredient,
    note: num2(g.physical_qty) + ' ' + g.base_unit + ' on hand', route: 'inventory'});
  for (const s of D.suppliers) idx.push({kind: 'Supplier', label: s.name,
    note: s.category, route: 'inventory'});
  return idx;
}

function runSearch(q) {
  const box = $('#searchResults');
  const term = q.trim().toLowerCase();
  if (term.length < 2) { box.classList.remove('open'); box.innerHTML = ''; return; }
  const hits = searchIndex().filter((r) => r.label.toLowerCase().includes(term)
    || r.note.toLowerCase().includes(term)).slice(0, 12);
  box.innerHTML = hits.length
    ? hits.map((h) => `<a class="search-hit" href="#/${h.route}">
        <span class="badge muted">${esc(h.kind)}</span>
        <span><b>${esc(h.label)}</b><span class="small muted">${esc(h.note)}</span></span></a>`).join('')
    : `<div class="search-hit"><span class="small muted">No match for “${esc(q)}”</span></div>`;
  box.classList.add('open');
}

function exportMenu() {
  openModal(`<button class="icon-btn modal-close" data-close aria-label="Close">✕</button>
    <h2>Export report</h2>
    <div class="sub">${dateLong(state.from)} – ${dateLong(state.to)} · ${state.cat || 'all categories'}</div>
    <div class="stack" style="margin-top:14px">
      <button class="btn btn-gold" id="ex1">Sales line report (CSV)</button>
      <button class="btn" id="ex2">Daily sales summary (CSV)</button>
      <button class="btn" id="ex3">Item performance (CSV)</button>
      <button class="btn" id="ex4">Recipe costing (CSV)</button>
      <button class="btn" id="ex5">Stock register (CSV)</button>
      <button class="btn btn-ghost" id="ex6">Print current view (PDF)</button>
    </div>
    <div class="notice" style="margin-top:14px">
      ${svg('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>')}
      <span>Exports contain synthetic sample data, not actual business performance.</span></div>`,
  {label: 'Export report'});
  const t = totals();
  $('#ex1').addEventListener('click', () => {
    downloadCSV(`versova_sales_${state.from}_${state.to}.csv`,
      ['Date', 'Item', 'Category', 'Type', 'Qty', 'Net', 'Cost'],
      lines().map((l) => [l.date, l.name, l.category, l.type, l.qty, l.net.toFixed(2),
        l.cost.toFixed(2)]));
    toast('Sales report exported');
  });
  $('#ex2').addEventListener('click', () => {
    downloadCSV(`versova_daily_${state.from}_${state.to}.csv`,
      ['Date', 'Bills', 'Gross', 'Discount', 'Net'], D.daily_bills.filter((b) => inRange(b.date))
        .map((b) => [b.date, b.bills, b.gross, b.discount, b.net]));
    toast('Daily summary exported');
  });
  $('#ex3').addEventListener('click', () => {
    downloadCSV('versova_items.csv', ['Item', 'Category', 'Qty', 'Net', 'CostPct'],
      itemAgg().map((i) => [i.name, i.category, i.qty, i.net.toFixed(2),
        i.food_cost_pct.toFixed(2)]));
    toast('Item performance exported');
  });
  $('#ex4').addEventListener('click', () => {
    downloadCSV('versova_recipes.csv', ['Recipe', 'Type', 'Cost', 'Price', 'CostPct'],
      D.recipes.map((r) => [r.recipe_name, r.type, r.recipe_cost, r.selling_price,
        r.food_cost_pct]));
    toast('Recipe costing exported');
  });
  $('#ex5').addEventListener('click', () => {
    downloadCSV('versova_stock.csv', ['Ingredient', 'Unit', 'Physical', 'Value', 'Status'],
      D.inventory_register.map((g) => [g.ingredient, g.base_unit, g.physical_qty,
        g.closing_value, g.status]));
    toast('Stock register exported');
  });
  $('#ex6').addEventListener('click', () => { closeModal(); window.print(); });
  void t;
}

function render() {
  const route = ROUTES[state.route] ? state.route : 'overview';
  state.route = route;
  const def = ROUTES[route];
  renderNav();
  $('#pageTitle').textContent = def.label;
  $('#pageSub').textContent = def.sub;
  $('#pageActions').innerHTML = `<button class="btn btn-ghost btn-sm" id="actExport">
    ${svg('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>')}<span>Export</span></button>`;
  $('#actExport').addEventListener('click', exportMenu);
  const meta = $('#periodMeta');
  meta.innerHTML = `<b>${dateLong(state.from)}</b> – ${dateLong(state.to)} ·
    ${num(dayDiff(state.from, state.to))} days${state.cat ? ' · ' + esc(state.cat) : ''}`;
  const root = $('#viewRoot');
  root.onclick = null;
  def.view(root);
  if (typeof Atmo !== 'undefined') {
    const now = Date.now();
    if (now - (render.lastPulse || 0) > 900) { render.lastPulse = now; Atmo.pulse(); }
  }
  window.scrollTo({top: 0, behavior: 'instant'});
  document.title = `${def.label} · ${D.business}`;
}

function applyRoute(hash) {
  closeModal();
  const route = (hash || '').replace(/^#\/?/, '').split('?')[0] || 'overview';
  state.route = ROUTES[route] ? route : 'overview';
  state.q = $('#tableSearch').value = '';
  render();
  const root = $('#viewRoot');
  if (root) {
    root.classList.remove('view-enter');
    void root.offsetWidth;          // restart the entrance animation on each navigation
    root.classList.add('view-enter');
  }
  if (window.innerWidth <= 1024) document.body.classList.remove('nav-open');
}

function wireShell() {
  const from = $('#from');
  const to = $('#to');
  from.min = to.min = D.period.start;
  from.max = to.max = D.period.end;
  const params = new URLSearchParams(location.search);
  state.from = params.get('from') || D.period.start;
  state.to = params.get('to') || D.period.end;
  from.value = state.from;
  to.value = state.to;

  const cat = $('#cat');
  cat.innerHTML = '<option value="">All categories</option>'
    + D.categories.map((c) => `<option value="${esc(c.category)}">${esc(c.category)}</option>`)
      .join('');
  cat.value = state.cat = params.get('cat') || '';

  const commit = () => {
    if (from.value > to.value) { const t = from.value; from.value = to.value; to.value = t; }
    state.from = from.value || D.period.start;
    state.to = to.value || D.period.end;
    state.cat = cat.value;
    render();
  };
  from.addEventListener('change', commit);
  to.addEventListener('change', commit);
  cat.addEventListener('change', commit);

  $$('#quick button').forEach((b) => b.addEventListener('click', () => {
    const n = b.dataset.range === 'all' ? dayDiff(D.period.start, D.period.end)
      : Number(b.dataset.range);
    state.to = D.period.end;
    state.from = D.period.start;
    let start = D.period.end;
    for (let i = 1; i < n; i += 1) start = shiftDays(start, -1);
    if (start < D.period.start) start = D.period.start;
    state.from = start;
    from.value = state.from;
    to.value = state.to;
    $$('#quick button').forEach((x) => x.classList.toggle('active', x === b));
    render();
  }));

  let timer;
  $('#tableSearch').addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.q = e.target.value; render(); }, 220);
  });

  $('#globalSearch').addEventListener('input', (e) => runSearch(e.target.value));
  $('#globalSearch').addEventListener('focus', (e) => runSearch(e.target.value));
  $('#globalSearch').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { $('#searchResults').classList.remove('open'); e.target.blur(); }
    if (e.key === 'Enter') {
      const first = $('#searchResults .search-hit');
      if (first && first.getAttribute('href')) location.hash = first.getAttribute('href');
      $('#searchResults').classList.remove('open');
    }
  });
  $('#searchResults').addEventListener('click', () => {
    setTimeout(() => closePanels(), 50);
  });

  $('#bellBtn').addEventListener('click', () => {
    renderNotifications();
    togglePanel('notifPanel');
    $('#bellBtn').setAttribute('aria-expanded', String($('#notifPanel').classList.contains('open')));
  });
  $('#profileBtn').addEventListener('click', () => {
    renderProfile();
    togglePanel('profilePanel');
    $('#profileBtn').setAttribute('aria-expanded',
      String($('#profilePanel').classList.contains('open')));
  });
  $('#themeBtn').addEventListener('click', () => {
    setTheme(state.theme === 'dark' ? 'light' : 'dark');
    render();
  });
  $('#exportBtn').addEventListener('click', exportMenu);
  const sideBtn = $('#sideBtn');
  const applySide = (collapsed) => {
    document.body.classList.toggle('side-collapsed', collapsed);
    if (!sideBtn) return;
    const label = collapsed ? 'Expand navigation' : 'Collapse navigation';
    sideBtn.setAttribute('aria-expanded', String(!collapsed));
    sideBtn.setAttribute('aria-label', label);
    sideBtn.title = label;
  };
  if (sideBtn) {
    sideBtn.addEventListener('click', () => {
      const collapsed = !document.body.classList.contains('side-collapsed');
      applySide(collapsed);
      localStorage.setItem('vv.side', collapsed ? 'collapsed' : 'open');
    });
    applySide(localStorage.getItem('vv.side') === 'collapsed');
  }
  $('#menuBtn').addEventListener('click', () => {
    const open = document.body.classList.toggle('nav-open');
    $('#menuBtn').setAttribute('aria-expanded', String(open));
  });
  $('#overlay').addEventListener('click', () => {
    document.body.classList.remove('nav-open');
    closePanels();
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.popover, #bellBtn, #profileBtn, #moodBtn, #soundBtn, .searchbox, #searchResults')) {
      closePanels();
    }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      $('#globalSearch').focus();
      $('#globalSearch').select();
    }
    if (e.key === 'Escape') closePanels();
  });
  window.addEventListener('hashchange', () => applyRoute(location.hash));
}

function boot() {
  const saved = localStorage.getItem('vv.theme');
  setTheme(saved || 'dark');
  state.role = localStorage.getItem('vv.role') || 'Owner';
  $('#disclaimer').innerHTML = `${svg('<path d="M12 9v4M12 17h.01"/>'
    + '<path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>')}
    <span>${esc(D.disclaimer)}</span>`;
  const bell = $('#bellBtn');
  if (bell && !bell.querySelector('.count')) {
    bell.insertAdjacentHTML('beforeend', '<span class="count" hidden></span>');
  }
  renderNotifications();
  wireShell();
  wireAtmosphere();
  const route = location.hash ? location.hash
    : '#/' + (localStorage.getItem('vv.landing') || 'overview');
  applyRoute(route);
  $('#loading')?.remove();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
