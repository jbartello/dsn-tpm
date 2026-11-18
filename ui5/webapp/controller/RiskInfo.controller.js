sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/HashChanger",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast"
], function (Controller, HashChanger, JSONModel, MessageToast) {
  "use strict";

  var PROB = ["Near Certain", "Highly Likely", "Likely", "Unlikely", "Remote"];
  var IMPACT = ["Insignificant", "Modest", "Moderate", "Significant", "Unacceptable"];
  // scoring values aligned to the arrays above (PROB index 0 = highest; IMPACT index 0 = lowest)
  var PROB_VAL = [0.95, 0.80, 0.50, 0.30, 0.10];
  var IMPACT_VAL = [0.10, 0.30, 0.50, 0.80, 0.95];
  var STATUSES = ["New", "Open", "In Process", "Mitigating", "Closed"];
  var STRATEGIES = ["Mitigate", "Avoid", "Transfer", "Accept", "Exploit", "Enhance", "Share"];

  function fmtScore(v) {
    var s = (Math.round(v * 10000) / 10000).toString();
    return s;
  }
  function todayStr() {
    var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; };
    return p(d.getMonth() + 1) + "/" + p(d.getDate()) + "/" + d.getFullYear();
  }
  // colour tier per cell (row 0 = Near Certain), matches the prototype
  var TIER = [
    [3, 4, 4, 5, 5],
    [2, 3, 4, 5, 5],
    [0, 2, 3, 4, 5],
    [0, 0, 2, 3, 4],
    [0, 0, 2, 2, 3]
  ];
  var RISK_PALETTE = { 0: "#2e7d0e", 1: "#4fa015", 2: "#8cc63e", 3: "#e2df1e", 4: "#ef8a2b", 5: "#e12219" };
  var OPP_PALETTE  = { 0: "#d6e3f7", 1: "#a9c5ec", 2: "#6f9fdc", 3: "#5577c9", 4: "#6b4ba8", 5: "#4b2c87" };

  return Controller.extend("dassian.tpm.ui5.controller.RiskInfo", {
    onInit: function () {
      this.getView().setModel(new JSONModel({ kind: "Risk", items: [], riskCount: 0, oppCount: 0 }), "risk");
      this.getView().setModel(new JSONModel({ edit: false, isNew: false, tasks: [] }), "sel");
      this.getView().setModel(new JSONModel({ prob: PROB, impact: IMPACT, statuses: STATUSES, strategies: STRATEGIES }), "cfg");
      var tm = new JSONModel();
      tm.loadData(sap.ui.require.toUrl("dassian/tpm/ui5/model/risktasks.json"));
      tm.attachRequestCompleted(function () { this._tasks = tm.getData() || {}; }.bind(this));
      this._load();
    },

    // True stepped waterfall, replicating the register prototype's SVG: score
    // bands, the original-score dashed baseline, the stepped current line through
    // each mitigation task's target score, node dots, and a "today" marker.
    _waterfall: function (o, tasks) {
      var W = 600, H = 250, mL = 38, mR = 16, mT = 12, mB = 42, pw = W - mL - mR, ph = H - mT - mB;
      var yPx = function (s) { return mT + ph - s * ph; };
      var orig = parseFloat(o.OriginalScore) || 0, tgt = parseFloat(o.TargetScore) || 0;
      var pts = [{ t: 0, s: orig }];
      (tasks || []).forEach(function (tk, i) { pts.push({ t: i + 1, s: parseFloat(tk.TargetScore) || 0 }); });
      if (pts.length === 1) { pts.push({ t: 1, s: tgt }); }
      var span = pts.length - 1 + 4;
      var xPx = function (t) { return mL + (t / span) * pw; };
      var s = "";
      s += '<rect x="' + mL + '" y="' + yPx(1) + '" width="' + pw + '" height="' + (yPx(0.4) - yPx(1)) + '" fill="#e12219"/>';
      s += '<rect x="' + mL + '" y="' + yPx(0.4) + '" width="' + pw + '" height="' + (yPx(0.2) - yPx(0.4)) + '" fill="#e2df1e"/>';
      s += '<rect x="' + mL + '" y="' + yPx(0.2) + '" width="' + pw + '" height="' + (yPx(0) - yPx(0.2)) + '" fill="#2e7d0e"/>';
      for (var g = 0; g <= 10; g += 2) { var sc = g / 10, y = yPx(sc); s += '<text x="' + (mL - 6) + '" y="' + (y + 3) + '" text-anchor="end" font-size="10" fill="#6a6d70">' + sc.toFixed(1) + '</text>'; }
      s += '<line x1="' + xPx(0) + '" y1="' + yPx(orig) + '" x2="' + xPx(span) + '" y2="' + yPx(orig) + '" stroke="#5b9bd5" stroke-width="2" stroke-dasharray="6 4"/>';
      var path = "M" + xPx(pts[0].t) + "," + yPx(pts[0].s);
      for (var i = 1; i < pts.length; i++) { path += " L" + xPx(pts[i - 1].t) + "," + yPx(pts[i].s) + " L" + xPx(pts[i].t) + "," + yPx(pts[i].s); }
      path += " L" + xPx(span) + "," + yPx(pts[pts.length - 1].s);
      s += '<path d="' + path + '" fill="none" stroke="#1d1d1d" stroke-width="2.5"/>';
      pts.forEach(function (p) { s += '<circle cx="' + xPx(p.t) + '" cy="' + yPx(p.s) + '" r="3.5" fill="#5b9bd5"/>'; });
      var tx = xPx(span - 0.5);
      s += '<line x1="' + tx + '" y1="' + mT + '" x2="' + tx + '" y2="' + (mT + ph) + '" stroke="#ffffff" stroke-width="2" stroke-dasharray="5 4"/>';
      s += '<text x="' + (mL + pw / 2) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="11" fill="#6a6d70">Mitigation Tasks over Time</text>';
      s += '<text x="11" y="' + (mT + ph / 2) + '" text-anchor="middle" font-size="11" fill="#6a6d70" transform="rotate(-90 11 ' + (mT + ph / 2) + ')">Risk Score</text>';
      var legend = '<div style="display:flex;gap:16px;font-size:12px;color:#6a6d70;margin-top:6px">'
        + '<span><span style="display:inline-block;width:18px;height:3px;background:#1d1d1d;vertical-align:middle;margin-right:4px"></span>Current</span>'
        + '<span><span style="display:inline-block;width:18px;border-top:3px dashed #5b9bd5;vertical-align:middle;margin-right:4px"></span>Original</span>'
        + '<span><span style="display:inline-block;width:18px;border-top:3px dashed #9aa0a6;vertical-align:middle;margin-right:4px"></span>Today&#39;s Date</span>'
        + "</div>";
      return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:600px;height:auto">' + s + "</svg>" + legend;
    },

    _prog: function () { return this.getOwnerComponent().getModel("ui").getProperty("/program"); },
    _kind: function () { return this.getView().getModel("risk").getProperty("/kind"); },
    onProgramChange: function () { this._load(); },
    // SegmentedButton two-way-binds selectedKey to risk>/kind already; just reload.
    onKindChange: function () { this._load(); },

    _load: function () {
      var prog = this._prog(), kind = this._kind();
      var model = this.getOwnerComponent().getModel();
      model.bindList("/Risks").requestContexts(0, 300).then(function (ctxs) {
        var items = [], counts = Array.from({ length: 5 }, function () { return [0, 0, 0, 0, 0]; });
        var nRisk = 0, nOpp = 0;
        ctxs.forEach(function (c) {
          var o = c.getObject();
          if (o.ProgramID !== prog) { return; }
          if (o.Kind === "Risk") { nRisk++; } else { nOpp++; }
          if (o.Kind !== kind) { return; }
          items.push(o);
          var p = o.ProbIndex, i = o.ImpactIndex;
          if (p >= 0 && p < 5 && i >= 0 && i < 5) { counts[p][i]++; }
        });
        var m = this.getView().getModel("risk");
        m.setProperty("/items", items);
        m.setProperty("/riskCount", nRisk);
        m.setProperty("/oppCount", nOpp);
        this._renderMatrix(counts, kind);
        this._colourScores(kind);
      }.bind(this));
    },

    _renderMatrix: function (counts, kind) {
      var pal = kind === "Opportunity" ? OPP_PALETTE : RISK_PALETTE;
      var h = '<div style="display:inline-block">';
      for (var p = 0; p < 5; p++) {
        h += '<div style="display:flex;align-items:center">';
        h += '<div style="width:7.5rem;color:#6a6d70;font-size:0.8rem">' + PROB[p] + '</div>';
        for (var i = 0; i < 5; i++) {
          var tier = TIER[p][i], bg = pal[tier];
          var white = kind === "Opportunity" && tier >= 4;
          var n = counts[p][i];
          h += '<div style="width:4.6rem;height:3.2rem;margin:2px;border-radius:4px;display:flex;align-items:center;'
            + 'justify-content:center;font-weight:700;background:' + bg + ';color:' + (white ? "#fff" : "#1d1d1d") + '">'
            + (n ? n : "") + "</div>";
        }
        h += "</div>";
      }
      h += '<div style="display:flex"><div style="width:7.5rem"></div>';
      IMPACT.forEach(function (im) {
        h += '<div style="width:4.6rem;margin:2px;text-align:center;color:#6a6d70;font-size:0.72rem">' + im + "</div>";
      });
      h += "</div></div>";
      var ctrl = this.byId("matrixHtml");
      if (ctrl) { ctrl.setContent(h); }
    },

    _colourScores: function (kind) {
      var t = this.byId("riskTable");
      if (!t) { return; }
      t.toggleStyleClass("kindOpp", kind === "Opportunity");
      t.toggleStyleClass("kindRisk", kind !== "Opportunity");
    },

    onRiskPress: function (evt) {
      var o = evt.getSource().getBindingContext("risk").getObject();
      var sel = this.getView().getModel("sel");
      var data = Object.assign({ edit: false, isNew: false }, o);
      var tasks = ((this._tasks && this._tasks[o.ID]) || []).map(function (t) { return Object.assign({}, t); });
      data.tasks = tasks;
      sel.setData(data);
      this._refreshWaterfall();
      this.byId("riskDialog").open();
    },

    // ---- Create / Edit / Save ----
    _projectId: function () {
      var items = this.getView().getModel("risk").getProperty("/items") || [];
      if (items.length && items[0].ProjectID) { return items[0].ProjectID; }
      return this._prog() === "DEMO" ? "JTB001" : "DD-0001";
    },
    _nextId: function () {
      var risk = this.getView().getModel("risk");
      var n = (risk.getProperty("/riskCount") || 0) + (risk.getProperty("/oppCount") || 0) + 1;
      return this._projectId() + "-R" + (n < 10 ? "0" + n : "" + n);
    },
    onCreateRisk: function () {
      var kind = this._kind();
      var r = {
        ID: this._nextId(), ProgramID: this._prog(), ProjectID: this._projectId(), Kind: kind,
        Title: "", Description: "", Category: "", ResponseStrategy: "Mitigate", Triggers: "",
        Owner: "", Status: "New", WorkPackage: "",
        Probability: "Likely", Impact: "Moderate", ProbIndex: 2, ImpactIndex: 2,
        OriginalScore: "0.25", CurrentScore: "0.25", TargetScore: "0",
        RiskValue: "0", OriginalValue: "0", CurrentValue: "0", TargetValue: "0",
        Cause: "", Event: "", Effect: "", MitigationPlan: "", DateRaised: todayStr(), LastReviewed: "",
        edit: true, isNew: true, tasks: []
      };
      this.getView().getModel("sel").setData(r);
      this._refreshWaterfall();
      this.byId("riskDialog").open();
    },
    onEditRisk: function () { this.getView().getModel("sel").setProperty("/edit", true); },

    // Recompute Current Score (and Original, for a brand-new risk) from Probability × Impact.
    onScoreChange: function () {
      var sel = this.getView().getModel("sel"), d = sel.getData();
      var pi = PROB.indexOf(d.Probability), ii = IMPACT.indexOf(d.Impact);
      if (pi < 0) { pi = 2; } if (ii < 0) { ii = 2; }
      var cur = PROB_VAL[pi] * IMPACT_VAL[ii];
      sel.setProperty("/ProbIndex", pi);
      sel.setProperty("/ImpactIndex", ii);
      sel.setProperty("/CurrentScore", fmtScore(cur));
      if (d.isNew) { sel.setProperty("/OriginalScore", fmtScore(cur)); }
      this._refreshWaterfall();
    },
    onTaskScoreChange: function () { this._refreshWaterfall(); },

    onAddTask: function () {
      var sel = this.getView().getModel("sel"), tasks = sel.getProperty("/tasks") || [];
      tasks.push({ Desc: "", Start: "", End: "", Assigned: "", TargetScore: "0", Status: "New", TargetValue: "0" });
      sel.setProperty("/tasks", tasks);
    },
    onDeleteTask: function (evt) {
      var sel = this.getView().getModel("sel");
      var idx = evt.getSource().getBindingContext("sel").getPath().split("/").pop();
      var tasks = sel.getProperty("/tasks") || [];
      tasks.splice(parseInt(idx, 10), 1);
      sel.setProperty("/tasks", tasks);
      this._refreshWaterfall();
    },

    onSaveRisk: function () {
      var sel = this.getView().getModel("sel"), d = sel.getData();
      if (!d.Title || !d.Description) {
        MessageToast.show("Enter a short description and a description before saving.");
        return;
      }
      d.LastReviewed = todayStr();
      var rec = Object.assign({}, d); delete rec.edit; delete rec.isNew; delete rec.tasks;
      var tasks = (d.tasks || []).map(function (t) { return Object.assign({}, t); });

      var risk = this.getView().getModel("risk");
      var items = risk.getProperty("/items") || [];
      var idx = -1;
      items.forEach(function (x, i) { if (x.ID === rec.ID) { idx = i; } });
      if (idx >= 0) {
        items[idx] = rec;
      } else {
        items.push(rec);
        if (rec.Kind === "Opportunity") { risk.setProperty("/oppCount", (risk.getProperty("/oppCount") || 0) + 1); }
        else { risk.setProperty("/riskCount", (risk.getProperty("/riskCount") || 0) + 1); }
      }
      // only keep rows that match the kind currently shown in the register
      risk.setProperty("/items", items.filter(function (x) { return x.Kind === rec.Kind; }));
      this._tasks = this._tasks || {};
      this._tasks[rec.ID] = tasks;

      this._recount();
      sel.setProperty("/edit", false);
      sel.setProperty("/isNew", false);
      this._refreshWaterfall();
      MessageToast.show((rec.Kind === "Opportunity" ? "Opportunity " : "Risk ") + rec.ID + " saved.");
    },

    // Rebuild the 5×5 matrix counts from the rows currently in the register.
    _recount: function () {
      var kind = this._kind();
      var items = this.getView().getModel("risk").getProperty("/items") || [];
      var counts = Array.from({ length: 5 }, function () { return [0, 0, 0, 0, 0]; });
      items.forEach(function (o) {
        if (o.Kind !== kind) { return; }
        var p = o.ProbIndex, i = o.ImpactIndex;
        if (p >= 0 && p < 5 && i >= 0 && i < 5) { counts[p][i]++; }
      });
      this._renderMatrix(counts, kind);
    },

    _refreshWaterfall: function () {
      var sel = this.getView().getModel("sel");
      var wf = this.byId("waterfallHtml");
      if (wf) { wf.setContent(this._waterfall(sel.getData(), sel.getProperty("/tasks") || [])); }
    },

    onCloseDialog: function () { this.byId("riskDialog").close(); },

    onNavBack: function () { HashChanger.getInstance().setHash(""); }
  });
});
