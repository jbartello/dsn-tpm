// FLP sandbox boot: sandbox2.js bootstraps sap.ushell.Container but does not
// place the renderer in this (@ui5/cli) setup, so create + place it once the
// container is ready.
sap.ui.define([], function () {
  "use strict";
  function render(n) {
    if (window.sap && sap.ushell && sap.ushell.Container && sap.ushell.Container.createRenderer) {
      sap.ushell.Container.createRenderer("fiori2", true).then(function (r) {
        r.placeAt("content");
        // Land directly in the TPM app (its tile Home is the launchpad), wrapped
        // in the Fiori launchpad shell chrome.
        if (!location.hash || location.hash === "" || location.hash === "#Shell-home") {
          location.hash = "#tpm-display";
        }
      });
    } else if (n > 0) {
      setTimeout(function () { render(n - 1); }, 200);
    }
  }
  render(60);
});
