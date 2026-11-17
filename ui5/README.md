# Dassian TPM — SAP Fiori elements / UI5

A UI5 port of the TPM prototype (`../dassian-tpm-springboard.html`), built as a **SAP Fiori elements** app on an **OData V4 mock** service. The list/object-page modules are generated from OData annotations (metadata-driven); the bespoke analytical screens (EVM charts, Gantt, 5×5 risk matrix, Monte Carlo, waterfall) are added as **custom pages/sections** inside the same Fiori elements app.

## Architecture

```
ui5/
  package.json            devDeps: @ui5/cli, @sap-ux/ui5-middleware-fe-mockserver
  ui5.yaml                UI5 tooling + fe-mockserver (serves OData V4 at /odata/mainService)
  webapp/
    index.html            UI5 CDN/tooling bootstrap, Horizon theme
    Component.js          extends sap.fe.core.AppComponent
    manifest.json         app descriptor: data source, models, FE routing (List Report + Object Page)
    view/App.view.xml     sap.m.App root (NavContainer routing)
    i18n/i18n.properties
    annotations/annotations.xml   UI annotations (LineItem, SelectionFields, HeaderInfo, Facets, DataPoints)
    localService/mainService/
      metadata.xml        OData V4 EDMX (Program, Project, ControlAccount)
      data/*.json         mock data generated from the real prototype data
```

- **Model:** JSON mock data served as OData V4 by the Fiori-tools mock server, so the same app runs unchanged against a real ABAP CDS/RAP service later (swap the data source).
- **Theme:** `sap_horizon` — the current Fiori look the HTML prototype hand-rolled.
- **R/Y/G bands:** carried as `*Criticality` fields (1=red, 2=amber, 3=green) and rendered via `UI.DataPoint` criticality — no custom CSS.

## Run it

Requires Node 18+.

```bash
cd ui5
npm install
npm start
```

`npm start` launches the UI5 dev server with the OData mock and opens the app.

Two entry points:
- **`index.html`** — the app standalone (a tile launchpad home routes to each module).
- **`flp.html`** — the app inside the full **Fiori Launchpad shell** (`sap.ushell` sandbox): SAP shell bar, user menu, with the app embedded. Boots straight into the app via the `#tpm-display` intent.

Every module is reachable from the tile launchpad; Control Accounts / Risk Register / Project Setup / Baseline Change / Artifacts are Fiori elements List Reports + Object Pages, the rest are custom freestyle pages. A Demo / MFG program switch drives the custom pages.

## Module → page mapping

| Prototype screen | UI5 realization | Status |
|---|---|---|
| Project Values (Control Account summary) | FE **List Report + Object Page** on `ControlAccount` | ✅ Phase 1 (list verified) |
| Risk Register (risks & opportunities) | FE **List Report + Object Page** on `Risk`, with PMBOK fields (Risk ID, RBS category, response strategy, triggers) and cause/event/effect | ✅ Phase 2 (list verified) |
| Risk 5×5 probability/impact matrix | Custom freestyle page: zone-shaded 5×5 heatmap built from `Risk` data | ✅ Phase 4 |
| Project Analytics (EVM charts) | Custom freestyle page: `sap.viz` VizFrame (BAC vs EAC column, CPI/SPI scatter) | ✅ Phase 4 |
| Springboard launchpad | FLP sandbox (`sap.ushell`) — single entry linking both apps | ▢ Phase 4 |
| Project Setup | FE List Report + Object Page on `Project`: Project Header section + embedded Control Accounts table (navigation) | ✅ Phase 7 |
| Project Baseline / Change Request | FE List Report + Object Page on `BaselineChange` (9 BCR/FCR records) | ✅ Phase 8 |
| Project EAC | Custom freestyle page: BAC / Contract EAC / IEAC(CPI) / IEAC(CPI×SPI) / VAC per CA + program rollup | ✅ Phase 7 |
| Master Schedule + Monte Carlo | Custom freestyle page: activity table + Monte Carlo schedule-risk (triangular durations, P-values, completion-confidence S-curve via VizFrame, LOE toggle) | ✅ Phase 5 |
| Variance Analysis Report | Custom freestyle page: expandable Format-5 narrative per out-of-tolerance CA (EVM stat grid, AI-draft, reactive completeness, approve workflow) | ✅ Phase 6 |
| Artifacts & Reports | FE List Report + Object Page on `Artifact` (10-document catalog) | ✅ Phase 8 |
| Springboard launchpad (tile home) | In-app `GenericTile` launchpad routing to each app | ✅ Phase 3 |
| Object Pages (Control Account, Risk) | FE Object Page, all fields binding | ✅ Phase 3 (fixed) |

### Phase 3 notes
- **Object pages fixed.** The blank numeric fields were an `Edm.Decimal` representation bug: OData V4 carries decimals as JSON **strings**, but the mock emitted numbers, so UI5's Decimal type rendered them empty. Decimal mock fields are now strings; Control Account and Risk object pages fully populate.
- **Launchpad.** The entry page (`index.html`) is a tile springboard (Control Accounts, Risk Register) that routes into each FE app and back. This is an **in-app** launchpad, not the full `sap.ushell` FLP shell — the FLP sandbox (`sandbox2.js`) needs extra spaces/pages config in this npm distribution, which can be added later for the exact FLP chrome. The standalone runtime logs a non-fatal `navigationService.storeInnerAppStateAsync` message (the full shell app-state service isn't present); navigation still completes.

## Production path

Replace the mock with an **ABAP RAP** service: CDS views for Control Accounts, Work Packages, WBS, Risks, Schedule Activities, exposed as OData V4, with the same UI annotations moved to CDS metadata extensions. The Fiori elements front end stays essentially unchanged.
