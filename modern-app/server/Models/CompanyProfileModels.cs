namespace ElitePos.LocalService.Models;

public sealed record CompanyProfileDto(string CompanyName, string CompanyAddress, string BusinessType, string CompanyPhone1, string CompanyPhone2, string CompanyMobileNo, string CompanyFax, string CompanyEmail, string CompanyWebsite, string? LogoBase64, string? LogoContentType, DateTime UpdatedAt);
public sealed record CompanyProfileWriteRequest(string? CompanyName, string? CompanyAddress, string? BusinessType, string? CompanyPhone1, string? CompanyPhone2, string? CompanyMobileNo, string? CompanyFax, string? CompanyEmail, string? CompanyWebsite, string? LogoBase64, string? LogoContentType);
