# Schedule-Integrated Subtasks — Edit Plan

**Date:** 2026-06-22
**File:** `dassian-tpm-springboard.html` (Edit Plan module + schedule Gantt)
**Scope:** Demo program only (project JTB001 · PPC/SIS Demo 1), consistent with the other WBS-tree modules.

## Purpose

Turn Edit Plan into a cost- and schedule-integrated system. Replace work-package-level direct cost planning with **cost-loaded subtasks (activities)** beneath every work package. Each subtask carries both the resource cost grid **and** the schedule (start/finish, duration, predecessors). A Critical Path Method (CPM) engine computes the critical path and can reschedule from predecessor links. Work package → control account → summary levels roll up both cost and schedule, so the WBS tree, Display Baseline, the cost curve, and the Gantt all derive from one source. Moving the schedule moves the cost.

## Key decisions (from brainstorming)

- **Full replacement**, not additive: subtasks are mandatory under every WP. WP-direct planning is removed.
- **Subtasks carry their own cost**: each subtask has the monthly resource grid (existing catalog ENG/MFG/Material/…). Cells are editable **only within the task's [start, finish] window** (the existing date-window cell-lock). No baseline cost may fall outside the task dates.
- **Hybrid scheduling**: manual dates by default, plus a **"Reschedule from predecessors"** action that recomputes dates via CPM.
- **All four dependency types** — FS / SS / FF / SF — each with optional lead/lag.
- **Critical path** = chain of tasks with total float ≤ 0.
- **Cost shifts with the task**: on reschedule/move, a subtask's monthly resource values shift by the same number of months so the cost curve travels with the schedule and stays inside the window. (Confirmed.)
- **Dependency arrows deferred** for v1: show a Predecessors column + red critical-path bars instead. (Confirmed.)
- **Migration**: seed **one default subtask per WP** from current data. (Confirmed.)

## Data model

New global `window.SCHEDULE` (or in-memory `schedData`), keyed by work-package WBS id:

```
schedData.tasks[wpWbs] = [
  {
    id,                       // stable within the WP, e.g. wpWbs + '.T1'
    name,
    start, finish,            // 'MM/DD/YYYY'
    preds: [ { id, type, lag } ],   // type ∈ FS|SS|FF|SF; lag in working days (may be negative = lead)
    res: { ENG: [..50 monthly..], MFG: [...], ... }   // existing monthly catalog; cells locked to [start,finish]
  }, ...
]
```

- **Duration** is derived = working days (Mon–Fri) between start and finish (inclusive). Not stored.
- Resource catalog and monthly bucket axis (`CAP_TP.months`, 50 months) are unchanged.
- Date precision is daily; cost remains monthly-bucketed (a cell's month is editable if the task window overlaps it).

## Scheduling engine (CPM)

- **Working-day calendar**: Mon–Fri, no holidays. Helpers to add/subtract working days and count working days between dates.
- **Forward pass**: early start/finish per task honoring predecessor links + lag.
  - FS: succ.start ≥ pred.finish + lag
  - SS: succ.start ≥ pred.start + lag
  - FF: succ.finish ≥ pred.finish + lag
  - SF: succ.finish ≥ pred.start + lag
- **Backward pass** from project finish (max early finish across the WP's tasks) → late start/finish.
- **Total float** = LF − EF (in working days). **Critical = float ≤ 0.**
- **Manual mode**: dates entered directly; the engine still computes float/critical path from the current dates + links, and **flags conflicts** where a manual date violates a link.
- **Reschedule from predecessors**: preserves each task's duration, recomputes start from the binding predecessor constraint forward through the network (topological order; detect/avoid cycles), then re-derives finish. Tasks with no predecessors keep their manual start.
- Scope: CPM runs **within a work package's subtask network** (predecessors reference sibling subtasks of the same WP for v1).

## Cost ↔ schedule integration

- **Roll-up chain**: subtask grid → WP (sum of its subtasks) → CA → summary. This replaces the CAP_TP-sourced rollup for migrated WPs. `bdResSeries` / `bdPmbRange` / `bdNodeBCWS` and the Gantt read from `schedData` for WPs that have subtasks.
- **WP span** = min subtask start / max subtask finish. PMB Start/Finish cards and Gantt bars derive from this (unchanged formula, new source).
- **Cost travels with schedule**: when a subtask is rescheduled or its dates change by N months, its per-resource monthly arrays shift by N months (clamped to the timeline). Values never fall outside the [start, finish] window.
- **Cells outside the window stay locked** (the existing lock styling), so manual edits can't place budget outside the dates.

## Migration (full replacement)

On first entry to Edit Plan (lazy, once):

- For each WP (leaf in the current tree) that has time-phasing, create **one default subtask**:
  - `name` = WP description (e.g. "Airframe Integ., Assy, Test, Checkout")
  - `start`/`finish` = the WP's current span (first/last active month → month-start/month-end dates)
  - `res` = the WP's current rolled resource grid (`bdResSeries(wp)`)
  - `preds` = []
- WPs with no time-phasing start with **no subtasks** and an "Add subtask" affordance.
- After migration the WP grid is **read-only roll-up**; all editing happens at subtask level.

## UI

**Selecting a work package** → MS-Project-style **subtask table**:
- Columns: Name · Start · Finish · Duration (working days) · Predecessors · Float · Critical (flag).
- Actions: **+ Add subtask**, delete, and **Reschedule from predecessors**.
- Predecessors entered as `id` + type + lag (e.g. `T1 FS+5d`).

**Selecting a subtask** → its resource cost grid, date-window-locked, identical in behavior to today's WP grid (Cost/Hours/EQP toggle, per-cell edit, totals).

**Gantt** (existing section, extended):
- Subtask rows nested under their WP (indented one further level).
- **Critical-path bars red**, normal task bars blue, summary (WP/CA/summary) bars grey.
- A **Predecessors** column in the left label area (or appended to the label).
- Dependency arrows deferred.

## Scope boundaries (YAGNI / out of scope for v1)

- Daily date precision; cost bucketed monthly.
- Mon–Fri calendar; no holiday calendars.
- Predecessors reference sibling subtasks within the same WP (no cross-WP links yet).
- No resource leveling.
- No date constraints (SNET/FNLT/MSO) — predecessor-driven scheduling only.
- No dependency arrows on the Gantt (predecessor column + critical-path color instead).
- Demo project JTB001 only.
- In-memory/session state (no backend persistence), consistent with the rest of the prototype.

## Verification targets

- Migration seeds exactly one subtask per time-phased WP; WP roll-up cost equals the pre-migration WP cost.
- Editing a subtask cell rolls up to WP/CA/summary and the Gantt.
- Rescheduling moves dates per CPM and **shifts the cost curve** by the same offset; no budget lands outside the window.
- Critical path correctly identifies the zero-float chain for each link type (FS/SS/FF/SF + lag).
- Subtask bars render under WPs with critical-path coloring; tree ↔ Gantt stay in sync.
