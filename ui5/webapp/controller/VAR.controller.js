sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/HashChanger",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast",
  "sap/m/Dialog",
  "sap/m/Button",
  "sap/m/TextArea",
  "sap/m/Label",
  "sap/m/Text",
  "sap/m/VBox"
], function (Controller, HashChanger, JSONModel, MessageToast, Dialog, Button, TextArea, Label, Text, VBox) {
  "use strict";

  // Month-end periods with time-phasing factors (plan/earn/act), matching Project Values.
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
    return a >= 1e6 ? s + "$" + (a / 1e6).toFixed(1) + "M"
      : a >= 1e3 ? s + "$" + (a / 1e3).toFixed(0) + "K"
        : s + "$" + a.toFixed(0);
  }
  function pctStatus(pct) { return pct <= -10 ? "out" : (pct <= -5 ? "watch" : "ok"); }
  function stateOf(st) { return st === "out" ? "Error" : (st === "watch" ? "Warning" : "Success"); }
  function statusText(st) { return st === "out" ? "Out" : (st === "watch" ? "Watch" : "In tol."); }

  function camEmail(name) {
    var n = (name || "").trim();
    if (n.indexOf(" ") > -1) { var parts = n.split(/\s+/); return (parts[0][0] + parts.slice(1).join("")).toLowerCase() + "@dassian.com"; }
    return n.toLowerCase() + "@dassian.com";
  }

  function narrative(a) {
    function seg(label, pct, prior, status, idxName, idxVal) {
      var where = status === "out" ? "is out of tolerance" : "is approaching the tolerance limit";
      var worsened = pct < prior, swing = Math.abs(pct - prior).toFixed(1);
      var trend = worsened
        ? "degraded from " + prior.toFixed(1) + "% last period — an unfavorable swing of " + swing + " pts"
        : "improved from " + prior.toFixed(1) + "% last period (+" + swing + " pts) but remains beyond tolerance";
      return label + " " + where + " at " + pct.toFixed(1) + "% (" + idxName + " " + idxVal.toFixed(2) + "), " + trend + ".";
    }
    var parts = [];
    if (a.flagCV) { parts.push(seg("Cost variance", a.cvp, a.priorCVpct, a.cvStatus, "CPI", a.cpi)); }
    if (a.flagSV) { parts.push(seg("Schedule variance", a.svp, a.priorSVpct, a.svStatus, "SPI", a.spi)); }
    return parts.join(" ");
  }

  return Controller.extend("dassian.tpm.ui5.controller.VAR", {
    onInit: function () {
      this.getView().setModel(new JSONModel({ items: [], all: [], sum: {} }), "narr");
      this.getView().setModel(new JSONModel({
        project: "", cam: "", period: "2026-05",
        projects: [], cams: [], periods: PERIODS.map(function (p) { return { key: p.id, text: p.label }; })
      }), "flt");
      this._raw = [];
      this._rawProg = null;
      this._curPeriod = null;
      this._narr = {};          // session narrative store, keyed prog|period|wbs
      this._seeded = {};        // programs whose prior-period narratives are seeded
      this._load();
    },
    _prog: function () { return this.getOwnerComponent().getModel("ui").getProperty("/program"); },
    _key: function (prog, period, wbs) { return prog + "|" + period + "|" + wbs; },

    onProgramChange: function () {
      this._persistCurrent();
      this.getView().getModel("flt").setProperty("/project", "");
      this.getView().getModel("flt").setProperty("/cam", "");
      this._load();
    },
    onFilterChange: function () {
      this._persistCurrent();
      this._compute();
    },

    // Snapshot the currently-shown narratives into the store under their period,
    // so edits survive a period switch and can be carried forward.
    _persistCurrent: function () {
      if (this._curPeriod == null || !this._rawProg) { return; }
      var prog = this._rawProg, store = this._narr, that = this;
      (this.getView().getModel("narr").getProperty("/items") || []).forEach(function (it) {
        store[that._key(prog, that._curPeriod, it.wbs)] = { rc: it.rc, im: it.im, ca: it.ca, gw: it.gw, approved: it.approved, aiDrafted: it.aiDrafted, notified: it.notified };
      });
    },

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
        that._seedPrior(prog, raw);
        that._compute();
      });
    },

    // Seed illustrative prior-period narratives (every period but the latest) so
    // "Import previous period" has content to carry forward in the demo.
    _seedPrior: function (prog, raw) {
      if (this._seeded[prog]) { return; }
      this._seeded[prog] = true;
      var store = this._narr, that = this;
      var priors = PERIODS.slice(0, PERIODS.length - 1);
      raw.forEach(function (o) {
        priors.forEach(function (p) {
          var k = that._key(prog, p.id, o.ID);
          if (store[k]) { return; }
          store[k] = {
            rc: "[" + p.label + " — prior period] Unfavorable cost/schedule variance on " + o.Description + " driven by supplier delivery slip and labor inefficiency; root cause reviewed with " + (o.Manager || "the CAM") + ".",
            im: "[" + p.label + " — prior period] EAC trended above BAC; estimated 2–3 week schedule impact to downstream integration milestones.",
            ca: "[" + p.label + " — prior period] Recovery plan: expedite critical parts, add a second integration shift, re-sequence test; get-well targeted the following period.",
            gw: "", approved: false, aiDrafted: false, notified: false
          };
        });
      });
    },

    // Apply project / CAM / period filters, time-phase by the period factor, then
    // build the narrative items, rollup summary and the variance table.
    _compute: function () {
      var prog = this._rawProg, that = this;
      var flt = this.getView().getModel("flt").getData();
      var f = (PERIOD_MAP[flt.period] || PERIOD_MAP["2026-05"]).f;
      var store = this._narr;
      var items = [], all = [], totBac = 0, wCPIn = 0, wSPIn = 0, totCV = 0, totSV = 0;

      this._raw.forEach(function (o) {
        if (flt.project && o.ProjectID !== flt.project) { return; }
        if (flt.cam && o.Manager !== flt.cam) { return; }
        var bcws = (parseFloat(o.PlannedValue) || 0) * f.plan;
        var bcwp = (parseFloat(o.EarnedValue) || 0) * f.earn;
        var acwp = (parseFloat(o.ActualCost) || 0) * f.act;
        var cpi = acwp ? bcwp / acwp : 0, spi = bcws ? bcwp / bcws : 0;
        var cv = bcwp - acwp, cvp = bcwp ? cv / bcwp * 100 : 0;
        var sv = bcwp - bcws, svp = bcws ? sv / bcws * 100 : 0;
        var vac = parseFloat(o.VAC) || 0, bac = parseFloat(o.BAC) || 0, eac = parseFloat(o.EAC) || 0;
        var cvStatus = pctStatus(cvp), svStatus = pctStatus(svp);
        var flagCV = bcwp > 0 && cvStatus !== "ok", flagSV = bcwp > 0 && svStatus !== "ok";

        if (bcwp > 0) { totBac += bac; wCPIn += cpi * bac; wSPIn += spi * bac; totCV += cv; totSV += sv; }

        var rowStatus = (cvStatus === "out" || svStatus === "out") ? "out" : ((cvStatus === "watch" || svStatus === "watch") ? "watch" : "ok");
        all.push({
          wbs: o.ID, desc: o.Description, cam: o.Manager,
          cvpT: cvp.toFixed(1) + "%", svpT: svp.toFixed(1) + "%", cvState: stateOf(cvStatus), svState: stateOf(svStatus),
          cpiT: cpi.toFixed(2), spiT: spi.toFixed(2),
          trend: rowStatus !== "ok" ? "▼ degrading" : "▲ stable/improving", trendState: rowStatus !== "ok" ? "Error" : "Success",
          status: statusText(rowStatus), statusState: stateOf(rowStatus)
        });

        if (!(flagCV || flagSV)) { return; }
        var item = {
          id: o.ID, wbs: o.ID, desc: o.Description, cam: o.Manager, email: camEmail(o.Manager),
          bcws: bcws, bcwp: bcwp, acwp: acwp, cv: cv, cvp: cvp, sv: sv, svp: svp, vac: vac, bac: bac, eac: eac, cpi: cpi, spi: spi,
          cvStatus: cvStatus, svStatus: svStatus, flagCV: flagCV, flagSV: flagSV,
          priorCVpct: cvp + 2.6, priorSVpct: svp + 2.6,
          bcwsT: fmtM(bcws), bcwpT: fmtM(bcwp), acwpT: fmtM(acwp),
          cvT: fmtM(cv) + " / " + cvp.toFixed(1) + "%", svT: fmtM(sv) + " / " + svp.toFixed(1) + "%", vacT: fmtM(vac),
          cpiT: cpi.toFixed(3), spiT: spi.toFixed(3),
          cvPillState: stateOf(cvStatus), svPillState: stateOf(svStatus),
          rc: "", im: "", ca: "", gw: "", approved: false, aiDrafted: false, notified: false
        };
        var saved = store[that._key(prog, flt.period, o.ID)];
        if (saved) { item.rc = saved.rc; item.im = saved.im; item.ca = saved.ca; item.gw = saved.gw; item.approved = saved.approved; item.aiDrafted = saved.aiDrafted; item.notified = saved.notified; }
        item.narr = narrative(item);
        items.push(item);
      });

      items.sort(function (a, b) { return a.cvp - b.cvp; });
      var wCPI = totBac ? wCPIn / totBac : 0, wSPI = totBac ? wSPIn / totBac : 0;
      var cvAgg = totBac ? totCV / totBac * 100 : 0, svAgg = totBac ? totSV / totBac * 100 : 0;
      var sum = {
        cpiT: wCPI.toFixed(2), cpiState: wCPI >= 1 ? "Success" : (wCPI >= 0.95 ? "Warning" : "Error"), cpiSub: wCPI >= 1 ? "Favorable" : "Unfavorable",
        spiT: wSPI.toFixed(2), spiState: wSPI >= 1 ? "Success" : (wSPI >= 0.95 ? "Warning" : "Error"), spiSub: wSPI >= 1 ? "On / ahead" : "Behind",
        cvT: fmtM(totCV) + " (" + cvAgg.toFixed(1) + "%)", cvState: stateOf(pctStatus(cvAgg)),
        svT: fmtM(totSV) + " (" + svAgg.toFixed(1) + "%)", svState: stateOf(pctStatus(svAgg)),
        alerts: String(items.length), alertState: items.length ? "Error" : "Success", alertSub: items.length ? "Need attention" : "All in tolerance"
      };
      this.getView().getModel("narr").setData({ items: items, all: all, sum: sum });
      this._curPeriod = flt.period;
    },

    onAiDraft: function (evt) {
      var ctx = evt.getSource().getBindingContext("narr"), o = ctx.getObject(), m = this.getView().getModel("narr"), p = ctx.getPath();
      m.setProperty(p + "/rc", "[AI draft — confirm] The data shows " + o.cvT + " cost and " + o.svp.toFixed(1) +
        "% schedule variance — ACWP exceeded BCWP while BCWP trailed BCWS. The numbers show the magnitude, not the reason. ROOT CAUSE REQUIRES ANALYST / CAM INPUT.");
      m.setProperty(p + "/im", "[AI draft — confirm] Estimate at completion is " + fmtM(o.eac) + " vs BAC " + fmtM(o.bac) +
        " (VAC " + o.vacT + "). Quantify schedule impact to milestones with the CAM.");
      m.setProperty(p + "/ca", "[AI draft — template] Owner: [name]. Action: [corrective step]. Get-well: [date]. The AI cannot propose a real corrective action — supply the plan.");
      m.setProperty(p + "/aiDrafted", true);
    },

    // Carry forward the previous month-end's narrative for this control account.
    onImportPrev: function (evt) {
      var ctx = evt.getSource().getBindingContext("narr"), it = ctx.getObject(), p = ctx.getPath(), m = this.getView().getModel("narr");
      var flt = this.getView().getModel("flt").getData();
      var idx = -1;
      PERIODS.forEach(function (pp, i) { if (pp.id === flt.period) { idx = i; } });
      if (idx <= 0) { MessageToast.show("No earlier period than " + ((PERIOD_MAP[flt.period] || {}).label || flt.period) + "."); return; }
      var prior = PERIODS[idx - 1];
      var saved = this._narr[this._key(this._rawProg, prior.id, it.wbs)];
      if (!saved || !(saved.rc || saved.im || saved.ca)) { MessageToast.show("No previous-period narrative on file for " + it.wbs + "."); return; }
      m.setProperty(p + "/rc", saved.rc);
      m.setProperty(p + "/im", saved.im);
      m.setProperty(p + "/ca", saved.ca);
      if (saved.gw) { m.setProperty(p + "/gw", saved.gw); }
      MessageToast.show("Imported " + prior.label + " narrative for " + it.wbs + " — review and update for this period.");
    },

    onApprove: function (evt) {
      var ctx = evt.getSource().getBindingContext("narr");
      this.getView().getModel("narr").setProperty(ctx.getPath() + "/approved", true);
    },

    onNotifyCAM: function (evt) {
      var ctx = evt.getSource().getBindingContext("narr"), a = ctx.getObject(), that = this, path = ctx.getPath();
      var body = a.cam + ",\n\n" +
        "The following control account requires a corrective-action review:\n\n" +
        "WBS: " + a.wbs + " — " + a.desc + "\n" +
        "CAM: " + a.cam + "\n\n" +
        a.narr + "\n\n" +
        "Cost: CPI " + a.cpi.toFixed(2) + ", CV " + a.cvp.toFixed(1) + "%\n" +
        "Schedule: SPI " + a.spi.toFixed(2) + ", SV " + a.svp.toFixed(1) + "%\n\n" +
        "Please initiate a corrective-action plan and reply with proposed mitigation steps and revised target dates.\n\n" +
        "— Dassian Total Program Management";
      var ta = new TextArea({ value: body, rows: 12, width: "100%", growing: true });
      var dlg = new Dialog({
        title: "Send to Control Account Manager",
        contentWidth: "36rem",
        content: [new VBox({ items: [
          new Label({ text: "To" }), new Text({ text: a.cam + " <" + a.email + ">" }),
          new Label({ text: "Subject", class: "sapUiSmallMarginTop" }), new Text({ text: "Variance Alert — " + a.wbs }),
          new Label({ text: "Message", class: "sapUiSmallMarginTop" }), ta,
          new Text({ text: "Prototype — creates a corrective-action workflow task and drafts the CAM email. No message is actually sent.", class: "sapUiSmallMarginTop" })
        ] }).addStyleClass("sapUiSmallMargin")],
        beginButton: new Button({ text: "Create workflow & draft email", type: "Emphasized", press: function () {
          that.getView().getModel("narr").setProperty(path + "/notified", true);
          MessageToast.show("Corrective-action workflow created; email drafted to " + a.cam);
          dlg.close();
        } }),
        endButton: new Button({ text: "Cancel", press: function () { dlg.close(); } }),
        afterClose: function () { dlg.destroy(); }
      });
      this.getView().addDependent(dlg);
      dlg.open();
    },

    onNavBack: function () { HashChanger.getInstance().setHash(""); }
  });
});
