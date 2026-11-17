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

Every module is reachable from the tile launchpad (9 tiles, matching the prototype's screens). Project Values / Project Setup / Baseline Change are Fiori elements List Reports + Object Pages; Risk Information, Project Analytics, Master Schedule + Monte Carlo, Variance Analysis, Project EAC and Artifacts & Reports are custom freestyle pages. A Demo / MFG program switch drives the custom pages.

## Module → page mapping

| Prototype screen | UI5 realization | Status |
|---|---|---|
| Project Values (Control Account summary) | FE **List Report + Object Page** on `ControlAccount` | ✅ |
| **Risk Information** | One screen: 5×5 probability/impact matrix + Risks/Opportunities register + detail dialog (Details / Scoring / Mitigation), program-aware. PMBOK fields on `Risk` (Risk ID, RBS category, response strategy, triggers) and cause/event/effect | ✅ |
| Project Analytics (EVM charts) | Custom freestyle page: `sap.viz` VizFrame (BAC vs EAC column, CPI/SPI scatter) | ✅ Phase 4 |
| Springboard launchpad | FLP sandbox (`sap.ushell`) — single entry linking both apps | ▢ Phase 4 |
| Project Setup | FE List Report + Object Page on `Project`: Project Header section + embedded Control Accounts table (navigation) | ✅ Phase 7 |
| Project Baseline / Change Request | FE List Report + Object Page on `BaselineChange` (9 BCR/FCR records) | ✅ Phase 8 |
| Project EAC | Custom freestyle page: BAC / Contract EAC / IEAC(CPI) / IEAC(CPI×SPI) / VAC per CA + program rollup | ✅ Phase 7 |
| Master Schedule + Monte Carlo | Custom freestyle page: activity table + Monte Carlo schedule-risk (triangular durations, P-values, completion-confidence S-curve via VizFrame, LOE toggle) | ✅ Phase 5 |
| Variance Analysis Report | Custom freestyle page: expandable Format-5 narrative per out-of-tolerance CA (EVM stat grid, AI-draft, reactive completeness, approve workflow) | ✅ Phase 6 |
| Artifacts & Reports | One screen: the 10-document catalog where opening a row shows that report — WBS Dictionary / RAM / CAP / Tripwire / Control Log open an embedded data grid; IMS / VAR navigate to their module | ✅ |
| Springboard launchpad (tile home) | In-app `GenericTile` launchpad routing to each app | ✅ Phase 3 |
| Object Pages (Control Account, Risk) | FE Object Page, all fields binding | ✅ Phase 3 (fixed) |

### Phase 3 notes
- **Object pages fixed.** The blank numeric fields were an `Edm.Decimal` representation bug: OData V4 carries decimals as JSON **strings**, but the mock emitted numbers, so UI5's Decimal type rendered them empty. Decimal mock fields are now strings; Control Account and Risk object pages fully populate.
- **Launchpad.** `index.html` is the tile springboard; `flp.html` runs the same app inside the full `sap.ushell` Fiori Launchpad shell. The standalone runtime logs a non-fatal `navigationService.storeInnerAppStateAsync` message; navigation still completes.

## Production path

Replace the mock with an **ABAP RAP** service: CDS views for the entities,
exposed as OData V4, with the UI annotations moved to CDS metadata extensions.
The Fiori elements front end stays essentially unchanged. See **[PRODUCTION.md](PRODUCTION.md)**
for the full entity→CDS mapping, service exposure, RAP behavior, and what changes
in `webapp/` — plus an example CDS view in [docs/C_TPMControlAccount.cds](docs/C_TPMControlAccount.cds).
