sap.ui.define([
  "sap/ui/core/mvc/ControllerExtension",
  "dassian/tpm/ui5/ext/BcrDetail"
], function (ControllerExtension, BcrDetail) {
  "use strict";

  // Fiori elements List Report extension. The app runs inside a custom sap.tnt
  // ToolPage shell, so FE's built-in list → object-page navigation (which needs
  // the FE RootViewController) throws. For Baseline Changes we intercept the row
  // press and open the rich BCR detail slide-out instead; other list reports fall
  // through to the default behavior. (The toolbar "Create" action is handled by
  // the ext/BcrActions handler module, which FE loads from the manifest.)
  return ControllerExtension.extend("dassian.tpm.ui5.ext.ListReportExt", {
    override: {
      routing: {
        onBeforeNavigation: function (mParams) {
          var ctx = mParams && mParams.bindingContext;
          if (!ctx || typeof ctx.getPath !== "function") { return false; }
          if (ctx.getPath().indexOf("/BaselineChanges") !== 0) { return false; }
          BcrDetail.open(this.base.getView(), ctx.getProperty("ID"));
          return true;   // cancel the default FE navigation
        }
      }
    }
  });
});
