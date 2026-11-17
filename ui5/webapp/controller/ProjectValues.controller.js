sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/HashChanger",
  "sap/ui/model/json/JSONModel"
], function (Controller, HashChanger, JSONModel) {
  "use strict";

  // Placeholders carried from the prototype (link to SAP % Complete / REC fields later).
  var PV_PCT = { DEMO: 19, MFG: 37 };
  var PV_REC = { DEMO: 0.58, MFG: 0.64 };

  function fmtM(v) {
    var a = Math.abs(v), s = v < 0 ? "-" : "";
    return a >= 1e6 ? s + "$" + (a / 1e6).toFixed(1) + "M" : a >= 1e3 ? s + "$" + (a / 1e3).toFixed(0) + "K" : s + "$" + a.toFixed(0);
  }
  function critState(v, red, amber) { return v >= amber ? "Success" : (v >= red ? "Warning" : "Error"); }

  return Controller.extend("dassian.tpm.ui5.controller.ProjectValues", {
    onInit: function () {
      this.getView().setModel(new JSONModel({ kpi: {}, rows: [], pct: 0, rec: 0, nonrec: 0 }), "pv");
      this._load();
    },
    _prog: function () { return this.getOwnerComponent().getModel("ui").getProperty("/program"); },
    onProgramChange: function () { this._load(); },

    _load: function () {
      var prog = this._prog(), model = this.getOwnerComponent().getModel();
      model.bindList("/ControlAccounts").requestContexts(0, 500).then(function (ctxs) {
        var rows = [], plan = 0, earned = 0, actual = 0, bac = 0, eac = 0, vac = 0;
        ctxs.forEach(function (c) {
          var o = c.getObject();
          if (o.ProgramID !== prog) { return; }
          var pv = parseFloat(o.PlannedValue) || 0, ev = parseFloat(o.EarnedValue) || 0, ac = parseFloat(o.ActualCost) || 0;
          var cpi = parseFloat(o.CPI) || 0, spi = parseFloat(o.SPI) || 0;
          plan += pv; earned += ev; actual += ac; bac += parseFloat(o.BAC) || 0; eac += parseFloat(o.EAC) || 0; vac += parseFloat(o.VAC) || 0;
          rows.push({
            wbs: o.ID, desc: o.Description, cam: o.Manager,
            pvT: fmtM(pv), evT: fmtM(ev), acT: fmtM(ac), bacT: fmtM(parseFloat(o.BAC) || 0), eacT: fmtM(parseFloat(o.EAC) || 0),
            vacT: fmtM(parseFloat(o.VAC) || 0), vac: parseFloat(o.VAC) || 0,
            cpiT: cpi.toFixed(3), spiT: spi.toFixed(3),
            cpiState: critState(cpi, 0.9, 1), spiState: critState(spi, 0.9, 1)
          });
        });
        var cpi = actual ? earned / actual : 0, spi = plan ? earned / plan : 0;
        var pct = PV_PCT[prog] != null ? PV_PCT[prog] : 20;
        var ratio = PV_REC[prog] != null ? PV_REC[prog] : 0.6;
        var rec = bac * ratio, nonrec = bac * (1 - ratio);
        this.getView().getModel("pv").setData({
          rows: rows,
          pct: pct,
          rec: rec, nonrec: nonrec, recT: fmtM(rec), nonrecT: fmtM(nonrec),
          kpi: {
            bacT: fmtM(bac), eacT: fmtM(eac), vacT: fmtM(vac),
            cpiT: cpi.toFixed(3), spiT: spi.toFixed(3),
            cvT: fmtM(earned - actual), svT: fmtM(earned - plan),
            bcwsT: fmtM(plan), bcwpT: fmtM(earned), acwpT: fmtM(actual),
            cpiState: cpi >= 1 ? "Success" : (cpi >= 0.9 ? "Warning" : "Error"),
            spiState: spi >= 1 ? "Success" : (spi >= 0.9 ? "Warning" : "Error"),
            vacState: vac >= 0 ? "Success" : "Error"
          }
        });
      }.bind(this));
    },

    onNavBack: function () { HashChanger.getInstance().setHash(""); }
  });
});
