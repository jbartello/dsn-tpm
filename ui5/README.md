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

`npm start` launches the UI5 dev server with the OData mock and opens the app. The Control Accounts list is live, filterable by Program / Project / CAM, with CPI/SPI/VAC coloured by status; click a row for the Control Account object page.

## Module → page mapping

| Prototype screen | UI5 realization | Status |
|---|---|---|
| Project Values (Control Account summary) | FE **List Report + Object Page** on `ControlAccount` | ✅ Phase 1 |
| Project Analytics (EVM charts) | Custom OP section with `sap.viz` VizFrame charts | ▢ Phase 2 |
| Risk Register (risks/opps, 5×5 matrix) | FE List Report on `Risk` + custom matrix section | ▢ Phase 2 |
| Project Setup (header / CA / WP / MR-UB) | FE Object Page with sub-sections | ▢ Phase 3 |
| Project Baseline / Change Request | FE List Report + Object Page on `BaselineChange` | ▢ Phase 3 |
| Project EAC | FE Object Page + editable table | ▢ Phase 3 |
| Master Schedule + Monte Carlo | Custom page: `sap.gantt` + VizFrame S-curve | ▢ Phase 4 |
| Variance Analysis Report | FE List Report + custom expandable narrative | ▢ Phase 4 |
| Artifacts & slide-outs | FE List Report + dialogs | ▢ Phase 4 |
| Springboard launchpad | FLP sandbox (`sap.ushell`) with tiles | ▢ Phase 4 |

## Production path

Replace the mock with an **ABAP RAP** service: CDS views for Control Accounts, Work Packages, WBS, Risks, Schedule Activities, exposed as OData V4, with the same UI annotations moved to CDS metadata extensions. The Fiori elements front end stays essentially unchanged.
