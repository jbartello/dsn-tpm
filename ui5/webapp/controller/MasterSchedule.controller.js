sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/HashChanger",
  "sap/ui/model/json/JSONModel"
], function (Controller, HashChanger, JSONModel) {
  "use strict";

  return Controller.extend("dassian.tpm.ui5.controller.MasterSchedule", {
    onInit: function () {
      this.getView().setModel(new JSONModel({
        iters: "5000", optPct: 10, pesPct: 30, loeFix: true, hasResult: false, curve: []
      }), "mc");
      this.getView().setModel(new JSONModel({ baselineFinish: "—", count: 0, loeCount: 0 }), "sched");

      var model = this.getOwnerComponent().getModel();
      model.bindList("/ScheduleActivities").requestContexts(0, 500).then(function (ctxs) {
        var acts = ctxs.map(function (c) {
          var o = c.getObject();
          return { off: o.StartOffset || 0, dur: o.DurationDays || 1, loe: !!o.IsLOE, finish: o.Finish };
        });
        this._acts = acts;
        // deterministic project finish = latest-finishing activity
        this._baseOff = acts.reduce(function (m, a) { return Math.max(m, a.off + a.dur - 1); }, 0);
        this._baseDate = acts.reduce(function (best, a) {
          return this._dnum(a.finish) > this._dnum(best) ? a.finish : best;
        }.bind(this), "01/01/1900");
        this.getView().getModel("sched").setData({
          baselineFinish: this._baseDate, count: acts.length, loeCount: acts.filter(function (a) { return a.loe; }).length
        });
      }.bind(this));
    },

    // ---- date helpers (Mon–Fri calendar, matching the prototype) ----
    _dnum: function (s) { var p = String(s).split("/"); return p.length < 3 ? 0 : (+p[2]) * 10000 + (+p[0]) * 100 + (+p[1]); },
    _fmt: function (d) { return String(d.getMonth() + 1).padStart(2, "0") + "/" + String(d.getDate()).padStart(2, "0") + "/" + d.getFullYear(); },
    _addWorkdays: function (dateStr, n) {
      var p = String(dateStr).split("/"), d = new Date(+p[2], +p[0] - 1, +p[1]), c = 0;
      while (c < n) { d.setDate(d.getDate() + 1); var w = d.getDay(); if (w !== 0 && w !== 6) { c++; } }
      return this._fmt(d);
    },

    // triangular sampler
    _tri: function (o, m, p) {
      if (p <= o) { return m; }
      var u = Math.random(), fc = (m - o) / (p - o);
      return u < fc ? o + Math.sqrt(u * (p - o) * (m - o)) : p - Math.sqrt((1 - u) * (p - o) * (p - m));
    },

    onRun: function () {
      var m = this.getView().getModel("mc"), d = m.getData();
      var acts = this._acts || [];
      if (!acts.length) { return; }
      var N = Math.max(500, parseInt(d.iters, 10) || 5000);
      var opt = Math.max(0, +d.optPct) / 100, pes = Math.max(0, +d.pesPct) / 100, loeFix = !!d.loeFix;
      var base = this._baseOff;
      var fins = new Float64Array(N);
      for (var k = 0; k < N; k++) {
        var mx = -1e9;
        for (var i = 0; i < acts.length; i++) {
          var a = acts[i];
          var dur = (loeFix && a.loe) ? a.dur : Math.max(1, this._tri(a.dur * (1 - opt), a.dur, a.dur * (1 + pes)));
          var f = a.off + dur - 1;
          if (f > mx) { mx = f; }
        }
        fins[k] = mx;
      }
      fins.sort();
      var pf = function (q) { return fins[Math.min(N - 1, Math.floor(q * N))]; };
      var slip = function (off) { return Math.round(off - base); };
      var dateAt = function (off) { return this._addWorkdays(this._baseDate, Math.max(0, Math.round(off - base))); }.bind(this);
      var onTime = fins.reduce(function (acc, v) { return acc + (v <= base ? 1 : 0); }, 0) / N * 100;
      var curve = [];
      for (var j = 0; j <= 50; j++) { var q = j / 50, off = pf(q); curve.push({ slip: slip(off), prob: Math.round(q * 100) }); }
      var slipTxt = function (off) { var w = slip(off); return (w > 0 ? "+" : "") + w + " wd"; };

      m.setData(Object.assign({}, d, {
        hasResult: true,
        baseDate: this._baseDate,
        p50: dateAt(pf(0.50)), p50slip: slipTxt(pf(0.50)),
        p80: dateAt(pf(0.80)), p80slip: slipTxt(pf(0.80)),
        p90: dateAt(pf(0.90)), p90slip: slipTxt(pf(0.90)),
        pOnTime: onTime.toFixed(1) + "%",
        curve: curve,
        note: N.toLocaleString() + " iterations · triangular durations (−" + d.optPct + "% / +" + d.pesPct + "%)" +
          (loeFix ? " · level-of-effort activities held fixed" : "") +
          ". Illustrative — the Demo schedule has no network logic, so the finish is the latest-finishing activity (merge bias)."
      }));
    },

    onNavBack: function () { HashChanger.getInstance().setHash(""); }
  });
});
