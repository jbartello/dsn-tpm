# Earned Value Status

**Date:** 2026-08-05
**File:** `dassian-tpm-springboard.html` (Earned Value Status module)
**Scope:** Demo program only (project JTB001), consistent with the WBS-tree modules.

## Purpose

A per-work-package earned-value status screen. Show the WBS structure (summary → control account → work package) with each WP's EV method from Project Setup, and the schedule subtasks beneath each WP. Each task carries an editable EV method and a method-aware % complete; task earned value rolls up (budget-weighted, per EV standards) to a WP % complete and on up the WBS. LOE work packages are calculated (time-based), not manually updated, but their %C is displayed.

## Data

Extend each subtask in `schedData` with:
- `evm` — EV method (one of the 9 catalog methods). Defaults to the parent WP's Project-Setup **Default EV Method** (`psData.wp[wp].ev`); individually overridable per task. (Confirmed (b).)
- `pc` — % complete 0–100 (default 0). Not used/stored for LOE (computed).

Task **BAC** = Σ of the task's `res` monthly values (existing).

## Per-method % complete (method-aware single input)

- **% Complete / Earned Standards (EST) / Units Complete / Milestone (Weighted) / Apportioned Effort** → free 0–100 entry (v1: no method sub-inputs; user assesses the number).
- **0/100** → "complete?" checkbox → 0 or 100.
- **50/50** → start/complete toggle → 0 / 50 / 100.
- **25/75** → start/complete toggle → 0 / 25 / 100.
- **Level of Effort (LOE)** → auto, read-only: `pc = cumulative task budget in months up to the data date ÷ total task budget`. Reads 100% once the data date passes the WP finish. (Confirmed (c): budget-to-date basis, not elapsed working days.)

## Roll-up (budget-weighted, confirmed (a))

- Task BCWP = `pc/100 × BAC`.
- Node %C (WP, CA, summary, project) = `Σ(descendant task BCWP) ÷ Σ(descendant task BAC) × 100`.
- Node BCWP = `Σ(descendant task BCWP)`; Node BAC = `Σ(descendant task BAC)`.
- Applies at every WBS level so the whole structure shows a weighted %C and earned $.

## Data date

From the existing **Month-End** selector (`pvState.period`, `YYYY-MM`). Used only for LOE: map the period's year-month onto the schedule (CAP_TP) month index and sum the task's monthly budget through that index. If the period is before the task starts → 0%; on/after its last funded month → 100%.

## UI

Expandable indented table on the Earned Value Status screen (its own expand state; reuses `bdBuild` tree + `schedTasks`). Columns:

| Column | Summary / CA / WP rows | Task rows |
|---|---|---|
| Name | WBS id · description (indented, caret to expand) | task id · name |
| EV Method | WP's Project-Setup method (read-only) | editable dropdown (defaults to WP method) |
| BAC | rolled-up $ | task $ |
| % Complete | rolled-up (read-only) | method-aware input; LOE = calc (read-only, greyed) |
| BCWP (Earned) | rolled-up $ | `pc × BAC` |

- WPs expand to reveal their tasks. Editing a task's method or %C recomputes and rolls up live.
- A summary strip (tiles): Total BAC, Earned (BCWP), overall % complete, data date.
- Program gate: JTB001 only; other programs show a placeholder (like Display Baseline / Edit Plan).

## Scope boundaries (YAGNI)

- All 9 catalog EV methods accepted; Apportioned/Milestone/Units/EST are free-% entry in v1 (no milestone lists, units, or driver-task linkage).
- LOE earned on budget-to-date (not a separate working-day calc).
- In-session state (no backend), like the rest of the prototype.
- JTB001 demo only.

## Verification targets

- WP rows show the Setup EV method; tasks default to it and can override.
- 0/100, 50/50, 25/75 toggles set the right %C; % Complete accepts free entry.
- LOE tasks compute %C from the data date (0 before start, partial mid, 100 after finish) and are read-only.
- WP %C equals the budget-weighted roll-up of its tasks; CA/summary roll up the same way.
- Editing a task recomputes the WP/CA/summary %C and BCWP live; no console errors.
