namespace ElitePos.LocalService.Models;

public sealed record SettingTypeDto(int SettingTypeId, string Code, string NameAr, string NameEn, bool IsHierarchical, bool IsActive, int SortOrder, int ActiveSettingCount);
public sealed record SettingTypeWriteRequest(string? NameAr, string? NameEn, bool IsHierarchical, bool IsActive = true);
public sealed record SettingDto(int SettingId, int SettingTypeId, int? ParentSettingId, string? Code, string ValueAr, string ValueEn, int SortOrder, bool IsActive, DateTime CreatedAt, DateTime UpdatedAt);
public sealed record SettingTreeDto(int SettingId, int SettingTypeId, int? ParentSettingId, string? Code, string ValueAr, string ValueEn, int SortOrder, bool IsActive, IReadOnlyList<SettingTreeDto> Children);
public sealed record SettingWriteRequest(string? ValueAr, string? ValueEn, int? ParentSettingId, bool IsActive = true);
