sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function (Controller) {
  "use strict";

  // object-page / list routes that should highlight their parent nav entry
  var ROUTE_TO_NAV = {
    ControlAccountsObjectPage: "ControlAccountsList",
    BaselineChangesObjectPage: "BaselineChangesList",
    ProjectsObjectPage: "ProjectsList"
  };

  return Controller.extend("dassian.tpm.ui5.controller.App", {
    onInit: function () {
      this._router = this.getOwnerComponent().getRouter();
      this._router.attachRouteMatched(this._onRouteMatched, this);
    },

    onNavSelect: function (evt) {
      var item = evt.getParameter("item");
      var key = item && item.getKey && item.getKey();
      if (key) { this._router.navTo(key); }
    },

    onToggleNav: function () {
      var tp = this.byId("toolPage");
      tp.setSideExpanded(!tp.getSideExpanded());
    },

    // Keep the side-navigation highlight in sync with whatever route is active,
    // including navigations triggered from launchpad tiles or in-page links.
    _onRouteMatched: function (evt) {
      var name = evt.getParameter("name");
      var key = ROUTE_TO_NAV[name] || name;
      var sn = this.byId("sideNav");
      var list = sn && sn.getItem();
      if (!list) { return; }
      var found = null;
      list.getItems().forEach(function (it) {
        if (it.getKey && it.getKey() === key) { found = it; }
      });
      if (found) { sn.setSelectedItem(found); }
    }
  });
});
