# Display Baseline — PPC-Workbench-style view

**Date:** 2026-06-16
**File:** `dassian-tpm-springboard.html` (replaces the placeholder `renderBaselineDisplay(p)` at ~line 929)
**Status:** Design approved — ready to plan/implement

## Purpose

Replace the Display Baseline placeholder with a master–detail view of the
Performance Measurement Baseline (PMB), evoking the Dassian PPC Workbench:
a WBS hierarchy on the left, a baseline detail panel on the right.

## Data sources (all client-side, already loaded)

- **`WBS_DICT`** — WBS hierarchy (levels 01 → 06-WP, 105 rows) with description,
  CAM, PMB start/finish dates, hours, cost. JTB001 (PPC/SIS Demo 1) only.
- **`CAP_TP`** — time-phased monthly buckets (Jan 2022 → Feb 2026, ~50 periods);
  rows keyed by `ca` + `wp` with `type` BCWS/BCWP/ACWP and per-month `vals[]`.
  This view uses **BCWS rows only**. JTB001 only.
- **`PROGRAMS`** — Demo → [JTB001]; MFG Program → [DD-0010, DD-0001, DD-0002, DD-0003].

## Layout — master / detail

Two panes under the standard `module-intro`.

### Left pane — WBS tree
- Built from `WBS_DICT`, collapsible, indented by WBS depth.
- **Goes all the way down to work package** (levels 05/06-WP are leaf nodes).
- Each node shows `WBS id · description` with its rolled BCWS total at the right.
- Expand/collapse carets; clicking a node selects it. Root (level 01) selected by default.

### Right pane — detail panel (updates on node select)
1. **Baseline header facts** — WBS id, description, level, CAM/owner,
   PMB start/finish, total BCWS, hours, cost. From the node's `WBS_DICT` row
   plus rolled `CAP_TP` BCWS.
2. **Time-phased BCWS table** — monthly periods as columns (Jan 2022 → Feb 2026),
   **frozen label column** on the left, **Total** column at the end, **horizontal scroll**.
   Rows: **BCWS** (per month) and **Cum BCWS** (running total).

## Roll-up logic

For a selected WBS node, BCWS = sum of all `CAP_TP` BCWS rows whose key falls under
the node's WBS prefix (parents aggregate descendants; a CA sums its work packages;
a leaf WP shows its own row). Header dates/hours/cost come from the node's `WBS_DICT` row.

## Scope / placeholder

Driven by the selected program/project:
- **Demo / JTB001** → full tree + detail.
- **MFG / DD-\*** (no WBS/time-phased data) → clean placeholder:
  "Baseline not yet loaded for this project."

## Styling / constraints

- Reuse existing idioms: `module-intro`, `ca`/`ca-wrap` table classes, number
  formatters (`addCommas`, `mfmt`), SAP-Fiori palette.
- Pure render function like the other modules; no new dependencies.

## Out of scope (YAGNI for now)

- BCWS S-curve chart, child/work-package breakdown table (declined).
- Editing the baseline; baseline version history.
- Time-phased data for MFG/DD projects.
