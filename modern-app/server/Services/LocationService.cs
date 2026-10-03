using System.Data;
using System.Data.Common;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

public sealed class LocationService(DbConnectionFactory factory)
{
    public async Task<IReadOnlyList<CountryDto>> GetCountriesAsync(bool includeInactive, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        await using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT c.CountryId,c.NameAr,c.NameEn,c.IsActive,c.SortOrder,COUNT(CASE WHEN ci.IsActive=1 THEN 1 END) FROM dbo.Countries c LEFT JOIN dbo.Cities ci ON ci.CountryId=c.CountryId WHERE (@inactive=1 OR c.IsActive=1) GROUP BY c.CountryId,c.NameAr,c.NameEn,c.IsActive,c.SortOrder ORDER BY c.SortOrder,c.NameEn";
        Add(cmd, "@inactive", includeInactive, DbType.Boolean);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var rows = new List<CountryDto>();
        while (await reader.ReadAsync(ct)) rows.Add(new(reader.GetInt32(0), reader.GetString(1), reader.GetString(2), reader.GetBoolean(3), reader.GetInt32(4), reader.GetInt32(5)));
        return rows;
    }

    public async Task<IReadOnlyList<CityDto>?> GetCitiesAsync(int countryId, bool includeInactive, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        await using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT CityId,CountryId,NameAr,NameEn,IsActive,SortOrder FROM dbo.Cities WHERE CountryId=@country AND (@inactive=1 OR IsActive=1) ORDER BY SortOrder,NameEn";
        Add(cmd, "@country", countryId, DbType.Int32); Add(cmd, "@inactive", includeInactive, DbType.Boolean);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var rows = new List<CityDto>();
        while (await reader.ReadAsync(ct)) rows.Add(new(reader.GetInt32(0), reader.GetInt32(1), reader.GetString(2), reader.GetString(3), reader.GetBoolean(4), reader.GetInt32(5)));
        return rows;
    }

    public async Task<CountryDto> CreateCountryAsync(LocationWriteRequest request, CancellationToken ct)
    {
        Validate(request);
        await using var db = await OpenAsync(ct);
        await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            var sort = await NextSortAsync(db, tx, "Countries", null, ct);
            await using var cmd = db.CreateCommand(); cmd.Transaction = tx;
            cmd.CommandText = "INSERT INTO dbo.Countries(NameAr,NameEn,IsActive,SortOrder) OUTPUT INSERTED.CountryId VALUES(@ar,@en,@active,@sort)";
            Add(cmd, "@ar", request.NameAr!.Trim(), DbType.String, 150); Add(cmd, "@en", request.NameEn!.Trim(), DbType.String, 150); Add(cmd, "@active", request.IsActive, DbType.Boolean); Add(cmd, "@sort", sort, DbType.Int32);
            var id = Convert.ToInt32(await cmd.ExecuteScalarAsync(ct)); await tx.CommitAsync(ct);
            return new(id, request.NameAr.Trim(), request.NameEn.Trim(), request.IsActive, sort, 0);
        }
        catch { await tx.RollbackAsync(ct); throw; }
    }

    public async Task<CityDto> CreateCityAsync(int countryId, LocationWriteRequest request, CancellationToken ct)
    {
        Validate(request);
        await using var db = await OpenAsync(ct);
        await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            await using var exists = db.CreateCommand(); exists.Transaction = tx; exists.CommandText = "SELECT 1 FROM dbo.Countries WITH (UPDLOCK,HOLDLOCK) WHERE CountryId=@id"; Add(exists, "@id", countryId, DbType.Int32);
            if (await exists.ExecuteScalarAsync(ct) is null) throw new LocationException("Country was not found.", 404);
            var sort = await NextSortAsync(db, tx, "Cities", countryId, ct);
            await using var cmd = db.CreateCommand(); cmd.Transaction = tx;
            cmd.CommandText = "INSERT INTO dbo.Cities(CountryId,NameAr,NameEn,IsActive,SortOrder) OUTPUT INSERTED.CityId VALUES(@country,@ar,@en,@active,@sort)";
            Add(cmd, "@country", countryId, DbType.Int32); Add(cmd, "@ar", request.NameAr!.Trim(), DbType.String, 150); Add(cmd, "@en", request.NameEn!.Trim(), DbType.String, 150); Add(cmd, "@active", request.IsActive, DbType.Boolean); Add(cmd, "@sort", sort, DbType.Int32);
            var id = Convert.ToInt32(await cmd.ExecuteScalarAsync(ct)); await tx.CommitAsync(ct);
            return new(id, countryId, request.NameAr.Trim(), request.NameEn.Trim(), request.IsActive, sort);
        }
        catch { await tx.RollbackAsync(ct); throw; }
    }

    public async Task<CountryDto?> UpdateCountryAsync(int countryId, LocationWriteRequest request, CancellationToken ct)
    {
        Validate(request); await using var db = await OpenAsync(ct); await using var cmd = db.CreateCommand();
        cmd.CommandText = "UPDATE dbo.Countries SET NameAr=@ar,NameEn=@en,IsActive=@active,UpdatedAt=SYSUTCDATETIME() WHERE CountryId=@id; SELECT c.CountryId,c.NameAr,c.NameEn,c.IsActive,c.SortOrder,COUNT(CASE WHEN ci.IsActive=1 THEN 1 END) FROM dbo.Countries c LEFT JOIN dbo.Cities ci ON ci.CountryId=c.CountryId WHERE c.CountryId=@id GROUP BY c.CountryId,c.NameAr,c.NameEn,c.IsActive,c.SortOrder";
        Add(cmd, "@id", countryId, DbType.Int32); Add(cmd, "@ar", request.NameAr!.Trim(), DbType.String, 150); Add(cmd, "@en", request.NameEn!.Trim(), DbType.String, 150); Add(cmd, "@active", request.IsActive, DbType.Boolean);
        await using var reader = await cmd.ExecuteReaderAsync(ct); return await reader.ReadAsync(ct) ? new(reader.GetInt32(0), reader.GetString(1), reader.GetString(2), reader.GetBoolean(3), reader.GetInt32(4), reader.GetInt32(5)) : null;
    }

    public async Task<CityDto?> UpdateCityAsync(int cityId, LocationWriteRequest request, CancellationToken ct)
    {
        Validate(request); await using var db = await OpenAsync(ct); await using var cmd = db.CreateCommand();
        cmd.CommandText = "UPDATE dbo.Cities SET NameAr=@ar,NameEn=@en,IsActive=@active,UpdatedAt=SYSUTCDATETIME() WHERE CityId=@id; SELECT CityId,CountryId,NameAr,NameEn,IsActive,SortOrder FROM dbo.Cities WHERE CityId=@id";
        Add(cmd, "@id", cityId, DbType.Int32); Add(cmd, "@ar", request.NameAr!.Trim(), DbType.String, 150); Add(cmd, "@en", request.NameEn!.Trim(), DbType.String, 150); Add(cmd, "@active", request.IsActive, DbType.Boolean);
        await using var reader = await cmd.ExecuteReaderAsync(ct); return await reader.ReadAsync(ct) ? new(reader.GetInt32(0), reader.GetInt32(1), reader.GetString(2), reader.GetString(3), reader.GetBoolean(4), reader.GetInt32(5)) : null;
    }

    private static async Task<int> NextSortAsync(DbConnection db, DbTransaction tx, string table, int? countryId, CancellationToken ct)
    {
        await using var cmd = db.CreateCommand(); cmd.Transaction = tx;
        cmd.CommandText = countryId.HasValue ? $"SELECT ISNULL(MAX(SortOrder),0)+1 FROM dbo.{table} WITH (UPDLOCK,HOLDLOCK) WHERE CountryId=@country" : $"SELECT ISNULL(MAX(SortOrder),0)+1 FROM dbo.{table} WITH (TABLOCKX,HOLDLOCK)";
        if (countryId.HasValue) Add(cmd, "@country", countryId.Value, DbType.Int32);
        return Convert.ToInt32(await cmd.ExecuteScalarAsync(ct));
    }

    private async Task<DbConnection> OpenAsync(CancellationToken ct) { var db = factory.CreateConnection(); await db.OpenAsync(ct); return db; }
    private static void Add(DbCommand command, string name, object value, DbType type, int? size = null) { var p = command.CreateParameter(); p.ParameterName = name; p.DbType = type; if (size.HasValue) p.Size = size.Value; p.Value = value; command.Parameters.Add(p); }
    private static void Validate(LocationWriteRequest request) { if (string.IsNullOrWhiteSpace(request.NameAr) || request.NameAr.Trim().Length > 150 || string.IsNullOrWhiteSpace(request.NameEn) || request.NameEn.Trim().Length > 150) throw new LocationException("Arabic and English names are required and must be 150 characters or fewer."); }
}

public sealed class LocationException(string message, int statusCode = 400) : Exception(message) { public int StatusCode { get; } = statusCode; }
