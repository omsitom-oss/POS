namespace ElitePos.LocalService.Models;

public sealed record InventoryItemDto(
    long ItemId,
    string ItemCode,
    string NameAr,
    string NameEn,
    string? BaseUnitAr,
    string? BaseUnitEn,
    decimal Quantity,
    decimal SellPrice,
    decimal? LastPurchasePrice,
    int MinimumLevelForAlert,
    bool IsActive);

public sealed record InventoryBatchDto(long PurchaseLineId, string InvoiceNo, DateTime PurchaseDate, string? Barcode, DateTime? ExpiryDate, string BatchNo, decimal Quantity, decimal AvailableQuantity, decimal UnitCost);
public sealed record InventoryDisposalRequest(long ItemId, long PurchaseLineId, decimal Quantity, string? Reason, int? RequestedBy, int? BranchId);
public sealed record InventoryRequestDto(long RequestId, string RequestType, long ItemId, long? PurchaseLineId, decimal Quantity, string Reason, string Status, int? RequestedBy, DateTime CreatedAt, int? ReviewedBy, DateTime? ReviewedAt);
