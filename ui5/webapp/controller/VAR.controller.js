sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/HashChanger",
  "sap/ui/model/json/JSONModel"
], function (Controller, HashChanger, JSONModel) {
  "use strict";

  function fmtM(v) {
    var a = Math.abs(v), s = v < 0 ? "-" : "";
    return a >= 1e6 ? s + "$" + (a / 1e6).toFixed(1) + "M"
      : a >= 1e3 ? s + "$" + (a / 1e3).toFixed(0) + "K"
        : s + "$" + a.toFixed(0);
  }

  return Controller.extend("dassian.tpm.ui5.controller.VAR", {
    onInit: function () {
      this.getView().setModel(new JSONModel({ items: [] }), "narr");
      this._load();
    },
    _prog: function () { return this.getOwnerComponent().getModel("ui").getProperty("/program"); },
    onProgramChange: function () { this._load(); },
    _load: function () {
      var prog = this._prog(), model = this.getOwnerComponent().getModel();
      model.bindList("/ControlAccounts").requestContexts(0, 500).then(function (ctxs) {
        var items = [];
        ctxs.forEach(function (c) {
          var o = c.getObject();
          if (o.ProgramID !== prog) { return; }
          var bcwp = parseFloat(o.EarnedValue) || 0, cpi = parseFloat(o.CPI) || 0, spi = parseFloat(o.SPI) || 0;
          // out of tolerance: has earned value and is behind on cost or schedule
          if (!(bcwp > 0 && (cpi < 0.95 || spi < 0.95))) { return; }
          var bcws = parseFloat(o.PlannedValue) || 0, acwp = parseFloat(o.ActualCost) || 0;
          var cv = bcwp - acwp, cvp = bcwp ? cv / bcwp * 100 : 0;
          var sv = bcwp - bcws, svp = bcws ? sv / bcws * 100 : 0;
          var vac = parseFloat(o.VAC) || 0, bac = parseFloat(o.BAC) || 0, eac = parseFloat(o.EAC) || 0;
          items.push({
            id: o.ID, wbs: o.ID, desc: o.Description, cam: o.Manager,
            bcws: bcws, bcwp: bcwp, acwp: acwp, cv: cv, cvp: cvp, sv: sv, svp: svp, vac: vac, bac: bac, eac: eac, cpi: cpi, spi: spi,
            bcwsT: fmtM(bcws), bcwpT: fmtM(bcwp), acwpT: fmtM(acwp),
            cvT: fmtM(cv) + " / " + cvp.toFixed(1) + "%", svT: fmtM(sv) + " / " + svp.toFixed(1) + "%", vacT: fmtM(vac),
            cpiT: cpi.toFixed(3), spiT: spi.toFixed(3),
            rc: "", im: "", ca: "", gw: "", approved: false, aiDrafted: false
          });
        });
        this.getView().getModel("narr").setProperty("/items", items);
      }.bind(this));
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

    onApprove: function (evt) {
      var ctx = evt.getSource().getBindingContext("narr");
      this.getView().getModel("narr").setProperty(ctx.getPath() + "/approved", true);
    },

    onNavBack: function () { HashChanger.getInstance().setHash(""); }
  });
});
