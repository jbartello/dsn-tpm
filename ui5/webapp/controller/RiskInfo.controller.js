sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/HashChanger",
  "sap/ui/model/json/JSONModel",
  "sap/m/VBox",
  "sap/m/HBox",
  "sap/m/Text"
], function (Controller, HashChanger, JSONModel, VBox, HBox, Text) {
  "use strict";

  var PROB = ["Near Certain", "Highly Likely", "Likely", "Unlikely", "Remote"];
  var IMPACT = ["Insignificant", "Modest", "Moderate", "Significant", "Unacceptable"];

  return Controller.extend("dassian.tpm.ui5.controller.RiskInfo", {
    onInit: function () {
      this.getView().setModel(new JSONModel({ kind: "Risk", items: [], riskCount: 0, oppCount: 0 }), "risk");
      this.getView().setModel(new JSONModel({}), "sel");
      this._load();
    },

    _prog: function () { return this.getOwnerComponent().getModel("ui").getProperty("/program"); },
    onProgramChange: function () { this._load(); },
    onKindChange: function (evt) {
      this.getView().getModel("risk").setProperty("/kind", evt.getParameter("selectedKey"));
      this._load();
    },

    _load: function () {
      var prog = this._prog(), kind = this.getView().getModel("risk").getProperty("/kind");
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
        this._buildMatrix(counts);
      }.bind(this));
    },

    _zone: function (p, i) { var s = (5 - p) * (i + 1); return s >= 15 ? "riskHigh" : (s >= 6 ? "riskMed" : "riskLow"); },
    _buildMatrix: function (counts) {
      var host = this.byId("matrixHost"); if (!host) { return; }
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
