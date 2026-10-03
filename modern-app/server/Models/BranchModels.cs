namespace ElitePos.LocalService.Models;

public sealed record BranchDto(int BranchId, string BranchCode, string NameAr, string NameEn, bool IsActive, int SortOrder, DateTime CreatedAt, DateTime UpdatedAt);
public sealed record BranchWriteRequest(string? NameAr, string? NameEn, bool IsActive = true);
