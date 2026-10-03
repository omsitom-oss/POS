# Database usage map

Static match of catalog names against VB source text; identifiers in SQL strings do not guarantee runtime execution. Dynamic SQL, helpers, report definitions, or code paths may evade this scan.

## Tables and source references
- `Accounts`: `frmAccountsBalances`, `frmPayment`, `frmBanks`
- `AccountTypes`: No static name match; further indirect/dynamic-use review required.
- `BasicSettings`: `frmMain`, `PublicVariables`
- `cash`: `frmFinanceReports`, `frmPharmacySales`
- `Cashier`: `frmMain`, `PublicVariables`, `frmCashier`, `frmPharmacySales`, `frmPOSSales`
- `Cheques`: `frmChequesManagement`, `frmFinanceReports`, `frmInvociesReconciliation`, `frmPayment`, `frmNotification`
- `Disposes`: `frmDispose`, `frmUpdatePatchDetails`
- `InsuranceContracts`: `FunctionsModule`, `InsuranceDataModule`, `frmBillLimitExceptions`, `frmInsuranceSettings`, `frmNewInsuranceContarct`, `frmNewInsuranceContarctException`, `frmOutOfInsuranceItems`, `frmPharmacySales`, `frmPharmacySalesBills`, `frmReturnInsuranceSales`, `frmSalesBillsPlus`, `frmItems`
- `InsuranceExceptions`: `InsuranceDataModule`, `frmBillLimitExceptions`, `frmInsuranceExceptionsSettings`, `frmInsuranceSettings`, `frmNewInsuranceContarctException`, `frmPharmacySales`, `frmPharmacySalesBills`, `frmReturnInsuranceSales`, `frmSalesBillsPlus`
- `InsuranceExceptionsGroups`: `frmInsuranceExceptionsSettings`, `frmInsuranceGroupItems`, `frmInsuranceSettings`
- `InsuranceGroups`: `frmInsuranceGroupItems`, `frmInsuranceSettings`
- `InsurancePriceList`: `InsuranceDataModule`, `frmInsuranceSettings`, `frmSalesBillsPlus`
- `InsuranceSales`: `frmFindBills`, `frmPharmacySales`, `frmPharmacySalesBills`, `frmReturnInsuranceSales`, `frmReturnSales`
- `InsuranceSalesTransactions`: `frmFindBills`, `frmPharmacySales`, `frmPharmacySalesBills`, `frmReturnInsuranceSales`
- `InvociesReconciliation`: `frmChequesManagement`, `frmFinanceReports`, `frmInvociesReconciliation`, `frmReturnSales`
- `NewTbl`: No static name match; further indirect/dynamic-use review required.
- `OutOfInsuranceItems`: `InsuranceDataModule`, `frmInsuranceSettings`, `frmOutOfInsuranceItems`, `frmSalesBillsPlus`, `frmItems`
- `OutOfInsuranceItemsExceptions`: `InsuranceDataModule`, `frmInsuranceExceptionsSettings`, `frmInsuranceSettings`, `frmSalesBillsPlus`
- `Payments`: `frmInvociesReconciliation`, `frmPayment`
- `Purchases`: `frmMain`, `frmTransactionsManagement`, `frmNewPurchase`, `frmReturnPurchases`, `frmGRNArchive`, `frmInvoicesArchive`, `frmPrivileges`
- `Requests`: `frmMain`, `frmGRNArchive`, `frmNewRequest`, `frmPrivileges`
- `Sales`: `frmMain`, `FunctionsModule`, `frmClientsLateMove`, `frmFinanceReports`, `frmInvociesReconciliation`, `frmGRNArchive`, `frmInvoicesArchive`, `frmSalesReports`, `frmPharmacySales`, `frmPharmacySalesBills`, `frmPOSSales`, `frmReturnSales`, `frmPrivileges`
- `SettingsBenefits`: `frmBenefits`
- `SettingsBranches`: `FunctionsModule`, `frmDispose`, `frmInvociesReconciliation`, `frmPayment`, `frmNewPurchase`, `frmReturnPurchases`, `frmSalesReports`, `frmNewRequest`, `frmFindBills`, `frmPharmacySales`, `frmPharmacySalesBills`, `frmPOSSales`, `frmReturnInsuranceSales`, `frmReturnSales`, `frmSalesBills`, `frmSalesBillsPlus`, `frmUpdatePatchDetails`, `frmStock`, `frmMapBranches`
- `SettingsBranchesMap`: `frmMain`, `InsuranceDataModule`, `frmPharmacySales`, `frmMapBranches`
- `SettingsCategories`: `frmInsuranceExceptionsSettings`, `frmInsuranceSettings`, `frmCategories`, `frmItems`, `frmItemsSelection`, `frmSettingsItems`
- `SettingsCities`: `frmCities`, `frmCustomers`
- `SettingsCompanyProfile`: `FunctionsModule`, `ReportsModule`, `frmFinanceReports`, `frmSalesReports`, `frmStockReports`, `EliteMsgBox`, `frmCompany`
- `SettingsGenerics`: `frmInsuranceExceptionsSettings`, `frmInsuranceSettings`, `frmOutOfInsuranceItems`, `frmGenerics`, `frmItems`, `frmItemsSelection`
- `SettingsInsuranceCompanies`: `FunctionsModule`, `frmCopyContract`, `frmNewInsuranceContarct`, `frmInsuranceCompany`
- `SettingsInsuranceExceptions`: `frmNewInsuranceContarctException`
- `SettingsInsuranceGroups`: `frmInsuranceExceptionsSettings`, `frmInsuranceGroupItems`, `frmInsuranceSettings`, `frmInsuranceGroups`
- `SettingsInsuranceGroupsItems`: `frmInsuranceExceptionsSettings`, `frmInsuranceGroupItems`, `frmInsuranceSettings`
- `SettingsItems`: `ReportsModule`, `frmDispose`, `InsuranceDataModule`, `frmInsuranceSettings`, `frmOutOfInsuranceItems`, `frmNewPurchase`, `frmReturnPurchases`, `frmSalesReports`, `frmStockReports`, `frmNewRequest`, `frmFindBills`, `frmPackages`, `frmPharmacySales`, `frmPharmacySalesBills`, `frmPOSSales`, `frmReturnInsuranceSales`, `frmReturnSales`, `frmSalesBills`, `frmSalesBillsPlus`, `frmUpdatePatchDetails`, `frmItems`, `frmItemsSelection`, `frmSettingsItems`, `frmStock`, `frmNotification`, `frmSearchItem`
- `SettingsManufacturers`: `frmItems`, `frmManufacturers`, `frmStock`
- `SettingsPackages`: `frmPackages`
- `SettingsPartners`: `FunctionsModule`, `frmTransactionsManagement`, `frmAccountsBalances`, `frmChequesManagement`, `frmClientsLateMove`, `frmFinanceReports`, `frmInvociesReconciliation`, `frmPayment`, `frmPaymentsManagement`, `frmNewPurchase`, `frmReturnPurchases`, `frmGRNArchive`, `frmInvoicesArchive`, `frmSalesReports`, `frmStockReports`, `frmCashier`, `frmPharmacySales`, `frmPharmacySalesBills`, `frmPOSSales`, `frmReturnSales`, `frmSalesBills`, `frmSalesBillsPlus`, `frmCustomers`, `frmInsuranceCompany`
- `SettingsSalesMen`: `frmTransactionsManagement`, `frmFinanceReports`, `frmInvociesReconciliation`, `frmSalesReports`, `frmCustomers`, `frmSalesMen`
- `SettingsUnits`: `frmItems`, `frmSettingsItems`, `frmUnits`
- `Stock`: `FunctionsModule`, `frmDispose`, `frmNewPurchase`, `frmReturnPurchases`, `frmNewRequest`, `frmPharmacySales`, `frmPharmacySalesBills`, `frmPOSSales`, `frmReturnInsuranceSales`, `frmReturnSales`, `frmUpdatePatchDetails`
- `StockQuantities`: No static name match; further indirect/dynamic-use review required.
- `TempStocks`: `frmDispose`, `frmNewPurchase`, `frmNewRequest`
- `Transactions`: `FunctionsModule`, `frmDispose`, `frmChequesManagement`, `frmClientsLateMove`, `frmPayment`, `frmNewPurchase`, `frmReturnPurchases`, `frmSalesReports`, `frmPharmacySales`, `frmPOSSales`, `frmReturnInsuranceSales`, `frmReturnSales`, `frmCustomers`
- `Users`: `frmMain`, `frmULogin`, `frmTransactionsManagement`, `frmChequesManagement`, `frmFinanceReports`, `frmPaymentsManagement`, `frmSalesReports`, `frmPrivileges`, `frmUsersManagements`, `frmApearance`, `frmChangePassword`

## Views and procedures
- `VIEW ViewInitialSales`: No VB source match.
- `VIEW ViewSalesMan`: `frmSalesReports`
- `VIEW ViewPayments`: `frmChequesManagement`, `frmPaymentsManagement`
- `VIEW ViewCheques`: `frmChequesManagement`, `frmFinanceReports`, `frmNotification`
- `VIEW ViewDisposes`: `frmTransactionsManagement`
- `VIEW ViewInsuranceExceptionsGroups`: `frmInsuranceExceptionsSettings`, `frmPharmacySales`
- `VIEW ViewInsuranceGroups`: `frmInsuranceSettings`, `frmPharmacySales`, `frmPharmacySalesBills`
- `VIEW ViewInsuranceGroupsItems`: `InsuranceDataModule`, `frmSalesBillsPlus`
- `VIEW ViewInsuranceGroupsItemsEXp`: `InsuranceDataModule`, `frmSalesBillsPlus`
- `VIEW ViewInsurancePriceList`: `frmInsuranceSettings`
- `VIEW ViewItems`: `ReportsModule`, `frmDispose`, `frmInsuranceExceptionsSettings`, `frmInsuranceGroupItems`, `frmInsuranceSettings`, `frmOutOfInsuranceItems`, `frmNewPurchase`, `frmStockReports`, `frmNewRequest`, `frmPharmacySales`, `frmPharmacySalesBills`, `frmPOSSales`, `frmItems`, `frmItemsSelection`, `frmSettingsItems`, `frmStock`, `frmNotification`, `frmSearchItem`
- `VIEW ViewOutOfInsuranceItems`: `frmInsuranceExceptionsSettings`, `frmInsuranceSettings`, `frmOutOfInsuranceItems`
- `VIEW ViewOutOfInsuranceItemsExceptions`: `frmInsuranceExceptionsSettings`
- `VIEW ViewPackages`: `frmPackages`
- `VIEW ViewPurchases`: `FunctionsModule`, `frmTransactionsManagement`, `frmReturnPurchases`, `frmGRNArchive`, `frmInvoicesArchive`, `frmStockReports`, `frmStock`
- `VIEW ViewRequests`: `FunctionsModule`, `frmTransactionsManagement`, `frmGRNArchive`
- `VIEW ViewSales`: `FunctionsModule`, `frmTransactionsManagement`, `frmGRNArchive`, `frmInvoicesArchive`, `frmSalesReports`, `frmStockReports`, `frmCashier`, `frmReturnSales`
- `VIEW ViewStock`: `FunctionsModule`, `ReportsModule`, `frmDispose`, `frmNewPurchase`, `frmReturnPurchases`, `frmGRNArchive`, `frmInvoicesArchive`, `frmSalesReports`, `frmStockReports`, `frmNewRequest`, `frmCashier`, `frmPharmacySales`, `frmPOSSales`, `frmReturnSales`, `frmStock`, `frmNotification`
- `VIEW ViewTempStocks`: `FunctionsModule`, `frmDispose`, `frmNewPurchase`, `frmInvoicesArchive`, `frmNewRequest`
- `VIEW ViewTransaction`: `FunctionsModule`, `frmAccountsBalances`, `frmFinanceReports`
- `PROCEDURE SP_InitialBill_Save`: No VB source match.
- `PROCEDURE SP_SaleOrder`: `frmPOSSales`

## Representative source traces
- `frmNewPurchase` approval: `Purchases`, `TempStocks`, `Stock`, `SettingsItems`, and `Transactions`; approval updates status, posts stock lots, removes temporary details, saves debit/credit ledger rows, then prints.
- Sales/POS and return forms coordinate sales, stock out movements, temporary details, partner/insurance data, and ledger entries; verify each variant independently.
- `FunctionsModule.PrintInvoice`: purchase/sale and stock views plus company data -> Crystal `rptInvoice` -> modal `ReportViewer`.
- `FunctionsModule.PrintGRN`: purchase/sale/request and stock views -> `rptGRN`; `PrintStatmentOfAccount`: `ViewTransaction` and company profile -> `rptStatmentOfAccount`.

## SQL patterns
ADO.NET queries and writes are issued directly from forms/modules. Two stored procedures exist; the scan did not establish their use as the primary application access path. Parameterization and transactions are mixed. Several IDs use `MAX(ID)+1`, creating concurrency concerns to preserve or explicitly resolve.
