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
    extract: ["CPR-STD", "IPMDAR-STD", "INTERNAL"],
    cams: ["Jason Bartello", "Allen Ytzen", "EHAYES", "Richard Reed", "Tim LaRue", "L. Ortiz"],
    analysts: ["Jason Bartello", "P. Nguyen", "M. Cole"],
    ev: ["0/100", "25/75", "50/50", "% Complete", "Milestone (Weighted)", "Level of Effort (LOE)", "Apportioned Effort", "Earned Standards (EST)", "Units Complete"],
    eoc: ["Labor", "Material", "ODC", "Subcontract", "Travel", "Other"],
    caType: ["Control Account", "Summary Level Planning Package"],
    wpType: ["Work Package", "Planning Package"],
    rec: ["Recurring", "Non-Recurring"]
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

  return Controller.extend("dassian.tpm.ui5.controller.ProjectSetup", {
    onInit: function () {
      this.getView().setModel(new JSONModel({
        opts: OPTS,
        header: { reporting: "Control Accounts", pm: "L. Ortiz", pmbVer: OPTS.pmbVer[0], eacVer: OPTS.eacVer[0], extract: OPTS.extract[0], obs: "Program" },
        thresh: defaultThresh()
      }), "set");
      this.getView().setModel(new JSONModel({ mode: "ca", sel: null, selNode: null, tree: [], opts: OPTS, d: {} }), "ps");
      this._map = {};
      this._threshHtml = threshTable(this.getView().getModel("set").getProperty("/thresh"));
      var that = this;
      var t = this.byId("threshHtml");
      if (t) { t.addEventDelegate({ onAfterRendering: function () { if (t.getContent() !== that._threshHtml) { t.setContent(that._threshHtml); } } }); }
      this._load();
    },
    _prog: function () { return this.getOwnerComponent().getModel("ui").getProperty("/program"); },
    onProgramChange: function () { this._load(); },

    // ---------- WBS tree build ----------
    _load: function () {
      var prog = this._prog(), model = this.getOwnerComponent().getModel(), that = this;
      model.bindList("/ControlAccounts").requestContexts(0, 500).then(function (ctxs) {
        var cas = [];
        ctxs.forEach(function (c) {
          var o = c.getObject();
          if (o.ProgramID !== prog) { return; }
          cas.push({ id: o.ID, desc: o.Description, cam: o.Manager });
        });
        var roots = that._buildTree(cas);
        var ps = that.getView().getModel("ps");
        ps.setProperty("/tree", roots);
        var first = cas.length ? cas[0].id : (roots[0] && roots[0].id);
        ps.setProperty("/sel", first);
        ps.setProperty("/selNode", that._map[first] || null);
        that._refreshDetail();
        var tree = that.byId("wbsTree");
        if (tree) { setTimeout(function () { tree.expandToLevel(4); }, 0); }
      });
    },

    _newNode: function (id) {
      return {
        id: id, desc: "", title: id, level: id.split(".").length, children: [],
        ca: { flag: false, slpp: false, cam: "", analyst: "", target: "", sow: "", notes: "" },
        wp: { flag: false, pp: false, mfg: false, ev: "", mgr: "", eoc: "", rec: "Recurring", imsS: "", imsF: "", sow: "", assign: "", notes: "" },
        mrub: { mr: false, ub: false, burden: false, mgr: "", vendor: "" },
        badges: []
      };
    },
    _buildTree: function (cas) {
      var map = {}, that = this;
      function ensure(id) {
        if (map[id]) { return map[id]; }
        var n = that._newNode(id);
        map[id] = n;
        var parts = id.split(".");
        if (parts.length > 1) { ensure(parts.slice(0, -1).join(".")).children.push(n); }
        return n;
      }
      cas.forEach(function (ca) {
        var n = ensure(ca.id);
        n.desc = ca.desc; n.title = ca.id + " · " + ca.desc;
        n.ca.flag = true; n.ca.cam = ca.cam;           // real control accounts are pre-classified
        for (var i = 1; i <= 2; i++) {                 // synthesize work-package leaves below each CA
          var w = ensure(ca.id + "." + i);
          w.desc = "Work Package " + i; w.title = w.id + " · Work Package " + i;
        }
      });
      Object.keys(map).forEach(function (id) {
        var n = map[id];
        if (!n.desc) { n.title = id + " · (summary element)"; }
        that._badges(n);
      });
      this._map = map;
      var roots = [];
      Object.keys(map).forEach(function (id) {
        var parts = id.split("."), pid = parts.slice(0, -1).join(".");
        if (parts.length === 1 || !map[pid]) { roots.push(map[id]); }
      });
      return roots;
    },

    _badges: function (n) {
      var b = [];
      if (n.ca.flag) { b.push({ text: n.ca.slpp ? "SLPP" : "CA", state: "Information" }); }
      if (n.wp.flag) { b.push({ text: n.wp.pp ? "PP" : "WP", state: "Success" }); if (n.wp.mfg) { b.push({ text: "MFG", state: "Information" }); } }
      if (n.mrub.mr) { b.push({ text: "MR", state: "Warning" }); }
      if (n.mrub.ub) { b.push({ text: "UB", state: "Warning" }); }
      n.badges = b;
    },

    // ---------- EIA-748 structural validation ----------
    _ancestors: function (id) { var p = id.split("."), out = []; for (var i = p.length - 1; i > 0; i--) { out.push(p.slice(0, i).join(".")); } return out; },
    _descendants: function (id) { var pre = id + "."; return Object.keys(this._map).filter(function (k) { return k.indexOf(pre) === 0; }); },
    _isCA: function (id) { var n = this._map[id]; return !!(n && n.ca.flag); },
    _isWP: function (id) { var n = this._map[id]; return !!(n && n.wp.flag); },
    _isMRUB: function (id) { var n = this._map[id]; return !!(n && (n.mrub.mr || n.mrub.ub)); },
    _findAnc: function (id, pred) { return this._ancestors(id).find(pred); },
    _findDesc: function (id, pred) { return this._descendants(id).find(pred); },
    _caAbove: function (id) { var that = this; return this._ancestors(id).some(function (a) { return that._isCA(a); }); },
    _canBeCA: function (id) {
      var that = this, n;
      if (this._isWP(id)) { return "it is already a work package"; }
      if (this._isMRUB(id)) { return "it is an MR/UB object"; }
      if ((n = this._findAnc(id, function (a) { return that._isCA(a); }))) { return "a control account already exists above it (" + n + ")"; }
      if ((n = this._findDesc(id, function (a) { return that._isCA(a); }))) { return "a control account already exists below it (" + n + ")"; }
      if ((n = this._findAnc(id, function (a) { return that._isWP(a); }))) { return "a work package exists above it (" + n + ")"; }
      return "";
    },
    _canBeWP: function (id) {
      var that = this, n;
      if (this._isCA(id)) { return "it is already a control account"; }
      if (this._isMRUB(id)) { return "it is an MR/UB object"; }
      if (!this._caAbove(id)) { return "a work package must sit below a control account"; }
      if ((n = this._findAnc(id, function (a) { return that._isWP(a); }))) { return "a work package exists above it (" + n + ")"; }
      if ((n = this._findDesc(id, function (a) { return that._isWP(a); }))) { return "a work package already exists below it (" + n + ")"; }
      return "";
    },
    _canBeMRUB: function (id) {
      var that = this, n;
      if (this._isCA(id)) { return "it is a control account"; }
      if (this._isWP(id)) { return "it is a work package"; }
      if ((n = this._findAnc(id, function (a) { return that._isCA(a); }))) { return "a control account exists above it (" + n + ")"; }
      if ((n = this._findDesc(id, function (a) { return that._isCA(a); }))) { return "a control account exists below it (" + n + ")"; }
      return "";
    },

    // ---------- selection + detail ----------
    _node: function () { return this.getView().getModel("ps").getProperty("/selNode"); },
    onNodeSelect: function (evt) {
      var item = evt.getParameter("listItem") || evt.getSource().getSelectedItem();
      if (!item) { return; }
      var node = item.getBindingContext("ps").getObject();
      var ps = this.getView().getModel("ps");
      ps.setProperty("/sel", node.id);
      ps.setProperty("/selNode", node);
      this._refreshDetail();
    },
    onModeChange: function () { this._refreshDetail(); },

    _refreshDetail: function () {
      var ps = this.getView().getModel("ps"), node = ps.getProperty("/selNode");
      if (!node) { ps.setProperty("/d", { hasSel: false }); return; }
      var id = node.id;
      ps.setProperty("/d", {
        hasSel: true,
        caFlag: node.ca.flag, caBlock: node.ca.flag ? "" : this._canBeCA(id),
        wpFlag: node.wp.flag, wpBlock: node.wp.flag ? "" : this._canBeWP(id),
        mrFlag: node.mrub.mr, ubFlag: node.mrub.ub,
        mrubFlag: node.mrub.mr || node.mrub.ub,
        mrubBlock: (node.mrub.mr || node.mrub.ub) ? "" : this._canBeMRUB(id)
      });
    },
    _afterChange: function (node) {
      this._badges(node);
      this.getView().getModel("ps").refresh(true);
      this._refreshDetail();
    },

    // ---------- classification toggles (validated) ----------
    onToggleCA: function (evt) {
      var node = this._node(), src = evt.getSource(); if (!node) { return; }
      if (evt.getParameter("selected")) {
        var r = this._canBeCA(node.id);
        if (r) { node.ca.flag = false; src.setSelected(false); MessageToast.show("Cannot set Control Account — " + r); this._refreshDetail(); return; }
        node.ca.flag = true;
      } else {
        var off = this._findDesc(node.id, this._isWP.bind(this));
        if (off) { node.ca.flag = true; src.setSelected(true); MessageToast.show("Cannot unmark Control Account — clear the work packages below it first (" + off + ")"); return; }
        node.ca.flag = false;
      }
      this._afterChange(node);
    },
    onToggleWP: function (evt) {
      var node = this._node(), src = evt.getSource(); if (!node) { return; }
      if (evt.getParameter("selected")) {
        var r = this._canBeWP(node.id);
        if (r) { node.wp.flag = false; src.setSelected(false); MessageToast.show("Cannot set Work Package — " + r); this._refreshDetail(); return; }
        node.wp.flag = true;
      } else { node.wp.flag = false; }
      this._afterChange(node);
    },
    onToggleMR: function (evt) {
      var node = this._node(), src = evt.getSource(); if (!node) { return; }
      if (evt.getParameter("selected")) {
        var r = this._canBeMRUB(node.id);
        if (r) { node.mrub.mr = false; src.setSelected(false); MessageToast.show("Cannot set Management Reserve — " + r); this._refreshDetail(); return; }
        node.mrub.mr = true;
      } else { node.mrub.mr = false; }
      this._afterChange(node);
    },
    onToggleUB: function (evt) {
      var node = this._node(), src = evt.getSource(); if (!node) { return; }
      if (evt.getParameter("selected")) {
        var r = this._canBeMRUB(node.id);
        if (r) { node.mrub.ub = false; src.setSelected(false); MessageToast.show("Cannot set Undistributed Budget — " + r); this._refreshDetail(); return; }
        node.mrub.ub = true;
      } else { node.mrub.ub = false; }
      this._afterChange(node);
    },
    // type / sub-flag changes just refresh badges (no structural impact)
    onTypeChange: function () { var n = this._node(); if (n) { this._afterChange(n); } },

    onCopyThresholds: function () {
      MessageToast.show("Copy thresholds from another maintained project (prototype — connect to project list)");
    },

    onNavBack: function () { HashChanger.getInstance().setHash(""); }
  });
});
