// ---------------------------------------------------------------------------
// Example ABAP CDS consumption view for the ControlAccount entity, carrying the
// same UI annotations the prototype keeps in webapp/annotations/annotations.xml.
// Illustrative — field/table names are placeholders for the real CO/EVM source.
// Author in ADT against the target system; do not run against a live system
// from the prototype repo.
// ---------------------------------------------------------------------------

@AccessControl.authorizationCheck: #CHECK
@EndUserText.label: 'TPM Control Account (EVM)'
@UI.headerInfo: {
  typeName: 'Control Account',
  typeNamePlural: 'Control Accounts',
  title:       { value: 'Description' },
  description: { value: 'ControlAccountID' }
}
define view entity C_TPMControlAccount
  as projection on I_TPMControlAccount   // interface view over the CO/EVM source
{
      @UI.facet: [
        { id: 'General', purpose: #STANDARD, type: #FIELDGROUP_REFERENCE,
          label: 'General Information', targetQualifier: 'Identity' },
        { id: 'EVM', purpose: #STANDARD, type: #FIELDGROUP_REFERENCE,
          label: 'Earned Value', targetQualifier: 'EVM' } ]

      @UI.lineItem:      [{ position: 10, label: 'WBS / CA' }]
      @UI.fieldGroup:    [{ qualifier: 'Identity', position: 10 }]
  key ControlAccountID,

      @UI.selectionField: [{ position: 10 }]
      @UI.fieldGroup:     [{ qualifier: 'Identity', position: 40 }]
      ProgramID,

      @UI.selectionField: [{ position: 20 }]
      @UI.fieldGroup:     [{ qualifier: 'Identity', position: 50 }]
      ProjectID,

      @UI.lineItem:   [{ position: 20, label: 'Description' }]
      @UI.fieldGroup: [{ qualifier: 'Identity', position: 20 }]
      Description,

      @UI.lineItem:       [{ position: 30, label: 'CAM' }]
      @UI.selectionField: [{ position: 30 }]
      @UI.fieldGroup:     [{ qualifier: 'Identity', position: 30 }]
      @EndUserText.label: 'Control Account Manager'
      Manager,

      @Semantics.amount.currencyCode: 'Currency'
      @UI.fieldGroup: [{ qualifier: 'EVM', position: 10 }]
      PlannedValue,
      @UI.fieldGroup: [{ qualifier: 'EVM', position: 20 }]
      EarnedValue,
      @UI.fieldGroup: [{ qualifier: 'EVM', position: 30 }]
      ActualCost,
      @UI.fieldGroup: [{ qualifier: 'EVM', position: 40 }]
      ScheduleVariance,
      @UI.fieldGroup: [{ qualifier: 'EVM', position: 50 }]
      CostVariance,

      @UI.lineItem:   [{ position: 40, label: 'BAC' }]
      @UI.fieldGroup: [{ qualifier: 'EVM', position: 60 }]
      BAC,
      @UI.lineItem:   [{ position: 50, label: 'EAC' }]
      @UI.fieldGroup: [{ qualifier: 'EVM', position: 70 }]
      EAC,

      @UI.dataPoint:  { title: 'VAC', criticality: 'VACCriticality' }
      @UI.lineItem:   [{ position: 60, label: 'VAC', type: #AS_DATAPOINT }]
      @UI.fieldGroup: [{ qualifier: 'EVM', position: 80, type: #AS_DATAPOINT }]
      VAC,

      @UI.dataPoint:  { title: 'CPI', criticality: 'CPICriticality' }
      @UI.lineItem:   [{ position: 70, label: 'CPI', type: #AS_DATAPOINT }]
      CPI,
      @UI.dataPoint:  { title: 'SPI', criticality: 'SPICriticality' }
      @UI.lineItem:   [{ position: 80, label: 'SPI', type: #AS_DATAPOINT }]
      SPI,

      // R/Y/G bands computed in CDS (1 = red, 2 = amber, 3 = green), exactly
      // like the *Criticality fields the mock pre-computes.
      @UI.hidden: true
      case when CPI >= 1   then 3
           when CPI >= 0.9 then 2
           else 1 end                                   as CPICriticality,
      @UI.hidden: true
      case when SPI >= 1   then 3
           when SPI >= 0.9 then 2
           else 1 end                                   as SPICriticality,
      @UI.hidden: true
      case when VAC >= 0         then 3
           when VAC >= -100000   then 2
           else 1 end                                   as VACCriticality,

      Currency,

      // Navigation to the project (Project object page's embedded CA table).
      _Project
}
