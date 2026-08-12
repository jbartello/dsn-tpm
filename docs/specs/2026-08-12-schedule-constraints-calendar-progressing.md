# Master Schedule — Calendar, Constraints, and Progressing (P6/MSP parity)

**Date:** 2026-08-12
**File:** `dassian-tpm-springboard.html` (Master Schedule + CPM engine + Edit Plan activity editor)
**Scope:** Demo program only (JTB001). In-session state, consistent with the rest of the prototype.

## Purpose

Bring the Master Schedule closer to MS Project / Primavera P6 by adding the three highest-leverage capabilities it currently lacks:

1. **A real working calendar** (holidays) that all schedule math respects.
2. **Schedule constraints + negative float** so activities can be anchored to dates and the network can show being behind a required date.
3. **Status / data-date progressing** that produces forecast dates (Actual dates, remaining duration, % complete rescheduled to the data date).

## Guiding architecture

**Constraints live in the plan CPM; progressing is a read-only forecast overlay.**

- `schedComputeAll` (the plan CPM) already writes computed dates back to `t.start`/`t.finish`, and those dates drive baseline cost. **Constraints extend this plan CPM directly** — they change planned dates and float.
- **Progressing does NOT mutate plan dates or cost.** A separate `schedForecast(dataDate)` pass computes forecast/progressed dates for display only, preserving the PMB and time-phased cost and enabling a plan-vs-forecast comparison.

## 1. Calendar / Holidays (foundational)

- **Data:** global `SCHED_HOLIDAYS` — a set of working-day-excluded dates (stored as date-number keys). Workweek remains Mon–Fri.
- **Engine:** `bdIsWD(d)` returns false on weekends **and** on any holiday. All working-day helpers (`bdShiftWD`, `bdWorkdaysBetween`, `bdSnapWD`, `bdSnapWDback`) already route through `bdIsWD`, so CPM, lag, and duration math respect holidays automatically. Adding/removing a holiday invalidates the CPM cache and reschedules.
- **UI:** a collapsible **Working Calendar** card on the Master Schedule — list current holidays, add a date, remove a date.

## 2. Constraints + negative float

- **Data (per activity & milestone):** `constraint: { type, date }` where `type ∈ '' (ASAP) | SNET | SNLT | FNET | FNLT | MSO | MFO`, plus optional `deadline` (date).
- **Forward pass (early constraints), applied after predecessor push:**
  - `SNET` → `es = max(es, snap(date))`
  - `FNET` → `es = max(es, snap(date) − (d−1))`
  - `MSO` → `es = snap(date)` (mandatory; overrides predecessor logic)
  - `MFO` → `es = snap(date) − (d−1)` (mandatory)
- **Backward pass (late constraints), applied against `lf` (init `lf = PF`):**
  - `SNLT` → `lf = min(lf, snap(date) + (d−1))`
  - `FNLT` → `lf = min(lf, snap(date))`
  - `MFO` → `lf = min(lf, snap(date))`
  - `deadline` → `lf = min(lf, snap(deadline))` (float only; does not move the task in the forward pass)
- **Negative float:** `schedFloatDays(es, ls)` already returns signed working days; late constraints earlier than logic requires yield negative total float. `critical = linked && float ≤ 0` (unchanged) now also flags behind-schedule chains.
- **Conflict flag:** when a mandatory `MSO`/`MFO` date is earlier than the predecessor-driven early date (logic violated), mark the node with a ⚠ conflict indicator.
- **Display:** negative float rendered in red in the subtask table, milestone table, and Gantt tooltips.
- **UI entry:** a **Schedule Attributes** panel for the selected activity in Edit Plan (adjacent to the predecessor editor): constraint type dropdown + date + deadline. Milestones get the same controls in their Master Schedule link/attributes editor.

## 3. Status / data-date progressing

- **Data date (DD):** the last calendar day of the shared **Month-End** period (`pvState.period`, `YYYY-MM`). A read-out/selector appears on the Master Schedule.
- **Data (per activity):** `pct` (schedule % complete 0–100, default 0), optional `actualStart`, optional `actualFinish`.
- **`schedForecast(DD)` — retained-logic overlay (does not mutate plan):** topological order over plan nodes + milestones; for each node return `{ fStart, fFinish, state }` where `state ∈ complete | inprogress | notstarted`:
  - **Complete** (`pct >= 100` or `actualFinish`): `fStart = actualStart || planStart`; `fFinish = actualFinish || min(planFinish, DD)`. Drives successors by `fFinish`.
  - **In progress** (`0 < pct < 100`): `fStart = actualStart || max(predForecast, planStart)`; `remDur = ceil(origDur × (1 − pct/100))`; remaining scheduled from the data date → `fFinish = shift(max(DD, predForecastDriven), remDur − 1)`.
  - **Not started** (`pct = 0`): `fStart = max(predForecast, DD, early-constraint)`; `fFinish = shift(fStart, d − 1)`. No remaining work before the data date.
- **Project forecast finish** = max `fFinish` across nodes. **Schedule variance (working days)** = signed `bdWorkdaysBetween(planProjectFinish, forecastProjectFinish)`.
- **Gantt visuals (Master Schedule):**
  - vertical **data-date line** at DD;
  - each activity bar shows a **progress fill** proportional to `pct`;
  - if `fFinish > planFinish`, a **hatched slip segment** extends the bar to the forecast finish.
- **Tiles:** add **Forecast Finish** and **Schedule Variance (wd)** to the summary strip.
- **UI entry:** the same Edit-Plan Schedule Attributes panel (pct, actual start, actual finish).

## Scope boundaries (YAGNI)

- Retained logic only — no progress override / out-of-sequence options.
- Single global calendar (holidays + Mon–Fri); no multiple/named/resource/activity calendars; no elapsed durations.
- No resource leveling; no project must-finish date (float measured against the computed finish plus any late constraints/deadlines).
- Milestones get constraints + an optional actual date; no partial % (0/100).
- Progressing stays **independent** of EV Status / EAC (no auto-feed of forecast finish or % complete).
- Demo **JTB001** only; in-session state; changes recompute live.

## Verification targets

- Adding a holiday inside an activity's span lengthens durations crossing it and pushes dependent dates.
- Each constraint type resolves correctly; a `FNLT`/`deadline` earlier than logic produces negative float shown red and flags the node critical; a violated `MSO`/`MFO` shows the conflict marker.
- Progressing: complete / in-progress / not-started activities render correctly relative to the data-date line; forecast finish and schedule variance compute; **plan dates and time-phased cost are unchanged** by any progressing edit.
- Baseline modules (Display Baseline, Edit Plan cost, EAC) are unaffected by progressing.
- No console errors.
