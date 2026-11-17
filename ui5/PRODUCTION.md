# Productionizing — from OData V4 mock to ABAP RAP

This app is built as **SAP Fiori elements on OData V4**. The only thing that is
"mock" is the data source: an in-memory `fe-mockserver` reading JSON. To make it
a real product, replace that mock with an **ABAP RAP** OData V4 service. The
Fiori elements front end — views, routing, UI annotations, and the custom
freestyle pages — stays essentially unchanged.

```
  Today (prototype)                         Production
  ─────────────────                         ──────────
  webapp (FE + custom pages)                webapp (unchanged)
        │ OData V4                                │ OData V4
  fe-mockserver (JSON)          ───►        ABAP RAP service
  localService/metadata.xml                 CDS views + behavior
  localService/data/*.json                  S/4 (or BTP ABAP) tables
```

## 1. Entity → CDS mapping

Each mock entity becomes a CDS **interface view** (`I_…`) over the source
table(s), plus a **projection/consumption view** (`C_…`) exposed on the service.

| Mock entity (`metadata.xml`) | Source in S/4 / Dassian | CDS projection |
|---|---|---|
| `Program` | Program master | `C_TPMProgram` |
| `Project` | Project / WBS header | `C_TPMProject` |
| `ControlAccount` | CO / EVM control-account data (the "two scoreboards" CO-vs-FI reads matter here) | `C_TPMControlAccount` |
| `Risk` | Risk register table | `C_TPMRisk` |
| `ScheduleActivity` | IMS / schedule activities | `C_TPMScheduleActivity` |
| `BaselineChange` | BCR/FCR log | `C_TPMBaselineChange` |
| `Artifact` | Document/artifact catalog | `C_TPMArtifact` |

Associations (`Project → ControlAccounts`, etc.) become CDS `association`s, which
RAP exposes as OData navigation — the Project object page's embedded Control
Accounts table then works exactly as it does against the mock.

## 2. UI annotations

The UI annotations in `webapp/annotations/annotations.xml` (LineItem,
SelectionFields, HeaderInfo, Facets, DataPoint criticality) move into **CDS
metadata extensions** (`@UI.lineItem`, `@UI.selectionField`, `@UI.facet`,
`@UI.dataPoint`). Same vocabulary, authored in ABAP instead of XML. The list
report / object page templates read them identically.

Example — `ControlAccount` (abbreviated), see `docs/C_TPMControlAccount.cds`:

```abap
@UI.lineItem: [{ position: 10, label: 'WBS / CA' }]
ID;
@UI.dataPoint: { title: 'CPI', criticality: 'CPICriticality' }
@UI.lineItem: [{ position: 70, label: 'CPI' }]
CPI;
```

Criticality (the R/Y/G bands) is computed in the CDS view with a `CASE` on
CPI/SPI/VAC, exactly like the `*Criticality` fields the mock pre-computes.

## 3. Service exposure

1. **Service Definition** — `define service ZUI_TPM { expose C_TPMProgram; expose C_TPMProject; … }`.
2. **Service Binding** — type **OData V4 — UI**; activate; publish.
3. The binding's URL (e.g. `/sap/opu/odata4/sap/zui_tpm/srvd/sap/zui_tpm/0001/`)
   replaces the mock `uri` in `manifest.json`'s `mainService` data source.

## 4. Editable scenarios (RAP behavior)

The Risk narrative, VAR approve, and BCR workflow are read-only against the mock.
To make them persist, add a **RAP behavior definition** on the relevant
projection (`managed` or `unmanaged`), with:
- fields/actions (e.g. `action approveVAR`, `action aiDraftNarrative`),
- determinations/validations (e.g. recompute criticality on modify),
- draft handling for the object-page edit flow.

The Fiori elements object pages pick up create/update/actions automatically from
the behavior; the custom VAR page would call the action via the OData model.

## 5. The custom (freestyle) pages

Project Analytics, Risk Matrix, Master Schedule + Monte Carlo, VAR, Project EAC
and the Report Viewer read through the same OData V4 model (`bindList` /
`requestContexts`), so they run **unchanged** against the RAP service. Options to
push logic to the backend:
- **Analytics / EAC rollups** → CDS analytical (`@Analytics.dataCategory`) or a
  dedicated aggregate view, instead of client-side `parseFloat`/reduce.
- **Monte Carlo** → stays client-side (it's a simulation), or becomes a RAP
  action returning the P-values if you want server-side runs.
- **Report Viewer** tables (WBS/RAM/CAP/Tripwire/Control Log) → each becomes its
  own CDS view + OData entity; swap the static `reports.json` for `bindList`.

## 6. What changes in `webapp/`

| File | Change |
|---|---|
| `manifest.json` → `dataSources.mainService.uri` | point at the RAP service URL |
| `ui5.yaml` | drop `sap-fe-mockserver`; add `fiori-tools-proxy` to the backend |
| `localService/` | remove (metadata + data now come from the backend) |
| everything else (views, controllers, annotations, custom pages, FLP) | **unchanged** |

## 7. Tooling

Develop CDS + RAP in **ABAP Development Tools (ADT)** or the **ABAP MCP / SAP
Build** tooling; transport via the standard CTS. This repo's front end is the
deliverable that sits on top — it is intentionally backend-agnostic.

> This document is a design/scaffolding guide. No changes are made to any live
> SAP system from here; CDS/RAP objects are created in ADT against the target
> system under the normal transport and review process.
