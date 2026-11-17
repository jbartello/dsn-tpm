sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/HashChanger",
  "sap/ui/model/json/JSONModel"
], function (Controller, HashChanger, JSONModel) {
  "use strict";

  function fmtM(v) {
    if (v == null) { return "—"; }
    var a = Math.abs(v), s = v < 0 ? "-" : "";
    return a >= 1e6 ? s + "$" + (a / 1e6).toFixed(2) + "M"
      : a >= 1e3 ? s + "$" + (a / 1e3).toFixed(0) + "K"
        : s + "$" + a.toFixed(0);
  }

  return Controller.extend("dassian.tpm.ui5.controller.EAC", {
    onInit: function () {
      this.getView().setModel(new JSONModel({ items: [], totals: {} }), "eac");
      this._load();
    },
    _prog: function () { return this.getOwnerComponent().getModel("ui").getProperty("/program"); },
    onProgramChange: function () { this._load(); },
    _load: function () {
      var prog = this._prog(), model = this.getOwnerComponent().getModel();
      model.bindList("/ControlAccounts").requestContexts(0, 500).then(function (ctxs) {
        var items = [], sBac = 0, sEac = 0, sVac = 0, sEv = 0, sAc = 0;
        ctxs.forEach(function (c) {
          var o = c.getObject();
          if (o.ProgramID !== prog) { return; }
          var bac = parseFloat(o.BAC) || 0, eac = parseFloat(o.EAC) || 0, vac = parseFloat(o.VAC) || 0;
          var cpi = parseFloat(o.CPI) || 0, spi = parseFloat(o.SPI) || 0;
          var ev = parseFloat(o.EarnedValue) || 0, ac = parseFloat(o.ActualCost) || 0;
          var ieacCpi = cpi > 0 ? bac / cpi : null;                               // IEAC = BAC / CPI
          var ieacComp = (cpi > 0 && spi > 0) ? ac + (bac - ev) / (cpi * spi) : null; // composite CPI×SPI
          var etc = eac > 0 ? eac - ac : null;                                   // ETC = EAC − ACWP
          items.push({
            wbs: o.ID, desc: o.Description, cam: o.Manager,
            bacT: fmtM(bac), acwpT: fmtM(ac), etcT: fmtM(etc), eacT: fmtM(eac), vacT: fmtM(vac), vac: vac,
            ieacCpiT: fmtM(ieacCpi), ieacCompT: fmtM(ieacComp),
            cpiT: cpi.toFixed(3), spiT: spi.toFixed(3)
          });
          sBac += bac; sEac += eac; sVac += vac; sEv += ev; sAc += ac;
        });
        var progCpi = sAc > 0 ? sEv / sAc : 0;
        var progIeac = progCpi > 0 ? sBac / progCpi : null;
        this.getView().getModel("eac").setData({
          items: items,
          totals: {
            bacT: fmtM(sBac), acwpT: fmtM(sAc), etcT: fmtM(sEac - sAc), eacT: fmtM(sEac), vacT: fmtM(sVac), vac: sVac,
            progCpiT: progCpi.toFixed(3), progIeacT: fmtM(progIeac)
          }
        });
      }.bind(this));
    },

    onNavBack: function () { HashChanger.getInstance().setHash(""); }
  });
});
