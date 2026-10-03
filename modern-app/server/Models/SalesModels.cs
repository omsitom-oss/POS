namespace ElitePos.LocalService.Models;

public sealed record SaleLineWriteRequest(long ItemId, decimal Quantity, decimal UnitPrice);
public sealed record SaleWriteRequest(DateTime? SaleDate, int? CustomerPartnerId, int TreasuryId, int CurrencyId, string? Description, IReadOnlyList<SaleLineWriteRequest>? Lines, int? BranchId = null, int? SavedBy = null, decimal Discount = 0);
public sealed record SaleListItem(long SaleId, string SaleNo, DateTime SaleDate, string? CustomerName, string TreasuryName, string CurrencySymbol, decimal Total, int LineCount, string Status);
public sealed record SaleResult(long SaleId, string SaleNo, decimal Total, int LineCount);
public sealed record ReportSummary(DateTime From, DateTime To, decimal SalesTotal, decimal PurchasesTotal, decimal ExpensesTotal, decimal ReceiptsTotal, decimal PaymentsTotal, decimal GrossMargin, int SalesCount, int PurchaseCount);
