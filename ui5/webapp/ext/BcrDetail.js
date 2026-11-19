sap.ui.define([
  "sap/m/Dialog", "sap/m/Button", "sap/m/ScrollContainer", "sap/ui/core/HTML"
], function (Dialog, Button, ScrollContainer, HTML) {
  "use strict";

  // Full Baseline Change Request detail, matching the prototype's 9-section slide-out.
  // Opened from the Fiori elements list via a routing override (ext/ListReportExt),
  // reading the rich change data (ported from bcr-data.js) by BCR ID.

  var _dataPromise = null, _dialog = null, _html = null;
  // Records created this session (full detail), keyed by BCR id — checked before
  // the static bcr.json so a freshly created change opens with everything entered.
  var _overrides = {};

  var BCR_TYPES = {
    "BCR-P": "Internal replanning within the PMB (no CBB change)",
    "BCR-M": "Allocation of Management Reserve to control accounts",
    "BCR-C": "CBB / authorized scope change (Contracting Officer action)",
    "FCR": "Forecast / EAC change only (no budget movement)"
  };
  var BCR_BASELINE = [
    ["cbb", "Contract Budget Base (CBB)"],
    ["pmb", "Performance Measurement Baseline (PMB)"],
    ["mr", "Management Reserve (MR)"],
    ["ub", "Undistributed Budget (UB) — within PMB"],
    ["eac", "Estimate at Completion (EAC)"]
  ];

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
  function num(n) { var v = parseFloat(String(n == null ? "" : n).replace(/[, ]/g, "")); return isNaN(v) ? 0 : v; }
  function money(n) { return num(n).toLocaleString("en-US", { maximumFractionDigits: 0 }); }
  function yn(v) { return v ? "Yes" : "No"; }
  function decClass(d) { return d === "Approved" ? "ok" : d === "Rejected" ? "bad" : d === "N/A" ? "na" : "warn"; }

  function field(label, val) {
    return '<div class="bcrd-fld"><div class="bcrd-lbl">' + esc(label) + '</div><div class="bcrd-val">' + (val === "" || val == null ? "—" : esc(val)) + "</div></div>";
  }
  function section(n, title, inner) {
    return '<div class="bcrd-sec"><h3>' + n + " · " + esc(title) + "</h3><div class=\"bcrd-in\">" + inner + "</div></div>";
  }

  function buildHtml(b) {
    var aff = b.affects || {};

    // 1 · Identification
    var cust = b.customerDirected ? ("Yes" + (b.customerRef ? " (" + esc(b.customerRef) + ")" : "")) : "No";
    var s1 = '<div class="bcrd-grid">' +
      field("BCR Number", b.id) + field("Revision", b.rev) +
      field("Program / Project", b.prog) + field("Contract / Task Order No.", b.contract) +
      field("Date Submitted", b.dateSubmitted) + field("Originator", b.originator) +
      field("Priority", b.priority) + field("Status", b.status) +
      field("Customer-directed?", cust) + "</div>";

    // 2 · Change Classification
    var affects = [aff.scope ? "Scope" : null, aff.budget ? "Budget" : null, aff.schedule ? "Schedule" : null].filter(Boolean).join(", ") || "—";
    var retro = b.retro ? ("Yes" + (b.retroJust ? " — " + esc(b.retroJust) : "")) : "No";
    var s2 = '<div class="bcrd-grid">' +
      field("Change Type", b.type + " — " + (BCR_TYPES[b.type] || "")) +
      field("Affects", affects) +
      field("Retroactive (prior period)?", retro) +
      field("SOW reference / change driver", b.driver) + "</div>";

    // 3 · Description & Justification
    var s3 = '<div class="bcrd-stack">' +
      field("Description of change", b.description) +
      field("Reason / justification (why now, root cause)", b.justification) +
      field("Impact if not approved", b.impactIfNot) + "</div>";

    // 4 · Affected Work
    var aw = (b.affectedWork || []);
    var s4 = '<table class="bcrd-tbl"><thead><tr><th>WBS</th><th>Control Account</th><th>Work Package(s)</th><th>CAM</th><th>OBS / IPT</th></tr></thead><tbody>' +
      (aw.length ? aw.map(function (w) {
        return "<tr><td>" + esc(w.wbs) + "</td><td>" + esc(w.ca) + "</td><td>" + esc(w.wp) + "</td><td>" + esc(w.cam) + "</td><td>" + esc(w.obs) + "</td></tr>";
      }).join("") : '<tr><td colspan="5" class="bcrd-empty">No affected work recorded.</td></tr>') +
      "</tbody></table>";

    // 5 · Budget Movement
    var bm = (b.budgetMoves || []);
    var s5 = '<table class="bcrd-tbl"><thead><tr><th>From (source)</th><th>To (destination)</th><th>Element of Cost</th><th class="bcrd-num">Hours</th><th class="bcrd-num">Dollars</th></tr></thead><tbody>' +
      (bm.length ? bm.map(function (m) {
        return "<tr><td>" + esc(m.from) + "</td><td>" + esc(m.to) + "</td><td>" + esc(m.eoc) + '</td><td class="bcrd-num">' + money(m.hours) + '</td><td class="bcrd-num">' + money(m.dollars) + "</td></tr>";
      }).join("") : '<tr><td colspan="5" class="bcrd-empty">No budget movement recorded.</td></tr>') +
      "</tbody></table>";

    // 6 · Baseline Impact (Before → After) + CBB = PMB + MR balance check
    var after = {};
    var baseRows = BCR_BASELINE.map(function (row) {
      var k = row[0], label = row[1];
      var v = (b.baseline && b.baseline[k]) || { before: 0, change: 0 };
      var a = num(v.before) + num(v.change);
      after[k] = a;
      var chg = num(v.change);
      return "<tr><td>" + esc(label) + '</td><td class="bcrd-num">' + money(v.before) +
        '</td><td class="bcrd-num ' + (chg < 0 ? "bcrd-neg" : "") + '">' + (chg > 0 ? "+" : "") + money(chg) +
        '</td><td class="bcrd-num bcrd-after">' + money(a) + "</td></tr>";
    }).join("");
    var lhs = after.cbb, rhs = after.pmb + after.mr, ok = Math.abs(lhs - rhs) < 0.5;
    var balance = '<div class="bcrd-balance ' + (ok ? "ok" : "bad") + '">' +
      (ok ? "✓ Balanced: CBB " + money(after.cbb) + " = PMB " + money(after.pmb) + " + MR " + money(after.mr)
          : "✗ Out of balance: CBB " + money(after.cbb) + " ≠ PMB " + money(after.pmb) + " + MR " + money(after.mr) + " (= " + money(rhs) + ")") + "</div>";
    var s6 = '<table class="bcrd-tbl"><thead><tr><th>Element</th><th class="bcrd-num">Before</th><th class="bcrd-num">Change (+/−)</th><th class="bcrd-num">After</th></tr></thead><tbody>' + baseRows + "</tbody></table>" + balance;

    // 7 · Schedule Impact
    var sc = (b.schedule || []);
    var s7 = '<table class="bcrd-tbl"><thead><tr><th>Milestone / Activity</th><th>Baseline Date (Before)</th><th>Revised Date (After)</th><th>Variance</th></tr></thead><tbody>' +
      (sc.length ? sc.map(function (s) {
        return "<tr><td>" + esc(s.milestone) + "</td><td>" + esc(s.before) + "</td><td>" + esc(s.after) + "</td><td>" + esc(s.variance) + "</td></tr>";
      }).join("") : '<tr><td colspan="4" class="bcrd-empty">No schedule impact recorded.</td></tr>') +
      "</tbody></table>";

    // 8 · Approvals
    var ap = (b.approvals || []);
    var s8 = '<table class="bcrd-tbl"><thead><tr><th>Role</th><th>Name</th><th>Date</th><th>Decision</th></tr></thead><tbody>' +
      ap.map(function (a) {
        var dec = a.decision || "Pending";
        return "<tr><td>" + esc(a.role) + "</td><td>" + (a.name ? esc(a.name) : "—") + "</td><td>" + (a.date ? esc(a.date) : "—") +
          '</td><td><span class="bcrd-dec ' + decClass(dec) + '">' + esc(dec) + "</span></td></tr>";
      }).join("") + "</tbody></table>";

    // 9 · Disposition / Log Entry
    var impl = b.implemented ? ("Yes" + (b.implementedDate ? " (" + esc(b.implementedDate) + ")" : "")) : "No";
    var s9 = '<div class="bcrd-grid">' +
      field("CCB Disposition", b.disposition) +
      field("Effective Period (accounting month)", b.effectiveMonth) +
      field("CBB / Change Control Log Entry No.", b.logEntry) +
      field("Implemented in tool", impl) + "</div>";

    return section(1, "Identification", s1) +
      section(2, "Change Classification", s2) +
      section(3, "Description & Justification", s3) +
      section(4, "Affected Work", s4) +
      section(5, "Budget Movement", s5) +
      section(6, "Baseline Impact (Before → After)", s6) +
      section(7, "Schedule Impact", s7) +
      section(8, "Approvals", s8) +
      section(9, "Disposition / Log Entry", s9);
  }

  function loadData() {
    if (!_dataPromise) {
      _dataPromise = fetch(sap.ui.require.toUrl("dassian/tpm/ui5/model/bcr.json")).then(function (r) { return r.json(); });
    }
    return _dataPromise;
  }

  function ensureDialog(view) {
    if (_dialog) { return _dialog; }
    _html = new HTML();
    var sc = new ScrollContainer({ height: "100%", width: "100%", horizontal: false, vertical: true, content: [_html] });
    _dialog = new Dialog({
      title: "Baseline Change Request",
      contentWidth: "1040px", contentHeight: "84%", resizable: true, draggable: true,
      content: [sc],
      endButton: new Button({ text: "Close", press: function () { _dialog.close(); } })
    });
    view.addDependent(_dialog);
    return _dialog;
  }

  return {
    // Store a full (session-created) record so it opens with all its detail.
    register: function (rec) { if (rec && rec.id) { _overrides[rec.id] = rec; } },

    open: function (view, id) {
      if (_overrides[id]) {
        var o = _overrides[id], dlg0 = ensureDialog(view);
        dlg0.setTitle(o.id + (o.title ? " — " + o.title : ""));
        _html.setContent('<div class="bcrd-wrap">' + buildHtml(o) + "</div>");
        dlg0.open();
        return;
      }
      loadData().then(function (rows) {
        var b = (rows || []).filter(function (x) { return x.id === id; })[0];
        if (!b) { return; }
        var dlg = ensureDialog(view);
        dlg.setTitle(b.id + (b.title ? " — " + b.title : ""));
        _html.setContent('<div class="bcrd-wrap">' + buildHtml(b) + "</div>");
        dlg.open();
      });
    }
  };
});
