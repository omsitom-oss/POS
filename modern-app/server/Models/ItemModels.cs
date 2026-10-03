namespace ElitePos.LocalService.Models;

public sealed record ItemDto(
    long ItemId,
    string ItemCode,
    string NameAr,
    string NameEn,
    string? ManufacturerName,
    string? ImageBase64,
    int? CategorySettingId,
    int? GenericSettingId,
    string? CategoryAr,
    string? CategoryEn,
    string? BaseUnitAr,
    string? BaseUnitEn,
    decimal SellPrice,
    decimal? LastPurchasePrice,
    int MinimumLevelForAlert,
    bool IsActive);

public sealed record ItemUnitDto(int UnitSettingId, string UnitAr, string UnitEn, decimal ConversionToBase, bool IsBase, int SortOrder);
public sealed record ItemPriceHistoryDto(long ItemPriceHistoryId, decimal? PreviousPrice, decimal NewPrice, int? UserId, string? UserName, DateTime ChangedAt);
public sealed record ItemDetailsDto(ItemDto Item, IReadOnlyList<ItemUnitDto> Units, IReadOnlyList<ItemPriceHistoryDto> PriceHistory);

public sealed record ItemUnitWriteRequest(int UnitSettingId, decimal ConversionToBase, bool IsBase, int SortOrder = 0);
public sealed record ItemWriteRequest(
    string? NameAr,
    string? NameEn,
    string? ManufacturerName,
    int? CategorySettingId,
    int? GenericSettingId,
    decimal SellPrice,
    int MinimumLevelForAlert,
    bool IsActive,
    IReadOnlyList<ItemUnitWriteRequest>? Units,
    string? ImageBase64 = null,
    int? UserId = null);
