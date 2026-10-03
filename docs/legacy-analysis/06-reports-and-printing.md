# Reports and printing

## Report technology
Crystal Reports 13 (`.rpt`) with VB report wrapper classes, `ReportViewer`, DataSets, and SQL queries. Reports are often assembled in code into a DataSet, passed to a Crystal report, populated with parameters, and opened modally. Printing behavior is part of invoice completion and should be compared by sample output, not only totals.

## Report files
The active project tree includes templates/wrappers for invoices, GRNs, income per invoice, expiry, client movement, most-sold items, minimum stock, invoices by user, price lists, partner cash, running cheque totals, salesperson sales, unpaid invoices, stock status/items/movement, revenue per item/invoice, and account statements. Finance has cheque and cheque-breakdown reports. Full report filenames are discoverable under `Elite-POS/Modules/Reporting/Reports` and `Modules/Finance/Reports`.

## Shared print paths observed
- `PrintInvoice(type, pattern)` selects purchase/sale headers and detail rows, distinguishes preliminary from confirmed documents, sets department/report/partner labels, and displays `rptInvoice` in `ReportViewer`.
- `PrintGRN(type, pattern)` supports receipt, issue, and internal issue forms and displays `rptGRN`.
- `PrintStatmentOfAccount(account-or-partner, date range)` includes a prior-period opening aggregate plus in-period transaction rows and displays `rptStatmentOfAccount`.
- Purchase approval calls invoice printing after committing.

## Reports and datasets inventory
See the `.rpt`/`.xsd` assets under `Elite-POS/Modules`. Dataset schemas and generated classes are included; report wrappers can carry additional parameter names and data mappings. These should be migrated report-by-report after their source forms because they encode operational definitions and layout conventions.

## Risks and verification
Some Crystal templates may carry saved database login/query definitions that cannot be reconstructed from wrapper source. Print review must record paper size, margins, logo/company fields, Arabic text/font direction, barcode/price, quantity/bonus, expiry, totals/discount, copies, printer selection, and preliminary/confirmed labels. Determine whether the modern system needs direct printer support or browser/PDF output on the local device.

## Asset list found in active project tree

Crystal templates (`.rpt`):
- rptCheques.rpt
- rptChequesBreakDown.rpt
- MostSoldItems.rpt
- rptClientMovement.rpt
- rptExpireItems.rpt
- rptGRN.rpt
- rptIncomePerInvoice.rpt
- rptInvoice.rpt
- rptInvoicesPerUser.rpt
- rptMinimumLevel.rpt
- rptPartnersCash.rpt
- rptPriceList.rpt
- rptPriceListAdel.rpt
- rptRunningTotalChegue.rpt
- rptSalesManSales.rpt
- rptSalesPerUser.rpt
- rptSalesRevenuePerInvoice.rpt
- rptSalesRevenuePerItem.rpt
- rptStatmentOfAccount.rpt
- rptStockItems.rpt
- rptStockMovement.rpt
- rptStockStatus.rpt
- rptUnPaidInvoicesPerSalesMan.rpt

Typed dataset schemas (`.xsd`): DSCheques, DSUnPaid, rptChequesBreakDown, DSFinanceTransaction, DSSalesMan, DSStock, DSStockOperations, DSViewTransactions.
