sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/HashChanger",
  "sap/ui/model/json/JSONModel"
], function (Controller, HashChanger, JSONModel) {
  "use strict";

  // Placeholders carried from the prototype (link to SAP % Complete / REC fields later).
  var PV_PCT = { DEMO: 19, MFG: 37 };
  var PV_REC = { DEMO: 0.58, MFG: 0.64 };

  // Month-end periods with time-phasing factors (plan/earn/act), matching the prototype.
  var PERIODS = [
    { id: "2025-12", label: "Dec 2025", f: { plan: 0.20, earn: 0.14, act: 0.16 } },
    { id: "2026-01", label: "Jan 2026", f: { plan: 0.36, earn: 0.28, act: 0.31 } },
    { id: "2026-02", label: "Feb 2026", f: { plan: 0.54, earn: 0.44, act: 0.49 } },
    { id: "2026-03", label: "Mar 2026", f: { plan: 0.70, earn: 0.61, act: 0.66 } },
    { id: "2026-04", label: "Apr 2026", f: { plan: 0.86, earn: 0.80, act: 0.83 } },
    { id: "2026-05", label: "May 2026", f: { plan: 1.00, earn: 1.00, act: 1.00 } }
  ];
  var PERIOD_MAP = {};
  PERIODS.forEach(function (p) { PERIOD_MAP[p.id] = p; });

  function fmtM(v) {
    var a = Math.abs(v), s = v < 0 ? "-" : "";
    return a >= 1e6 ? s + "$" + (a / 1e6).toFixed(1) + "M" : a >= 1e3 ? s + "$" + (a / 1e3).toFixed(0) + "K" : s + "$" + a.toFixed(0);
  }
  function critState(v, red, amber) { return v >= amber ? "Success" : (v >= red ? "Warning" : "Error"); }

  return Controller.extend("dassian.tpm.ui5.controller.ProjectValues", {
    onInit: function () {
      this.getView().setModel(new JSONModel({ kpi: {}, rows: [], pct: 0, rec: 0, nonrec: 0 }), "pv");
      this.getView().setModel(new JSONModel({
        project: "", cam: "", period: "2026-05",
        projects: [], cams: [], periods: PERIODS.map(function (p) { return { key: p.id, text: p.label }; })
      }), "flt");
      this._raw = [];
      this._rawProg = null;
      this._load();
    },
    _prog: function () { return this.getOwnerComponent().getModel("ui").getProperty("/program"); },

    onProgramChange: function () {
      // program changed: reset the project & CAM filters (their option lists differ per program)
      this.getView().getModel("flt").setProperty("/project", "");
      this.getView().getModel("flt").setProperty("/cam", "");
      this._load();
    },
    onFilterChange: function () { this._compute(); },

    // Fetch the program's control accounts once, build the filter option lists, then compute.
    _load: function () {
      var prog = this._prog(), model = this.getOwnerComponent().getModel(), that = this;
      model.bindList("/ControlAccounts").requestContexts(0, 500).then(function (ctxs) {
        var raw = [], projSet = {}, camSet = {};
        ctxs.forEach(function (c) {
          var o = c.getObject();
          if (o.ProgramID !== prog) { return; }
          raw.push(o);
          if (o.ProjectID) { projSet[o.ProjectID] = true; }
          if (o.Manager) { camSet[o.Manager] = true; }
        });
        that._raw = raw;
        that._rawProg = prog;
        var flt = that.getView().getModel("flt");
        flt.setProperty("/projects", [{ key: "", text: "(All projects)" }].concat(Object.keys(projSet).map(function (k) { return { key: k, text: k }; })));
        flt.setProperty("/cams", [{ key: "", text: "(All CAMs)" }].concat(Object.keys(camSet).sort().map(function (k) { return { key: k, text: k }; })));
        that._compute();
      });
    },

    // Apply the project / CAM / period filters to the cached rows and recompute everything.
    _compute: function () {
      var prog = this._rawProg, flt = this.getView().getModel("flt").getData();
      var f = (PERIOD_MAP[flt.period] || PERIOD_MAP["2026-05"]).f;
      var rows = [], plan = 0, earned = 0, actual = 0, bac = 0, eac = 0, vac = 0;

      this._raw.forEach(function (o) {
        if (flt.project && o.ProjectID !== flt.project) { return; }
        if (flt.cam && o.Manager !== flt.cam) { return; }
        // time-phase PV/EV/AC by the selected month-end; BAC/EAC/VAC are at-completion (constant)
        var pv = (parseFloat(o.PlannedValue) || 0) * f.plan;
        var ev = (parseFloat(o.EarnedValue) || 0) * f.earn;
        var ac = (parseFloat(o.ActualCost) || 0) * f.act;
        var rBac = parseFloat(o.BAC) || 0, rEac = parseFloat(o.EAC) || 0, rVac = parseFloat(o.VAC) || 0;
        var cpi = ac ? ev / ac : 0, spi = pv ? ev / pv : 0;
        plan += pv; earned += ev; actual += ac; bac += rBac; eac += rEac; vac += rVac;
        rows.push({
          wbs: o.ID, desc: o.Description, cam: o.Manager,
          pvT: fmtM(pv), evT: fmtM(ev), acT: fmtM(ac), bacT: fmtM(rBac), eacT: fmtM(rEac),
          vacT: fmtM(rVac), vac: rVac,
          cpiT: cpi.toFixed(3), spiT: spi.toFixed(3),
          cpiState: critState(cpi, 0.9, 1), spiState: critState(spi, 0.9, 1)
        });
      });

      var cpi = actual ? earned / actual : 0, spi = plan ? earned / plan : 0;
      var basePct = PV_PCT[prog] != null ? PV_PCT[prog] : 20;
      var pct = Math.round(basePct * f.earn);                     // % complete shifts with the period
      var ratio = PV_REC[prog] != null ? PV_REC[prog] : 0.6;
      var rec = bac * ratio, nonrec = bac * (1 - ratio);

      this.getView().getModel("pv").setData({
        rows: rows,
        pct: pct,
        rec: rec, nonrec: nonrec, recT: fmtM(rec), nonrecT: fmtM(nonrec),
        kpi: {
          bacT: fmtM(bac), eacT: fmtM(eac), vacT: fmtM(vac),
          cpiT: cpi.toFixed(3), spiT: spi.toFixed(3),
          cvT: fmtM(earned - actual), svT: fmtM(earned - plan),
          bcwsT: fmtM(plan), bcwpT: fmtM(earned), acwpT: fmtM(actual),
          cpiState: cpi >= 1 ? "Success" : (cpi >= 0.9 ? "Warning" : "Error"),
          spiState: spi >= 1 ? "Success" : (spi >= 0.9 ? "Warning" : "Error"),
          vacState: vac >= 0 ? "Success" : "Error"
        }
      });
    },

    onNavBack: function () { HashChanger.getInstance().setHash(""); }
  });
});
