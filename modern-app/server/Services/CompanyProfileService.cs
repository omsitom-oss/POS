using System.Data;
using System.Data.Common;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

public sealed class CompanyProfileService(DbConnectionFactory factory)
{
    private static readonly string[] BusinessTypes = ["Pharmacy", "Electronics", "Restaurant", "Coffee Shop", "Grocery"];
    public async Task<CompanyProfileDto> GetAsync(CancellationToken ct)
    {
        await using var db = await OpenAsync(ct); await using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT CompanyName,CompanyAddress,BusinessType,CompanyPhone1,CompanyPhone2,CompanyMobileNo,CompanyFax,CompanyEmail,CompanyWebsite,LogoBase64,LogoContentType,UpdatedAt FROM dbo.CompanyProfile WHERE CompanyProfileId=1";
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? Read(reader) : throw new InvalidOperationException("Company profile row is missing.");
    }

    public async Task<CompanyProfileDto> SaveAsync(CompanyProfileWriteRequest request, CancellationToken ct)
    {
        Validate(request);
        await using var db = await OpenAsync(ct); await using var cmd = db.CreateCommand();
        cmd.CommandText = "UPDATE dbo.CompanyProfile SET CompanyName=@name,CompanyAddress=@address,BusinessType=@businessType,CompanyPhone1=@phone1,CompanyPhone2=@phone2,CompanyMobileNo=@mobile,CompanyFax=@fax,CompanyEmail=@email,CompanyWebsite=@website,LogoBase64=@logo,LogoContentType=@contentType,UpdatedAt=SYSUTCDATETIME() WHERE CompanyProfileId=1";
        Add(cmd, "@name", request.CompanyName!.Trim(), DbType.String, 250); Add(cmd, "@address", request.CompanyAddress!.Trim(), DbType.String, 350); Add(cmd, "@businessType", request.BusinessType?.Trim() ?? string.Empty, DbType.String, 50); Add(cmd, "@phone1", request.CompanyPhone1?.Trim() ?? string.Empty, DbType.String, 250); Add(cmd, "@phone2", request.CompanyPhone2?.Trim() ?? string.Empty, DbType.String, 250); Add(cmd, "@mobile", request.CompanyMobileNo?.Trim() ?? string.Empty, DbType.String, 250); Add(cmd, "@fax", request.CompanyFax?.Trim() ?? string.Empty, DbType.String, 250); Add(cmd, "@email", request.CompanyEmail?.Trim() ?? string.Empty, DbType.String, 250); Add(cmd, "@website", request.CompanyWebsite?.Trim() ?? string.Empty, DbType.String, 250); Add(cmd, "@logo", request.LogoBase64, DbType.String); Add(cmd, "@contentType", request.LogoContentType, DbType.AnsiString, 100);
        await cmd.ExecuteNonQueryAsync(ct); return await GetAsync(ct);
    }

    private static void Validate(CompanyProfileWriteRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CompanyName) || request.CompanyName.Trim().Length > 250) throw new CompanyProfileException("Company name is required and must be 250 characters or fewer.");
        if (string.IsNullOrWhiteSpace(request.CompanyAddress) || request.CompanyAddress.Trim().Length > 350) throw new CompanyProfileException("Company address is required and must be 350 characters or fewer.");
        if (!string.IsNullOrWhiteSpace(request.BusinessType) && !BusinessTypes.Contains(request.BusinessType.Trim(), StringComparer.Ordinal)) throw new CompanyProfileException("Business type is invalid.");
        if (!string.IsNullOrWhiteSpace(request.LogoBase64) && request.LogoBase64.Length > 7_000_000) throw new CompanyProfileException("The logo must be 5 MB or smaller.");
        if (!string.IsNullOrWhiteSpace(request.LogoContentType) && !new[] { "image/png", "image/jpeg", "image/webp", "image/gif" }.Contains(request.LogoContentType, StringComparer.OrdinalIgnoreCase)) throw new CompanyProfileException("Logo must be PNG, JPEG, WEBP, or GIF.");
    }
    private async Task<DbConnection> OpenAsync(CancellationToken ct) { var db = factory.CreateConnection(); await db.OpenAsync(ct); return db; }
    private static CompanyProfileDto Read(DbDataReader r) => new(r.GetString(0), r.GetString(1), r.GetString(2), r.GetString(3), r.GetString(4), r.GetString(5), r.GetString(6), r.GetString(7), r.GetString(8), r.IsDBNull(9) ? null : r.GetString(9), r.IsDBNull(10) ? null : r.GetString(10), r.GetDateTime(11));
    private static void Add(DbCommand c, string name, object? value, DbType type, int? size = null) { var p = c.CreateParameter(); p.ParameterName = name; p.DbType = type; if (size.HasValue) p.Size = size.Value; p.Value = value ?? DBNull.Value; c.Parameters.Add(p); }
}

public sealed class CompanyProfileException(string message, int statusCode = 400) : Exception(message) { public int StatusCode { get; } = statusCode; }
