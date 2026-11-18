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

  // Summary columns shown from CAP_SUMMARY (indexes into cols), as in the prototype
  var CAP_SUM_SHOW = [3, 4, 12, 13, 14, 16, 17, 20, 21, 22, 23, 24, 26, 27, 30, 31, 32, 33, 34, 35, 36, 37];
  // Tripwire column groups: text, numeric, and the check columns (21+) rendered OK/ISSUE/N/A
  var TW_TEXT = [0, 1, 3, 5], TW_NUM = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  // artifact name -> navigate to another module
  var NAV = {
    "Integrated Master Schedule (IMS)": "MasterSchedule",
    "Variance Analysis Report (VAR)": "VAR"
  };

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }

  // Month-end periods with plan factors (May = full), to time-phase the RAM budgets.
  var PERIODS = [
    { key: "2025-12", text: "Dec 2025", f: 0.20 },
    { key: "2026-01", text: "Jan 2026", f: 0.36 },
    { key: "2026-02", text: "Feb 2026", f: 0.54 },
    { key: "2026-03", text: "Mar 2026", f: 0.70 },
    { key: "2026-04", text: "Apr 2026", f: 0.86 },
    { key: "2026-05", text: "May 2026", f: 1.00 }
  ];

  return Controller.extend("dassian.tpm.ui5.controller.ArtifactsReports", {
    onInit: function () {
      var m = new JSONModel();
      this.getView().setModel(m, "reports");
      m.loadData(sap.ui.require.toUrl("dassian/tpm/ui5/model/reports.json"));
      var ram = new JSONModel();
      this.getView().setModel(ram, "ram");
      ram.loadData(sap.ui.require.toUrl("dassian/tpm/ui5/model/ram.json"));
      ram.attachRequestCompleted(function () {
        ram.setProperty("/periods", PERIODS);
        ram.setProperty("/period", "2026-05");
      });
      var cap = new JSONModel();
      this.getView().setModel(cap, "cap");
      cap.loadData(sap.ui.require.toUrl("dassian/tpm/ui5/model/cap.json"));
      this.getView().setModel(new JSONModel({ view: "tp" }), "capui");
      var tw = new JSONModel();
      this.getView().setModel(tw, "tw");
      tw.loadData(sap.ui.require.toUrl("dassian/tpm/ui5/model/tripwire.json"));
      var cl = new JSONModel();
      this.getView().setModel(cl, "cl");
      cl.loadData(sap.ui.require.toUrl("dassian/tpm/ui5/model/controllog.json"));
      var s14 = new JSONModel();
      this.getView().setModel(s14, "s14");
      s14.loadData(sap.ui.require.toUrl("dassian/tpm/ui5/model/schedule14.json"));
    },

    onOpenArtifact: function (evt) {
      var ctx = evt.getSource().getBindingContext();
      var name = ctx.getProperty("Name");
      if (name === "WBS Dictionary") { this._openWbsDictionary(); }
      else if (name === "Responsibility Assignment Matrix (RAM)") { this._openRam(); }
      else if (name === "Control Account Plans (CAP)") { this._openCap(); }
      else if (name === "Tripwire Report") { this._openTripwire(); }
      else if (name === "Program Control Log") { this._openControlLog(); }
      else if (name === "Schedule 14-Point Assessment") { this._openSchedule14(); }
      else if (NAV[name]) { HashChanger.getInstance().setHash(NAV[name]); }
      else { MessageToast.show("No embedded viewer for “" + name + "” — document reference only."); }
    },

    // RAM: grouped OBS department headers over the manager columns, WBS level/CA
    // marks, and the budget rollup footer (Total, G&A, PMB, MR, CBB, Fee, Price).
    _openRam: function () {
      var d = this.getView().getModel("ram").getData();
      if (!d || !d.rows) { MessageToast.show("RAM data not loaded yet — try again."); return; }
      this.byId("reportGrid").setVisible(false);
      this.byId("ramBox").setVisible(true);
      this._renderRam();
      var dlg = this.byId("reportDialog");
      dlg.setTitle("Responsibility Assignment Matrix (RAM)");
      dlg.open();
    },
    onRamPeriodChange: function () { this._renderRam(); },

    _renderRam: function () {
      var d = this.getView().getModel("ram").getData();
      if (!d || !d.rows) { return; }
      var np = d.people.length, c = d.constants || { mr: 0, fee: 0, gaRate: 0 };
      // time-phase every budget figure through the selected month-end
      var periodKey = this.getView().getModel("ram").getProperty("/period") || "2026-05";
      var per = PERIODS.filter(function (p) { return p.key === periodKey; })[0] || PERIODS[PERIODS.length - 1];
      var f = per.f;
      var money = function (v) { return (v == null || v === "") ? "" : Math.round(v * f).toLocaleString("en-US"); };

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
      this.byId("reportHtml").setContent("<div>" + html + "</div>");
    },

    // CAP: Time-Phased / Summary toggle, matching the prototype.
    _openCap: function () {
      var d = this.getView().getModel("cap").getData();
      if (!d || !d.tp) { MessageToast.show("CAP data not loaded yet — try again."); return; }
      this.byId("reportGrid").setVisible(false);
      this.byId("ramBox").setVisible(false);
      this.byId("capBox").setVisible(true);
      this._renderCap();
      var dlg = this.byId("reportDialog");
      dlg.setTitle("Control Account Plans (CAP)");
      dlg.open();
    },
    onCapViewChange: function () { this._renderCap(); },

    _renderCap: function () {
      var d = this.getView().getModel("cap").getData();
      if (!d || !d.tp) { return; }
      var view = this.getView().getModel("capui").getProperty("/view");
      this.byId("capHtml").setContent("<div>" + (view === "summary" ? this._capSummaryHtml(d.summary) : this._capTpHtml(d.tp)) + "</div>");
    },

    _capTpHtml: function (t) {
      var money = function (v) { return (typeof v === "number" && v !== 0) ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : ""; };
      var monthTh = (t.months || []).map(function (m) { return '<th class="cap-num">' + esc(m) + "</th>"; }).join("");
      var rows = t.rows || [], body = "", i = 0;
      while (i < rows.length) {
        var wp = rows[i].wp, grp = [];
        while (i < rows.length && rows[i].wp === wp) { grp.push(rows[i]); i++; }
        grp.forEach(function (r, gi) {
          var lead = gi === 0
            ? '<td rowspan="' + grp.length + '">' + esc(r.ca) + '</td><td rowspan="' + grp.length + '">' + esc(r.wp) + '</td><td rowspan="' + grp.length + '">' + esc(r.wpDesc) + "</td>"
            : "";
          var mvals = (r.vals || []).map(function (v) { return '<td class="cap-num">' + money(v) + "</td>"; }).join("");
          body += "<tr" + (gi === 0 ? ' class="cap-wptop"' : "") + ">" + lead + '<td class="cap-type">' + esc(r.type) + '</td><td class="cap-num cap-tot">' + money(r.totals) + "</td>" + mvals + "</tr>";
        });
      }
      return '<table class="cap-tbl cap-tp"><thead><tr><th>Control Account</th><th>Work Package</th><th>Description</th><th>Type</th><th class="cap-num">TOTALS</th>' + monthTh + "</tr></thead><tbody>" + body + "</tbody></table>";
    },

    _capSummaryHtml: function (s) {
      var cols = s.cols || [], rows = s.rows || [];
      var fmt = function (name, v) {
        if (typeof v !== "number") { return esc(String(v).replace("WBS ", "")); }
        if (/SPI|CPI|TCPI/.test(name)) { return v.toFixed(2); }
        if (/%/.test(name)) { return v.toFixed(1) + "%"; }
        return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
      };
      var th = CAP_SUM_SHOW.map(function (idx, k) { return "<th" + (k > 1 ? ' class="cap-num"' : "") + ">" + esc(cols[idx]) + "</th>"; }).join("");
      var body = rows.map(function (r) {
        return "<tr>" + CAP_SUM_SHOW.map(function (idx, k) {
          var name = cols[idx], v = r[idx];
          var cls = (k <= 1) ? "" : ("cap-num" + ((typeof v === "number" && v < 0) ? " cap-neg" : ""));
          return '<td class="' + cls + '">' + fmt(name, v) + "</td>";
        }).join("") + "</tr>";
      }).join("");
      return '<table class="cap-tbl cap-sum"><thead><tr>' + th + "</tr></thead><tbody>" + body + "</tbody></table>";
    },

    // Generic HTML-report display (Tripwire, Control Log, Schedule 14-Point).
    _showGen: function (title, html) {
      this.byId("reportGrid").setVisible(false);
      this.byId("ramBox").setVisible(false);
      this.byId("capBox").setVisible(false);
      this.byId("genScroll").setVisible(true);
      this.byId("genHtml").setContent("<div>" + html + "</div>");
      var dlg = this.byId("reportDialog");
      dlg.setTitle(title);
      dlg.open();
    },

    _openTripwire: function () {
      var t = this.getView().getModel("tw").getData();
      if (!t || !t.rows) { MessageToast.show("Tripwire data not loaded yet — try again."); return; }
      var CHK = []; for (var i = 21; i < t.cols.length; i++) { CHK.push(i); }
      var twMoney = function (v) { return (typeof v === "number") ? Math.round(v).toLocaleString("en-US") : esc(v); };
      var twRatio = function (v) { return (typeof v === "number") ? v.toFixed(2) : esc(v); };
      var th = "";
      TW_TEXT.forEach(function (i) { th += "<th>" + esc(t.cols[i]) + "</th>"; });
      TW_NUM.forEach(function (i) { th += '<th class="tw-num">' + esc(t.cols[i]) + "</th>"; });
      CHK.forEach(function (i) { var full = String(t.cols[i]); th += '<th class="tw-chk" title="' + esc(full) + '">' + esc(full.split(" ")[0]) + "</th>"; });
      var body = t.rows.map(function (r) {
        var cells = "";
        TW_TEXT.forEach(function (i) { cells += "<td>" + esc(r[i]) + "</td>"; });
        TW_NUM.forEach(function (i) { cells += '<td class="tw-num">' + (i >= 18 ? twRatio(r[i]) : twMoney(r[i])) + "</td>"; });
        CHK.forEach(function (i) { var v = r[i], cls = v === "ISSUE" ? "tw-issue" : (v === "OK" ? "tw-ok" : "tw-na"); cells += '<td class="tw-chk ' + cls + '">' + esc(v) + "</td>"; });
        return "<tr>" + cells + "</tr>";
      }).join("");
      var m = t.meta || {};
      var issues = t.rows.reduce(function (a, r) { return a + r.filter(function (cc) { return cc === "ISSUE"; }).length; }, 0);
      var sub = esc([m.snapshot, m.baseline].filter(Boolean).join(" · ")) + (issues ? " · " + issues + " issues flagged" : "");
      var html = '<div class="rep-sub">' + sub + '</div><table class="tw-tbl"><thead><tr>' + th + "</tr></thead><tbody>" + body + "</tbody></table>";
      this._showGen(m.title || "Tripwire Report", html);
    },

    _openControlLog: function () {
      var c = this.getView().getModel("cl").getData();
      if (!c || !c.rows) { MessageToast.show("Program Control Log not loaded yet — try again."); return; }
      var cmoney = function (v) { return (typeof v === "number") ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : esc(v); };
      var metaHtml = (c.meta || []).map(function (x) { return x.label ? '<span class="cl-m"><b>' + esc(x.label) + ":</b> " + esc(x.value) + "</span>" : '<span class="cl-m">' + esc(x.value) + "</span>"; }).join("");
      var left = c.cols.slice(0, 9), cbb = c.cols.slice(9);
      var thead = "<thead><tr>" + left.map(function (h) { return '<th rowspan="2">' + esc(h) + "</th>"; }).join("") +
        '<th class="cl-cbb" colspan="5">Contract Budget Baseline</th></tr><tr>' + cbb.map(function (h) { return '<th class="cl-num">' + esc(h) + "</th>"; }).join("") + "</tr></thead>";
      var body = (c.rows || []).map(function (r) {
        var summary = !String(r[8]).trim(), cells = "", i;
        for (i = 0; i < 9; i++) { cells += "<td>" + esc(r[i]) + "</td>"; }
        for (i = 9; i < 14; i++) { cells += '<td class="cl-num">' + cmoney(r[i]) + "</td>"; }
        return '<tr class="' + (summary ? "cl-sum" : "") + '">' + cells + "</tr>";
      }).join("");
      var html = '<div class="cl-metabar">' + metaHtml + '</div><table class="cl-tbl">' + thead + "<tbody>" + body + "</tbody></table>";
      this._showGen(c.title || "Program Control Log", html);
    },

    _openSchedule14: function () {
      var s = this.getView().getModel("s14").getData();
      if (!s || !s.metrics) { MessageToast.show("Schedule assessment not loaded yet — try again."); return; }
      var pill = function (st) { return st === "Pass" ? '<span class="s14-pill s14-pass">Pass</span>' : (st === "Fail" ? '<span class="s14-pill s14-fail">Fail</span>' : '<span class="s14-pill s14-na">N/A</span>'); };
      var pass = 0, fail = 0, na = 0;
      var rows = s.metrics.map(function (r) {
        if (r.status === "Pass") { pass++; } else if (r.status === "Fail") { fail++; } else { na++; }
        return '<tr><td class="s14-num">' + r.num + "</td><td>" + esc(r.name) + '</td><td class="s14-num">' + esc(r.val) + "</td><td>" + esc(r.thresh) + "</td><td>" + pill(r.status) + '</td><td class="s14-note">' + esc(r.detail) + "</td></tr>";
      }).join("");
      var html = '<div class="rep-sub">DCMA schedule-health metrics · ' + pass + " pass · " + fail + " fail · " + na + " N/A · illustrative for the Demo IMS (project JTB001)</div>" +
        '<table class="s14-tbl"><thead><tr><th>#</th><th>Metric</th><th class="s14-num">Measured</th><th>DCMA Threshold</th><th>Result</th><th>Notes</th></tr></thead><tbody>' + rows + "</tbody></table>";
      this._showGen("Schedule 14-Point Assessment", html);
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
      this.byId("ramBox").setVisible(false);
      this.byId("capBox").setVisible(false);
      this.byId("genScroll").setVisible(false);
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
