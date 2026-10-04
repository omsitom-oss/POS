namespace ElitePos.LocalService.Models;

public sealed record SaleLineWriteRequest(long ItemId, decimal Quantity, decimal UnitPrice);
public sealed record SaleWriteRequest(DateTime? SaleDate, int? CustomerPartnerId, int? TreasuryId, int CurrencyId, string? Description, IReadOnlyList<SaleLineWriteRequest>? Lines, int? BranchId = null, int? SavedBy = null, decimal Discount = 0, bool CanOverridePrice = false);
public sealed record SaleListItem(long SaleId, string SaleNo, DateTime SaleDate, string? CustomerName, string? TreasuryName, string CurrencySymbol, decimal Total, int LineCount, string Status);
public sealed record SaleResult(long SaleId, string SaleNo, decimal Total, int LineCount);
public sealed record ReportSummary(DateTime From, DateTime To, decimal SalesTotal, decimal PurchasesTotal, decimal ExpensesTotal, decimal ReceiptsTotal, decimal PaymentsTotal, decimal GrossMargin, int SalesCount, int PurchaseCount, decimal SalesReturnsTotal = 0, decimal PurchaseReturnsTotal = 0);
public sealed record ReportDay(DateTime Date, decimal Sales, decimal Returns, decimal Cost, int Invoices);
public sealed record ReportItem(long ItemId, string ItemCode, string NameAr, string NameEn, decimal Quantity, decimal Revenue, decimal Cost);
public sealed record ReportExpense(string AccountCode, string NameAr, string NameEn, decimal Amount);
public sealed record ReportPayments(decimal Cash, decimal OnAccount, int CashCount, int OnAccountCount);
public sealed record ReportBranch(int BranchId, string NameAr, string NameEn, decimal Sales, decimal Margin, int Invoices);
public sealed record ReportCashier(int? UserId, string? UserName, decimal Sales, int Invoices);
public sealed record ReportOverview(ReportSummary Summary, ReportSummary Previous, IReadOnlyList<ReportDay> Days, IReadOnlyList<ReportItem> TopItems, IReadOnlyList<ReportExpense> Expenses, ReportPayments Payments, IReadOnlyList<ReportBranch> Branches, IReadOnlyList<ReportCashier> Cashiers);
