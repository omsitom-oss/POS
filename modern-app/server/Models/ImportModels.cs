namespace ElitePos.LocalService.Models;

public sealed record ImportLineWriteRequest(long ItemId, int? UnitSettingId, decimal Quantity, decimal UnitPrice, DateTime? ExpiryDate = null, string? BatchNo = null, string? Barcode = null);

public sealed record ImportShipmentWriteRequest(
    int SupplierPartnerId,
    DateTime? PurchaseDate,
    int CurrencyId,
    decimal ExchangeRateToBase,
    int CountryId,
    string? SupplierInvoiceNo,
    string? ShipmentReference,
    string? AllocationMethod,
    IReadOnlyList<ImportLineWriteRequest>? Lines,
    int? BranchId = null,
    int? SavedBy = null);

// PayeeType is PARTNER (owed to a partner), TREASURY (paid now from a till) or ACCOUNT (owed on a payable account).
public sealed record ImportCostWriteRequest(
    string CostType,
    decimal Amount,
    int CurrencyId,
    decimal ExchangeRateToBase,
    string PayeeType,
    int? PayeePartnerId = null,
    int? PayeeTreasuryId = null,
    string? PayeeAccountCode = null,
    string? Description = null);

public sealed record ImportLineDetail(
    long PurchaseLineId,
    long ItemId,
    string ItemName,
    int? UnitSettingId,
    string? UnitName,
    decimal Quantity,
    decimal UnitPrice,
    decimal LineTotal,
    decimal GoodsBase,
    decimal AllocatedCostBase,
    decimal LandedTotalBase,
    decimal LandedUnitCostBase,
    DateTime? ExpiryDate,
    string? BatchNo,
    string? Barcode);

public sealed record ImportCostDetail(
    long CostId,
    string CostType,
    decimal Amount,
    int CurrencyId,
    string CurrencyCode,
    string CurrencySymbol,
    decimal ExchangeRateToBase,
    decimal BaseAmount,
    string PayeeType,
    int? PayeePartnerId,
    int? PayeeTreasuryId,
    string? PayeeAccountCode,
    string PayeeName,
    string? Description);

public sealed record ImportShipmentDetail(
    long PurchaseId,
    string InvoiceNo,
    string Status,
    int BranchId,
    int SupplierPartnerId,
    string SupplierName,
    DateTime PurchaseDate,
    int CurrencyId,
    string CurrencyCode,
    string CurrencySymbol,
    decimal ExchangeRateToBase,
    int? CountryId,
    string? SupplierInvoiceNo,
    string? ShipmentReference,
    string AllocationMethod,
    decimal GoodsTotal,
    decimal GoodsBase,
    decimal CostsBase,
    decimal LandedBase,
    DateTime? ReceivedAt,
    IReadOnlyList<ImportLineDetail> Lines,
    IReadOnlyList<ImportCostDetail> Costs);

public sealed record ImportPayableAccount(string AccountCode, string NameAr, string NameEn);
