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
    onOpenRiskInfo: function () {
      this._go("RiskInfo");
    },
    onOpenAnalytics: function () {
      this._go("Analytics");
    },
    onOpenMasterSchedule: function () {
      this._go("MasterSchedule");
    },
    onOpenVAR: function () {
      this._go("VAR");
    },
    onOpenSetup: function () {
      this._go("Projects");
    },
    onOpenEac: function () {
      this._go("EAC");
    },
    onOpenBcr: function () {
      this._go("BaselineChanges");
    },
    onOpenArtifacts: function () {
      this._go("Artifacts");
    },
    onOpenReports: function () {
      this._go("Reports");
    }
  });
});
