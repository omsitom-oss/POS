namespace ElitePos.LocalService.Models;

// An invoice that can still be returned, for the invoice finder of both return screens.
public sealed record ReturnableInvoice(long InvoiceId, string InvoiceNo, DateTime InvoiceDate, string? PartnerName, string CurrencySymbol, decimal Total, decimal ReturnedTotal);

public sealed record ReturnLineWriteRequest(long LineId, decimal Quantity);

public sealed record SalesReturnSourceLine(long SaleLineId, long ItemId, string ItemCode, string ItemNameAr, string ItemNameEn, decimal SoldQuantity, decimal ReturnedQuantity, decimal ReturnableQuantity, decimal UnitPrice);
public sealed record SalesReturnSource(long SaleId, string SaleNo, DateTime SaleDate, int BranchId, string? CustomerName, int? TreasuryId, int CurrencyId, string CurrencySymbol, decimal Subtotal, decimal Discount, decimal Total, decimal ReturnedTotal, IReadOnlyList<SalesReturnSourceLine> Lines, int? CustomerPartnerId = null);
public sealed record SalesReturnWriteRequest(long SaleId, int? TreasuryId, DateTime? ReturnDate, string? Reason, IReadOnlyList<ReturnLineWriteRequest>? Lines, int? SavedBy = null);
public sealed record SalesReturnListItem(long SalesReturnId, string ReturnNo, DateTime ReturnDate, long SaleId, string SaleNo, string? CustomerName, string? TreasuryNameAr, string? TreasuryNameEn, string CurrencySymbol, decimal Total, int LineCount);
public sealed record SalesReturnLineDetail(long SaleLineId, long ItemId, string ItemNameAr, string ItemNameEn, decimal Quantity, decimal UnitPrice, decimal LineTotal);
public sealed record SalesReturnDetail(long SalesReturnId, string ReturnNo, DateTime ReturnDate, long SaleId, string SaleNo, string? CustomerName, int? TreasuryId, string CurrencySymbol, decimal Subtotal, decimal Discount, decimal Total, string? Reason, IReadOnlyList<SalesReturnLineDetail> Lines);

public sealed record PurchaseReturnSourceLine(long PurchaseLineId, long ItemId, string ItemCode, string ItemNameAr, string ItemNameEn, string? UnitName, string? BatchNo, DateTime? ExpiryDate, decimal PurchasedQuantity, decimal ReturnedQuantity, decimal AvailableQuantity, decimal ReturnableQuantity, decimal UnitCost);
public sealed record PurchaseReturnSource(long PurchaseId, string InvoiceNo, DateTime PurchaseDate, int BranchId, int SupplierPartnerId, string SupplierName, int CurrencyId, string CurrencySymbol, decimal Subtotal, decimal Discount, decimal Total, decimal ReturnedTotal, bool RequiresApproval, IReadOnlyList<PurchaseReturnSourceLine> Lines);
public sealed record PurchaseReturnWriteRequest(long PurchaseId, DateTime? ReturnDate, string? Reason, IReadOnlyList<ReturnLineWriteRequest>? Lines, int? SavedBy = null);
public sealed record PurchaseReturnReviewRequest(string? Note);
public sealed record PurchaseReturnListItem(long PurchaseReturnId, string ReturnNo, DateTime ReturnDate, long PurchaseId, string InvoiceNo, string SupplierName, string CurrencySymbol, decimal Total, int LineCount, string Status, string? ReviewNote);
public sealed record PurchaseReturnLineDetail(long PurchaseLineId, long ItemId, string ItemNameAr, string ItemNameEn, string? BatchNo, decimal Quantity, decimal UnitCost, decimal LineTotal);
public sealed record PurchaseReturnDetail(long PurchaseReturnId, string ReturnNo, DateTime ReturnDate, long PurchaseId, string InvoiceNo, string SupplierName, string CurrencySymbol, decimal Subtotal, decimal Discount, decimal Total, string? Reason, string Status, string? ReviewNote, IReadOnlyList<PurchaseReturnLineDetail> Lines);
