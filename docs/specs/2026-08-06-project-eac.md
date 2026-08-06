# Project EAC — Create/Edit EAC & Display EAC

**Date:** 2026-08-06
**File:** `dassian-tpm-springboard.html`
**Scope:** Demo program only (JTB001).

## Purpose

Add two subsections under Project EAC: **Create/Edit EAC** (mirrors Edit Plan — editable) and **Display EAC** (mirrors Display Baseline — read-only). Both show a period (data date) selector at the top. EAC is an estimate-at-completion forecast layered on the shared baseline activities: **EAC = ACWP-to-date + ETC**.

## Nav

Project EAC becomes an expandable parent (`toggleEac`, like `toggleBaseline`) with two children:
- **Create/Edit EAC** → module `eac-edit`
- **Display EAC** → module `eac-display`

## Data (EAC forecast layer on existing subtasks)

Each `schedData` subtask gains, seeded from the baseline (lazily via `eacEnsure`):
- `eacFinish` — editable forecast finish (default = baseline `finish`).
- `eacRes` — time-phased EAC cost `{resId: monthly[]}` (default = copy of baseline `res`).

So EAC starts equal to the baseline; the user adjusts the forecast. Same activity list & predecessor schedule as the baseline — only forecast finish + ETC cost are EAC-specific.

## ACWP / ETC split by period

Period = shared month-end data date (`pvState.period`, `YYYY-MM`), selectable at the top of both EAC screens. For each subtask cell at month index `i` (date `months[i]`):
- before `start` or after `eacFinish` → **none** (locked at 0),
- month ≤ period → **ACWP** (read-only everywhere; stand-in for actuals = planned-through-period),
- month > period (and ≤ eacFinish) → **ETC** (editable on Create/Edit, read-only on Display).
- **EAC = ACWP + ETC.**

## Roll-up

- `eacResSeries(wbs)` = Σ descendant WP subtasks' `eacRes`.
- `eacTotals(wbs)` = { bac (= baseline `bdNodeBCWS`), acwp, etc, eac = acwp+etc, vac = bac − eac }, classifying each cell by period.
- Node forecast finish = latest `eacFinish` among descendant subtasks.
- Rolls up subtask → WP → CA → summary.

## Create/Edit EAC (≈ Edit Plan)

- Period selector at top. WBS tree (own `eacState.expanded/sel`) → select a WP:
  - **Subtask table**: ID · Name · Baseline Finish · **Forecast Finish (editable)** · EAC $ · ACWP $ · ETC $.
  - Selecting a subtask shows its **EAC cost grid**: ACWP cells locked/shaded, ETC cells editable out to the forecast finish (extending forecast finish opens more ETC months; shrinking zeros them — clamp), pre-start/post-finish cells blank.
- Summary nodes: read-only rollup table + "select a work package" note (like Edit Plan).
- Editing forecast finish or an ETC cell recomputes and rolls up live.

## Display EAC (≈ Display Baseline)

- Period selector at top. WBS tree → any node shows a **read-only** time-phased EAC resource table (Σ eacRes by resource), with ACWP (≤period) / ETC (>period) column shading, plus header cards. Fully read-only.

## Header cards (both screens)

EAC · ACWP-to-date · ETC · Forecast Finish · VAC (= BAC − EAC).

## Scope boundaries (YAGNI)

- ACWP = baseline (planned) cost through the data date (no separate actuals tracked yet).
- Shares baseline activities/predecessors; only forecast finish + ETC cost are EAC-specific.
- Forecast finish editable per subtask (bounds its ETC window).
- Cost/Hours toggle reused where sensible (cost focus for v1).
- JTB001 demo only; in-session state; no EAC Gantt in v1.

## Verification targets

- Nav: Project EAC expands to Create/Edit EAC + Display EAC.
- Fresh EAC = baseline (EAC total ties to baseline BAC before edits).
- Period selector splits ACWP (≤period, locked) / ETC (>period, editable on Edit only).
- Editing an ETC cell and the forecast finish rolls up to WP/CA/summary; VAC updates.
- Display EAC is fully read-only; both screens show the period selector on top.
- No console errors.
