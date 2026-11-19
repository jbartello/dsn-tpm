sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/HashChanger",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast"
], function (Controller, HashChanger, JSONModel, MessageToast) {
  "use strict";

  // Program / contract identification (ported from the prototype PROG_INFO).
  var PROG_INFO = {
    DEMO: {
      progName: "PPC/SIS Demonstration Program 1", progNo: "JTB001",
      contractNo: "DEMO-JTB001-C-0001", contractType: "Cost Plus Incentive Fee (CPIF)",
      customer: "U.S. Air Force — AFLCMC (demo)", prime: "Dassian Aerospace (demo prime)",
      pm: "Jason Bartello", pop: "01/01/2022 – 02/27/2026",
      coe: "Air Vehicle Systems COE", sbu: "Combat Air SBU", cbt: "USAF Fighter/Trainer CBT",
      productFamily: "Fighter / Trainer Aircraft", pmFocal: "Jason Bartello", ppcFocal: "E. Hayes", engLead: "R. Reed", ipdsPhase: "EMD (Phase C)",
      evms: "Compliant — EIA-748 (Validated)", reporting: "IPMDAR — Monthly", oversight: "DCMA (demo)"
    },
    MFG: {
      progName: "Manufacturing Production Program", progNo: "MFG-2024",
      contractNo: "DEMO-MFG-C-0042", contractType: "Fixed-Price Incentive, Firm (FPIF)",
      customer: "U.S. Navy — NAVAIR (demo)", prime: "Dassian Manufacturing (demo prime)",
      pm: "Program Office", pop: "10/01/2023 – 09/30/2027",
      coe: "Manufacturing & Production COE", sbu: "Naval Systems SBU", cbt: "USN NAVAIR CBT",
      productFamily: "Naval Aircraft Systems", pmFocal: "Program Office", ppcFocal: "T. LaRue", engLead: "L. Johnson", ipdsPhase: "Production & Deployment (Phase D)",
      evms: "Compliant — EIA-748", reporting: "IPMDAR — Monthly", oversight: "DCMA (demo)"
    }
  };
  var PV_PCT = { DEMO: 19, MFG: 37 };
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
  function money(n) { return "$" + Math.round(n).toLocaleString("en-US"); }

  return Controller.extend("dassian.tpm.ui5.controller.ProgramInfo", {
    onInit: function () {
      this.getView().setModel(new JSONModel({
        edit: false, hasData: false,
        info: {}, kpi: {}, budget: {}, evms: {},
        period: "2026-05", periods: PERIODS.map(function (p) { return { key: p.id, text: p.label }; })
      }), "pi");
      this._store = {};     // session edits to identification, per program
      this._load();
    },
    _prog: function () { return this.getOwnerComponent().getModel("ui").getProperty("/program"); },

    onProgramChange: function () { this.getView().getModel("pi").setProperty("/edit", false); this._load(); },
    onPeriodChange: function () { this._compute(); },

    _load: function () {
      var prog = this._prog(), model = this.getOwnerComponent().getModel(), that = this;
      model.bindList("/ControlAccounts").requestContexts(0, 500).then(function (ctxs) {
        var raw = [];
        ctxs.forEach(function (c) { var o = c.getObject(); if (o.ProgramID === prog) { raw.push(o); } });
        that._raw = raw;
        that._rawProg = prog;
        // identification + contract values: session edits override the shipped defaults
        var info = Object.assign({}, PROG_INFO[prog] || PROG_INFO.DEMO, that._store[prog] || {});
        // seed the editable contract-value fields from the BAC-derived defaults
        // (only when not already set by a prior edit), matching the prototype.
        var bac = raw.reduce(function (t, o) { return t + (parseFloat(o.BAC) || 0); }, 0);
        if (info.tc == null) { info.tc = Math.round(bac); }
        if (info.fee == null) { info.fee = Math.round(bac * 0.08); }
        if (info.cv == null) { info.cv = Math.round((parseFloat(info.tc) || 0) + (parseFloat(info.fee) || 0)); }
        if (info.ceiling == null) { info.ceiling = Math.round((parseFloat(info.cv) || 0) * 1.15); }
        that.getView().getModel("pi").setProperty("/info", info);
        that._compute();
      });
    },

    _compute: function () {
      var prog = this._rawProg, m = this.getView().getModel("pi");
      var per = PERIOD_MAP[m.getProperty("/period")] || PERIOD_MAP["2026-05"], f = per.f;
      var raw = this._raw || [], hasData = raw.length > 0;
      var plan = 0, earned = 0, actual = 0, bac = 0, eac = 0, vac = 0;
      raw.forEach(function (o) {
        plan += (parseFloat(o.PlannedValue) || 0) * f.plan;
        earned += (parseFloat(o.EarnedValue) || 0) * f.earn;
        actual += (parseFloat(o.ActualCost) || 0) * f.act;
        bac += parseFloat(o.BAC) || 0;
        eac += parseFloat(o.EAC) || 0;
        vac += parseFloat(o.VAC) || 0;
      });
      var cpi = actual ? earned / actual : 0, spi = plan ? earned / plan : 0;
      var pct = Math.round((PV_PCT[prog] != null ? PV_PCT[prog] : 20) * f.earn);

      // Contract value / cost / fee / ceiling are user-editable (seeded in _load);
      // the budget-side figures (CBB/TAB/BAC/MR/UB) roll up from the WBS BAC.
      var info = m.getProperty("/info") || {};
      var tc = parseFloat(info.tc) || 0, fee = parseFloat(info.fee) || 0;
      var cv = parseFloat(info.cv) || 0, ceiling = parseFloat(info.ceiling) || 0;
      var mr = bac * 0.04, cbb = bac + mr, tab = cbb, ub = bac * 0.01;
      var dash = function (v, fn) { return hasData ? fn(v) : "—"; };

      m.setProperty("/hasData", hasData);
      m.setProperty("/kpi", {
        bacT: dash(bac, fmtM), eacT: dash(eac, fmtM), vacT: dash(vac, fmtM),
        cpiT: hasData ? cpi.toFixed(2) : "—", spiT: hasData ? spi.toFixed(2) : "—", pctT: hasData ? pct + "%" : "—",
        eacState: eac <= bac ? "Success" : "Error",
        vacState: vac >= 0 ? "Success" : "Error",
        cpiState: cpi >= 1 ? "Success" : (cpi >= 0.95 ? "Warning" : "Error"),
        spiState: spi >= 1 ? "Success" : (spi >= 0.95 ? "Warning" : "Error")
      });
      m.setProperty("/budget", {
        cvT: dash(cv, money), tcT: dash(tc, money), feeT: dash(fee, money), ceilingT: dash(ceiling, money),
        cbbT: dash(cbb, money), tabT: dash(tab, money), bacT: dash(bac, money), mrT: dash(mr, money), ubT: dash(ub, money)
      });
      m.setProperty("/evms", {
        evms: m.getProperty("/info/evms"), reporting: m.getProperty("/info/reporting"),
        oversight: m.getProperty("/info/oversight"), period: per.label
      });
    },

    onEdit: function () { this.getView().getModel("pi").setProperty("/edit", true); },
    onCancelEdit: function () {
      this.getView().getModel("pi").setProperty("/edit", false);
      this._load();   // discard unsaved edits
    },
    onSave: function () {
      var m = this.getView().getModel("pi"), info = Object.assign({}, m.getProperty("/info"));
      this._store[this._rawProg] = info;        // persist this session's edits
      m.setProperty("/edit", false);
      this._compute();                          // EVMS section reads from info
      MessageToast.show("Program information saved for " + (info.progNo || this._rawProg) + ".");
    },

    onOpenRisk: function () { HashChanger.getInstance().setHash("RiskInfo"); },
    onOpenSchedule: function () { HashChanger.getInstance().setHash("MasterSchedule"); },
    onNavBack: function () { HashChanger.getInstance().setHash(""); }
  });
});
