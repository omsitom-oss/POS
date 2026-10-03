namespace ElitePos.LocalService.Models;

public sealed record CurrencyDto(int CurrencyId, string CurrencyCode, string CurrencyNameEn, string CurrencyNameAr, string Symbol, bool IsPrimary, bool IsActive, DateTime UpdatedAt, decimal? ExchangeRate, string? FlagBase64);
public sealed record CurrencyWriteRequest(string? CurrencyNameEn, string? CurrencyNameAr, string? Symbol, bool IsPrimary, bool IsActive = true, string? FlagBase64 = null);
public sealed record CurrencyRateDto(int CurrencyRateId, int CurrencyId, int BaseCurrencyId, decimal Rate, DateTime RecordedAt);
public sealed record CurrencyRateWriteRequest(decimal Rate);
public sealed record CurrencyRateUpdate(int CurrencyId, decimal Rate);
public sealed record CurrencyRateBatchRequest(IReadOnlyList<CurrencyRateUpdate> Rates);
