namespace ElitePos.LocalService.Models;

public sealed record TreasuryDto(int TreasuryId, string TreasuryCode, string NameAr, string NameEn, string TreasureType, int? BankId, string? BankNameAr, string? BankNameEn, string? AccountNumber, int CurrencyId, string CurrencySymbol, string CurrencyCode, bool IsActive, int SortOrder, DateTime CreatedAt, DateTime UpdatedAt, int? BranchId = null);
public sealed record TreasuryWriteRequest(string? NameAr, string? NameEn, string TreasureType, int? BankId, string? AccountNumber, int CurrencyId, bool IsActive = true, int? BranchId = null);
