sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/HashChanger",
  "sap/ui/model/json/JSONModel",
  "sap/ui/table/Column",
  "sap/m/Text",
  "sap/m/MessageToast",
  "dassian/tpm/ui5/model/WbsStore"
], function (Controller, HashChanger, JSONModel, Column, Text, MessageToast, WbsStore) {
  "use strict";

  // artifact name -> embedded report grid (static sample reports)
  var REPORT_KEY = {
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
      if (name === "WBS Dictionary") { this._openWbsDictionary(); }
      else if (REPORT_KEY[name]) { this._openReport(REPORT_KEY[name], name); }
      else if (NAV[name]) { HashChanger.getInstance().setHash(NAV[name]); }
      else { MessageToast.show("No embedded viewer for “" + name + "” — document reference only."); }
    },

    _prog: function () { return this.getOwnerComponent().getModel("ui").getProperty("/program"); },

    // The WBS Dictionary is generated live from the control-account and work-package
    // structure maintained in Project Setup (shared WbsStore), not from static data.
    _openWbsDictionary: function () {
      var prog = this._prog(), that = this;
      var render = function (tree) {
        var dict = WbsStore.dictionary(tree);
        that.getView().getModel("reports").setProperty("/wbs", dict);
        that._renderGrid(dict.cols, "reports>/wbs/rows", "WBS Dictionary — " + (prog === "MFG" ? "MFG Program" : "Demo") + " (from Control Accounts & Work Packages)");
      };
      if (WbsStore.get(prog)) { render(WbsStore.get(prog)); return; }
      var model = this.getOwnerComponent().getModel();
      model.bindList("/ControlAccounts").requestContexts(0, 500).then(function (ctxs) {
        var cas = [];
        ctxs.forEach(function (c) {
          var o = c.getObject();
          if (o.ProgramID !== prog) { return; }
          cas.push({ id: o.ID, desc: o.Description, cam: o.Manager, bac: parseFloat(o.BAC) || 0 });
        });
        render(WbsStore.ensure(prog, cas));
      });
    },

    _renderGrid: function (cols, rowsPath, title) {
      var grid = this.byId("reportGrid");
      if (!grid) { return; }
      grid.removeAllColumns();
      cols.forEach(function (c, i) {
        var wide = c === "Authorization Information" || c === "Scope of Work (SOW)";
        grid.addColumn(new Column({
          label: new Text({ text: String(c), wrapping: false }),
          template: new Text({ text: "{reports>" + i + "}", wrapping: wide }),
          width: wide ? "24rem" : (c === "Description" ? "14rem" : (i < 4 ? "12rem" : "8rem"))
        }));
      });
      grid.bindRows(rowsPath);
      var dlg = this.byId("reportDialog");
      dlg.setTitle(title);
      dlg.open();
    },

    _openReport: function (key, title) {
      var d = this.getView().getModel("reports").getProperty("/" + key);
      if (!d) { return; }
      this._renderGrid(d.cols, "reports>/" + key + "/rows", title);
    },

    onCloseReport: function () { this.byId("reportDialog").close(); },

    onNavBack: function () { HashChanger.getInstance().setHash(""); }
  });
});
