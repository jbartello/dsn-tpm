sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/HashChanger",
  "sap/ui/model/json/JSONModel"
], function (Controller, HashChanger, JSONModel) {
  "use strict";

  // ----- helpers ported from the prototype's analysis module -----
  var _clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  function niceMax(v) {
    if (v <= 0) { return 1; }
    var mag = Math.pow(10, Math.floor(Math.log10(v))), n = v / mag;
    var step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return step * mag;
  }
  function mfmt(v) {
    var a = Math.abs(v), sign = v < 0 ? "-" : "";
    return a >= 1e6 ? sign + "$" + (a / 1e6).toFixed(1) + "M"
      : a >= 1e3 ? sign + "$" + (a / 1e3).toFixed(0) + "K"
        : sign + "$" + a.toFixed(0);
  }

  // Month-end periods (simulated time-phasing, as in the prototype).
  var PERIODS = [
    { id: "2025-12", label: "Dec 2025" },
    { id: "2026-01", label: "Jan 2026" },
    { id: "2026-02", label: "Feb 2026" },
    { id: "2026-03", label: "Mar 2026" },
    { id: "2026-04", label: "Apr 2026" },
    { id: "2026-05", label: "May 2026" }
  ];

  // Generic multi-line chart.
  function lineSVG(cfg) {
    var w = 680, h = cfg.h || 250, mL = 60, mR = 18, mT = 16, mB = 36;
    var pw = w - mL - mR, ph = h - mT - mB, xN = cfg.xN;
    var yFmt = cfg.yFmt || function (v) { return v; };
    var all = cfg.series.reduce(function (acc, s) { return acc.concat(s.pts.map(function (p) { return p.y; })); }, [])
      .filter(function (v) { return v != null; })
      .concat((cfg.refLines || []).map(function (r) { return r.y; }));
    var yMin = cfg.yMin != null ? cfg.yMin : 0;
    var yMax = cfg.yMax != null ? cfg.yMax : niceMax(Math.max.apply(null, all.concat(1)));
    var xPx = function (i) { return mL + (xN <= 1 ? pw / 2 : (i / (xN - 1)) * pw); };
    var yPx = function (v) { return mT + ph - ((_clamp(v, yMin, yMax) - yMin) / ((yMax - yMin) || 1)) * ph; };
    var s = "";
    (cfg.bands || []).forEach(function (b) {
      var y1 = yPx(b.y2), y2 = yPx(b.y1);
      s += '<rect x="' + mL + '" y="' + y1 + '" width="' + pw + '" height="' + Math.max(0, y2 - y1) + '" fill="' + b.color + '"/>';
    });
    for (var g = 0; g <= 4; g++) {
      var v = yMin + (yMax - yMin) * g / 4, y = yPx(v);
      s += '<line x1="' + mL + '" y1="' + y + '" x2="' + (mL + pw) + '" y2="' + y + '" stroke="#eee"/><text x="' + (mL - 8) + '" y="' + (y + 3) + '" text-anchor="end">' + yFmt(v) + "</text>";
    }
    for (var i = 0; i < xN; i++) {
      s += '<text x="' + xPx(i) + '" y="' + (mT + ph + 18) + '" text-anchor="middle">' + (cfg.xLabels[i] || "") + "</text>";
    }
    if (cfg.statusX != null) {
      var sxp = xPx(cfg.statusX);
      s += '<line x1="' + sxp + '" y1="' + mT + '" x2="' + sxp + '" y2="' + (mT + ph) + '" stroke="#aaa" stroke-dasharray="3 3"/><text x="' + sxp + '" y="' + (mT - 4) + '" text-anchor="middle" fill="#999">Status</text>';
    }
    (cfg.refLines || []).forEach(function (r) {
      var ry = yPx(r.y);
      s += '<line x1="' + mL + '" y1="' + ry + '" x2="' + (mL + pw) + '" y2="' + ry + '" stroke="' + r.color + '" stroke-width="1.5" ' + (r.dash ? 'stroke-dasharray="' + r.dash + '"' : "") + "/>";
    });
    var hits = "";
    cfg.series.filter(function (se) { return !(cfg.hidden && cfg.hidden[se.name]); }).forEach(function (se) {
      var vis = se.pts.filter(function (p) { return p.y != null; });
      var poly = vis.map(function (p) { return xPx(p.x).toFixed(1) + "," + yPx(p.y).toFixed(1); }).join(" ");
      s += '<polyline points="' + poly + '" fill="none" stroke="' + se.color + '" stroke-width="2.5" ' + (se.dash ? 'stroke-dasharray="' + se.dash + '"' : "") + "/>";
      vis.forEach(function (p) {
        var cx = xPx(p.x).toFixed(1), cy = yPx(p.y).toFixed(1);
        var tip = (se.name ? se.name + " · " : "") + (cfg.xLabels[p.x] || "") + ": " + yFmt(p.y);
        s += '<circle cx="' + cx + '" cy="' + cy + '" r="3" fill="' + se.color + '"/>';
        // larger transparent hit target, collected to draw on top of everything
        hits += '<circle cx="' + cx + '" cy="' + cy + '" r="12" fill="transparent" style="cursor:pointer" data-tip="' + tip + '"/>';
      });
    });
    s += '<line x1="' + mL + '" y1="' + (mT + ph) + '" x2="' + (mL + pw) + '" y2="' + (mT + ph) + '" stroke="#bbb"/><line x1="' + mL + '" y1="' + mT + '" x2="' + mL + '" y2="' + (mT + ph) + '" stroke="#bbb"/>';
    s += hits;
    return '<svg class="chart" viewBox="0 0 ' + w + " " + h + '">' + s + "</svg>";
  }

  // Grouped bar chart.
  function barsSVG(cfg) {
    var w = 680, h = cfg.h || 240, mL = 60, mR = 18, mT = 18, mB = cfg.rotateLabels ? 82 : 36;
    var pw = w - mL - mR, ph = h - mT - mB;
    var yFmt = cfg.yFmt || function (v) { return v; }, yMin = cfg.yMin || 0;
    var yMax = cfg.yMax || niceMax(Math.max.apply(null, cfg.groups.reduce(function (acc, g) {
      return acc.concat(g.bars.map(function (b) { return b.v; })); }, [cfg.refLine ? cfg.refLine.y : 0, 1])));
    var yPx = function (v) { return mT + ph - ((v - yMin) / ((yMax - yMin) || 1)) * ph; };
    var vis = function (b) { return !(cfg.hidden && cfg.hidden[b.name]); };
    var gw = pw / cfg.groups.length, nb = (cfg.groups[0] ? cfg.groups[0].bars.filter(vis).length : 1) || 1;
    var bw = Math.min(40, (gw * 0.62) / nb), y0 = yPx(0);
    var s = "";
    for (var g = 0; g <= 4; g++) {
      var v = yMin + (yMax - yMin) * g / 4, y = yPx(v);
      s += '<line x1="' + mL + '" y1="' + y + '" x2="' + (mL + pw) + '" y2="' + y + '" stroke="#eee"/><text x="' + (mL - 8) + '" y="' + (y + 3) + '" text-anchor="end">' + yFmt(v) + "</text>";
    }
    cfg.groups.forEach(function (grp, gi) {
      var cx = mL + gw * gi + gw / 2;
      grp.bars.filter(vis).forEach(function (b, bi) {
        var x = cx - (nb * bw) / 2 + bi * bw, by = yPx(b.v);
        var tip = grp.label + (b.name ? " · " + b.name : "") + ": " + yFmt(b.v);
        s += '<rect x="' + x + '" y="' + Math.min(by, y0) + '" width="' + (bw - 4) + '" height="' + Math.abs(y0 - by) + '" fill="' + b.color + '" rx="2" data-tip="' + tip + '"/>';
        if (cfg.valLabels) { s += '<text x="' + (x + (bw - 4) / 2) + '" y="' + (by - 4) + '" text-anchor="middle" fill="#32363a">' + yFmt(b.v) + "</text>"; }
      });
      var ly = mT + ph + (cfg.rotateLabels ? 12 : 18);
      s += cfg.rotateLabels
        ? '<text x="' + cx + '" y="' + ly + '" text-anchor="end" transform="rotate(-55 ' + cx + " " + ly + ')">' + grp.label + "</text>"
        : '<text x="' + cx + '" y="' + ly + '" text-anchor="middle">' + grp.label + "</text>";
    });
    if (cfg.refLine && !(cfg.hidden && cfg.refLine.name && cfg.hidden[cfg.refLine.name])) {
      var ry = yPx(cfg.refLine.y);
      s += '<line x1="' + mL + '" y1="' + ry + '" x2="' + (mL + pw) + '" y2="' + ry + '" stroke="' + cfg.refLine.color + '" stroke-width="2" stroke-dasharray="5 4" data-tip="' + cfg.refLine.label + '"/>';
      s += '<text x="' + (mL + pw) + '" y="' + (ry - 5) + '" text-anchor="end" fill="' + cfg.refLine.color + '">' + cfg.refLine.label + "</text>";
    }
    s += '<line x1="' + mL + '" y1="' + y0 + '" x2="' + (mL + pw) + '" y2="' + y0 + '" stroke="#bbb"/>';
    return '<svg class="chart" viewBox="0 0 ' + w + " " + h + '">' + s + "</svg>";
  }

  // Bullseye scatter: SPI (x) vs CPI (y), crosshair at 1.0.
  function scatterSVG(pts) {
    var w = 680, h = 320, mL = 48, mR = 18, mT = 16, mB = 40;
    var pw = w - mL - mR, ph = h - mT - mB, lo = 0.6, hi = 1.4;
    var xPx = function (v) { return mL + ((_clamp(v, lo, hi) - lo) / (hi - lo)) * pw; };
    var yPx = function (v) { return mT + ph - ((_clamp(v, lo, hi) - lo) / (hi - lo)) * ph; };
    var cx = xPx(1), cy = yPx(1), s = "";
    s += '<rect x="' + cx + '" y="' + mT + '" width="' + (mL + pw - cx) + '" height="' + (cy - mT) + '" fill="#e3f4ea"/>';
    s += '<rect x="' + mL + '" y="' + cy + '" width="' + (cx - mL) + '" height="' + (mT + ph - cy) + '" fill="#fbe5e5"/>';
    for (var vv = lo; vv <= hi + 1e-9; vv += 0.2) {
      var x = xPx(vv), y = yPx(vv);
      s += '<line x1="' + x + '" y1="' + mT + '" x2="' + x + '" y2="' + (mT + ph) + '" stroke="#f1f1f1"/><line x1="' + mL + '" y1="' + y + '" x2="' + (mL + pw) + '" y2="' + y + '" stroke="#f1f1f1"/>';
      s += '<text x="' + x + '" y="' + (mT + ph + 16) + '" text-anchor="middle">' + vv.toFixed(1) + '</text><text x="' + (mL - 8) + '" y="' + (y + 3) + '" text-anchor="end">' + vv.toFixed(1) + "</text>";
    }
    s += '<line x1="' + cx + '" y1="' + mT + '" x2="' + cx + '" y2="' + (mT + ph) + '" stroke="#999"/><line x1="' + mL + '" y1="' + cy + '" x2="' + (mL + pw) + '" y2="' + cy + '" stroke="#999"/>';
    var maxB = Math.max.apply(null, pts.map(function (p) { return p.bac; }).concat(1));
    pts.forEach(function (p) {
      var r = 4 + 6 * Math.sqrt(p.bac / maxB);
      var tip = p.label + " (" + p.wbs + ") · SPI " + p.spi.toFixed(2) + " · CPI " + p.cpi.toFixed(2) + " · BAC " + mfmt(p.bac);
      s += '<circle cx="' + xPx(p.spi).toFixed(1) + '" cy="' + yPx(p.cpi).toFixed(1) + '" r="' + r.toFixed(1) + '" fill="#0a6ed1" opacity="0.5" stroke="#085caf" data-tip="' + tip + '"/>';
    });
    s += '<text x="' + (mL + pw / 2) + '" y="' + (h - 4) + '" text-anchor="middle">SPI &#8594;</text><text x="13" y="' + (mT + ph / 2) + '" text-anchor="middle" transform="rotate(-90 13 ' + (mT + ph / 2) + ')">CPI &#8594;</text>';
    s += '<line x1="' + mL + '" y1="' + (mT + ph) + '" x2="' + (mL + pw) + '" y2="' + (mT + ph) + '" stroke="#bbb"/><line x1="' + mL + '" y1="' + mT + '" x2="' + mL + '" y2="' + (mT + ph) + '" stroke="#bbb"/>';
    return '<svg class="chart" viewBox="0 0 ' + w + " " + h + '">' + s + "</svg>";
  }

  // legend builders — static entries (annotations) and clickable toggles (series)
  function lgLine(c, t, dash) { return '<span class="lg"><span class="ln" style="border-top-color:' + c + ";" + (dash ? "border-top-style:dashed;" : "") + '"></span>' + t + "</span>"; }
  function lgSw(c, t) { return '<span class="lg"><span class="sw" style="background:' + c + '"></span>' + t + "</span>"; }
  function swLine(c, dash) { return '<span class="ln" style="border-top-color:' + c + ";" + (dash ? "border-top-style:dashed;" : "") + '"></span>'; }
  function swBox(c) { return '<span class="sw" style="background:' + c + '"></span>'; }
  // Clickable legend entry that toggles a series on/off. `hid` is the chart's hidden map.
  function tg(key, name, swatch, label, hid) {
    var off = hid && hid[name] ? " off" : "";
    return '<span class="lg toggle' + off + '" data-chart="' + key + '" data-series="' + name + '">' + swatch + label + "</span>";
  }
  function rcCard(title, sub, body, legend) {
    return '<div class="rc-card"><div class="rc-head"><span>' + title + '</span><span class="rc-sub">' + sub + "</span></div>" +
      '<div class="rc-body">' + body + (legend ? '<div class="rc-legend">' + legend + "</div>" : "") + "</div></div>";
  }

  // Simulated time-phased EVM model for the program totals.
  function reportModel(tot, sIdx) {
    var bac = tot.bac || 1;
    var n = PERIODS.length;
    var S = function (t) { return t * t * (3 - 2 * t); };
    var cpiTarget = _clamp(tot.cpi || 0.95, 0.80, 1.10);
    var spiTarget = _clamp(0.88 + ((Math.round(bac / 1e6) % 13) / 100), 0.85, 1.05);
    var proj = 2, total = n + proj, finishIdx = total - 1;
    var pv = [], ev = [], ac = [], i;
    for (i = 0; i < n; i++) { pv[i] = bac * S((i + 1) / n); }
    for (i = 0; i <= sIdx; i++) {
      var tt = sIdx ? i / sIdx : 1;
      var sp = 1 + (spiTarget - 1) * tt, cp = 1.02 + (cpiTarget - 1.02) * tt;
      ev[i] = pv[i] * sp; ac[i] = ev[i] / cp;
    }
    var evS = ev[sIdx], acS = ac[sIdx];
    var cpiNow = acS ? evS / acS : 1, spiNow = pv[sIdx] ? evS / pv[sIdx] : 1;
    var eacPlan = acS + (bac - evS);
    var eacCpi = cpiNow ? acS + (bac - evS) / cpiNow : bac;
    var eacWt = (cpiNow * spiNow) ? acS + (bac - evS) / (cpiNow * spiNow) : bac;
    var etcLine = [];
    for (i = 0; i < total; i++) { etcLine[i] = i < sIdx ? null : acS + (eacCpi - acS) * ((i - sIdx) / Math.max(1, finishIdx - sIdx)); }
    var incPV = [], incAC = [];
    for (i = 0; i < n; i++) { incPV[i] = pv[i] - (i > 0 ? pv[i - 1] : 0); incAC[i] = i <= sIdx ? ac[i] - (i > 0 ? ac[i - 1] : 0) : 0; }
    var scatter = tot.cas.map(function (r, idx) {
      return { wbs: r.wbs, label: r.label, bac: r.bac || 1,
        spi: _clamp(spiNow + (((idx * 37) % 21) - 10) / 100, 0.62, 1.38),
        cpi: _clamp(cpiNow + (((idx * 53) % 21) - 10) / 100, 0.62, 1.38) };
    });
    return { n: n, total: total, sIdx: sIdx, finishIdx: finishIdx, bac: bac, pv: pv, ev: ev, ac: ac,
      etcLine: etcLine, eacPlan: eacPlan, eacCpi: eacCpi, eacWt: eacWt, cpiNow: cpiNow, spiNow: spiNow,
      incPV: incPV, incAC: incAC, scatter: scatter, eacOfficial: tot.eac,
      labels: PERIODS.map(function (p) { return p.label.replace(" 20", "’"); }).concat(["F+1", "F+2"]) };
  }

  function buildCharts(m, hid) {
    hid = hid || {};
    var H = function (k) { return hid[k] || (hid[k] = {}); };
    var X = m.total, L = m.labels, sx = m.sIdx;
    var pts = function (arr, lim) { return arr.slice(0, lim == null ? arr.length : lim).map(function (y, i) { return { x: i, y: y }; }); };

    // 1 · S-Curve
    var sCurve = lineSVG({
      h: 270, xN: X, xLabels: L, yMax: niceMax(Math.max(m.bac, m.eacWt)), yFmt: mfmt, hidden: H("scurve"),
      statusX: sx, refLines: [{ y: m.bac, color: "#6a6d70", dash: "4 4" }],
      series: [
        { pts: pts(m.pv, m.n), color: "#0a6ed1", name: "PV/BCWS" },
        { pts: pts(m.ev, sx + 1), color: "#107e3e", name: "EV/BCWP" },
        { pts: pts(m.ac, sx + 1), color: "#bb0000", name: "AC/ACWP" },
        { pts: m.etcLine.map(function (y, i) { return { x: i, y: y }; }), color: "#e9730c", dash: "5 4", name: "EAC/ETC" }
      ]
    });
    var sLeg = tg("scurve", "PV/BCWS", swLine("#0a6ed1"), "PV / BCWS", H("scurve")) +
      tg("scurve", "EV/BCWP", swLine("#107e3e"), "EV / BCWP", H("scurve")) +
      tg("scurve", "AC/ACWP", swLine("#bb0000"), "AC / ACWP", H("scurve")) +
      tg("scurve", "EAC/ETC", swLine("#e9730c", true), "EAC / ETC", H("scurve")) +
      lgLine("#6a6d70", "BAC", true);

    // 2 · Variance trend
    var cvCum = [], svCum = [], cvInc = [], svInc = [], i;
    for (i = 0; i <= sx; i++) {
      cvCum.push({ x: i, y: m.ev[i] - m.ac[i] });
      svCum.push({ x: i, y: m.ev[i] - m.pv[i] });
      var pc = i > 0 ? m.ev[i - 1] - m.ac[i - 1] : 0, ps = i > 0 ? m.ev[i - 1] - m.pv[i - 1] : 0;
      cvInc.push({ x: i, y: (m.ev[i] - m.ac[i]) - pc });
      svInc.push({ x: i, y: (m.ev[i] - m.pv[i]) - ps });
    }
    var vmax = niceMax(Math.max.apply(null, cvCum.concat(svCum, cvInc, svInc).map(function (p) { return Math.abs(p.y); }).concat(1)));
    var varChart = lineSVG({
      h: 240, xN: X, xLabels: L, yMin: -vmax, yMax: vmax, yFmt: mfmt, statusX: sx, hidden: H("variance"),
      refLines: [{ y: 0, color: "#bbb" }],
      series: [
        { pts: cvCum, color: "#bb0000", name: "CV cum" }, { pts: svCum, color: "#0a6ed1", name: "SV cum" },
        { pts: cvInc, color: "#e9730c", dash: "4 3", name: "CV current" }, { pts: svInc, color: "#6b4ba8", dash: "4 3", name: "SV current" }
      ]
    });
    var vLeg = tg("variance", "CV cum", swLine("#bb0000"), "CV cumulative", H("variance")) +
      tg("variance", "SV cum", swLine("#0a6ed1"), "SV cumulative", H("variance")) +
      tg("variance", "CV current", swLine("#e9730c", true), "CV current period", H("variance")) +
      tg("variance", "SV current", swLine("#6b4ba8", true), "SV current period", H("variance"));

    // 3 · CPI / SPI / TCPI trend
    var cpiPts = [], spiPts = [], tcpiPts = [];
    for (i = 0; i <= sx; i++) {
      cpiPts.push({ x: i, y: m.ac[i] ? m.ev[i] / m.ac[i] : 1 });
      spiPts.push({ x: i, y: m.pv[i] ? m.ev[i] / m.pv[i] : 1 });
      tcpiPts.push({ x: i, y: (m.bac - m.ac[i]) ? (m.bac - m.ev[i]) / (m.bac - m.ac[i]) : 1 });
    }
    var idxChart = lineSVG({
      h: 240, xN: X, xLabels: L, yMin: 0.7, yMax: 1.3, yFmt: function (v) { return v.toFixed(2); }, statusX: sx, hidden: H("index"),
      bands: [{ y1: 0.95, y2: 1.05, color: "#eef7f0" }],
      refLines: [{ y: 1.0, color: "#999", dash: "4 4" }],
      series: [
        { pts: cpiPts, color: "#107e3e", name: "CPI" }, { pts: spiPts, color: "#0a6ed1", name: "SPI" },
        { pts: tcpiPts, color: "#e9730c", dash: "4 3", name: "TCPI" }
      ]
    });
    var iLeg = tg("index", "CPI", swLine("#107e3e"), "CPI", H("index")) +
      tg("index", "SPI", swLine("#0a6ed1"), "SPI", H("index")) +
      tg("index", "TCPI", swLine("#e9730c", true), "TCPI (to-complete)", H("index")) +
      lgSw("#eef7f0", "±0.05 control band");

    // 4 · Bullseye
    var bull = scatterSVG(m.scatter);
    var bLeg = lgSw("#e3f4ea", "Ahead &amp; under budget") + lgSw("#fbe5e5", "Behind &amp; over budget") +
      '<span class="lg">Bubble size = BAC · ' + m.scatter.length + " control accounts</span>";

    // 5 · EAC forecasting
    var contract = m.bac * 1.03, eacColor = function (v) { return v > m.bac ? "#bb0000" : "#107e3e"; };
    var eacChart = barsSVG({
      h: 250, valLabels: true, yFmt: mfmt, yMax: niceMax(Math.max(m.bac, m.eacPlan, m.eacCpi, m.eacWt, contract)),
      groups: [
        { label: "BAC", bars: [{ v: m.bac, color: "#6a6d70" }] },
        { label: "EAC @Plan", bars: [{ v: m.eacPlan, color: eacColor(m.eacPlan) }] },
        { label: "EAC ÷CPI", bars: [{ v: m.eacCpi, color: eacColor(m.eacCpi) }] },
        { label: "EAC eff-wt", bars: [{ v: m.eacWt, color: eacColor(m.eacWt) }] },
        { label: "Contract", bars: [{ v: contract, color: "#0a6ed1" }] }
      ]
    });
    var eLeg = '<span class="lg">VAC (BAC − EAC÷CPI) = ' + mfmt(m.bac - m.eacCpi) + "</span>" +
      lgSw("#107e3e", "≤ BAC") + lgSw("#bb0000", "&gt; BAC") + lgSw("#0a6ed1", "Contract value");

    // 6 · Resource / spend histogram
    var hist = barsSVG({
      h: 240, yFmt: mfmt, hidden: H("hist"),
      groups: PERIODS.map(function (p, idx) {
        return { label: p.label.split(" ")[0], bars: [
          { v: m.incPV[idx], color: "#a9c5ec", name: "Planned" }, { v: m.incAC[idx], color: "#0a6ed1", name: "Actual" }] };
      })
    });
    var hLeg = tg("hist", "Planned", swBox("#a9c5ec"), "Planned spend (BCWS)", H("hist")) +
      tg("hist", "Actual", swBox("#0a6ed1"), "Actual spend (ACWP)", H("hist"));

    // 7 · Internal Cost (IEAC)
    var ev = m.ev[m.sIdx], ac = m.ac[m.sIdx], rem = m.bac - ev, cpi = m.cpiNow, spi = m.spiNow;
    var eacOfficial = m.eacOfficial || m.eacCpi;
    var ieacMethods = [
      { label: "÷ CPI", v: cpi ? ac + rem / cpi : m.bac },
      { label: "÷ (CPI×SPI)", v: (cpi * spi) ? ac + rem / (cpi * spi) : m.bac },
      { label: "÷ (.8CPI+.2SPI)", v: (0.8 * cpi + 0.2 * spi) ? ac + rem / (0.8 * cpi + 0.2 * spi) : m.bac },
      { label: "BAC ÷ CPI", v: cpi ? m.bac / cpi : m.bac },
      { label: "ACWP + Remaining", v: ac + rem }
    ];
    var ieacGroups = ieacMethods.map(function (mm) { return { label: mm.label, bars: [{ name: "iEAC", v: mm.v, color: "#efb000" }] }; });
    var ieacChart = barsSVG({
      h: 320, rotateLabels: true, yFmt: mfmt, groups: ieacGroups, hidden: H("ieac"),
      refLine: { y: eacOfficial, color: "#107e3e", label: "EAC " + mfmt(eacOfficial), name: "EAC" }
    });
    var ieacLeg = tg("ieac", "iEAC", swBox("#efb000"), "iEAC (independent calculations)", H("ieac")) +
      tg("ieac", "EAC", swLine("#107e3e"), "EAC (official forecast — reference)", H("ieac"));

    return '<div class="report-charts">' +
      rcCard("1 · S-Curve — Cumulative Performance", "BCWS / BCWP / ACWP with BAC reference &amp; EAC projection", sCurve, sLeg) +
      rcCard("2 · Variance Trend (CV &amp; SV)", "Cumulative vs current-period, in dollars", varChart, vLeg) +
      rcCard("3 · Performance Index Trend (CPI / SPI / TCPI)", "vs 1.0 baseline with ±0.05 control band", idxChart, iLeg) +
      rcCard("4 · Bullseye — SPI vs CPI", "Control accounts vs the 1.0 / 1.0 crosshair", bull, bLeg) +
      rcCard("5 · EAC / Forecasting", "Scenario family bracketed against BAC &amp; contract value", eacChart, eLeg) +
      rcCard("6 · Resource / Cost Histogram", "Time-phased planned vs actual spend by period", hist, hLeg) +
      rcCard("7 · Internal Cost (IEAC)", "DCMA Gold Card independent-EAC methods vs the official EAC (dashed reference line)", ieacChart, ieacLeg) +
      "</div>";
  }

  return Controller.extend("dassian.tpm.ui5.controller.Analytics", {
    onInit: function () {
      this.getView().setModel(new JSONModel({ period: "2026-05", periods: PERIODS }), "flt");
      this._html = "";
      this._hidden = {};      // per-chart hidden-series state, persists across re-renders
      this._lastModel = null;
      var that = this;
      var node = this.byId("chartsHtml");
      if (node) {
        node.addEventDelegate({ onAfterRendering: function () {
          var dom = node.getDomRef();
          if (dom) { that._attachTips(dom); }
        } });
      }
      this._load();
    },
    _prog: function () { return this.getOwnerComponent().getModel("ui").getProperty("/program"); },
    onProgramChange: function () { this._load(); },
    onPeriodChange: function () { this._load(); },

    _paint: function () {
      var node = this.byId("chartsHtml");
      if (node && this._html) { node.setContent(this._html); }
    },
    _attachTips: function () {
      var that = this;
      var tip = document.getElementById("tpmChartTip");
      if (!tip) {
        tip = document.createElement("div");
        tip.id = "tpmChartTip";
        tip.style.cssText = "position:fixed;display:none;z-index:2000;pointer-events:none;background:#32363a;color:#fff;font-size:12px;padding:6px 9px;border-radius:4px;white-space:nowrap;box-shadow:0 2px 10px rgba(0,0,0,.28)";
        document.body.appendChild(tip);
      }
      // Hover tooltips via one guarded document-level delegated listener, so
      // chart re-renders (legend toggles, period changes) never drop the handler.
      if (!this._tipsBound) {
        this._tipsBound = true;
        this._tipMove = function (e) {
          var viewDom = that.getView() && that.getView().getDomRef();
          var el = e.target && e.target.closest ? e.target.closest("[data-tip]") : null;
          if (!el || !viewDom || !viewDom.contains(el)) { tip.style.display = "none"; return; }
          tip.textContent = el.getAttribute("data-tip");
          tip.style.display = "block";
          tip.style.left = (e.clientX + 14) + "px";
          tip.style.top = (e.clientY + 14) + "px";
        };
        document.addEventListener("mousemove", this._tipMove, true);
      }
      // Clickable legend entries toggle their series on/off (one guarded listener).
      if (!this._clickBound) {
        this._clickBound = true;
        this._legendClick = function (e) {
          var el = e.target && e.target.closest ? e.target.closest("[data-chart]") : null;
          if (!el) { return; }
          var viewDom = that.getView() && that.getView().getDomRef();
          if (!viewDom || !viewDom.contains(el)) { return; }
          var k = el.getAttribute("data-chart"), n = el.getAttribute("data-series");
          var set = that._hidden[k] || (that._hidden[k] = {});
          if (set[n]) { delete set[n]; } else { set[n] = true; }
          if (that._lastModel) { that._html = buildCharts(that._lastModel, that._hidden); that._paint(); }
        };
        document.addEventListener("click", this._legendClick);
      }
    },

    onExit: function () {
      if (this._legendClick) { document.removeEventListener("click", this._legendClick); }
      if (this._tipMove) { document.removeEventListener("mousemove", this._tipMove, true); }
    },

    _load: function () {
      var prog = this._prog(), model = this.getOwnerComponent().getModel();
      var period = this.getView().getModel("flt").getProperty("/period");
      var sIdx = Math.max(0, PERIODS.map(function (p) { return p.id; }).indexOf(period));
      var that = this;
      model.bindList("/ControlAccounts").requestContexts(0, 500).then(function (ctxs) {
        var plan = 0, earned = 0, actual = 0, bac = 0, eac = 0, cas = [];
        ctxs.forEach(function (c) {
          var o = c.getObject();
          if (o.ProgramID !== prog) { return; }
          plan += parseFloat(o.PlannedValue) || 0;
          earned += parseFloat(o.EarnedValue) || 0;
          actual += parseFloat(o.ActualCost) || 0;
          bac += parseFloat(o.BAC) || 0;
          eac += parseFloat(o.EAC) || 0;
          cas.push({ wbs: o.ID, label: o.Description, bac: parseFloat(o.BAC) || 0 });
        });
        var cpi = actual ? earned / actual : 0.95, spi = plan ? earned / plan : 0.95;
        var m = reportModel({ bac: bac, eac: eac, cpi: cpi, spi: spi, cas: cas }, sIdx);
        that._lastModel = m;
        that._html = buildCharts(m, that._hidden);
        that._paint();
      });
    },

    onNavBack: function () { HashChanger.getInstance().setHash(""); }
  });
});
