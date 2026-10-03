namespace ElitePos.LocalService.Models;

public sealed record BankDto(int BankId, string BankCode, string NameAr, string NameEn, bool IsActive, int SortOrder, DateTime CreatedAt, DateTime UpdatedAt);
public sealed record BankWriteRequest(string? NameAr, string? NameEn, bool IsActive = true);
