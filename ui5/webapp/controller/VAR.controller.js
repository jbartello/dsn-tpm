sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/HashChanger",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast",
  "sap/m/Dialog",
  "sap/m/Button",
  "sap/m/TextArea",
  "sap/m/Label",
  "sap/m/Text",
  "sap/m/VBox"
], function (Controller, HashChanger, JSONModel, MessageToast, Dialog, Button, TextArea, Label, Text, VBox) {
  "use strict";

  function fmtM(v) {
    var a = Math.abs(v), s = v < 0 ? "-" : "";
    return a >= 1e6 ? s + "$" + (a / 1e6).toFixed(1) + "M"
      : a >= 1e3 ? s + "$" + (a / 1e3).toFixed(0) + "K"
        : s + "$" + a.toFixed(0);
  }
  // CV/SV % status against period tolerance (red -10%, yellow -5%)
  function pctStatus(pct) { return pct <= -10 ? "out" : (pct <= -5 ? "watch" : "ok"); }
  function stateOf(st) { return st === "out" ? "Error" : (st === "watch" ? "Warning" : "Success"); }
  function statusText(st) { return st === "out" ? "Out" : (st === "watch" ? "Watch" : "In tol."); }

  // Derive a plausible CAM email from the manager name (fictional demo data).
  function camEmail(name) {
    var n = (name || "").trim();
    if (n.indexOf(" ") > -1) { var parts = n.split(/\s+/); return (parts[0][0] + parts.slice(1).join("")).toLowerCase() + "@dassian.com"; }
    return n.toLowerCase() + "@dassian.com";
  }

  // Plain-language variance narrative (ported from the prototype).
  function narrative(a) {
    function seg(label, pct, prior, status, idxName, idxVal) {
      var where = status === "out" ? "is out of tolerance" : "is approaching the tolerance limit";
      var worsened = pct < prior, swing = Math.abs(pct - prior).toFixed(1);
      var trend = worsened
        ? "degraded from " + prior.toFixed(1) + "% last period — an unfavorable swing of " + swing + " pts"
        : "improved from " + prior.toFixed(1) + "% last period (+" + swing + " pts) but remains beyond tolerance";
      return label + " " + where + " at " + pct.toFixed(1) + "% (" + idxName + " " + idxVal.toFixed(2) + "), " + trend + ".";
    }
    var parts = [];
    if (a.flagCV) { parts.push(seg("Cost variance", a.cvp, a.priorCVpct, a.cvStatus, "CPI", a.cpi)); }
    if (a.flagSV) { parts.push(seg("Schedule variance", a.svp, a.priorSVpct, a.svStatus, "SPI", a.spi)); }
    return parts.join(" ");
  }

  return Controller.extend("dassian.tpm.ui5.controller.VAR", {
    onInit: function () {
      this.getView().setModel(new JSONModel({ items: [], all: [], sum: {} }), "narr");
      this._load();
    },
    _prog: function () { return this.getOwnerComponent().getModel("ui").getProperty("/program"); },
    onProgramChange: function () { this._load(); },

    _load: function () {
      var prog = this._prog(), model = this.getOwnerComponent().getModel(), that = this;
      model.bindList("/ControlAccounts").requestContexts(0, 500).then(function (ctxs) {
        var items = [], all = [], totBac = 0, wCPIn = 0, wSPIn = 0, totCV = 0, totSV = 0;
        ctxs.forEach(function (c) {
          var o = c.getObject();
          if (o.ProgramID !== prog) { return; }
          var bcws = parseFloat(o.PlannedValue) || 0, bcwp = parseFloat(o.EarnedValue) || 0, acwp = parseFloat(o.ActualCost) || 0;
          var cpi = parseFloat(o.CPI) || 0, spi = parseFloat(o.SPI) || 0;
          var cv = bcwp - acwp, cvp = bcwp ? cv / bcwp * 100 : 0;
          var sv = bcwp - bcws, svp = bcws ? sv / bcws * 100 : 0;
          var vac = parseFloat(o.VAC) || 0, bac = parseFloat(o.BAC) || 0, eac = parseFloat(o.EAC) || 0;
          var cvStatus = pctStatus(cvp), svStatus = pctStatus(svp);
          var flagCV = bcwp > 0 && cvStatus !== "ok", flagSV = bcwp > 0 && svStatus !== "ok";

          // program rollup (BAC-weighted, only accounts with earned value)
          if (bcwp > 0) { totBac += bac; wCPIn += cpi * bac; wSPIn += spi * bac; totCV += cv; totSV += sv; }

          var rowStatus = (cvStatus === "out" || svStatus === "out") ? "out" : ((cvStatus === "watch" || svStatus === "watch") ? "watch" : "ok");
          all.push({
            wbs: o.ID, desc: o.Description, cam: o.Manager,
            cvpT: cvp.toFixed(1) + "%", svpT: svp.toFixed(1) + "%", cvState: stateOf(cvStatus), svState: stateOf(svStatus),
            cpiT: cpi.toFixed(2), spiT: spi.toFixed(2),
            trend: rowStatus !== "ok" ? "▼ degrading" : "▲ stable/improving", trendState: rowStatus !== "ok" ? "Error" : "Success",
            status: statusText(rowStatus), statusState: stateOf(rowStatus)
          });

          if (!(flagCV || flagSV)) { return; }
          var item = {
            id: o.ID, wbs: o.ID, desc: o.Description, cam: o.Manager, email: camEmail(o.Manager),
            bcws: bcws, bcwp: bcwp, acwp: acwp, cv: cv, cvp: cvp, sv: sv, svp: svp, vac: vac, bac: bac, eac: eac, cpi: cpi, spi: spi,
            cvStatus: cvStatus, svStatus: svStatus, flagCV: flagCV, flagSV: flagSV,
            priorCVpct: cvp + 2.6, priorSVpct: svp + 2.6,
            bcwsT: fmtM(bcws), bcwpT: fmtM(bcwp), acwpT: fmtM(acwp),
            cvT: fmtM(cv) + " / " + cvp.toFixed(1) + "%", svT: fmtM(sv) + " / " + svp.toFixed(1) + "%", vacT: fmtM(vac),
            cpiT: cpi.toFixed(3), spiT: spi.toFixed(3),
            cvPillState: stateOf(cvStatus), svPillState: stateOf(svStatus),
            rc: "", im: "", ca: "", gw: "", approved: false, aiDrafted: false, notified: false
          };
          item.narr = narrative(item);
          items.push(item);
        });
        // worst first
        items.sort(function (a, b) { return a.cvp - b.cvp; });
        var wCPI = totBac ? wCPIn / totBac : 0, wSPI = totBac ? wSPIn / totBac : 0;
        var cvAgg = totBac ? totCV / totBac * 100 : 0, svAgg = totBac ? totSV / totBac * 100 : 0;
        var sum = {
          cpiT: wCPI.toFixed(2), cpiState: wCPI >= 1 ? "Success" : (wCPI >= 0.95 ? "Warning" : "Error"), cpiSub: wCPI >= 1 ? "Favorable" : "Unfavorable",
          spiT: wSPI.toFixed(2), spiState: wSPI >= 1 ? "Success" : (wSPI >= 0.95 ? "Warning" : "Error"), spiSub: wSPI >= 1 ? "On / ahead" : "Behind",
          cvT: fmtM(totCV) + " (" + cvAgg.toFixed(1) + "%)", cvState: stateOf(pctStatus(cvAgg)),
          svT: fmtM(totSV) + " (" + svAgg.toFixed(1) + "%)", svState: stateOf(pctStatus(svAgg)),
          alerts: String(items.length), alertState: items.length ? "Error" : "Success", alertSub: items.length ? "Need attention" : "All in tolerance"
        };
        that.getView().getModel("narr").setData({ items: items, all: all, sum: sum });
      });
    },

    onAiDraft: function (evt) {
      var ctx = evt.getSource().getBindingContext("narr"), o = ctx.getObject(), m = this.getView().getModel("narr"), p = ctx.getPath();
      m.setProperty(p + "/rc", "[AI draft — confirm] The data shows " + o.cvT + " cost and " + o.svp.toFixed(1) +
        "% schedule variance — ACWP exceeded BCWP while BCWP trailed BCWS. The numbers show the magnitude, not the reason. ROOT CAUSE REQUIRES ANALYST / CAM INPUT.");
      m.setProperty(p + "/im", "[AI draft — confirm] Estimate at completion is " + fmtM(o.eac) + " vs BAC " + fmtM(o.bac) +
        " (VAC " + o.vacT + "). Quantify schedule impact to milestones with the CAM.");
      m.setProperty(p + "/ca", "[AI draft — template] Owner: [name]. Action: [corrective step]. Get-well: [date]. The AI cannot propose a real corrective action — supply the plan.");
      m.setProperty(p + "/aiDrafted", true);
    },

    onApprove: function (evt) {
      var ctx = evt.getSource().getBindingContext("narr");
      this.getView().getModel("narr").setProperty(ctx.getPath() + "/approved", true);
    },

    onNotifyCAM: function (evt) {
      var ctx = evt.getSource().getBindingContext("narr"), a = ctx.getObject(), that = this, path = ctx.getPath();
      var body = a.cam + ",\n\n" +
        "The following control account requires a corrective-action review:\n\n" +
        "WBS: " + a.wbs + " — " + a.desc + "\n" +
        "CAM: " + a.cam + "\n\n" +
        a.narr + "\n\n" +
        "Cost: CPI " + a.cpi.toFixed(2) + ", CV " + a.cvp.toFixed(1) + "%\n" +
        "Schedule: SPI " + a.spi.toFixed(2) + ", SV " + a.svp.toFixed(1) + "%\n\n" +
        "Please initiate a corrective-action plan and reply with proposed mitigation steps and revised target dates.\n\n" +
        "— Dassian Total Program Management";
      var ta = new TextArea({ value: body, rows: 12, width: "100%", growing: true });
      var dlg = new Dialog({
        title: "Send to Control Account Manager",
        contentWidth: "36rem",
        content: [new VBox({ items: [
          new Label({ text: "To" }), new Text({ text: a.cam + " <" + a.email + ">" }),
          new Label({ text: "Subject", class: "sapUiSmallMarginTop" }), new Text({ text: "Variance Alert — " + a.wbs }),
          new Label({ text: "Message", class: "sapUiSmallMarginTop" }), ta,
          new Text({ text: "Prototype — creates a corrective-action workflow task and drafts the CAM email. No message is actually sent.", class: "sapUiSmallMarginTop" })
        ] }).addStyleClass("sapUiSmallMargin")],
        beginButton: new Button({ text: "Create workflow & draft email", type: "Emphasized", press: function () {
          that.getView().getModel("narr").setProperty(path + "/notified", true);
          MessageToast.show("Corrective-action workflow created; email drafted to " + a.cam);
          dlg.close();
        } }),
        endButton: new Button({ text: "Cancel", press: function () { dlg.close(); } }),
        afterClose: function () { dlg.destroy(); }
      });
      this.getView().addDependent(dlg);
      dlg.open();
    },

    onNavBack: function () { HashChanger.getInstance().setHash(""); }
  });
});
