sap.ui.define([
  "sap/m/Dialog", "sap/m/Button", "sap/m/ScrollContainer", "sap/ui/core/HTML",
  "sap/m/MessageToast", "sap/ui/core/Component", "dassian/tpm/ui5/ext/BcrDetail"
], function (Dialog, Button, ScrollContainer, HTML, MessageToast, Component, BcrDetail) {
  "use strict";

  // Editable "Create New Change Request" form, matching the prototype's 9-section
  // BCR form. On Save it creates the summary row in the OData service (so it shows
  // in the list) and registers the full detail with BcrDetail (so reopening the
  // new row shows everything that was entered).

  var _dialog = null, _html = null, _host = null, _bound = false, _seq = null;

  var TYPES = [
    ["BCR-P", "Internal replanning within the PMB (no CBB change)"],
    ["BCR-M", "Allocation of Management Reserve to control accounts"],
    ["BCR-C", "CBB / authorized scope change (Contracting Officer action)"],
    ["FCR", "Forecast / EAC change only (no budget movement)"]
  ];
  var PRIORITIES = ["Routine", "Urgent", "Emergency"];
  var STATUSES = ["Draft", "Submitted", "In Review", "Approved", "Rejected"];
  var DISPOS = ["Draft", "In Review", "Pending CCB", "Approved", "Approved w/ conditions", "Rejected", "Deferred"];
  var DECISIONS = ["Pending", "Approved", "Rejected", "N/A"];
  var EOC = ["Labor", "Material", "ODC", "Subcontract", "Mixed"];
  var BASELINE = [
    ["cbb", "Contract Budget Base (CBB)"],
    ["pmb", "Performance Measurement Baseline (PMB)"],
    ["mr", "Management Reserve (MR)"],
    ["ub", "Undistributed Budget (UB) — within PMB"],
    ["eac", "Estimate at Completion (EAC)"]
  ];
  var APPR_ROLES = ["Control Account Manager", "Program / Project Manager", "Business / Control (EVM Analyst)", "Change Control Board (CCB) Chair", "Customer / Contracting Officer"];

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
  function num(n) { var v = parseFloat(String(n == null ? "" : n).replace(/[, ]/g, "")); return isNaN(v) ? 0 : v; }
  function money(n) { return num(n).toLocaleString("en-US", { maximumFractionDigits: 0 }); }
  function opt(list, sel) {
    return list.map(function (o) { var v = Array.isArray(o) ? o[0] : o; return "<option" + (v === sel ? " selected" : "") + ">" + esc(v) + "</option>"; }).join("");
  }
  function prog() {
    try { return _host.getModel("ui").getProperty("/program") || "DEMO"; } catch (e) { return "DEMO"; }
  }

  // FE custom-action handlers don't hand us a usable control, so resolve a host
  // (for the OData/ui models and to parent the dialog) from the app component.
  function resolveHost(host) {
    if (host && typeof host.getModel === "function" && host.getModel()) { return host; }
    var comp = null;
    try {
      Component.registry.forEach(function (c) {
        var n = c.getMetadata().getName();
        if (n && n.indexOf("dassian.tpm.ui5") === 0) { comp = c; }
      });
    } catch (e) { /* registry unavailable */ }
    return (comp && comp.getRootControl()) || host;
  }

  // --- row builders (table bodies) ---
  function workRow() {
    return "<tr>" + ["wbs", "ca", "wp", "cam", "obs"].map(function (f) {
      return '<td><input data-f="' + f + '"></td>';
    }).join("") + "</tr>";
  }
  function moveRow() {
    return '<tr><td><input data-f="from"></td><td><input data-f="to"></td>' +
      '<td><select data-f="eoc">' + opt(EOC, "Labor") + "</select></td>" +
      '<td><input data-f="hours" class="be-num"></td><td><input data-f="dollars" class="be-num"></td></tr>';
  }
  function schedRow() {
    return '<tr><td><input data-f="milestone"></td><td><input data-f="before"></td>' +
      '<td><input data-f="after"></td><td><input data-f="variance"></td></tr>';
  }
  function apprRow(role) {
    return '<tr><td><input data-f="role" value="' + esc(role || "") + '"></td>' +
      '<td><input data-f="name"></td><td><input data-f="date"></td>' +
      '<td><select data-f="decision">' + opt(DECISIONS, "Pending") + "</select></td></tr>";
  }

  function fld(label, id, val, wide) {
    return '<div class="be-fld' + (wide ? " be-wide" : "") + '"><label>' + esc(label) + '</label>' +
      '<input id="' + id + '" value="' + esc(val == null ? "" : val) + '"></div>';
  }
  function sel(label, id, list, val) {
    return '<div class="be-fld"><label>' + esc(label) + '</label><select id="' + id + '">' + opt(list, val) + "</select></div>";
  }
  function txt(label, id) {
    return '<div class="be-fld be-wide"><label>' + esc(label) + '</label><textarea id="' + id + '"></textarea></div>';
  }
  function chk(id, label) {
    return '<label class="be-chk"><input type="checkbox" id="' + id + '"> ' + esc(label) + "</label>";
  }

  function formHtml(id) {
    var baseRows = BASELINE.map(function (row) {
      return "<tr><td>" + esc(row[1]) + "</td>" +
        '<td><input class="be-num be-base" data-k="' + row[0] + '" data-c="before" value="0"></td>' +
        '<td><input class="be-num be-base" data-k="' + row[0] + '" data-c="change" value="0"></td>' +
        '<td class="be-after" data-k="' + row[0] + '">0</td></tr>';
    }).join("");

    return '<div class="be-form" id="bcrEditForm">' +

      '<div class="bcrd-sec"><h3>1 · Identification</h3><div class="bcrd-in"><div class="be-grid">' +
        fld("BCR Number", "be_id", id) + fld("Revision", "be_rev", "0") +
        fld("Program / Project", "be_prog", prog()) + fld("Contract / Task Order No.", "be_contract", "") +
        fld("Date Submitted", "be_date", "") + fld("Originator (name / role)", "be_orig", "") +
        sel("Priority", "be_priority", PRIORITIES, "Routine") + sel("Status", "be_status", STATUSES, "Draft") +
        '<div class="be-fld be-wide"><label>Customer-directed?</label><div class="be-checks">' +
          chk("be_custDir", "Customer-directed change") +
          '<input id="be_custRef" placeholder="ECP / CCN / Mod reference" style="max-width:280px"></div></div>' +
      "</div></div></div>" +

      '<div class="bcrd-sec"><h3>2 · Change Classification</h3><div class="bcrd-in"><div class="be-grid">' +
        '<div class="be-fld"><label>Change Type</label><select id="be_type">' +
          TYPES.map(function (t) { return "<option value=\"" + t[0] + "\">" + t[0] + " — " + esc(t[1]) + "</option>"; }).join("") +
        "</select></div>" +
        '<div class="be-fld"><label>Affects</label><div class="be-checks">' +
          chk("be_aff_scope", "Scope") + chk("be_aff_budget", "Budget") + chk("be_aff_sched", "Schedule") + "</div></div>" +
        '<div class="be-fld be-wide"><label>Retroactive (prior period)?</label><div class="be-checks">' +
          chk("be_retro", "Retroactive change") +
          '<input id="be_retroJust" placeholder="Justification if retroactive" style="flex:1;min-width:240px"></div></div>' +
        fld("SOW reference / change driver", "be_driver", "", true) +
      "</div></div></div>" +

      '<div class="bcrd-sec"><h3>3 · Description &amp; Justification</h3><div class="bcrd-in"><div class="be-stack">' +
        txt("Description of change", "be_desc") +
        txt("Reason / justification (why now, root cause)", "be_just") +
        txt("Impact if not approved", "be_impact") +
      "</div></div></div>" +

      '<div class="bcrd-sec"><h3>4 · Affected Work</h3><div class="bcrd-in">' +
        '<table class="be-tbl"><thead><tr><th>WBS</th><th>Control Account</th><th>Work Package(s)</th><th>CAM</th><th>OBS / IPT</th></tr></thead>' +
        '<tbody data-body="work">' + workRow() + "</tbody></table>" +
        '<div class="be-addrow"><button type="button" data-add="work">＋ Add row</button></div>' +
      "</div></div>" +

      '<div class="bcrd-sec"><h3>5 · Budget Movement</h3><div class="bcrd-in">' +
        '<table class="be-tbl"><thead><tr><th>From (source)</th><th>To (destination)</th><th>Element of Cost</th><th class="bcrd-num">Hours</th><th class="bcrd-num">Dollars</th></tr></thead>' +
        '<tbody data-body="move">' + moveRow() + "</tbody></table>" +
        '<div class="be-addrow"><button type="button" data-add="move">＋ Add row</button></div>' +
      "</div></div>" +

      '<div class="bcrd-sec"><h3>6 · Baseline Impact (Before → After)</h3><div class="bcrd-in">' +
        '<table class="be-tbl"><thead><tr><th>Element</th><th class="bcrd-num">Before</th><th class="bcrd-num">Change (+/−)</th><th class="bcrd-num">After</th></tr></thead>' +
        "<tbody>" + baseRows + "</tbody></table>" +
        '<div class="bcrd-balance" id="be_balance">—</div>' +
      "</div></div>" +

      '<div class="bcrd-sec"><h3>7 · Schedule Impact</h3><div class="bcrd-in">' +
        '<table class="be-tbl"><thead><tr><th>Milestone / Activity</th><th>Baseline Date (Before)</th><th>Revised Date (After)</th><th>Variance</th></tr></thead>' +
        '<tbody data-body="sched">' + schedRow() + "</tbody></table>" +
        '<div class="be-addrow"><button type="button" data-add="sched">＋ Add row</button></div>' +
      "</div></div>" +

      '<div class="bcrd-sec"><h3>8 · Approvals</h3><div class="bcrd-in">' +
        '<table class="be-tbl"><thead><tr><th>Role</th><th>Name</th><th>Date</th><th>Decision</th></tr></thead>' +
        '<tbody data-body="appr">' + APPR_ROLES.map(apprRow).join("") + "</tbody></table>" +
      "</div></div>" +

      '<div class="bcrd-sec"><h3>9 · Disposition / Log Entry</h3><div class="bcrd-in"><div class="be-grid">' +
        sel("CCB Disposition", "be_disp", DISPOS, "Draft") +
        fld("Effective Period (accounting month)", "be_effMonth", "") +
        fld("CBB / Change Control Log Entry No.", "be_log", "") +
        '<div class="be-fld"><label>Implemented in tool</label><div class="be-checks">' +
          chk("be_impl", "Implemented") + '<input id="be_implDate" placeholder="Date" style="max-width:140px"></div></div>' +
      "</div></div></div>" +

      "</div>";
  }

  // Recompute After column + the CBB = PMB + MR balance check (live).
  function recalc() {
    var form = document.getElementById("bcrEditForm");
    if (!form) { return; }
    var after = {};
    BASELINE.forEach(function (row) {
      var k = row[0];
      var bef = form.querySelector('.be-base[data-k="' + k + '"][data-c="before"]');
      var chg = form.querySelector('.be-base[data-k="' + k + '"][data-c="change"]');
      var a = num(bef && bef.value) + num(chg && chg.value);
      after[k] = a;
      var cell = form.querySelector('.be-after[data-k="' + k + '"]');
      if (cell) { cell.textContent = money(a); }
    });
    var el = document.getElementById("be_balance");
    if (!el) { return; }
    var lhs = after.cbb, rhs = after.pmb + after.mr, ok = Math.abs(lhs - rhs) < 0.5;
    el.className = "bcrd-balance " + (ok ? "ok" : "bad");
    el.textContent = ok
      ? "✓ Balanced: CBB " + money(after.cbb) + " = PMB " + money(after.pmb) + " + MR " + money(after.mr)
      : "✗ Out of balance: CBB " + money(after.cbb) + " ≠ PMB " + money(after.pmb) + " + MR " + money(after.mr) + " (= " + money(rhs) + ")";
  }

  // One delegated listener pair handles recalc + add-row across re-renders.
  function bindOnce() {
    if (_bound) { return; }
    _bound = true;
    document.addEventListener("input", function (e) {
      if (e.target && e.target.classList && e.target.classList.contains("be-base")) { recalc(); }
    });
    document.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest("[data-add]") : null;
      if (!btn) { return; }
      var form = document.getElementById("bcrEditForm");
      if (!form || !form.contains(btn)) { return; }
      var kind = btn.getAttribute("data-add");
      var body = form.querySelector('tbody[data-body="' + kind + '"]');
      if (!body) { return; }
      var html = kind === "work" ? workRow() : kind === "move" ? moveRow() : schedRow();
      body.insertAdjacentHTML("beforeend", html);
    });
  }

  function rowsFrom(kind, fields) {
    var form = document.getElementById("bcrEditForm");
    var body = form && form.querySelector('tbody[data-body="' + kind + '"]');
    if (!body) { return []; }
    return Array.prototype.map.call(body.querySelectorAll("tr"), function (tr) {
      var o = {};
      fields.forEach(function (f) {
        var el = tr.querySelector('[data-f="' + f + '"]');
        o[f] = el ? el.value : "";
      });
      return o;
    }).filter(function (o) { return Object.keys(o).some(function (k) { return String(o[k]).trim() !== ""; }); });
  }

  function val(id) { var el = document.getElementById(id); return el ? el.value : ""; }
  function checked(id) { var el = document.getElementById(id); return !!(el && el.checked); }

  function collect(id) {
    var baseline = {};
    var form = document.getElementById("bcrEditForm");
    BASELINE.forEach(function (row) {
      var k = row[0];
      var bef = form.querySelector('.be-base[data-k="' + k + '"][data-c="before"]');
      var chg = form.querySelector('.be-base[data-k="' + k + '"][data-c="change"]');
      baseline[k] = { before: num(bef && bef.value), change: num(chg && chg.value) };
    });
    var moves = rowsFrom("move", ["from", "to", "eoc", "hours", "dollars"]).map(function (m) {
      m.hours = num(m.hours); m.dollars = num(m.dollars); return m;
    });
    return {
      id: id, rev: val("be_rev"), prog: val("be_prog") || prog(), title: val("be_desc") ? val("be_desc").slice(0, 120) : val("be_driver"),
      contract: val("be_contract"), dateSubmitted: val("be_date"), originator: val("be_orig"),
      priority: val("be_priority"), customerDirected: checked("be_custDir"), customerRef: val("be_custRef"),
      type: val("be_type"),
      affects: { scope: checked("be_aff_scope"), budget: checked("be_aff_budget"), schedule: checked("be_aff_sched") },
      retro: checked("be_retro"), retroJust: val("be_retroJust"), driver: val("be_driver"),
      description: val("be_desc"), justification: val("be_just"), impactIfNot: val("be_impact"),
      affectedWork: rowsFrom("work", ["wbs", "ca", "wp", "cam", "obs"]),
      budgetMoves: moves,
      baseline: baseline,
      schedule: rowsFrom("sched", ["milestone", "before", "after", "variance"]),
      approvals: rowsFrom("appr", ["role", "name", "date", "decision"]),
      disposition: val("be_disp"), effectiveMonth: val("be_effMonth"), logEntry: val("be_log"),
      implemented: checked("be_impl"), implementedDate: val("be_implDate"),
      status: val("be_status")
    };
  }

  function nextId() {
    if (_seq == null) { _seq = 13; }   // seeded above the shipped BCR-2026-0xx records
    _seq += 1;
    return "BCR-2026-" + String(_seq).padStart(3, "0");
  }

  function save(id) {
    var rec = collect(id);
    if (!rec.title) { rec.title = "Untitled change request"; }
    var model = _host.getModel();
    var lb = model.bindList("/BaselineChanges");   // kept referenced until created() settles
    var ctx = lb.create({
      ID: rec.id, ProgramID: rec.prog, Title: rec.title, Type: rec.type, Status: rec.status,
      DateSubmitted: rec.dateSubmitted, Originator: rec.originator, Priority: rec.priority,
      CustomerDirected: !!rec.customerDirected
    });
    ctx.created().then(function () {
      BcrDetail.register(rec);
      model.refresh();
      MessageToast.show("Change request " + rec.id + " created.");
      _dialog.close();
    }).catch(function (e) {
      _seq -= 1;   // allow the id to be reused on the next attempt
      MessageToast.show("Could not create the request: " + (e && e.message ? e.message : e));
    });
  }

  function ensureDialog(host) {
    if (_dialog) { return _dialog; }
    _html = new HTML();
    var sc = new ScrollContainer({ height: "100%", width: "100%", horizontal: false, vertical: true, content: [_html] });
    _dialog = new Dialog({
      title: "New Baseline Change Request",
      contentWidth: "1040px", contentHeight: "84%", resizable: true, draggable: true,
      content: [sc],
      beginButton: new Button({
        text: "Save", type: "Emphasized",
        press: function () { save(_dialog.data("bcrId")); }
      }),
      endButton: new Button({ text: "Cancel", press: function () { _dialog.close(); } })
    });
    if (host && typeof host.addDependent === "function") { host.addDependent(_dialog); }
    return _dialog;
  }

  return {
    open: function (host) {
      _host = resolveHost(host);
      bindOnce();
      var id = nextId();
      var dlg = ensureDialog(_host);
      dlg.data("bcrId", id);
      dlg.setTitle("New Baseline Change Request · " + id);
      _html.setContent(formHtml(id));
      dlg.open();
      setTimeout(recalc, 0);
    }
  };
});
