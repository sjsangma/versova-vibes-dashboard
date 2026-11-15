# Versova Vibes Cafe & Bar — Management Dashboard (public demo)

Read-only management dashboard for Versova Vibes Cafe & Bar, Versova, Mumbai.

**Live:** https://sjsangma.github.io/versova-vibes-dashboard/

## What this is

A static edition of the restaurant intelligence dashboard. The numbers are computed once
by the project's Python analytics (the same code that feeds the Excel workbook and the
PostgreSQL views) and baked into `index.html` as JSON. `app.js` then re-aggregates
line-level sales in the browser so the date and category filters are exact rather than
pre-computed snapshots.

Covered: revenue, food and beverage split, food cost %, top items, payment mix, inventory
and reorder alerts, expiry, wastage, staff attendance, recruitment funnel, customer
reviews, FSSAI hygiene and corrective actions, marketing campaigns, and a data-quality
panel that compares the browser totals against the Python/SQL values.

Filters: date range (including `Last 7` / `Last 14`), category, and sortable tables.
Shareable links work too, for example
`?from=2026-10-25&to=2026-10-31` or `?cat=Coffee`.

## Data disclaimer

All figures are **sample/synthetic data for demonstration** and are not actual business
performance. The closing-stock quantities in the inventory views come from the
restaurant's bar closing-stock sheet; all other operational figures are generated for
testing. Salary amounts are omitted from this public edition.

Review replies shown here are drafts only — this page never publishes a response.

## Files

- `index.html` — the dashboard, with the data payload embedded.
- `app.js` — filters, aggregation, charts and tables.
- `.nojekyll` — serves the files as-is on GitHub Pages.

## Related, private

The full system (Excel workbook, PostgreSQL schema and 55 practice queries, Python
automation, Streamlit app, integrated ETL) lives in a private repository and is not
published here.

---

Prepared with Lemon Code, an AI agent, on behalf of the project owner.
