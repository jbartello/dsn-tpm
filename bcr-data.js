/* ------------------------------------------------------------------
   Baseline Change Request (BCR) prototype data.
   Field set follows the EIA-748 / DOE model used across EVM tools
   (Deltek Cobra/PM Compass, Encore Empower): typed change requests
   (BCR-P internal replan, BCR-M MR allocation, BCR-C CBB/scope,
   FCR forecast/EAC), a budget-movement ledger, and before/after
   baseline values where CBB = PMB + MR - Overrun must hold.

   Each record carries summary fields (always present) used by the
   log list, plus optional detail consumed by the slide-out form.
   Money is whole USD; the form normalizes missing arrays to a blank
   row so terse records still open cleanly.
------------------------------------------------------------------ */
window.BCR_REQUESTS = [

  /* ---- DEMO program (JTB001) ---- */
  {
    id: 'BCR-2026-002', rev: '0', prog: 'DEMO',
    title: 'Reallocate Management Reserve for sensor re-qualification',
    contract: 'FA8xxx-24-C-0012', dateSubmitted: '03/14/2026',
    originator: 'Jason Bartello', priority: 'Routine',
    customerDirected: false, customerRef: '',
    type: 'BCR-M', affects: { scope: false, budget: true, schedule: true },
    retro: false, retroJust: '',
    driver: 'SOW 3.2.1 — supplier first-article inspection failure (risk realized)',
    description: 'Allocate $185,000 / 1,200 hrs from Management Reserve to CA JTB001.1 (Air Vehicle) to fund a second-source sensor qualification effort and a 3-week added integration window.',
    justification: 'Primary sensor supplier failed first-article inspection; previously identified schedule/cost risk has been realized. MR allocation is the approved retirement path.',
    impactIfNot: 'Integration test slips ~4 weeks, consuming all remaining float and jeopardizing the Air Vehicle milestone.',
    affectedWork: [
      { wbs: 'JTB001.1', ca: 'JTB001.1', wp: 'JTB001.1.4', cam: 'Jason Bartello', obs: 'Avionics IPT' },
    ],
    budgetMoves: [
      { from: 'Management Reserve', to: 'CA JTB001.1 / WP JTB001.1.4', eoc: 'Labor', hours: 1000, dollars: 150000 },
      { from: 'Management Reserve', to: 'CA JTB001.1 / WP JTB001.1.4', eoc: 'ODC', hours: 0, dollars: 35000 },
    ],
    baseline: {
      cbb:  { before: 7647518, change: 0 },
      pmb:  { before: 7347518, change: 185000 },
      mr:   { before: 300000,  change: -185000 },
      ub:   { before: 0,       change: 0 },
      eac:  { before: 7720000, change: 185000 },
    },
    schedule: [
      { milestone: 'WP JTB001.1.4 Sensor Integration Test', before: '08/14/2026', after: '09/04/2026', variance: '+21d' },
    ],
    approvals: [
      { role: 'Control Account Manager', name: 'Jason Bartello', date: '03/14/2026', decision: 'Approved' },
      { role: 'Program / Project Manager', name: 'L. Ortiz', date: '03/15/2026', decision: 'Approved' },
      { role: 'Business / Control (EVM Analyst)', name: 'Jason Bartello', date: '03/14/2026', decision: 'Approved' },
      { role: 'Change Control Board (CCB) Chair', name: 'L. Ortiz', date: '03/16/2026', decision: 'Approved' },
      { role: 'Customer / Contracting Officer', name: '', date: '', decision: 'N/A' },
    ],
    disposition: 'Approved', effectiveMonth: 'Mar-2026', logEntry: 'CCL-0031', implemented: true, implementedDate: '03/17/2026',
    status: 'Approved',
  },

  {
    id: 'BCR-2026-005', rev: '0', prog: 'DEMO',
    title: 'Internal replan — Air Vehicle integration sequence',
    contract: 'FA8xxx-24-C-0012', dateSubmitted: '04/02/2026',
    originator: 'Allen Ytzen', priority: 'Routine',
    customerDirected: false, customerRef: '',
    type: 'BCR-P', affects: { scope: false, budget: true, schedule: true },
    retro: false, retroJust: '',
    driver: 'Internal optimization — resequence integration to level avionics labor',
    description: 'Move $60,000 / 400 hrs of distributed budget from CA JTB001.3 (Data) to CA JTB001.1 (Air Vehicle) to align with a revised integration sequence. No change to CBB, PMB total, or MR.',
    justification: 'Re-sequencing levels avionics labor demand and removes a near-term resource conflict identified in the IMS.',
    impactIfNot: 'Resource conflict in May drives overtime premium and a likely SPI dip on Air Vehicle.',
    affectedWork: [
      { wbs: 'JTB001.1', ca: 'JTB001.1', wp: 'JTB001.1.2', cam: 'Jason Bartello', obs: 'Avionics IPT' },
      { wbs: 'JTB001.3', ca: 'JTB001.3', wp: 'JTB001.3.1', cam: 'Allen Ytzen', obs: 'Data IPT' },
    ],
    budgetMoves: [
      { from: 'CA JTB001.3 / Data', to: 'CA JTB001.1 / Air Vehicle', eoc: 'Labor', hours: 400, dollars: 60000 },
    ],
    baseline: {
      cbb:  { before: 7647518, change: 0 },
      pmb:  { before: 7347518, change: 0 },
      mr:   { before: 300000,  change: 0 },
      ub:   { before: 0,       change: 0 },
      eac:  { before: 7720000, change: 0 },
    },
    schedule: [
      { milestone: 'Air Vehicle Integration Start', before: '05/04/2026', after: '04/27/2026', variance: '-5d' },
    ],
    approvals: [
      { role: 'Control Account Manager', name: 'Allen Ytzen', date: '04/02/2026', decision: 'Approved' },
      { role: 'Program / Project Manager', name: 'L. Ortiz', date: '04/03/2026', decision: 'Approved' },
      { role: 'Business / Control (EVM Analyst)', name: 'Jason Bartello', date: '04/02/2026', decision: 'Approved' },
      { role: 'Change Control Board (CCB) Chair', name: 'L. Ortiz', date: '04/04/2026', decision: 'Approved' },
      { role: 'Customer / Contracting Officer', name: '', date: '', decision: 'N/A' },
    ],
    disposition: 'Approved', effectiveMonth: 'Apr-2026', logEntry: 'CCL-0036', implemented: true, implementedDate: '04/05/2026',
    status: 'Approved',
  },

  {
    id: 'BCR-2026-008', rev: '1', prog: 'DEMO',
    title: 'Customer-directed scope add — additional data deliverable',
    contract: 'FA8xxx-24-C-0012', dateSubmitted: '05/20/2026',
    originator: 'Jason Bartello', priority: 'Urgent',
    customerDirected: true, customerRef: 'ECP-0042 / Mod P00007',
    type: 'BCR-C', affects: { scope: true, budget: true, schedule: false },
    retro: false, retroJust: '',
    driver: 'Customer ECP-0042 — added monthly cyber compliance report (CDRL A012)',
    description: 'Authorize $120,000 of new contract scope into Undistributed Budget, then distribute to CA JTB001.3 (Data) for a new recurring data deliverable. Increases CBB.',
    justification: 'Customer-directed scope addition under Mod P00007. Budget enters UB pending negotiation of the CA-level plan with the CAM.',
    impactIfNot: 'Contract non-compliance with newly directed CDRL A012.',
    affectedWork: [
      { wbs: 'JTB001.3', ca: 'JTB001.3', wp: '(TBD at distribution)', cam: 'Allen Ytzen', obs: 'Data IPT' },
    ],
    budgetMoves: [
      { from: 'Contract scope (Mod P00007)', to: 'Undistributed Budget', eoc: 'Labor', hours: 700, dollars: 95000 },
      { from: 'Contract scope (Mod P00007)', to: 'Undistributed Budget', eoc: 'ODC', hours: 0, dollars: 25000 },
    ],
    baseline: {
      cbb:  { before: 7647518, change: 120000 },
      pmb:  { before: 7347518, change: 120000 },
      mr:   { before: 300000,  change: 0 },
      ub:   { before: 0,       change: 120000 },
      eac:  { before: 7720000, change: 120000 },
    },
    schedule: [
      { milestone: '', before: '', after: '', variance: '' },
    ],
    approvals: [
      { role: 'Control Account Manager', name: 'Allen Ytzen', date: '05/20/2026', decision: 'Approved' },
      { role: 'Program / Project Manager', name: 'L. Ortiz', date: '05/21/2026', decision: 'Approved' },
      { role: 'Business / Control (EVM Analyst)', name: 'Jason Bartello', date: '05/20/2026', decision: 'Approved' },
      { role: 'Change Control Board (CCB) Chair', name: 'L. Ortiz', date: '', decision: 'Pending' },
      { role: 'Customer / Contracting Officer', name: 'D. Pruitt (KO)', date: '', decision: 'Pending' },
    ],
    disposition: 'Pending CCB', effectiveMonth: '', logEntry: '', implemented: false, implementedDate: '',
    status: 'Submitted',
  },

  {
    id: 'BCR-2026-011', rev: '0', prog: 'DEMO',
    title: 'Forecast update — labor rate escalation',
    contract: 'FA8xxx-24-C-0012', dateSubmitted: '06/05/2026',
    originator: 'Richard Reed', priority: 'Routine',
    customerDirected: false, customerRef: '',
    type: 'FCR', affects: { scope: false, budget: false, schedule: false },
    retro: false, retroJust: '',
    driver: 'Approved FY26 forward pricing rate increase (+3.1% composite labor)',
    description: 'Update EAC for the approved FY26 labor rate escalation. Forecast/EAC only — no change to PMB, MR, or CBB.',
    justification: 'New DCAA-approved forward pricing rates raise the cost-to-complete; baseline budgets are unaffected (FCR, not a budget change).',
    impactIfNot: 'EAC understated; VAC trend would mislead management review.',
    affectedWork: [
      { wbs: 'JTB001', ca: '(all open CAs)', wp: '', cam: 'Various', obs: 'Program' },
    ],
    budgetMoves: [
      { from: '', to: '', eoc: '', hours: 0, dollars: 0 },
    ],
    baseline: {
      cbb:  { before: 7647518, change: 0 },
      pmb:  { before: 7347518, change: 0 },
      mr:   { before: 300000,  change: 0 },
      ub:   { before: 0,       change: 0 },
      eac:  { before: 7720000, change: 96000 },
    },
    schedule: [
      { milestone: '', before: '', after: '', variance: '' },
    ],
    approvals: [
      { role: 'Control Account Manager', name: 'Richard Reed', date: '06/05/2026', decision: 'Approved' },
      { role: 'Program / Project Manager', name: 'L. Ortiz', date: '', decision: 'Pending' },
      { role: 'Business / Control (EVM Analyst)', name: 'Jason Bartello', date: '06/05/2026', decision: 'Approved' },
      { role: 'Change Control Board (CCB) Chair', name: '', date: '', decision: 'Pending' },
      { role: 'Customer / Contracting Officer', name: '', date: '', decision: 'N/A' },
    ],
    disposition: 'In Review', effectiveMonth: '', logEntry: '', implemented: false, implementedDate: '',
    status: 'In Review',
  },

  {
    id: 'BCR-2026-013', rev: '0', prog: 'DEMO',
    title: 'Allocate remaining MR to Training risk reserve',
    contract: 'FA8xxx-24-C-0012', dateSubmitted: '06/14/2026',
    originator: 'Allen Ytzen', priority: 'Routine',
    customerDirected: false, customerRef: '',
    type: 'BCR-M', affects: { scope: false, budget: true, schedule: false },
    retro: false, retroJust: '',
    driver: 'Training courseware vendor risk — drafting MR allocation for CCB',
    description: 'Draft request to allocate $40,000 from Management Reserve to CA JTB001.4 (Training) to cover courseware rework risk.',
    justification: 'Courseware vendor performance trending below plan; reserving budget ahead of a likely rework.',
    impactIfNot: 'If risk materializes without reserve, would require an unplanned replan.',
    affectedWork: [
      { wbs: 'JTB001.4', ca: 'JTB001.4', wp: 'JTB001.4.1', cam: 'Allen Ytzen', obs: 'Training IPT' },
    ],
    budgetMoves: [
      { from: 'Management Reserve', to: 'CA JTB001.4 / Training', eoc: 'Labor', hours: 280, dollars: 40000 },
    ],
    baseline: {
      cbb:  { before: 7647518, change: 0 },
      pmb:  { before: 7347518, change: 40000 },
      mr:   { before: 300000,  change: -40000 },
      ub:   { before: 0,       change: 0 },
      eac:  { before: 7720000, change: 40000 },
    },
    schedule: [
      { milestone: '', before: '', after: '', variance: '' },
    ],
    approvals: [
      { role: 'Control Account Manager', name: 'Allen Ytzen', date: '06/14/2026', decision: 'Approved' },
      { role: 'Program / Project Manager', name: '', date: '', decision: 'Pending' },
      { role: 'Business / Control (EVM Analyst)', name: '', date: '', decision: 'Pending' },
      { role: 'Change Control Board (CCB) Chair', name: '', date: '', decision: 'Pending' },
      { role: 'Customer / Contracting Officer', name: '', date: '', decision: 'N/A' },
    ],
    disposition: 'Draft', effectiveMonth: '', logEntry: '', implemented: false, implementedDate: '',
    status: 'Draft',
  },

  /* ---- MFG program (DD-*) ---- */
  {
    id: 'BCR-2026-003', rev: '0', prog: 'MFG',
    title: 'Internal replan — Common Support Equipment de-scope',
    contract: 'N0001924C0099', dateSubmitted: '03/28/2026',
    originator: 'Richard Reed', priority: 'Routine',
    customerDirected: false, customerRef: '',
    type: 'BCR-P', affects: { scope: false, budget: true, schedule: false },
    retro: false, retroJust: '',
    driver: 'Make-vs-buy decision moved CSE effort to existing subcontract',
    description: 'Shift $250,000 of distributed budget from CA DD-0001.1.8 (Common Support Equipment) to CA DD-0001.1.4 (System Test & Evaluation). PMB total unchanged.',
    justification: 'Make/buy board moved CSE fabrication to an existing subcontract, freeing internal budget needed for added test articles.',
    impactIfNot: 'Test article shortfall risks an SPI breach on System Test.',
    affectedWork: [
      { wbs: 'DD-0001.1.8', ca: 'DD-0001.1.8', wp: '', cam: 'EHAYES', obs: 'Production' },
      { wbs: 'DD-0001.1.4', ca: 'DD-0001.1.4', wp: '', cam: 'EHAYES', obs: 'Test & Eval' },
    ],
    budgetMoves: [
      { from: 'CA DD-0001.1.8 / CSE', to: 'CA DD-0001.1.4 / System Test', eoc: 'Labor', hours: 1600, dollars: 250000 },
    ],
    baseline: {
      cbb:  { before: 485200000, change: 0 },
      pmb:  { before: 477200000, change: 0 },
      mr:   { before: 8000000,   change: 0 },
      ub:   { before: 0,         change: 0 },
      eac:  { before: 493000000, change: 0 },
    },
    schedule: [{ milestone: '', before: '', after: '', variance: '' }],
    approvals: [
      { role: 'Control Account Manager', name: 'EHAYES', date: '03/28/2026', decision: 'Approved' },
      { role: 'Program / Project Manager', name: 'M. Cole', date: '03/29/2026', decision: 'Approved' },
      { role: 'Business / Control (EVM Analyst)', name: 'Jason Bartello', date: '03/28/2026', decision: 'Approved' },
      { role: 'Change Control Board (CCB) Chair', name: 'M. Cole', date: '03/30/2026', decision: 'Approved' },
      { role: 'Customer / Contracting Officer', name: '', date: '', decision: 'N/A' },
    ],
    disposition: 'Approved', effectiveMonth: 'Mar-2026', logEntry: 'CCL-M-0014', implemented: true, implementedDate: '03/31/2026',
    status: 'Approved',
  },

  {
    id: 'BCR-2026-006', rev: '0', prog: 'MFG',
    title: 'MR allocation to System Test & Evaluation overrun',
    contract: 'N0001924C0099', dateSubmitted: '04/22/2026',
    originator: 'EHAYES', priority: 'Urgent',
    customerDirected: false, customerRef: '',
    type: 'BCR-M', affects: { scope: false, budget: true, schedule: true },
    retro: false, retroJust: '',
    driver: 'Realized risk — additional environmental test cycles required',
    description: 'Allocate $1,200,000 / 6,000 hrs from Management Reserve to CA DD-0001.1.4 (System Test & Evaluation) for additional environmental qualification cycles.',
    justification: 'Two additional thermal-vac cycles directed by the qualification board; cost previously carried as a top program risk.',
    impactIfNot: 'Qualification slips into the next fiscal quarter, delaying first delivery.',
    affectedWork: [
      { wbs: 'DD-0001.1.4', ca: 'DD-0001.1.4', wp: '', cam: 'EHAYES', obs: 'Test & Eval' },
    ],
    budgetMoves: [
      { from: 'Management Reserve', to: 'CA DD-0001.1.4 / System Test', eoc: 'Labor', hours: 6000, dollars: 1200000 },
    ],
    baseline: {
      cbb:  { before: 485200000, change: 0 },
      pmb:  { before: 477200000, change: 1200000 },
      mr:   { before: 8000000,   change: -1200000 },
      ub:   { before: 0,         change: 0 },
      eac:  { before: 493000000, change: 1200000 },
    },
    schedule: [
      { milestone: 'Environmental Qual Complete', before: '07/10/2026', after: '08/07/2026', variance: '+28d' },
    ],
    approvals: [
      { role: 'Control Account Manager', name: 'EHAYES', date: '04/22/2026', decision: 'Approved' },
      { role: 'Program / Project Manager', name: 'M. Cole', date: '04/23/2026', decision: 'Approved' },
      { role: 'Business / Control (EVM Analyst)', name: 'Jason Bartello', date: '04/22/2026', decision: 'Approved' },
      { role: 'Change Control Board (CCB) Chair', name: 'M. Cole', date: '04/24/2026', decision: 'Approved' },
      { role: 'Customer / Contracting Officer', name: '', date: '', decision: 'N/A' },
    ],
    disposition: 'Approved', effectiveMonth: 'Apr-2026', logEntry: 'CCL-M-0019', implemented: true, implementedDate: '04/25/2026',
    status: 'Approved',
  },

  {
    id: 'BCR-2026-010', rev: '2', prog: 'MFG',
    title: 'Contingency release for Site Activation scope growth',
    contract: 'N0001924C0099', dateSubmitted: '05/12/2026',
    originator: 'Tim LaRue', priority: 'Routine',
    customerDirected: true, customerRef: 'ECP-0118',
    type: 'BCR-C', affects: { scope: true, budget: true, schedule: true },
    retro: false, retroJust: '',
    driver: 'Customer-requested second activation site (ECP-0118)',
    description: 'Request to release $3,500,000 of contingency into the CBB for a second operational activation site. Rejected by CCB pending negotiated price.',
    justification: 'Scope growth is real but the proposed value exceeds the independent estimate; CCB returned for re-estimate.',
    impactIfNot: 'Second site not funded until re-priced.',
    affectedWork: [
      { wbs: 'DD-0002.1.9', ca: 'DD-0002.1.9', wp: '', cam: 'Tim LaRue', obs: 'Site Activation' },
    ],
    budgetMoves: [
      { from: 'Contingency', to: 'Undistributed Budget', eoc: 'Mixed', hours: 0, dollars: 3500000 },
    ],
    baseline: {
      cbb:  { before: 485200000, change: 3500000 },
      pmb:  { before: 477200000, change: 3500000 },
      mr:   { before: 8000000,   change: 0 },
      ub:   { before: 0,         change: 3500000 },
      eac:  { before: 493000000, change: 3500000 },
    },
    schedule: [
      { milestone: 'Site 2 Activation Start', before: 'N/A', after: '10/01/2026', variance: 'new' },
    ],
    approvals: [
      { role: 'Control Account Manager', name: 'Tim LaRue', date: '05/12/2026', decision: 'Approved' },
      { role: 'Program / Project Manager', name: 'M. Cole', date: '05/13/2026', decision: 'Approved' },
      { role: 'Business / Control (EVM Analyst)', name: 'Jason Bartello', date: '05/12/2026', decision: 'Approved' },
      { role: 'Change Control Board (CCB) Chair', name: 'M. Cole', date: '05/15/2026', decision: 'Rejected' },
      { role: 'Customer / Contracting Officer', name: 'D. Pruitt (KO)', date: '', decision: 'Pending' },
    ],
    disposition: 'Rejected', effectiveMonth: '', logEntry: '', implemented: false, implementedDate: '',
    status: 'Rejected',
  },

  {
    id: 'BCR-2026-012', rev: '0', prog: 'MFG',
    title: 'Forecast update — raw material price increase',
    contract: 'N0001924C0099', dateSubmitted: '06/03/2026',
    originator: 'Richard Reed', priority: 'Routine',
    customerDirected: false, customerRef: '',
    type: 'FCR', affects: { scope: false, budget: false, schedule: false },
    retro: false, retroJust: '',
    driver: 'Supplier PPI increase on titanium stock (+9%)',
    description: 'Update EAC for a confirmed titanium price increase across Air Vehicle material accounts. Forecast/EAC only.',
    justification: 'Confirmed supplier price increase raises material cost-to-complete; baseline budgets unaffected.',
    impactIfNot: 'EAC and VAC trend understated at the next IPMDAR submission.',
    affectedWork: [
      { wbs: 'DD-0001.1', ca: 'DD-0001.1', wp: '', cam: 'EHAYES', obs: 'Production' },
    ],
    budgetMoves: [{ from: '', to: '', eoc: '', hours: 0, dollars: 0 }],
    baseline: {
      cbb:  { before: 485200000, change: 0 },
      pmb:  { before: 477200000, change: 0 },
      mr:   { before: 8000000,   change: 0 },
      ub:   { before: 0,         change: 0 },
      eac:  { before: 493000000, change: 1750000 },
    },
    schedule: [{ milestone: '', before: '', after: '', variance: '' }],
    approvals: [
      { role: 'Control Account Manager', name: 'EHAYES', date: '06/03/2026', decision: 'Approved' },
      { role: 'Program / Project Manager', name: 'M. Cole', date: '', decision: 'Pending' },
      { role: 'Business / Control (EVM Analyst)', name: 'Jason Bartello', date: '06/03/2026', decision: 'Approved' },
      { role: 'Change Control Board (CCB) Chair', name: '', date: '', decision: 'Pending' },
      { role: 'Customer / Contracting Officer', name: '', date: '', decision: 'N/A' },
    ],
    disposition: 'In Review', effectiveMonth: '', logEntry: '', implemented: false, implementedDate: '',
    status: 'In Review',
  },

];
