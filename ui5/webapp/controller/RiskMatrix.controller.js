sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/HashChanger",
  "sap/m/VBox",
  "sap/m/HBox",
  "sap/m/Text"
], function (Controller, HashChanger, VBox, HBox, Text) {
  "use strict";

  // Index order matches the register prototype's scales.
  var PROB = ["Near Certain", "Highly Likely", "Likely", "Unlikely", "Remote"];        // row 0 = highest likelihood
  var IMPACT = ["Insignificant", "Modest", "Moderate", "Significant", "Unacceptable"]; // col 0 = lowest impact

  return Controller.extend("dassian.tpm.ui5.controller.RiskMatrix", {
    onInit: function () { this._load(); },
    _prog: function () { return this.getOwnerComponent().getModel("ui").getProperty("/program"); },
    onProgramChange: function () { this._load(); },
    _load: function () {
      var prog = this._prog(), model = this.getOwnerComponent().getModel();
      model.bindList("/Risks").requestContexts(0, 200).then(function (ctxs) {
        var counts = Array.from({ length: 5 }, function () { return [0, 0, 0, 0, 0]; });
        ctxs.forEach(function (c) {
          var o = c.getObject(), p = o.ProbIndex, i = o.ImpactIndex;
          if (o.ProgramID !== prog) { return; }
          if (p >= 0 && p < 5 && i >= 0 && i < 5) { counts[p][i]++; }
        });
        this._build(counts);
      }.bind(this));
    },

    // Inherent risk zone: likelihood (5=Near Certain) × impact (5=Unacceptable).
    _zone: function (probIndex, impactIndex) {
      var sev = (5 - probIndex) * (impactIndex + 1);
      return sev >= 15 ? "riskHigh" : (sev >= 6 ? "riskMed" : "riskLow");
    },

    _build: function (counts) {
      var host = this.byId("matrixHost");
      host.destroyItems();
      for (var p = 0; p < 5; p++) {
        var row = new HBox({ alignItems: "Center" });
        row.addItem(new Text({ text: PROB[p] }).addStyleClass("riskRowLabel"));
        for (var i = 0; i < 5; i++) {
          var cell = new VBox({ justifyContent: "Center", alignItems: "Center" });
          cell.addStyleClass("riskCell").addStyleClass(this._zone(p, i));
          cell.addItem(new Text({ text: counts[p][i] ? String(counts[p][i]) : "" }));
          row.addItem(cell);
        }
        host.addItem(row);
      }
      var labelRow = new HBox();
      labelRow.addItem(new Text({ text: "" }).addStyleClass("riskRowLabel"));
      IMPACT.forEach(function (im) { labelRow.addItem(new Text({ text: im }).addStyleClass("riskColLabel")); });
      host.addItem(labelRow);
      host.addItem(new Text({ text: "Probability (rows, high → low)  ×  Impact (columns, low → high)" }).addStyleClass("sapUiSmallMarginTop"));
    },

    onNavBack: function () { HashChanger.getInstance().setHash(""); }
  });
});
