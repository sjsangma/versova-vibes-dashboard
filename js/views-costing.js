'use strict';
/* Food costing and recipe management. Cost figures come from the recipe costing module;
   the calculator below only re-arranges them, it never replaces stored costs. */

const RECIPE_COLS = [
  {key: 'recipe_name', label: 'Recipe', fmt: (v, r) => `<a href="#" data-recipe="${esc(v)}"
    style="color:var(--text);text-decoration:none;border-bottom:1px dotted var(--line-strong)"><b>${esc(v)}</b></a>
    <div class="small muted">${esc(r.type)}</div>`},
  {key: 'selling_price', label: 'Selling price', num: true, fmt: (v) => inr2(v)},
  {key: 'recipe_cost', label: 'Recipe cost', num: true, fmt: (v) => inr2(v)},
  {key: 'food_cost_pct', label: 'Food cost %', num: true,
    fmt: (v) => badge(pct(v, 1), v > 32 ? 'bad' : v > 30 ? 'warn' : 'good')},
  {key: 'gross_profit', label: 'Gross profit', num: true, fmt: (v) => inr2(v)},
  {key: 'margin_pct', label: 'Margin', num: true, fmt: (v) => pct(v, 1)},
  {key: 'flag', label: 'Status', fmt: (v) => badge(v)},
];

function recipeModal(name) {
  const r = D.recipe_details.find((x) => x.recipe_name === name);
  if (!r) return;
  const ingRows = (r.ingredients || []).map((i) => `<tr>
    <td>${esc(i.ingredient)}</td>
    <td class="num mono">${num2(i.qty)} ${esc(i.unit)}</td>
    <td class="num mono">${inr2(i.rate)}</td>
    <td class="num mono">${inr2(i.line_cost)}</td></tr>`).join('');
  const ingredientsSum = (r.ingredients || []).reduce((a, i) => a + i.line_cost, 0);
  openModal(`<button class="icon-btn modal-close" data-close aria-label="Close">✕</button>
    <h2>${esc(r.recipe_name)}</h2>
    <div class="sub">${esc(r.category)} · ${esc(r.portion)} · prep ${num(r.prep_time_min)} min
      · yield ${pct(r.yield_pct, 0)}</div>
    <div class="grid g3" style="margin-bottom:14px">
      <div><div class="small muted">Recipe cost</div><div style="font-size:18px;font-weight:650">${inr2(r.recipe_cost)}</div></div>
      <div><div class="small muted">Selling price</div><div style="font-size:18px;font-weight:650">${inr2(r.selling_price)}</div></div>
      <div><div class="small muted">Food cost %</div>
        <div style="font-size:18px;font-weight:650" class="${r.food_cost_pct > 32 ? 'bad' : ''}">
        ${pct(r.food_cost_pct, 2)}</div></div>
    </div>
    <div class="table-wrap" style="max-height:250px"><table><thead><tr>
      <th>Ingredient</th><th class="num">Quantity</th><th class="num">Rate</th>
      <th class="num">Line cost</th></tr></thead><tbody>${ingRows}</tbody></table></div>
    <div class="row small muted" style="margin-top:8px">
      <span>Ingredient lines sum to ${inr2(ingredientsSum)}</span>
      <span class="spacer"></span><span>Stored recipe cost ${inr2(r.recipe_cost)}</span></div>
    <div class="small muted" style="margin-top:4px">Ingredient lines use current master rates;
      the stored recipe cost also carries the ${pct(100 - (r.yield_pct || 100), 0)} preparation
      yield loss.</div>
    <dl class="kv" style="margin-top:14px">
      <dt>Allergens</dt><dd>${esc(r.allergens || 'None declared')}</dd>
      <dt>Storage</dt><dd>${esc(r.storage || '—')}</dd>
    </dl>
    <p class="small muted" style="margin-top:12px">${esc(r.instructions || '')}</p>
    <div class="card" style="margin-top:14px;background:var(--card2)">
      <div class="card-head"><div><h3>Pricing calculator</h3>
        <div class="hint">Reprice from the stored recipe cost</div></div></div>
      <div class="row">
        <label class="small muted" for="calcTarget">Target food cost %</label>
        <input id="calcTarget" type="number" min="5" max="70" step="0.5" value="30"
          style="width:82px;height:30px;border-radius:7px;border:1px solid var(--line);
          background:var(--card);padding:0 8px">
        <label class="small muted" for="calcPrice">Selling price</label>
        <input id="calcPrice" type="number" min="0" step="1" value="${Math.round(r.selling_price)}"
          style="width:96px;height:30px;border-radius:7px;border:1px solid var(--line);
          background:var(--card);padding:0 8px">
      </div>
      <div id="calcOut" class="small" style="margin-top:10px"></div>
    </div>
    <div class="modal-foot"><button class="btn" data-close>Close</button></div>`, {label: r.recipe_name});

  const out = $('#calcOut');
  const run = () => {
    const target = Number($('#calcTarget').value) || 30;
    const price = Number($('#calcPrice').value) || 0;
    const suggested = r.recipe_cost / (target / 100);
    const current = price ? (r.recipe_cost / price) * 100 : 0;
    out.innerHTML = `<div class="grid g3">
      <div><div class="muted">Cost per portion</div><b>${inr2(r.recipe_cost)}</b></div>
      <div><div class="muted">Suggested price @ ${target}%</div><b>${inr2(suggested)}</b></div>
      <div><div class="muted">Food cost at entered price</div>
        <b class="${current > 32 ? '' : 'muted'}">${price ? pct(current, 1) : '—'}</b></div>
    </div>`;
  };
  $('#calcTarget').addEventListener('input', run);
  $('#calcPrice').addEventListener('input', run);
  run();
}

function viewRecipes(root) {
  const rows = D.recipes.slice().sort((a, b) => a.recipe_name.localeCompare(b.recipe_name));
  const details = D.recipe_details;
  const allergenCount = details.filter((d) => d.allergens && d.allergens !== 'None').length;
  const avgPrep = details.length
    ? details.reduce((a, d) => a + (d.prep_time_min || 0), 0) / details.length : 0;

  root.innerHTML = `
  <section class="kpis">
    ${kpiCard({label: 'Recipes on file', value: num(rows.length), icon: 'recipes', tone: 'gold',
      note: num(rows.filter((r) => r.type === 'Food').length) + ' food · '
      + num(rows.filter((r) => r.type === 'Beverage').length) + ' beverage'})}
    ${kpiCard({label: 'Average prep time', value: num2(avgPrep) + ' min', icon: 'clock',
      note: 'from the recipe cards'})}
    ${kpiCard({label: 'Recipes with allergens', value: num(allergenCount), icon: 'alert',
      note: 'declared on the recipe card'})}
    ${kpiCard({label: 'Average yield', value: pct(details.length ? details.reduce((a, d) =>
      a + (d.yield_pct || 0), 0) / details.length : 0, 1), icon: 'check',
      note: 'edible portion after preparation loss'})}
  </section>

  <div class="card">
    <div class="card-head"><div><h3>Recipe book</h3>
      <div class="hint">Open a recipe for ingredient lines, method, allergens and the
        pricing calculator</div></div></div>
    <div class="tbl-holder">${dataTable('rmList', [
      {key: 'recipe_name', label: 'Recipe', fmt: (v, r) => `<a href="#" data-recipe="${esc(v)}"
        style="color:var(--text);text-decoration:none;border-bottom:1px dotted var(--line-strong)">
        <b>${esc(v)}</b></a><div class="small muted">${esc(r.category || r.type)}</div>`},
      {key: 'portion', label: 'Portion'},
      {key: 'prep_time_min', label: 'Prep', num: true, fmt: (v) => num(v) + ' min'},
      {key: 'yield_pct', label: 'Yield', num: true, fmt: (v) => pct(v, 0)},
      {key: 'recipe_cost', label: 'Cost', num: true, fmt: (v) => inr2(v)},
      {key: 'selling_price', label: 'Price', num: true, fmt: (v) => inr2(v)},
      {key: 'food_cost_pct', label: 'Cost %', num: true,
        fmt: (v) => badge(pct(v, 1), v > 32 ? 'bad' : v > 30 ? 'warn' : 'good')},
      {key: 'allergens', label: 'Allergens', fmt: (v) => v && v !== 'None'
        ? badge(v, 'warn') : '<span class="muted small">None declared</span>'},
    ], details, {pageSize: 12, exportName: 'versova_recipe_book'})}</div>
  </div>

  <div class="notice" style="margin-top:14px">
    ${svg('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>')}
    <span>Recipe costs use the ingredient rates in the ingredient master. Refresh them when
      supplier invoices change so food cost percentages stay accurate.</span></div>`;

  bindTables(root);
  root.onclick = (e) => {
    const a = e.target.closest('[data-recipe]');
    if (!a) return;
    e.preventDefault();
    recipeModal(a.dataset.recipe);
  };
}

function viewCosting(root) {
  const C = D.cost;
  const rows = D.recipes.slice().sort((a, b) => b.food_cost_pct - a.food_cost_pct);
  const flagged = rows.filter((r) => r.flag !== 'Healthy');
  const food = rows.filter((r) => r.type === 'Food');
  const bev = rows.filter((r) => r.type === 'Beverage');
  const avg = (arr) => arr.length ? arr.reduce((a, r) => a + r.food_cost_pct, 0) / arr.length : 0;
  const buckets = [
    {label: 'Under 25% — strong margin', min: 0, max: 25, tone: 'good'},
    {label: '25–30% — on target', min: 25, max: 30, tone: 'info'},
    {label: '30–35% — watch', min: 30, max: 35, tone: 'warn'},
    {label: 'Over 35% — reprice', min: 35, max: 100, tone: 'bad'},
  ].map((b) => ({...b, count: rows.filter((r) => r.food_cost_pct >= b.min
    && r.food_cost_pct < b.max).length}));

  root.innerHTML = `
  <section class="kpis">
    ${kpiCard({label: 'Average food cost %', value: pct(C.avg_food_cost_pct), icon: 'costing',
      tone: 'gold', note: 'across ' + num(C.recipes) + ' recipes'})}
    ${kpiCard({label: 'Average beverage cost %', value: pct(C.avg_beverage_cost_pct), icon: 'costing',
      note: 'beverage recipes'})}
    ${kpiCard({label: 'Dishes for review', value: num(C.dishes_for_review), icon: 'alert',
      note: 'above the 30% target'})}
    ${kpiCard({label: 'Highest cost item', value: pct(C.highest_cost_pct, 1), icon: 'trend',
      note: C.highest_cost_item})}
  </section>

  <section class="grid split" style="margin-bottom:14px">
    <div class="card">
      <div class="card-head"><div><h3>Food cost distribution</h3>
        <div class="hint">Every recipe bucketed by food cost percentage</div></div></div>
      <div class="stack" style="gap:12px">
        ${buckets.map((b) => `<div>
          <div class="row small"><span>${esc(b.label)}</span>
            <b class="spacer mono">${num(b.count)}</b></div>
          <div class="progress" style="margin-top:5px"><i style="width:${
            (b.count / Math.max(1, rows.length) * 100).toFixed(1)}%;background:var(--${b.tone === 'good'
            ? 'good' : b.tone === 'info' ? 'teal' : b.tone === 'warn' ? 'warn' : 'bad'})"></i></div>
        </div>`).join('')}
      </div>
      <div class="row small muted" style="margin-top:14px">
        <span>Food ${pct(avg(food), 1)}</span><span>Beverage ${pct(avg(bev), 1)}</span>
        <span class="spacer"></span><span>Average margin ${pct(C.avg_margin_pct, 1)}</span>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Needs attention</h3>
        <div class="hint">Recipes above target — open for the full costing sheet</div></div></div>
      ${flagged.length ? barList(flagged.slice(0, 10).map((r) => ({label: r.recipe_name,
        value: r.food_cost_pct})), {fmt: (v) => pct(v, 1), color: 'var(--bad)'})
        : emptyState('All recipes on target', 'No recipe exceeds the food cost target.')}
    </div>
  </section>

  <div class="section-title"><h2>Recipe costing</h2><div class="line"></div></div>
  <div class="card">
    <div class="card-head"><div><h3>${num(rows.length)} recipes</h3>
      <div class="hint">Click a recipe name for ingredients and the pricing calculator</div></div>
      <button class="btn btn-ghost btn-sm" id="recipeCsv">${svg('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>')}<span>Export</span></button></div>
    <div class="tbl-holder">${dataTable('coRecipes', RECIPE_COLS, rows, {pageSize: 12})}</div>
  </div>`;

  bindTables(root);
  const open = (e) => {
    const a = e.target.closest('[data-recipe]');
    if (!a) return;
    e.preventDefault();
    recipeModal(a.dataset.recipe);
  };
  root.onclick = open;
  $('#recipeCsv', root).addEventListener('click', () => {
    downloadCSV(`versova_recipes_${state.from}_${state.to}.csv`,
      ['Recipe', 'Type', 'SellingPrice', 'RecipeCost', 'FoodCostPct', 'GrossProfit', 'MarginPct', 'Flag'],
      rows.map((r) => [r.recipe_name, r.type, r.selling_price, r.recipe_cost,
        r.food_cost_pct.toFixed(2), r.gross_profit, r.margin_pct.toFixed(2), r.flag]));
    toast('Recipe costing exported');
  });
}
