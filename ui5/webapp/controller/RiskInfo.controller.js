sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/HashChanger",
  "sap/ui/model/json/JSONModel"
], function (Controller, HashChanger, JSONModel) {
  "use strict";

  var PROB = ["Near Certain", "Highly Likely", "Likely", "Unlikely", "Remote"];
  var IMPACT = ["Insignificant", "Modest", "Moderate", "Significant", "Unacceptable"];
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
      this.getView().setModel(new JSONModel({}), "sel");
      this._load();
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
      var ctx = evt.getSource().getBindingContext("risk");
      this.getView().getModel("sel").setData(Object.assign({}, ctx.getObject()));
      this.byId("riskDialog").open();
    },
    onCloseDialog: function () { this.byId("riskDialog").close(); },

    onNavBack: function () { HashChanger.getInstance().setHash(""); }
  });
});
