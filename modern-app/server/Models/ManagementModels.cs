namespace ElitePos.LocalService.Models;

public sealed record BusinessTypeDto(string Code, string Name, string? Description);

public sealed record CustomerListItemDto(
    Guid PublicId,
    string CustomerCode,
    string BusinessName,
    string PartnerTypeCode,
    string? PrimaryBusinessType,
    string? ContactPerson,
    string? Phone,
    string? Country,
    string Status,
    DateTime CreatedAt);

public sealed record PartnerOptionDto(int PartnerId, string PartnerCode, string PartnerName, string Status);

public sealed record CustomerDetailsDto(
    Guid PublicId,
    string CustomerCode,
    string BusinessName,
    string PartnerTypeCode,
    string? ContactPerson,
    string? Phone,
    string? Mobile,
    string? Email,
    string? Address,
    string? City,
    string? Country,
    string? TaxNumber,
    string? Notes,
    string Status,
    DateTime CreatedAt,
    IReadOnlyList<BusinessTypeDto> BusinessTypes);

public sealed class CreateCustomerRequest
{
    public string? BusinessName { get; init; }
    public string? PartnerTypeCode { get; init; }
    public string? PrimaryBusinessTypeCode { get; init; }
    public string? ContactPerson { get; init; }
    public string? Phone { get; init; }
    public string? Mobile { get; init; }
    public string? Email { get; init; }
    public string? Address { get; init; }
    public string? City { get; init; }
    public string? Country { get; init; }
    public string? TaxNumber { get; init; }
    public string? Notes { get; init; }
}

public sealed class PartnerWriteRequest { public string? PartnerName { get; init; } public string? PartnerTypeCode { get; init; } public string? Phone { get; init; } public string? Email { get; init; } public string? Address { get; init; } public string? City { get; init; } public string? Country { get; init; } public string? SalesManName { get; init; } public string? Status { get; init; } }
