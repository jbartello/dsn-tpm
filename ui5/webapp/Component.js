sap.ui.define([
  "sap/fe/core/AppComponent",
  "sap/ui/model/json/JSONModel"
], function (AppComponent, JSONModel) {
  "use strict";

  return AppComponent.extend("dassian.tpm.ui5.Component", {
    metadata: {
      manifest: "json"
    },
    init: function () {
      AppComponent.prototype.init.apply(this, arguments);
      // App-wide program selection, shared by the custom (freestyle) pages.
      this.setModel(new JSONModel({ program: "DEMO" }), "ui");
    }
  });
});
