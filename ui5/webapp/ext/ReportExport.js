sap.ui.define([
  "sap/m/MessageToast"
], function (MessageToast) {
  "use strict";

  // Client-side report exporters ported from the prototype: a dependency-free
  // .xlsx writer (stored-ZIP, byte level) and a print-to-PDF window. Covers the
  // WBS Dictionary, RAM, CAP (Time-Phased/Summary), Tripwire and Program Control
  // Log. Each report provides a sheet builder + a print-HTML builder; the public
  // excel(kind, payload) / pdf(kind, payload) dispatch on the report kind.

  // ---- low-level zip / xlsx plumbing ----
  function u8(s) { return new TextEncoder().encode(s); }
  function concat(a) { var n = 0; a.forEach(function (x) { n += x.length; }); var o = new Uint8Array(n), p = 0; a.forEach(function (x) { o.set(x, p); p += x.length; }); return o; }
  function le16(n) { return new Uint8Array([n & 255, (n >> 8) & 255]); }
  function le32(n) { return new Uint8Array([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]); }
  function crc32(b) { var c = ~0; for (var i = 0; i < b.length; i++) { c ^= b[i]; for (var j = 0; j < 8; j++) { c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } } return (~c) >>> 0; }
  function zip(files) {
    var local = [], central = [], off = 0;
    files.forEach(function (f) {
      var nm = u8(f.name), d = f.data, crc = crc32(d), sz = d.length;
      var lh = concat([le32(0x04034b50), le16(20), le16(0), le16(0), le16(0), le16(0), le32(crc), le32(sz), le32(sz), le16(nm.length), le16(0), nm, d]);
      local.push(lh);
      central.push(concat([le32(0x02014b50), le16(20), le16(20), le16(0), le16(0), le16(0), le16(0), le32(crc), le32(sz), le32(sz), le16(nm.length), le16(0), le16(0), le16(0), le16(0), le32(0), le32(off), nm]));
      off += lh.length;
    });
    var cd = concat(central);
    var end = concat([le32(0x06054b50), le16(0), le16(0), le16(files.length), le16(files.length), le32(cd.length), le32(off), le16(0)]);
    return concat(local.concat([cd, end]));
  }
  function xesc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function colL(n) { var s = ""; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  function tcell(c, r, v, s) { return '<c r="' + colL(c) + r + '" t="inlineStr"' + (s ? ' s="' + s + '"' : "") + '><is><t xml:space="preserve">' + xesc(v) + "</t></is></c>"; }
  function ncell(c, r, v, s) { return '<c r="' + colL(c) + r + '" s="' + s + '"><v>' + (typeof v === "number" ? v : 0) + "</v></c>"; }
  function sheet(body, tail) { return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + body + "</sheetData>" + (tail || "") + "</worksheet>"; }

  // styles: 0=text 1=bold 2=hrs(#,##0.000) 3=cost(#,##0.00) 4=blue-text 5=blue-num 6=gold-text 7=gold-num; dxfs 0=ISSUE 1=OK 2=NA
  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.000"/><numFmt numFmtId="165" formatCode="#,##0.00"/></numFmts>' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFBDD7EE"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFE699"/></patternFill></fill></fills>' +
    '<borders count="1"><border/></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="8">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1"/>' +
    '<xf numFmtId="165" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1" applyNumberFormat="1"/>' +
    '<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>' +
    '<xf numFmtId="165" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1" applyNumberFormat="1"/>' +
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '<dxfs count="3">' +
    '<dxf><font><color rgb="FF9C0006"/></font><fill><patternFill><bgColor rgb="FFFFC7CE"/></patternFill></fill></dxf>' +
    '<dxf><font><color rgb="FF006100"/></font><fill><patternFill><bgColor rgb="FFC6EFCE"/></patternFill></fill></dxf>' +
    '<dxf><font><color rgb="FF7F7F7F"/></font><fill><patternFill><bgColor rgb="FFEDEDED"/></patternFill></fill></dxf>' +
    '</dxfs></styleSheet>';
  var CT = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';
  var RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  var WBR = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  function workbookXml(name) { return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + xesc(name) + '" sheetId="1" r:id="rId1"/></sheets></workbook>'; }
  function bytes(sheetName, sheetXml) {
    return zip([
      { name: "[Content_Types].xml", data: u8(CT) },
      { name: "_rels/.rels", data: u8(RELS) },
      { name: "xl/workbook.xml", data: u8(workbookXml(sheetName)) },
      { name: "xl/_rels/workbook.xml.rels", data: u8(WBR) },
      { name: "xl/styles.xml", data: u8(STYLES) },
      { name: "xl/worksheets/sheet1.xml", data: u8(sheetXml) }
    ]);
  }
  function download(sheetName, sheetXml, filename) {
    try {
      var blob = new Blob([bytes(sheetName, sheetXml)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    } catch (e) { MessageToast.show("Could not build the Excel file: " + (e && e.message ? e.message : e)); }
  }
  function printHtml(html) {
    var w = window.open("", "_blank");
    if (!w) { MessageToast.show("Allow pop-ups to export the PDF."); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }
  function pdfDoc(title, h1, sub, extraCss, tableHtml) {
    return "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>" + xesc(title) + "</title><style>" +
      "body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:0;padding:12px;}" +
      "h1{font-size:14px;margin:0 0 2px;}.sub{font-size:10px;color:#555;margin-bottom:8px;}" +
      "table{border-collapse:collapse;width:100%;}th,td{border:1px solid #bbb;padding:2px 3px;vertical-align:top;}" +
      "th{background:#eef3f8;}thead{display:table-header-group;}td.num{text-align:right;}" + extraCss +
      "</style></head><body><h1>" + xesc(h1) + "</h1><div class=\"sub\">" + sub + "</div>" + tableHtml +
      "<scr" + "ipt>window.onload=function(){setTimeout(function(){window.focus();window.print();},350);};</scr" + "ipt></body></html>";
  }
  function fileTag(s, fb) { return ((String(s || fb).split(" ")[0]) || fb).replace(/[^A-Za-z0-9_-]/g, ""); }
  function numFmt(v, d) { if (typeof v !== "number") { return ""; } if (v === 0) { return "0"; } return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); }

  // ================= WBS Dictionary =================
  var WBS_COLS = ["Level", "WBS Element", "Description", "Authorization Description", "SOW Ref",
    "CAM", "Rec/NRE", "BAC Hrs", "BAC Cost (USD)", "EV Method", "IMS Baseline Start", "IMS Baseline Finish",
    "PMB Start", "PMB Finish", "IMS Forecast Start", "IMS Forecast Finish", "EAC Start", "EAC Finish"];
  function wbsSheet(p) {
    var meta = p.meta || {}, rows = p.rows || [], rn = 1, out = [];
    [meta.title, meta.project, meta.contract, meta.printDate].filter(Boolean).forEach(function (t) { out.push('<row r="' + rn + '">' + tcell(0, rn, t, 0) + "</row>"); rn++; });
    out.push('<row r="' + rn + '"></row>'); rn++;
    out.push('<row r="' + rn + '">' + WBS_COLS.map(function (h, i) { return tcell(i, rn, h, 1); }).join("") + "</row>"); rn++;
    rows.forEach(function (r) {
      var v = [r.level, r.wbs, r.desc, r.auth, r.sow, r.cam, r.rec, r.hrs, r.cost, r.ev, r.imsBS, r.imsBF, r.pmbS, r.pmbF, r.fcstS, r.fcstF, r.eacS, r.eacF];
      var cells = "";
      v.forEach(function (val, i) { cells += (i === 7) ? ncell(7, rn, val, 2) : (i === 8) ? ncell(8, rn, val, 3) : tcell(i, rn, val, 0); });
      out.push('<row r="' + rn + '">' + cells + "</row>"); rn++;
    });
    return sheet(out.join(""));
  }
  function wbsPdf(p) {
    var meta = p.meta || {}, rows = p.rows || [];
    var widths = [3, 7, 9, 15, 7, 6, 4, 5, 6, 4, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5];
    var colgroup = "<colgroup>" + widths.map(function (w) { return '<col style="width:' + w + '%"/>'; }).join("") + "</colgroup>";
    var head = "<tr>" + WBS_COLS.map(function (h) { return "<th>" + xesc(h) + "</th>"; }).join("") + "</tr>";
    var body = rows.map(function (r) {
      var ca = /CA/.test(r.level);
      var cells = [r.level, r.wbs, r.desc, r.auth, r.sow, r.cam, r.rec].map(function (x) { return "<td>" + xesc(x) + "</td>"; }).join("");
      cells += '<td class="num">' + numFmt(r.hrs, 3) + '</td><td class="num">' + numFmt(r.cost, 2) + "</td><td>" + xesc(r.ev) + "</td>";
      cells += [r.imsBS, r.imsBF, r.pmbS, r.pmbF, r.fcstS, r.fcstF, r.eacS, r.eacF].map(function (x) { return "<td>" + xesc(x) + "</td>"; }).join("");
      return '<tr class="' + (ca ? "ca" : "") + '">' + cells + "</tr>";
    }).join("");
    var css = "@page{size:A4 landscape;margin:9mm;}table{font-size:7px;table-layout:fixed;}th,td{text-align:left;overflow-wrap:anywhere;word-break:break-word;}tr.ca{background:#eaf2fb;font-weight:bold;}";
    var sub = [meta.project, meta.contract, meta.printDate].filter(Boolean).map(xesc).join(" &middot; ");
    return pdfDoc(meta.title || "WBS Dictionary", meta.title || "Contract Work Breakdown Structure Dictionary", sub, css, "<table>" + colgroup + "<thead>" + head + "</thead><tbody>" + body + "</tbody></table>");
  }

  // ================= RAM =================
  function ramCompute(p) {
    var people = p.people || [], rows = p.rows || [], c = p.constants || { mr: 0, fee: 0, gaRate: 0 };
    var colSums = new Array(people.length).fill(0), grand = 0;
    rows.forEach(function (r) { (r.vals || []).forEach(function (v, i) { if (typeof v === "number") { colSums[i] += v; } }); if (typeof r.total === "number") { grand += r.total; } });
    var ga = colSums.map(function (v) { return v * c.gaRate; }), gaTot = grand * c.gaRate;
    var pmb = grand + gaTot, cbb = pmb + c.mr, price = cbb + c.fee;
    return { colSums: colSums, grand: grand, ga: ga, gaTot: gaTot, pmb: pmb, cbb: cbb, price: price, mr: c.mr, fee: c.fee };
  }
  function ramFoot(k) {
    return [
      { label: "Total (Excluding G&A and COM)  Currency: USD - Internal Cost", vals: k.colSums, total: k.grand },
      { label: "General Administrative (G&A)", vals: k.ga, total: k.gaTot },
      { label: "Cost of Money (COM)", vals: null, total: null },
      { label: "UNDISTRIBUTED BUDGET", vals: null, total: null },
      { label: "PERFORMANCE MEASUREMENT BASELINE", vals: null, total: k.pmb },
      { label: "MANAGEMENT RESERVE", vals: null, total: k.mr },
      { label: "CONTRACT BUDGET BASE", vals: null, total: k.cbb },
      { label: "FEE", vals: null, total: k.fee },
      { label: "CONTRACT PRICE", vals: null, total: k.price }
    ];
  }
  function ramSheet(p) {
    var meta = p.meta || {}, people = p.people || [], depts = p.depts || [], rows = p.rows || [], f = p.factor || 1, P0 = 6;
    var k = ramCompute(p), nc = function (col, r, v) { return '<c r="' + colL(col) + r + '" s="3"><v>' + (typeof v === "number" ? v * f : 0) + "</v></c>"; };
    var rn = 1, out = [];
    out.push('<row r="' + rn + '">' + tcell(0, rn, meta.title || "Responsibility Assignment Matrix (RAM)", 1) + "</row>"); rn++;
    out.push('<row r="' + rn + '">' + tcell(0, rn, [meta.project, meta.obs, p.periodLabel ? "Period: " + p.periodLabel : ""].filter(Boolean).join(" · "), 0) + "</row>"); rn++;
    out.push('<row r="' + rn + '"></row>'); rn++;
    var dr = "", cc = P0; depts.forEach(function (d) { dr += tcell(cc, rn, d.name, 1); cc += d.span; });
    out.push('<row r="' + rn + '">' + dr + "</row>"); rn++;
    var hr = ["1", "2", "3", "4", "WBS Number", "Description"].map(function (h, i) { return tcell(i, rn, h, 1); }).join("");
    hr += people.map(function (pp, i) { return tcell(P0 + i, rn, pp, 1); }).join("") + tcell(P0 + people.length, rn, "Total", 1);
    out.push('<row r="' + rn + '">' + hr + "</row>"); rn++;
    rows.forEach(function (r) {
      var cells = "";
      for (var col = 0; col < 4; col++) { cells += tcell(col, rn, (col + 1 === r.level) ? (r.ca ? "CA" : "X") : "", 0); }
      cells += tcell(4, rn, r.number, 0) + tcell(5, rn, r.desc, 0);
      (r.vals || []).forEach(function (v, i) { cells += (typeof v === "number") ? nc(P0 + i, rn, v) : tcell(P0 + i, rn, "", 0); });
      cells += (typeof r.total === "number") ? nc(P0 + people.length, rn, r.total) : tcell(P0 + people.length, rn, "", 0);
      out.push('<row r="' + rn + '">' + cells + "</row>"); rn++;
    });
    ramFoot(k).forEach(function (ft) {
      var cells = tcell(0, rn, ft.label, 1);
      for (var col = 1; col < 6; col++) { cells += tcell(col, rn, "", 1); }
      for (var i = 0; i < people.length; i++) { var v = ft.vals ? ft.vals[i] : null; cells += (typeof v === "number") ? nc(P0 + i, rn, v) : tcell(P0 + i, rn, "", 1); }
      cells += (typeof ft.total === "number") ? nc(P0 + people.length, rn, ft.total) : tcell(P0 + people.length, rn, "", 1);
      out.push('<row r="' + rn + '">' + cells + "</row>"); rn++;
    });
    return sheet(out.join(""));
  }
  function ramPdf(p) {
    var meta = p.meta || {}, people = p.people || [], depts = p.depts || [], rows = p.rows || [], f = p.factor || 1;
    var money = function (v) { return (typeof v === "number") ? (v * f).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""; };
    var deptTh = depts.map(function (d) { return '<th colspan="' + d.span + '">' + xesc(d.name) + "</th>"; }).join("");
    var personTh = people.map(function (pp) { return "<th>" + xesc(pp) + "</th>"; }).join("");
    var thead = '<thead><tr><th colspan="4">WBS Level</th><th rowspan="2">WBS Number</th><th rowspan="2">Description</th>' + deptTh + '<th rowspan="2">Total</th></tr><tr><th>1</th><th>2</th><th>3</th><th>4</th>' + personTh + "</tr></thead>";
    var lvl = function (r) { var s = ""; for (var c = 1; c <= 4; c++) { s += '<td class="lvl">' + ((c === r.level) ? (r.ca ? "CA" : "X") : "") + "</td>"; } return s; };
    var body = rows.map(function (r) { return '<tr class="' + (r.ca ? "ca" : "") + '">' + lvl(r) + "<td>" + xesc(r.number) + '</td><td class="d">' + xesc(r.desc) + "</td>" + (r.vals || []).map(function (v) { return '<td class="num">' + money(v) + "</td>"; }).join("") + '<td class="num">' + money(r.total) + "</td></tr>"; }).join("");
    var k = ramCompute(p);
    var foot = ramFoot(k).map(function (ft, i) { return '<tr class="foot' + (i === 0 ? " ft" : "") + '"><td colspan="6">' + xesc(ft.label) + "</td>" + (ft.vals ? ft.vals : new Array(people.length).fill(null)).map(function (v) { return '<td class="num">' + money(v) + "</td>"; }).join("") + '<td class="num">' + money(ft.total) + "</td></tr>"; }).join("");
    var css = "@page{size:A4 landscape;margin:8mm;}table{font-size:7px;}th,td{text-align:left;}th{text-align:center;}td.lvl{text-align:center;}tr.ca td{background:#eaf2fb;font-weight:bold;}tr.foot td{font-weight:bold;background:#f5f5f5;}tr.ft td{border-top:2px solid #999;}td.d{white-space:normal;max-width:130px;overflow-wrap:anywhere;}";
    var sub = [meta.project, meta.obs, p.periodLabel ? "Period: " + p.periodLabel : ""].filter(Boolean).map(xesc).join(" · ");
    return pdfDoc("RAM", meta.title || "Responsibility Assignment Matrix (RAM)", sub, css, "<table>" + thead + "<tbody>" + body + foot + "</tbody></table>");
  }

  // ================= CAP =================
  var CAP_SUM_COLS = [3, 4, 12, 13, 14, 16, 17, 20, 21, 22, 23, 24, 26, 27, 30, 31, 32, 33, 34, 35, 36, 37];
  function capTpSheet(t) {
    var rn = 1, out = [];
    var hdr = ["Control Account", "Work Package", "Description", "Type", "TOTALS"].concat(t.months || []);
    out.push('<row r="' + rn + '">' + hdr.map(function (h, i) { return tcell(i, rn, h, 1); }).join("") + "</row>"); rn++;
    (t.rows || []).forEach(function (r) {
      var cells = tcell(0, rn, r.ca, 0) + tcell(1, rn, r.wp, 0) + tcell(2, rn, r.wpDesc, 0) + tcell(3, rn, r.type, 0) + ncell(4, rn, r.totals, 3);
      (r.vals || []).forEach(function (v, i) { cells += ncell(5 + i, rn, v, 3); });
      out.push('<row r="' + rn + '">' + cells + "</row>"); rn++;
    });
    return sheet(out.join(""));
  }
  function capSummarySheet(s) {
    var cols = s.cols || [], rn = 1, out = [];
    out.push('<row r="' + rn + '">' + CAP_SUM_COLS.map(function (idx, k) { return tcell(k, rn, String(cols[idx]), 1); }).join("") + "</row>"); rn++;
    (s.rows || []).forEach(function (r) {
      var cells = "";
      CAP_SUM_COLS.forEach(function (idx, k) { var v = r[idx]; cells += (k <= 1) ? tcell(k, rn, String(v).replace("WBS ", ""), 0) : ((typeof v === "number") ? ncell(k, rn, v, 3) : tcell(k, rn, String(v), 0)); });
      out.push('<row r="' + rn + '">' + cells + "</row>"); rn++;
    });
    return sheet(out.join(""));
  }
  function capPdf(p) {
    var isSum = p.view === "summary", sub = (p.sub || ""), thead, body, title;
    if (isSum) {
      var s = p.summary || { cols: [], rows: [] };
      var fmt = function (name, v) { if (typeof v !== "number") { return xesc(String(v).replace("WBS ", "")); } if (/SPI|CPI|TCPI/.test(name)) { return v.toFixed(2); } if (/%/.test(name)) { return v.toFixed(1) + "%"; } return v.toLocaleString("en-US", { maximumFractionDigits: 0 }); };
      thead = "<tr>" + CAP_SUM_COLS.map(function (idx) { return "<th>" + xesc(s.cols[idx]) + "</th>"; }).join("") + "</tr>";
      body = (s.rows || []).map(function (r) { return "<tr>" + CAP_SUM_COLS.map(function (idx, k) { var v = r[idx]; var cls = (k <= 1) ? "d" : ("num" + ((typeof v === "number" && v < 0) ? " neg" : "")); return '<td class="' + cls + '">' + fmt(s.cols[idx], v) + "</td>"; }).join("") + "</tr>"; }).join("");
      title = "Control Account Plans — Summary";
    } else {
      var t = p.tp || { months: [], rows: [] };
      var money = function (v) { return (typeof v === "number" && v !== 0) ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : ""; };
      thead = '<tr><th>Control Account</th><th>Work Package</th><th class="d">Description</th><th>Type</th><th class="num">TOTALS</th>' + (t.months || []).map(function (mo) { return '<th class="num">' + xesc(mo) + "</th>"; }).join("") + "</tr>";
      body = (t.rows || []).map(function (r) { return "<tr><td>" + xesc(r.ca) + "</td><td>" + xesc(r.wp) + '</td><td class="d">' + xesc(r.wpDesc) + "</td><td>" + xesc(r.type) + '</td><td class="num">' + money(r.totals) + "</td>" + (r.vals || []).map(function (v) { return '<td class="num">' + money(v) + "</td>"; }).join("") + "</tr>"; }).join("");
      title = "Control Account Plans — Time-Phased";
    }
    var css = "@page{size:A4 landscape;margin:8mm;}table{font-size:6.5px;}th,td{text-align:right;}th{text-align:center;}td.d,th.d{text-align:left;white-space:normal;max-width:120px;overflow-wrap:anywhere;}td.neg{color:#bb0000;}";
    return pdfDoc("CAP", title, sub, css, "<table><thead>" + thead + "</thead><tbody>" + body + "</tbody></table>");
  }

  // ================= Tripwire =================
  var TW_TEXT = [0, 1, 3, 5], TW_NUM = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  function twChk(cols) { var a = []; for (var i = 21; i < cols.length; i++) { a.push(i); } return a; }
  function twMoney(v) { return (typeof v === "number") ? Math.round(v).toLocaleString("en-US") : xesc(v); }
  function twRatio(v) { return (typeof v === "number") ? v.toFixed(2) : xesc(v); }
  function twSheet(p) {
    var cols = p.cols || [], rows = p.rows || [], f = p.factor || 1, CHK = twChk(cols), order = TW_TEXT.concat(TW_NUM).concat(CHK);
    var rn = 1, out = [];
    out.push('<row r="' + rn + '">' + order.map(function (idx, k) { return tcell(k, rn, cols[idx], 1); }).join("") + "</row>"); rn++;
    rows.forEach(function (r) {
      var cells = "";
      order.forEach(function (idx, k) {
        var v = r[idx];
        if (TW_NUM.indexOf(idx) >= 0 && typeof v === "number") { cells += ncell(k, rn, (idx >= 18) ? v : v * f, 3); }   // scale dollars, keep ratios
        else { cells += tcell(k, rn, v, 0); }
      });
      out.push('<row r="' + rn + '">' + cells + "</row>"); rn++;
    });
    var c1 = colL(TW_TEXT.length + TW_NUM.length), c2 = colL(order.length - 1), lastRow = 1 + rows.length;
    var cf = '<conditionalFormatting sqref="' + c1 + "2:" + c2 + lastRow + '">' +
      '<cfRule type="cellIs" dxfId="0" priority="1" operator="equal"><formula>"ISSUE"</formula></cfRule>' +
      '<cfRule type="cellIs" dxfId="1" priority="2" operator="equal"><formula>"OK"</formula></cfRule>' +
      '<cfRule type="cellIs" dxfId="2" priority="3" operator="equal"><formula>"NA"</formula></cfRule>' +
      "</conditionalFormatting>";
    return sheet(out.join(""), cf);
  }
  function twPdf(p) {
    var meta = p.meta || {}, cols = p.cols || [], rows = p.rows || [], f = p.factor || 1, CHK = twChk(cols);
    var money = function (v) { return (typeof v === "number") ? Math.round(v * f).toLocaleString("en-US") : xesc(v); };
    var th = "";
    TW_TEXT.forEach(function (i) { th += '<th class="d">' + xesc(cols[i]) + "</th>"; });
    TW_NUM.forEach(function (i) { th += "<th>" + xesc(cols[i]) + "</th>"; });
    CHK.forEach(function (i) { th += '<th title="' + xesc(cols[i]) + '">' + xesc(String(cols[i]).split(" ")[0]) + "</th>"; });
    var body = rows.map(function (r) {
      var cells = "";
      TW_TEXT.forEach(function (i) { cells += '<td class="d">' + xesc(r[i]) + "</td>"; });
      TW_NUM.forEach(function (i) { cells += '<td class="num">' + (i >= 18 ? twRatio(r[i]) : money(r[i])) + "</td>"; });
      CHK.forEach(function (i) { var v = r[i]; cells += '<td class="' + (v === "ISSUE" ? "iss" : "") + '">' + xesc(v) + "</td>"; });
      return "<tr>" + cells + "</tr>";
    }).join("");
    var css = "@page{size:A4 landscape;margin:7mm;}table{font-size:6px;}th,td{text-align:center;padding:1px 2px;}td.d,th.d{text-align:left;}td.num{text-align:right;}td.iss{background:#fbe5e5;color:#bb0000;font-weight:bold;}";
    var sub = [meta.snapshot, meta.baseline, meta.planValues].filter(Boolean).map(xesc).join(" · ");
    return pdfDoc("Tripwire", meta.title || "Tripwire Report", sub, css, "<table><thead><tr>" + th + "</tr></thead><tbody>" + body + "</tbody></table>");
  }

  // ================= Program Control Log =================
  function clRowStyle(r) {
    var isSum = !String(r[8]).trim();
    if (!isSum) { return { t: 0, n: 3 }; }
    return (String(r[0]).indexOf(" - ") >= 0) ? { t: 6, n: 7 } : { t: 4, n: 5 };
  }
  function clSheet(p) {
    var cols = p.cols || [], rows = p.rows || [], rn = 1, out = [];
    out.push('<row r="' + rn + '">' + tcell(0, rn, p.title, 1) + "</row>"); rn++;
    (p.meta || []).forEach(function (x) { out.push('<row r="' + rn + '">' + tcell(0, rn, x.label || x.value, x.label ? 1 : 0) + (x.label ? tcell(1, rn, x.value, 0) : "") + "</row>"); rn++; });
    out.push('<row r="' + rn + '"></row>'); rn++;
    out.push('<row r="' + rn + '">' + tcell(9, rn, "Contract Budget Baseline", 1) + "</row>"); rn++;
    out.push('<row r="' + rn + '">' + cols.map(function (h, i) { return tcell(i, rn, h, 1); }).join("") + "</row>"); rn++;
    rows.forEach(function (r) {
      var st = clRowStyle(r), cells = "";
      for (var i = 0; i < 9; i++) { cells += tcell(i, rn, r[i], st.t); }
      for (i = 9; i < 14; i++) { cells += (typeof r[i] === "number") ? ncell(i, rn, r[i], st.n) : tcell(i, rn, r[i] || "", st.t); }
      out.push('<row r="' + rn + '">' + cells + "</row>"); rn++;
    });
    return sheet(out.join(""));
  }
  function clPdf(p) {
    var cols = p.cols || [], rows = p.rows || [];
    var money = function (v) { return (typeof v === "number") ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : xesc(v); };
    var metaHtml = (p.meta || []).map(function (x) { return x.label ? "<span><b>" + xesc(x.label) + ":</b> " + xesc(x.value) + "</span>" : "<span>" + xesc(x.value) + "</span>"; }).join(" &nbsp;&nbsp; ");
    var left = cols.slice(0, 9), cbb = cols.slice(9);
    var thead = "<thead><tr>" + left.map(function (h) { return '<th rowspan="2" class="d">' + xesc(h) + "</th>"; }).join("") + '<th colspan="5">Contract Budget Baseline</th></tr><tr>' + cbb.map(function (h) { return "<th>" + xesc(h) + "</th>"; }).join("") + "</tr></thead>";
    var body = rows.map(function (r) {
      var isSum = !String(r[8]).trim(), gold = isSum && String(r[0]).indexOf(" - ") >= 0, cls = gold ? "gold" : (isSum ? "blue" : "");
      var cells = "";
      for (var i = 0; i < 9; i++) { cells += '<td class="d">' + xesc(r[i]) + "</td>"; }
      for (i = 9; i < 14; i++) { cells += '<td class="num">' + money(r[i]) + "</td>"; }
      return '<tr class="' + cls + '">' + cells + "</tr>";
    }).join("");
    var css = "@page{size:A4 landscape;margin:8mm;}table{font-size:6.5px;}th,td{text-align:right;}th{text-align:center;}td.d,th.d{text-align:left;}tr.blue td{background:#BDD7EE;}tr.gold td{background:#FFE699;}";
    return pdfDoc("Program Control Log", p.title || "Program Control Log", metaHtml, css, "<table>" + thead + "<tbody>" + body + "</tbody></table>");
  }

  // ================= dispatch =================
  var EXCEL = {
    wbs: function (p) { download("WBS Dictionary", wbsSheet(p), "WBS_Dictionary_" + fileTag(p.meta && p.meta.project, "WBS") + ".xlsx"); },
    ram: function (p) { download("RAM", ramSheet(p), "RAM_" + fileTag(p.meta && p.meta.project, "RAM") + ".xlsx"); },
    cap: function (p) { download(p.view === "summary" ? "Summary" : "Time-Phased", p.view === "summary" ? capSummarySheet(p.summary) : capTpSheet(p.tp), "CAP_" + (p.view === "summary" ? "Summary" : "TimePhased") + ".xlsx"); },
    tripwire: function (p) { download("Tripwire", twSheet(p), "Tripwire_Report.xlsx"); },
    controllog: function (p) { download("Control Log", clSheet(p), "Program_Control_Log.xlsx"); }
  };
  var PDF = { wbs: wbsPdf, ram: ramPdf, cap: capPdf, tripwire: twPdf, controllog: clPdf };

  return {
    excel: function (kind, payload) { if (EXCEL[kind]) { EXCEL[kind](payload || {}); } },
    pdf: function (kind, payload) { if (PDF[kind]) { printHtml(PDF[kind](payload || {})); } }
  };
});
