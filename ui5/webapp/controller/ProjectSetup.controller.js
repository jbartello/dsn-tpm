sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/HashChanger",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast"
], function (Controller, HashChanger, JSONModel, MessageToast) {
  "use strict";

  var OPTS = {
    reporting: ["Control Accounts", "Work Packages", "WBS Level", "Manual Selection"],
    pmbVer: ["PMB-BL3 (Current)", "PMB-BL2", "PMB-BL1"],
    eacVer: ["EAC-Working", "EAC-Approved", "EAC-CBB"],
    extract: ["CPR-STD", "IPMDAR-STD", "INTERNAL"]
  };

  function L(rV, rP, yV, yP) { return { rVal: String(rV), rPct: String(rP), yVal: String(yV), yPct: String(yP) }; }
  function E() { return { rVal: "", rPct: "", yVal: "", yPct: "" }; }
  function defaultThresh() {
    return {
      vac: { period: { upper: E(), lower: E() }, cum: { upper: L(100000, 10, 50000, 5), lower: L(-100000, -10, -50000, -5) } },
      sv: { period: { upper: L(20000, 10, 10000, 5), lower: L(-20000, -10, -10000, -5) }, cum: { upper: L(50000, 10, 25000, 5), lower: L(-50000, -10, -25000, -5) } },
      cv: { period: { upper: L(20000, 10, 10000, 5), lower: L(-20000, -10, -10000, -5) }, cum: { upper: L(50000, 10, 25000, 5), lower: L(-50000, -10, -25000, -5) } }
    };
  }
  function addCommas(s) {
    if (s === "" || s == null) { return ""; }
    var neg = String(s).charAt(0) === "-", d = String(s).replace("-", "");
    return (neg ? "-" : "") + d.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }

  function threshTable(thresh) {
    var VARS = [["vac", "Variance at Complete"], ["sv", "Schedule Variance"], ["cv", "Cost Variance"]];
    var cell = function (v, scope, limit, field, off) {
      if (off) { return '<td class="ps-th-empty"></td>'; }
      var raw = thresh[v][scope][limit][field];
      var disp = (field === "rVal" || field === "yVal") ? addCommas(raw) : raw;
      return '<td><input class="ps-th-in" value="' + esc(disp) + '"></td>';
    };
    var limRow = function (v, limit, vName, lName, off) {
      return "<tr>" + (limit === "upper" ? '<td class="ps-th-var" rowspan="2">' + vName + "</td>" : "") + '<td class="ps-th-lim">' + lName + "</td>" +
        cell(v, "period", limit, "rVal", off) + cell(v, "period", limit, "rPct", off) + cell(v, "period", limit, "yVal", off) + cell(v, "period", limit, "yPct", off) +
        cell(v, "cum", limit, "rVal") + cell(v, "cum", limit, "rPct") + cell(v, "cum", limit, "yVal") + cell(v, "cum", limit, "yPct") + "</tr>";
    };
    var body = VARS.map(function (x) { var off = x[0] === "vac"; return limRow(x[0], "upper", x[1], "Upper Limit", off) + limRow(x[0], "lower", x[1], "Lower Limit", off); }).join("");
    return '<div class="ps-th-wrap"><table class="ps-th-tbl">' +
      "<thead>" +
      '<tr><th class="ps-th-corner" colspan="2"></th><th class="ps-th-grp" colspan="4">Period Thresholds</th><th class="ps-th-grp" colspan="4">Cumulative Thresholds</th></tr>' +
      '<tr><th colspan="2"></th><th class="ps-th-red" colspan="2">● Red</th><th class="ps-th-yel" colspan="2">▲ Yellow</th><th class="ps-th-red" colspan="2">● Red</th><th class="ps-th-yel" colspan="2">▲ Yellow</th></tr>' +
      "<tr><th colspan=\"2\"></th><th>Value</th><th>Percent</th><th>Value</th><th>Percent</th><th>Value</th><th>Percent</th><th>Value</th><th>Percent</th></tr>" +
      "</thead><tbody>" + body + "</tbody></table></div>";
  }

  function fmtM(v) {
    var a = Math.abs(v), s = v < 0 ? "-" : "";
    return a >= 1e6 ? s + "$" + (a / 1e6).toFixed(1) + "M" : a >= 1e3 ? s + "$" + (a / 1e3).toFixed(0) + "K" : s + "$" + a.toFixed(0);
  }

  function wbsTable(cas) {
    var rows = cas.map(function (c) {
      return '<tr><td class="wbs-code">' + esc(c.wbs) + "</td><td>" + esc(c.desc) + "</td>" +
        '<td><span class="wbs-badge wbs-ca">Control Account</span></td>' +
        "<td>" + esc(c.cam) + "</td><td>" + (c.ev || "Percent Complete") + '</td><td class="wbs-num">' + fmtM(c.bac) + "</td></tr>";
    }).join("");
    return '<div class="ps-th-wrap"><table class="wbs-tbl">' +
      "<thead><tr><th>WBS / CA</th><th>Description</th><th>Classification</th><th>CAM</th><th>EV Method</th><th>BAC</th></tr></thead>" +
      "<tbody>" + rows + "</tbody></table></div>";
  }

  return Controller.extend("dassian.tpm.ui5.controller.ProjectSetup", {
    onInit: function () {
      var m = new JSONModel({
        opts: OPTS,
        header: { reporting: "Control Accounts", pm: "L. Ortiz", pmbVer: OPTS.pmbVer[0], eacVer: OPTS.eacVer[0], extract: OPTS.extract[0], obs: "Program" },
        thresh: defaultThresh()
      });
      this.getView().setModel(m, "set");
      this._threshHtml = threshTable(m.getProperty("/thresh"));
      this._wbsHtml = "";
      var that = this;
      ["threshHtml", "wbsHtml"].forEach(function (id) {
        var node = that.byId(id);
        if (node) { node.addEventDelegate({ onAfterRendering: function () { that._paint(); } }); }
      });
      this._load();
    },
    _prog: function () { return this.getOwnerComponent().getModel("ui").getProperty("/program"); },
    onProgramChange: function () { this._load(); },

    _paint: function () {
      var t = this.byId("threshHtml"), w = this.byId("wbsHtml");
      if (t && this._threshHtml && t.getContent() !== this._threshHtml) { t.setContent(this._threshHtml); }
      if (w && this._wbsHtml && w.getContent() !== this._wbsHtml) { w.setContent(this._wbsHtml); }
    },

    _load: function () {
      var prog = this._prog(), model = this.getOwnerComponent().getModel(), that = this;
      model.bindList("/ControlAccounts").requestContexts(0, 500).then(function (ctxs) {
        var cas = [];
        ctxs.forEach(function (c) {
          var o = c.getObject();
          if (o.ProgramID !== prog) { return; }
          cas.push({ wbs: o.ID, desc: o.Description, cam: o.Manager, bac: parseFloat(o.BAC) || 0, ev: o.EVMethod });
        });
        that._wbsHtml = wbsTable(cas);
        that._paint();
      });
    },

    onCopyThresholds: function () {
      MessageToast.show("Copy thresholds from another maintained project (prototype — connect to project list)");
    },

    onNavBack: function () { HashChanger.getInstance().setHash(""); }
  });
});
