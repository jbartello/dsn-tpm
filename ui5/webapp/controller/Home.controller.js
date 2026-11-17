sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/HashChanger"
], function (Controller, HashChanger) {
  "use strict";

  return Controller.extend("dassian.tpm.ui5.controller.Home", {
    // Navigate by setting the hash directly so the Fiori elements router
    // resolves the target route (robust in a standalone, non-FLP runtime).
    _go: function (hash) {
      HashChanger.getInstance().setHash(hash);
    },
    onOpenControlAccounts: function () {
      this._go("ControlAccounts");
    },
    onOpenRisks: function () {
      this._go("Risks");
    },
    onOpenAnalytics: function () {
      this._go("Analytics");
    },
    onOpenRiskMatrix: function () {
      this._go("RiskMatrix");
    }
  });
});
