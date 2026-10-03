using System.Data;
using System.Data.Common;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

public sealed class ApprovalService(DbConnectionFactory factory)
{
    public async Task<IReadOnlyList<ApprovalSettingDto>> GetAsync(CancellationToken ct)
    {
        await using var db = factory.CreateConnection(); await db.OpenAsync(ct);
        await using var command = db.CreateCommand(); command.CommandText = "SELECT RequestType,RequiresApproval,UpdatedAt FROM dbo.ApprovalSettings ORDER BY RequestType";
        var rows = new List<ApprovalSettingDto>(); await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) rows.Add(new(reader.GetString(0), reader.GetBoolean(1), reader.GetDateTime(2)));
        return rows;
    }

    public async Task<ApprovalSettingDto?> SetAsync(string requestType, ApprovalSettingWriteRequest request, CancellationToken ct)
    {
        var key = requestType.Trim().ToUpperInvariant(); if (key.Length is 0 or > 50) return null;
        await using var db = factory.CreateConnection(); await db.OpenAsync(ct);
        await using var command = db.CreateCommand(); command.CommandText = "UPDATE dbo.ApprovalSettings SET RequiresApproval=@required,UpdatedAt=SYSUTCDATETIME() WHERE RequestType=@type; SELECT RequestType,RequiresApproval,UpdatedAt FROM dbo.ApprovalSettings WHERE RequestType=@type";
        Add(command, "@required", request.RequiresApproval, DbType.Boolean); Add(command, "@type", key, DbType.String);
        await using var reader = await command.ExecuteReaderAsync(ct); return await reader.ReadAsync(ct) ? new(reader.GetString(0), reader.GetBoolean(1), reader.GetDateTime(2)) : null;
    }

    private static void Add(DbCommand command, string name, object value, DbType type) { var parameter = command.CreateParameter(); parameter.ParameterName = name; parameter.DbType = type; parameter.Value = value; command.Parameters.Add(parameter); }
}
