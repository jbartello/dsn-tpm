sap.ui.define([], function () {
  "use strict";

  // Shared, session-scoped WBS structure per program. Project Setup maintains it
  // (classification + attributes) and the Artifacts WBS Dictionary reads from it,
  // so edits in Setup flow straight into the dictionary.
  var cache = {};

  function newNode(id) {
    return {
      id: id, desc: "", title: id, level: id.split(".").length, children: [], bac: 0,
      ca: { flag: false, slpp: false, cam: "", analyst: "", target: "", sow: "", auth: "", notes: "" },
      wp: { flag: false, pp: false, mfg: false, ev: "", mgr: "", eoc: "", rec: "Recurring", imsS: "", imsF: "", sow: "", auth: "", assign: "", notes: "" },
      mrub: { mr: false, ub: false, burden: false, mgr: "", vendor: "" },
      badges: []
    };
  }

  function badges(n) {
    var b = [];
    if (n.ca.flag) { b.push({ text: n.ca.slpp ? "SLPP" : "CA", state: "Information" }); }
    if (n.wp.flag) { b.push({ text: n.wp.pp ? "PP" : "WP", state: "Success" }); if (n.wp.mfg) { b.push({ text: "MFG", state: "Information" }); } }
    if (n.mrub.mr) { b.push({ text: "MR", state: "Warning" }); }
    if (n.mrub.ub) { b.push({ text: "UB", state: "Warning" }); }
    n.badges = b;
  }

  // Build the tree from control accounts; synthesize two work-package leaves per CA.
  function build(cas) {
    var map = {};
    function ensure(id) {
      if (map[id]) { return map[id]; }
      var n = newNode(id); map[id] = n;
      var parts = id.split(".");
      if (parts.length > 1) { ensure(parts.slice(0, -1).join(".")).children.push(n); }
      return n;
    }
    cas.forEach(function (ca) {
      var n = ensure(ca.id);
      n.desc = ca.desc; n.title = ca.id + " · " + ca.desc; n.bac = ca.bac || 0;
      n.ca.flag = true; n.ca.cam = ca.cam;                 // real control accounts, pre-classified
      n.ca.auth = "CA authorized under CWBS " + ca.id + " (" + ca.desc + ")";
      for (var i = 1; i <= 2; i++) {                        // work-package leaves below each CA
        var w = ensure(ca.id + "." + i);
        w.desc = "Work Package " + i; w.title = w.id + " · Work Package " + i;
        w.wp.flag = true;
        w.wp.ev = i === 1 ? "% Complete" : "0/100";
        w.wp.mgr = ca.cam;
        w.wp.rec = i === 1 ? "Recurring" : "Non-Recurring";
        w.wp.eoc = i === 1 ? "Labor" : "Material";
        w.wp.auth = "WAD-" + w.id + " — authorized by " + ca.cam;
      }
    });
    Object.keys(map).forEach(function (id) {
      var n = map[id];
      if (!n.desc) { n.title = id + " · (summary element)"; }
      badges(n);
    });
    var roots = [];
    Object.keys(map).forEach(function (id) {
      var parts = id.split("."), pid = parts.slice(0, -1).join(".");
      if (parts.length === 1 || !map[pid]) { roots.push(map[id]); }
    });
    return { roots: roots, map: map };
  }

  // Natural WBS-id comparator (numeric per segment where possible)
  function cmpWbs(a, b) {
    var pa = a.split("."), pb = b.split(".");
    for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
      var x = pa[i], y = pb[i];
      if (x === undefined) { return -1; }
      if (y === undefined) { return 1; }
      var nx = parseInt(x, 10), ny = parseInt(y, 10);
      if (!isNaN(nx) && !isNaN(ny) && String(nx) === x && String(ny) === y) { if (nx !== ny) { return nx - ny; } }
      else if (x !== y) { return x < y ? -1 : 1; }
    }
    return 0;
  }

  function money(v) {
    v = parseFloat(v) || 0;
    var a = Math.abs(v), s = v < 0 ? "-" : "";
    return a >= 1e6 ? s + "$" + (a / 1e6).toFixed(2) + "M" : a >= 1e3 ? s + "$" + (a / 1e3).toFixed(0) + "K" : s + "$" + a.toFixed(0);
  }

  // Generate the WBS Dictionary (cols + rows) from the classified nodes.
  function dictionary(tree) {
    var cols = ["Level", "WBS Element", "Description", "Classification", "CAM / Manager", "EV Method", "Rec / Non-Rec", "IMS Start", "IMS Finish", "BAC (USD)", "Authorization Information"];
    var ids = Object.keys(tree.map).filter(function (id) {
      var n = tree.map[id];
      return n.ca.flag || n.wp.flag || n.mrub.mr || n.mrub.ub;
    }).sort(cmpWbs);
    var rows = ids.map(function (id) {
      var n = tree.map[id], cls, mgr, ev, rec, s, f, bac, auth;
      if (n.ca.flag) {
        cls = n.ca.slpp ? "Control Account (SLPP)" : "Control Account";
        mgr = n.ca.cam || "—"; ev = "—"; rec = "—"; s = "—"; f = "—";
        bac = n.bac ? money(n.bac) : "—"; auth = n.ca.auth || "—";
      } else if (n.wp.flag) {
        cls = (n.wp.pp ? "Planning Package" : "Work Package") + (n.wp.mfg ? " · MFG" : "");
        mgr = n.wp.mgr || "—"; ev = n.wp.ev || "—"; rec = n.wp.rec || "—";
        s = n.wp.imsS || "—"; f = n.wp.imsF || "—"; bac = "—"; auth = n.wp.auth || "—";
      } else {
        cls = n.mrub.mr ? "Management Reserve" : "Undistributed Budget";
        mgr = n.mrub.mgr || "—"; ev = "—"; rec = "—"; s = "—"; f = "—"; bac = "—"; auth = "—";
      }
      return [String(n.level), id, n.desc || "(summary element)", cls, mgr, ev, rec, s, f, bac, auth];
    });
    return { cols: cols, rows: rows };
  }

  return {
    newNode: newNode,
    badges: badges,
    build: build,
    dictionary: dictionary,
    get: function (p) { return cache[p]; },
    ensure: function (p, cas) { return cache[p] || (cache[p] = build(cas)); },
    reset: function (p) { delete cache[p]; }
  };
});
