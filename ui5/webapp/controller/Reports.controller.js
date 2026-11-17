sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/HashChanger",
  "sap/ui/model/json/JSONModel",
  "sap/ui/table/Column",
  "sap/m/Text"
], function (Controller, HashChanger, JSONModel, Column, Text) {
  "use strict";

  var MAP = { wbsTable: "wbs", ramTable: "ram", capTable: "cap", tripTable: "tripwire", clTable: "controllog" };

  return Controller.extend("dassian.tpm.ui5.controller.Reports", {
    onInit: function () {
      var m = new JSONModel();
      this.getView().setModel(m, "reports");
      m.attachRequestCompleted(this._buildAll.bind(this));
      m.loadData(sap.ui.require.toUrl("dassian/tpm/ui5/model/reports.json"));
    },

    _buildAll: function () {
      Object.keys(MAP).forEach(this._build.bind(this));
    },

    _build: function (tableId) {
      var key = MAP[tableId];
      var t = this.byId(tableId);
      var d = this.getView().getModel("reports").getProperty("/" + key);
      if (!t || !d) { return; }
      t.removeAllColumns();
      d.cols.forEach(function (c, i) {
        t.addColumn(new Column({
          label: new Text({ text: String(c), wrapping: false }),
          template: new Text({ text: "{reports>" + i + "}", wrapping: false }),
          width: i < 4 ? "12rem" : "8rem",
          hAlign: "Begin"
        }));
      });
      t.bindRows("reports>/" + key + "/rows");
    },

    onNavBack: function () { HashChanger.getInstance().setHash(""); }
  });
});
