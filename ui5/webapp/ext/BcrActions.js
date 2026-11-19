sap.ui.define([
  "dassian/tpm/ui5/ext/BcrEditor"
], function (BcrEditor) {
  "use strict";

  // Handler module for the Baseline Change list's custom toolbar action.
  // Fiori elements loads this module (named in the manifest's controlConfiguration)
  // and calls onCreateBcr with the button press event; the event source gives us a
  // control in the page's model scope to host the create dialog.
  return {
    onCreateBcr: function (oEvent) {
      var host = (oEvent && typeof oEvent.getSource === "function") ? oEvent.getSource() : null;
      BcrEditor.open(host);
    }
  };
});
