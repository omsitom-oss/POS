namespace ElitePos.LocalService.Models;

public sealed record ChartAccountDto(int AccountId, int BranchId, string AccountCode, string NameAr, string NameEn, string AccountType, decimal Balance, bool IsSystem, bool IsActive);
