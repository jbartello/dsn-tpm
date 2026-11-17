sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/HashChanger",
  "sap/ui/model/json/JSONModel"
], function (Controller, HashChanger, JSONModel) {
  "use strict";

  return Controller.extend("dassian.tpm.ui5.controller.Analytics", {
    onInit: function () { this._load(); },
    _prog: function () { return this.getOwnerComponent().getModel("ui").getProperty("/program"); },
    onProgramChange: function () { this._load(); },
    _load: function () {
      var prog = this._prog(), model = this.getOwnerComponent().getModel();
      model.bindList("/ControlAccounts").requestContexts(0, 500).then(function (ctxs) {
        var items = [], perf = [];
        ctxs.forEach(function (c) {
          var o = c.getObject();
          if (o.ProgramID !== prog) { return; }
          items.push({ name: o.Description, bac: parseFloat(o.BAC) || 0, eac: parseFloat(o.EAC) || 0 });
          perf.push({ name: o.Description, cpi: parseFloat(o.CPI) || 0, spi: parseFloat(o.SPI) || 0 });
        });
        this.getView().setModel(new JSONModel({ items: items, perf: perf }), "chart");
      }.bind(this));
    },
    onNavBack: function () { HashChanger.getInstance().setHash(""); }
  });
});
