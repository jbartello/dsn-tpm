sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/HashChanger",
  "sap/ui/model/json/JSONModel",
  "sap/ui/table/Column",
  "sap/m/Text",
  "sap/m/MessageToast",
  "dassian/tpm/ui5/model/WbsStore"
], function (Controller, HashChanger, JSONModel, Column, Text, MessageToast, WbsStore) {
  "use strict";

  // artifact name -> embedded report grid (static sample reports)
  var REPORT_KEY = {
    "Responsibility Assignment Matrix (RAM)": "ram",
    "Control Account Plans (CAP)": "cap",
    "Tripwire Report": "tripwire",
    "Program Control Log": "controllog"
  };
  // artifact name -> navigate to another module
  var NAV = {
    "Integrated Master Schedule (IMS)": "MasterSchedule",
    "Schedule 14-Point Assessment": "MasterSchedule",
    "Variance Analysis Report (VAR)": "VAR"
  };

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
  function money(v) { return (v == null || v === "") ? "" : Math.round(v).toLocaleString("en-US"); }

  return Controller.extend("dassian.tpm.ui5.controller.ArtifactsReports", {
    onInit: function () {
      var m = new JSONModel();
      this.getView().setModel(m, "reports");
      m.loadData(sap.ui.require.toUrl("dassian/tpm/ui5/model/reports.json"));
      var ram = new JSONModel();
      this.getView().setModel(ram, "ram");
      ram.loadData(sap.ui.require.toUrl("dassian/tpm/ui5/model/ram.json"));
    },

    onOpenArtifact: function (evt) {
      var ctx = evt.getSource().getBindingContext();
      var name = ctx.getProperty("Name");
      if (name === "WBS Dictionary") { this._openWbsDictionary(); }
      else if (name === "Responsibility Assignment Matrix (RAM)") { this._openRam(); }
      else if (REPORT_KEY[name]) { this._openReport(REPORT_KEY[name], name); }
      else if (NAV[name]) { HashChanger.getInstance().setHash(NAV[name]); }
      else { MessageToast.show("No embedded viewer for “" + name + "” — document reference only."); }
    },

    // RAM: grouped OBS department headers over the manager columns, WBS level/CA
    // marks, and the budget rollup footer (Total, G&A, PMB, MR, CBB, Fee, Price).
    _openRam: function () {
      var d = this.getView().getModel("ram").getData();
      if (!d || !d.rows) { MessageToast.show("RAM data not loaded yet — try again."); return; }
      var np = d.people.length, c = d.constants || { mr: 0, fee: 0, gaRate: 0 };

      // column sums + grand total across the detail rows
      var colSums = new Array(np).fill(0), grand = 0;
      d.rows.forEach(function (r) {
        (r.vals || []).forEach(function (v, i) { if (typeof v === "number") { colSums[i] += v; } });
        if (typeof r.total === "number") { grand += r.total; }
      });
      var ga = colSums.map(function (v) { return v * c.gaRate; }), gaTot = grand * c.gaRate;
      var pmb = grand + gaTot, cbb = pmb + c.mr, price = cbb + c.fee;

      // ---- header ----
      var deptTh = d.depts.map(function (dp) { return '<th class="ram-dept" colspan="' + dp.span + '">' + esc(dp.name) + "</th>"; }).join("");
      var personTh = d.people.map(function (p) { return '<th class="ram-person">' + esc(p) + "</th>"; }).join("");
      var thead =
        "<thead>" +
        '<tr class="ram-title"><th colspan="6">' + esc(d.meta.project) + '</th><th colspan="' + (np + 1) + '">' + esc(d.meta.obs) + "</th></tr>" +
        '<tr class="ram-grp"><th colspan="4" class="ram-ylw">WBS Level</th><th colspan="2" class="ram-ylw">WBS Element</th>' + deptTh + '<th rowspan="2" class="ram-totcol">Total</th></tr>' +
        '<tr class="ram-sub"><th class="ram-ylw">1</th><th class="ram-ylw">2</th><th class="ram-ylw">3</th><th class="ram-ylw">4</th><th class="ram-ylw">Number</th><th class="ram-ylw">Description</th>' + personTh + "</tr>" +
        "</thead>";

      // ---- detail rows ----
      var lvlCells = function (r) {
        var s = "";
        for (var col = 1; col <= 4; col++) {
          var mk = (col === r.level) ? (r.ca ? "CA" : "X") : "";
          s += '<td class="ram-lvl' + (mk === "CA" ? " ram-ca" : "") + '">' + mk + "</td>";
        }
        return s;
      };
      var body = d.rows.map(function (r) {
        var cells = (r.vals || []).map(function (v) { return '<td class="ram-num">' + money(v) + "</td>"; }).join("");
        return "<tr>" + lvlCells(r) + "<td>" + esc(r.number) + "</td><td>" + esc(r.desc) + "</td>" + cells + '<td class="ram-num ram-tot">' + money(r.total) + "</td></tr>";
      }).join("");

      // ---- footer rollup ----
      var blanks = new Array(np).fill('<td class="ram-num"></td>').join("");
      var perRow = function (label, cols, total, cls) {
        var cells = cols ? cols.map(function (v) { return '<td class="ram-num">' + money(v) + "</td>"; }).join("") : blanks;
        return '<tr class="ram-foot ' + (cls || "") + '"><td colspan="6">' + esc(label) + "</td>" + cells + '<td class="ram-num ram-tot">' + money(total) + "</td></tr>";
      };
      var foot =
        perRow("Total (Excluding G&A and COM)  Currency: USD - Internal Cost", colSums, grand, "ram-foot-top") +
        perRow("General Administrative (G&A)", ga, gaTot) +
        perRow("Cost of Money (COM)", null, null) +
        perRow("UNDISTRIBUTED BUDGET", null, null) +
        perRow("PERFORMANCE MEASUREMENT BASELINE", null, pmb, "ram-foot-bold") +
        perRow("MANAGEMENT RESERVE", null, c.mr) +
        perRow("CONTRACT BUDGET BASE", null, cbb, "ram-foot-bold") +
        perRow("FEE", null, c.fee) +
        perRow("CONTRACT PRICE", null, price, "ram-foot-bold");

      var html = '<table class="ram-tbl">' + thead + "<tbody>" + body + foot + "</tbody></table>";
      this.byId("reportGrid").setVisible(false);
      this.byId("reportHtmlScroll").setVisible(true);
      this.byId("reportHtml").setContent("<div>" + html + "</div>");
      var dlg = this.byId("reportDialog");
      dlg.setTitle("Responsibility Assignment Matrix (RAM)");
      dlg.open();
    },

    _prog: function () { return this.getOwnerComponent().getModel("ui").getProperty("/program"); },

    // The WBS Dictionary is generated live from the control-account and work-package
    // structure maintained in Project Setup (shared WbsStore), not from static data.
    _openWbsDictionary: function () {
      var prog = this._prog(), that = this;
      var render = function (tree) {
        var dict = WbsStore.dictionary(tree);
        that.getView().getModel("reports").setProperty("/wbs", dict);
        that._renderGrid(dict.cols, "reports>/wbs/rows", "WBS Dictionary — " + (prog === "MFG" ? "MFG Program" : "Demo") + " (from Control Accounts & Work Packages)");
      };
      if (WbsStore.get(prog)) { render(WbsStore.get(prog)); return; }
      var model = this.getOwnerComponent().getModel();
      model.bindList("/ControlAccounts").requestContexts(0, 500).then(function (ctxs) {
        var cas = [];
        ctxs.forEach(function (c) {
          var o = c.getObject();
          if (o.ProgramID !== prog) { return; }
          cas.push({ id: o.ID, desc: o.Description, cam: o.Manager, bac: parseFloat(o.BAC) || 0 });
        });
        render(WbsStore.ensure(prog, cas));
      });
    },

    _renderGrid: function (cols, rowsPath, title) {
      var grid = this.byId("reportGrid");
      if (!grid) { return; }
      this.byId("reportHtmlScroll").setVisible(false);
      grid.setVisible(true);
      grid.removeAllColumns();
      cols.forEach(function (c, i) {
        var wide = c === "Authorization Information" || c === "Scope of Work (SOW)";
        grid.addColumn(new Column({
          label: new Text({ text: String(c), wrapping: false }),
          template: new Text({ text: "{reports>" + i + "}", wrapping: wide }),
          width: wide ? "24rem" : (c === "Description" ? "14rem" : (i < 4 ? "12rem" : "8rem"))
        }));
      });
      grid.bindRows(rowsPath);
      var dlg = this.byId("reportDialog");
      dlg.setTitle(title);
      dlg.open();
    },

    _openReport: function (key, title) {
      var d = this.getView().getModel("reports").getProperty("/" + key);
      if (!d) { return; }
      this._renderGrid(d.cols, "reports>/" + key + "/rows", title);
    },

    onCloseReport: function () { this.byId("reportDialog").close(); },

    onNavBack: function () { HashChanger.getInstance().setHash(""); }
  });
});
