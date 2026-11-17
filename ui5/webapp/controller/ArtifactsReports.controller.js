sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/HashChanger",
  "sap/ui/model/json/JSONModel",
  "sap/ui/table/Column",
  "sap/m/Text",
  "sap/m/MessageToast"
], function (Controller, HashChanger, JSONModel, Column, Text, MessageToast) {
  "use strict";

  // artifact name -> embedded report grid
  var REPORT_KEY = {
    "WBS Dictionary": "wbs",
    "Responsibility Assignment Matrix (RAM)": "ram",
    "Control Account Plans (CAP)": "cap",
    "Tripwire Report": "tripwire",
    "Program Control Log": "controllog"
  };
  // artifact name -> navigate to another module
  var NAV = {
    "Integrated Master Schedule (IMS)": "MasterSchedule",
    "Schedule 14-Point Assessment": "MasterSchedule",
    "Variance Analysis Report (VAR)": "VAR"
  };

  return Controller.extend("dassian.tpm.ui5.controller.ArtifactsReports", {
    onInit: function () {
      var m = new JSONModel();
      this.getView().setModel(m, "reports");
      m.loadData(sap.ui.require.toUrl("dassian/tpm/ui5/model/reports.json"));
    },

    onOpenArtifact: function (evt) {
      var ctx = evt.getSource().getBindingContext();
      var name = ctx.getProperty("Name");
      if (REPORT_KEY[name]) { this._openReport(REPORT_KEY[name], name); }
      else if (NAV[name]) { HashChanger.getInstance().setHash(NAV[name]); }
      else { MessageToast.show("No embedded viewer for “" + name + "” — document reference only."); }
    },

    _openReport: function (key, title) {
      var grid = this.byId("reportGrid");
      var d = this.getView().getModel("reports").getProperty("/" + key);
      if (!grid || !d) { return; }
      grid.removeAllColumns();
      d.cols.forEach(function (c, i) {
        grid.addColumn(new Column({
          label: new Text({ text: String(c), wrapping: false }),
          template: new Text({ text: "{reports>" + i + "}", wrapping: false }),
          width: i < 4 ? "12rem" : "8rem"
        }));
      });
      grid.bindRows("reports>/" + key + "/rows");
      var dlg = this.byId("reportDialog");
      dlg.setTitle(title);
      dlg.open();
    },

    onCloseReport: function () { this.byId("reportDialog").close(); },

    onNavBack: function () { HashChanger.getInstance().setHash(""); }
  });
});
