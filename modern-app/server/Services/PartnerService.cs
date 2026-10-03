using System.Data;
using System.Data.Common;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

public sealed class PartnerService(DbConnectionFactory factory)
{
    public async Task<IReadOnlyList<PartnerOptionDto>> GetOptionsAsync(CancellationToken ct)
    {
        await using var db = await OpenAsync(ct); await using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT PartnerId,PartnerCode,PartnerName,Status FROM dbo.Partners WHERE Status=N'ACTIVE' ORDER BY PartnerName,PartnerCode";
        await using var reader = await cmd.ExecuteReaderAsync(ct); var rows = new List<PartnerOptionDto>();
        while (await reader.ReadAsync(ct)) rows.Add(new(reader.GetInt32(0), reader.GetString(1), reader.GetString(2), reader.GetString(3)));
        return rows;
    }

    public async Task<IReadOnlyList<CustomerListItemDto>> GetAsync(CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        await using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT p.PublicId,p.PartnerCode,p.PartnerName,CASE WHEN pt.Code=N'CLIENT' OR pt.ValueEn=N'Client' OR pt.ValueAr=N'عميل' THEN N'CLIENT' WHEN pt.Code=N'SUPPLIER' OR pt.ValueEn=N'Supplier' OR pt.ValueAr=N'مورد' THEN N'SUPPLIER' WHEN pt.Code=N'BOTH' OR pt.ValueEn=N'Client & supplier' OR pt.ValueAr=N'عميل ومورد' THEN N'BOTH' ELSE pt.Code END,p.Phone,COALESCE(c.NameEn,p.Country),p.Status,p.CreatedAt FROM dbo.Partners p JOIN dbo.Settings pt ON pt.SettingId=p.PartnerTypeSettingId LEFT JOIN dbo.Countries c ON c.CountryId=p.CountryId ORDER BY p.PartnerName,p.PartnerCode";
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var rows = new List<CustomerListItemDto>();
        while (await reader.ReadAsync(ct))
            rows.Add(new(reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), null, null, reader.IsDBNull(4) ? null : reader.GetString(4), reader.IsDBNull(5) ? null : reader.GetString(5), reader.GetString(6), DateTime.SpecifyKind(reader.GetDateTime(7), DateTimeKind.Utc)));
        return rows;
    }

    public async Task<CustomerDetailsDto?> GetAsync(Guid id, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        await using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT p.PublicId,p.PartnerCode,p.PartnerName,CASE WHEN pt.Code=N'CLIENT' OR pt.ValueEn=N'Client' OR pt.ValueAr=N'عميل' THEN N'CLIENT' WHEN pt.Code=N'SUPPLIER' OR pt.ValueEn=N'Supplier' OR pt.ValueAr=N'مورد' THEN N'SUPPLIER' WHEN pt.Code=N'BOTH' OR pt.ValueEn=N'Client & supplier' OR pt.ValueAr=N'عميل ومورد' THEN N'BOTH' ELSE pt.Code END,p.Phone,p.Email,p.Address,COALESCE(ci.NameEn,p.City),COALESCE(c.NameEn,p.Country),p.Status,p.CreatedAt FROM dbo.Partners p JOIN dbo.Settings pt ON pt.SettingId=p.PartnerTypeSettingId LEFT JOIN dbo.Countries c ON c.CountryId=p.CountryId LEFT JOIN dbo.Cities ci ON ci.CityId=p.CityId WHERE p.PublicId=@id";
        Add(cmd, "@id", id, DbType.Guid);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        return new(reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), null,
            reader.IsDBNull(4) ? null : reader.GetString(4), null,
            reader.IsDBNull(5) ? null : reader.GetString(5), reader.IsDBNull(6) ? null : reader.GetString(6),
            reader.IsDBNull(7) ? null : reader.GetString(7), reader.IsDBNull(8) ? null : reader.GetString(8),
            null, null, reader.GetString(9), DateTime.SpecifyKind(reader.GetDateTime(10), DateTimeKind.Utc), Array.Empty<BusinessTypeDto>());
    }

    public async Task<CustomerDetailsDto> SaveAsync(int? id, PartnerWriteRequest request, CancellationToken ct)
    {
        var name = request.PartnerName?.Trim();
        var type = request.PartnerTypeCode?.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Partner name is required.");
        if (!string.IsNullOrWhiteSpace(request.Email) && !new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(request.Email.Trim())) throw new ArgumentException("Enter a valid email address.");
        await using var db = await OpenAsync(ct);
        await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            int partnerId; Guid publicId; string code;
            int partnerTypeSettingId;
            await using (var typeCommand = db.CreateCommand())
            {
                typeCommand.Transaction = tx;
                typeCommand.CommandText = "SELECT TOP 1 s.SettingId, CASE WHEN s.Code=N'CLIENT' OR s.ValueEn=N'Client' OR s.ValueAr=N'عميل' THEN N'CLIENT' WHEN s.Code=N'SUPPLIER' OR s.ValueEn=N'Supplier' OR s.ValueAr=N'مورد' THEN N'SUPPLIER' WHEN s.Code=N'BOTH' OR s.ValueEn=N'Client & supplier' OR s.ValueAr=N'عميل ومورد' THEN N'BOTH' ELSE s.Code END FROM dbo.Settings s JOIN dbo.SettingTypes t ON t.SettingTypeId=s.SettingTypeId WHERE t.Code=N'PARTNER_TYPE' AND (s.Code=@type OR (@type=N'CLIENT' AND (s.ValueEn=N'Client' OR s.ValueAr=N'عميل')) OR (@type=N'SUPPLIER' AND (s.ValueEn=N'Supplier' OR s.ValueAr=N'مورد')) OR (@type=N'BOTH' AND (s.ValueEn=N'Client & supplier' OR s.ValueAr=N'عميل ومورد'))) AND s.IsActive=1";
                Add(typeCommand, "@type", type, DbType.String);
                await using var typeReader = await typeCommand.ExecuteReaderAsync(ct);
                if (!await typeReader.ReadAsync(ct)) throw new ArgumentException("Choose a valid partner type.");
                partnerTypeSettingId = typeReader.GetInt32(0);
                type = typeReader.GetString(1);
            }
            var status = string.IsNullOrWhiteSpace(request.Status) ? "ACTIVE" : request.Status!.Trim().ToUpperInvariant();
            if (id.HasValue)
            {
                await using var cmd = db.CreateCommand(); cmd.Transaction = tx;
                cmd.CommandText = "UPDATE dbo.Partners SET PartnerName=@name,PartnerTypeSettingId=@typeId,Phone=@phone,Email=@email,Address=@address,City=@city,Country=@country,CountryId=(SELECT TOP 1 CountryId FROM dbo.Countries WHERE NameEn=@country OR NameAr=@country),CityId=(SELECT TOP 1 CityId FROM dbo.Cities WHERE (NameEn=@city OR NameAr=@city) AND CountryId=(SELECT TOP 1 CountryId FROM dbo.Countries WHERE NameEn=@country OR NameAr=@country)),SalesManName=@sales,Status=@status,UpdatedAt=SYSUTCDATETIME() WHERE PartnerId=@id; SELECT PublicId,PartnerCode FROM dbo.Partners WHERE PartnerId=@id";
                Add(cmd, "@name", name, DbType.String); Add(cmd, "@typeId", partnerTypeSettingId, DbType.Int32); Add(cmd, "@phone", Clean(request.Phone), DbType.String); Add(cmd, "@email", Clean(request.Email), DbType.String); Add(cmd, "@address", Clean(request.Address), DbType.String); Add(cmd, "@city", Clean(request.City), DbType.String); Add(cmd, "@country", Clean(request.Country), DbType.String); Add(cmd, "@sales", Clean(request.SalesManName), DbType.String); Add(cmd, "@status", status, DbType.String); Add(cmd, "@id", id.Value, DbType.Int32);
                if (await cmd.ExecuteNonQueryAsync(ct) == 0) throw new ArgumentException("Partner was not found.");
                await using var reader = await cmd.ExecuteReaderAsync(ct); if (!await reader.ReadAsync(ct)) throw new ArgumentException("Partner was not found.");
                partnerId = id.Value; publicId = reader.GetGuid(0); code = reader.GetString(1);
            }
            else
            {
                await using var cmd = db.CreateCommand(); cmd.Transaction = tx;
                cmd.CommandText = "INSERT INTO dbo.Partners(PartnerCode,PartnerName,PartnerTypeSettingId,Phone,Email,Address,City,Country,CountryId,CityId,SalesManName,Status,BranchId) OUTPUT INSERTED.PartnerId,INSERTED.PublicId,INSERTED.PartnerCode VALUES(@code,@name,@typeId,@phone,@email,@address,@city,@country,(SELECT TOP 1 CountryId FROM dbo.Countries WHERE NameEn=@country OR NameAr=@country),(SELECT TOP 1 CityId FROM dbo.Cities WHERE (NameEn=@city OR NameAr=@city) AND CountryId=(SELECT TOP 1 CountryId FROM dbo.Countries WHERE NameEn=@country OR NameAr=@country)),@sales,@status,(SELECT TOP 1 BranchId FROM dbo.Branches ORDER BY BranchId))";
                Add(cmd, "@code", $"P-{Guid.NewGuid():N}"[..18], DbType.String); Add(cmd, "@name", name, DbType.String); Add(cmd, "@typeId", partnerTypeSettingId, DbType.Int32); Add(cmd, "@phone", Clean(request.Phone), DbType.String); Add(cmd, "@email", Clean(request.Email), DbType.String); Add(cmd, "@address", Clean(request.Address), DbType.String); Add(cmd, "@city", Clean(request.City), DbType.String); Add(cmd, "@country", Clean(request.Country), DbType.String); Add(cmd, "@sales", Clean(request.SalesManName), DbType.String); Add(cmd, "@status", status, DbType.String);
                await using var reader = await cmd.ExecuteReaderAsync(ct); await reader.ReadAsync(ct); partnerId = reader.GetInt32(0); publicId = reader.GetGuid(1); code = reader.GetString(2); await reader.CloseAsync();
                await using var codeCmd = db.CreateCommand(); codeCmd.Transaction = tx; codeCmd.CommandText = "UPDATE dbo.Partners SET PartnerCode=@code,UpdatedAt=SYSUTCDATETIME() WHERE PartnerId=@id"; Add(codeCmd, "@code", $"PTN-{partnerId:D6}", DbType.String); Add(codeCmd, "@id", partnerId, DbType.Int32); await codeCmd.ExecuteNonQueryAsync(ct); code = $"PTN-{partnerId:D6}";
            }
            await tx.CommitAsync(ct);
            return new(publicId, code, name, type!, null, Clean(request.Phone), null, Clean(request.Email), Clean(request.Address), Clean(request.City), Clean(request.Country), null, null, status, DateTime.UtcNow, Array.Empty<BusinessTypeDto>());
        }
        catch { await tx.RollbackAsync(ct); throw; }
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    public async Task<CustomerDetailsDto> SaveByPublicIdAsync(Guid publicId, PartnerWriteRequest request, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct); await using var cmd = db.CreateCommand(); cmd.CommandText = "SELECT PartnerId FROM dbo.Partners WHERE PublicId=@id"; Add(cmd, "@id", publicId, DbType.Guid); var value = await cmd.ExecuteScalarAsync(ct); if (value is null) throw new ArgumentException("Partner was not found."); return await SaveAsync(Convert.ToInt32(value), request, ct);
    }
    private async Task<DbConnection> OpenAsync(CancellationToken ct) { var db = factory.CreateConnection(); await db.OpenAsync(ct); return db; }
    private static void Add(DbCommand command, string name, object? value, DbType type) { var parameter = command.CreateParameter(); parameter.ParameterName = name; parameter.DbType = type; parameter.Value = value ?? DBNull.Value; command.Parameters.Add(parameter); }
}

