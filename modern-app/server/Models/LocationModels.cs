namespace ElitePos.LocalService.Models;

public sealed record CountryDto(int CountryId, string NameAr, string NameEn, bool IsActive, int SortOrder, int ActiveCityCount);
public sealed record CityDto(int CityId, int CountryId, string NameAr, string NameEn, bool IsActive, int SortOrder);
public sealed record LocationWriteRequest(string? NameAr, string? NameEn, bool IsActive = true);
