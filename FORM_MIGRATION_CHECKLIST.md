# Form migration checklist

Each listed form has an **ANALYZED** status for static source inventory (identity, area, handlers, representative controls, direct DB references and visible dependencies). This status does not mean behavior has been fully specified or parity verified. Mark READY only after exact formulas, validations, permissions, side effects, keyboard flow, and output are captured.

| Form | Area | Status | Behavior/parity note |
|---|---|---|---|
| `Form1` | Form1.vb | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmMain` | frmMain.vb | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmULogin` | frmULogin.vb | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmDispose` | Modules/Disposes/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmAccountsBalances` | Modules/Finance/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmChequesManagement` | Modules/Finance/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmClientsLateMove` | Modules/Finance/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmFinanceReports` | Modules/Finance/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmInvociesReconciliation` | Modules/Finance/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmPayment` | Modules/Finance/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmPaymentsManagement` | Modules/Finance/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmTransactionsManagement` | Modules | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmApprovement` | Modules/Insurance/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmBillLimitExceptions` | Modules/Insurance/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmCopyContract` | Modules/Insurance/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmInsuranceExceptionsSettings` | Modules/Insurance/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmInsuranceGroupItems` | Modules/Insurance/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmInsuranceSettings` | Modules/Insurance/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmNewInsuranceContarct` | Modules/Insurance/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmNewInsuranceContarctException` | Modules/Insurance/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmOutOfInsuranceItems` | Modules/Insurance/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmSync` | Modules/Insurance/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmNewPurchase` | Modules/Purchase/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmReturnPurchases` | Modules/Purchase/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmGRNArchive` | Modules/Reporting/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmInvoicesArchive` | Modules/Reporting/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmSalesReports` | Modules/Reporting/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmStockReports` | Modules/Reporting/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmNewRequest` | Modules/Requests/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmCashier` | Modules/Sales/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmFindBills` | Modules/Sales/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmPackages` | Modules/Sales/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmPharmacySales` | Modules/Sales/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmPharmacySalesBills` | Modules/Sales/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmPOSSales` | Modules/Sales/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmReturnInsuranceSales` | Modules/Sales/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmReturnSales` | Modules/Sales/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmSalesBills` | Modules/Sales/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmSalesBillsPlus` | Modules/Sales/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmUpdatePatchDetails` | Modules/Sales/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmBanks` | Modules/Settings/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmBenefits` | Modules/Settings/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmCategories` | Modules/Settings/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmCities` | Modules/Settings/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmCustomers` | Modules/Settings/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmGenerics` | Modules/Settings/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmInsuranceCompany` | Modules/Settings/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmInsuranceGroups` | Modules/Settings/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmItems` | Modules/Settings/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmItemsSelection` | Modules/Settings/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmManufacturers` | Modules/Settings/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmSalesMen` | Modules/Settings/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmSettingsItems` | Modules/Settings/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmUnits` | Modules/Settings/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmStock` | Modules/Stock/Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmPrivileges` | Modules/User Managment | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmUsersManagements` | Modules/User Managment | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `EliteMsgBox` | Public Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmAboutUs` | Public Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmApearance` | Public Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmChangePassword` | Public Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmCompany` | Public Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmMapBranches` | Public Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmNotification` | Public Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmSearchItem` | Public Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `frmSelectDate` | Public Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |
| `ReportViewer` | Public Forms | ANALYZED | Functional walkthrough and old/new parity verification pending |

Allowed status values: NOT STARTED, ANALYZED, READY, IN PROGRESS, MIGRATED, VERIFIED.
