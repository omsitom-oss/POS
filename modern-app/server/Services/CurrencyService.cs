using System.Data;
using System.Data.Common;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

public sealed class CurrencyService(DbConnectionFactory factory)
{
    public async Task<IReadOnlyList<CurrencyDto>> GetAsync(bool includeInactive, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct); await using var cmd = db.CreateCommand(); cmd.CommandText = "SELECT c.CurrencyId,c.CurrencyCode,c.CurrencyNameEn,c.CurrencyNameAr,c.Symbol,c.IsPrimary,c.IsActive,c.UpdatedAt,CASE WHEN c.IsPrimary=1 THEN CAST(1 AS decimal(19,8)) ELSE latest.Rate END AS ExchangeRate,c.FlagBase64 FROM dbo.Currencies c OUTER APPLY (SELECT TOP (1) h.Rate FROM dbo.CurrencyRateHistory h WHERE h.CurrencyId=c.CurrencyId AND h.BaseCurrencyId=(SELECT TOP (1) CurrencyId FROM dbo.Currencies WHERE IsPrimary=1) ORDER BY h.RecordedAt DESC,h.CurrencyRateId DESC) latest WHERE (@inactive=1 OR c.IsActive=1) ORDER BY c.IsPrimary DESC,c.CurrencyNameEn"; Add(cmd, "@inactive", includeInactive, DbType.Boolean); await using var r = await cmd.ExecuteReaderAsync(ct); var rows = new List<CurrencyDto>(); while (await r.ReadAsync(ct)) rows.Add(Read(r)); return rows;
    }
    public async Task<CurrencyDto> SaveAsync(int? id, CurrencyWriteRequest request, CancellationToken ct)
    {
        Validate(request); await using var db = await OpenAsync(ct); await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            if (request.IsPrimary) { await using var reset = db.CreateCommand(); reset.Transaction = tx; reset.CommandText = "UPDATE dbo.Currencies SET IsPrimary=0,UpdatedAt=SYSUTCDATETIME() WHERE IsPrimary=1 AND CurrencyId<>@id"; Add(reset, "@id", id ?? 0, DbType.Int32); await reset.ExecuteNonQueryAsync(ct); }
            int currencyId;
            if (id.HasValue)
            {
                await using var update = db.CreateCommand(); update.Transaction = tx; update.CommandText = "UPDATE dbo.Currencies SET CurrencyNameEn=@en,CurrencyNameAr=@ar,Symbol=@symbol,IsPrimary=@primary,IsActive=@active,FlagBase64=@flag,UpdatedAt=SYSUTCDATETIME() WHERE CurrencyId=@id";
                Add(update, "@en", request.CurrencyNameEn!.Trim(), DbType.String, 150); Add(update, "@ar", request.CurrencyNameAr!.Trim(), DbType.String, 150); Add(update, "@symbol", request.Symbol?.Trim() ?? string.Empty, DbType.String, 20); Add(update, "@primary", request.IsPrimary, DbType.Boolean); Add(update, "@active", request.IsActive, DbType.Boolean); Add(update, "@flag", request.FlagBase64, DbType.String); Add(update, "@id", id.Value, DbType.Int32);
                if (await update.ExecuteNonQueryAsync(ct) == 0) throw new CurrencyException("Currency was not found.", 404);
                currencyId = id.Value;
            }
            else
            {
                var pendingCode = $"P-{Guid.NewGuid():N}"[..18];
                await using var insert = db.CreateCommand(); insert.Transaction = tx; insert.CommandText = "INSERT INTO dbo.Currencies(CurrencyCode,CurrencyNameEn,CurrencyNameAr,Symbol,IsPrimary,IsActive,FlagBase64) OUTPUT INSERTED.CurrencyId VALUES(@code,@en,@ar,@symbol,@primary,@active,@flag)";
                Add(insert, "@code", pendingCode, DbType.String, 20); Add(insert, "@en", request.CurrencyNameEn!.Trim(), DbType.String, 150); Add(insert, "@ar", request.CurrencyNameAr!.Trim(), DbType.String, 150); Add(insert, "@symbol", request.Symbol?.Trim() ?? string.Empty, DbType.String, 20); Add(insert, "@primary", request.IsPrimary, DbType.Boolean); Add(insert, "@active", request.IsActive, DbType.Boolean); Add(insert, "@flag", request.FlagBase64, DbType.String);
                currencyId = Convert.ToInt32(await insert.ExecuteScalarAsync(ct));
                var generatedCode = $"CUR-{currencyId:D6}";
                await using var codeUpdate = db.CreateCommand(); codeUpdate.Transaction = tx; codeUpdate.CommandText = "UPDATE dbo.Currencies SET CurrencyCode=@code,UpdatedAt=SYSUTCDATETIME() WHERE CurrencyId=@id"; Add(codeUpdate, "@code", generatedCode, DbType.String, 20); Add(codeUpdate, "@id", currencyId, DbType.Int32); await codeUpdate.ExecuteNonQueryAsync(ct);
            }
            await tx.CommitAsync(ct); return (await GetAsync(true, ct)).First(item => item.CurrencyId == currencyId);
        }
        catch { await tx.RollbackAsync(ct); throw; }
    }
    public async Task<bool> SetActiveAsync(int id, bool active, CancellationToken ct) { await using var db = await OpenAsync(ct); if (!active) { await using var primary = db.CreateCommand(); primary.CommandText = "SELECT IsPrimary FROM dbo.Currencies WHERE CurrencyId=@id"; Add(primary, "@id", id, DbType.Int32); if (Convert.ToBoolean(await primary.ExecuteScalarAsync(ct))) throw new CurrencyException("The primary currency must remain active."); } await using var cmd = db.CreateCommand(); cmd.CommandText = "UPDATE dbo.Currencies SET IsActive=@active,UpdatedAt=SYSUTCDATETIME() WHERE CurrencyId=@id"; Add(cmd, "@active", active, DbType.Boolean); Add(cmd, "@id", id, DbType.Int32); return await cmd.ExecuteNonQueryAsync(ct) > 0; }
    public async Task<CurrencyRateDto> SetRateAsync(int currencyId, CurrencyRateWriteRequest request, CancellationToken ct)
    {
        if (request.Rate <= 0 || request.Rate > 999999999999.99999999m) throw new CurrencyException("Exchange rate must be greater than zero.");
        await using var db = await OpenAsync(ct); await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            int baseCurrencyId;
            await using (var primary = db.CreateCommand()) { primary.Transaction = tx; primary.CommandText = "SELECT TOP (1) CurrencyId FROM dbo.Currencies WITH (UPDLOCK,HOLDLOCK) WHERE IsPrimary=1 AND IsActive=1"; var value = await primary.ExecuteScalarAsync(ct); if (value is null || value == DBNull.Value) throw new CurrencyException("Set an active primary currency before managing exchange rates."); baseCurrencyId = Convert.ToInt32(value); }
            await using (var target = db.CreateCommand()) { target.Transaction = tx; target.CommandText = "SELECT IsPrimary,IsActive FROM dbo.Currencies WITH (UPDLOCK,HOLDLOCK) WHERE CurrencyId=@id"; Add(target, "@id", currencyId, DbType.Int32); await using var reader = await target.ExecuteReaderAsync(ct); if (!await reader.ReadAsync(ct)) throw new CurrencyException("Currency was not found.", 404); if (reader.GetBoolean(0)) throw new CurrencyException("The primary currency does not need an exchange rate."); if (!reader.GetBoolean(1)) throw new CurrencyException("Only active currencies can have an exchange rate."); }
            await using var insert = db.CreateCommand(); insert.Transaction = tx; insert.CommandText = "INSERT INTO dbo.CurrencyRateHistory(CurrencyId,BaseCurrencyId,Rate) OUTPUT INSERTED.CurrencyRateId,INSERTED.CurrencyId,INSERTED.BaseCurrencyId,INSERTED.Rate,INSERTED.RecordedAt VALUES(@currency,@base,@rate)"; Add(insert, "@currency", currencyId, DbType.Int32); Add(insert, "@base", baseCurrencyId, DbType.Int32); Add(insert, "@rate", request.Rate, DbType.Decimal); insert.Parameters["@rate"].Precision = 19; insert.Parameters["@rate"].Scale = 8;
            CurrencyRateDto dto;
            await using (var result = await insert.ExecuteReaderAsync(ct)) { await result.ReadAsync(ct); dto = new CurrencyRateDto(result.GetInt32(0), result.GetInt32(1), result.GetInt32(2), result.GetDecimal(3), result.GetDateTime(4)); }
            await tx.CommitAsync(ct); return dto;
        }
        catch { await tx.RollbackAsync(ct); throw; }
    }
    public async Task<IReadOnlyList<CurrencyRateDto>> GetRateHistoryAsync(int currencyId, DateTime? fromInclusive, DateTime? toExclusive, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        await using var command = db.CreateCommand();
        command.CommandText = "SELECT h.CurrencyRateId,h.CurrencyId,h.BaseCurrencyId,h.Rate,h.RecordedAt FROM dbo.CurrencyRateHistory h WHERE h.CurrencyId=@id AND (@from IS NULL OR h.RecordedAt >= @from) AND (@to IS NULL OR h.RecordedAt < @to) ORDER BY h.RecordedAt DESC,h.CurrencyRateId DESC";
        Add(command, "@id", currencyId, DbType.Int32);
        Add(command, "@from", fromInclusive, DbType.DateTime2);
        Add(command, "@to", toExclusive, DbType.DateTime2);
        await using var reader = await command.ExecuteReaderAsync(ct);
        var history = new List<CurrencyRateDto>();
        while (await reader.ReadAsync(ct)) history.Add(new CurrencyRateDto(reader.GetInt32(0), reader.GetInt32(1), reader.GetInt32(2), reader.GetDecimal(3), reader.GetDateTime(4)));
        return history;
    }
    public async Task<int> SetRatesAsync(CurrencyRateBatchRequest request, CancellationToken ct)
    {
        if (request.Rates is null || request.Rates.Count == 0) return 0;
        if (request.Rates.GroupBy(item => item.CurrencyId).Any(group => group.Count() > 1)) throw new CurrencyException("A currency may appear only once in a rate update.");
        if (request.Rates.Any(item => item.Rate <= 0 || item.Rate > 999999999999.99999999m)) throw new CurrencyException("Exchange rates must be greater than zero.");
        await using var db = await OpenAsync(ct); await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            int baseCurrencyId;
            await using (var primary = db.CreateCommand()) { primary.Transaction = tx; primary.CommandText = "SELECT TOP (1) CurrencyId FROM dbo.Currencies WITH (UPDLOCK,HOLDLOCK) WHERE IsPrimary=1 AND IsActive=1"; var value = await primary.ExecuteScalarAsync(ct); if (value is null || value == DBNull.Value) throw new CurrencyException("Set an active primary currency before managing exchange rates."); baseCurrencyId = Convert.ToInt32(value); }
            var changed = 0;
            foreach (var update in request.Rates)
            {
                decimal? currentRate = null;
                await using (var target = db.CreateCommand()) { target.Transaction = tx; target.CommandText = "SELECT IsPrimary,IsActive,(SELECT TOP (1) h.Rate FROM dbo.CurrencyRateHistory h WHERE h.CurrencyId=c.CurrencyId AND h.BaseCurrencyId=@base ORDER BY h.RecordedAt DESC,h.CurrencyRateId DESC) FROM dbo.Currencies c WITH (UPDLOCK,HOLDLOCK) WHERE c.CurrencyId=@id"; Add(target, "@base", baseCurrencyId, DbType.Int32); Add(target, "@id", update.CurrencyId, DbType.Int32); await using var reader = await target.ExecuteReaderAsync(ct); if (!await reader.ReadAsync(ct)) throw new CurrencyException("Currency was not found.", 404); if (reader.GetBoolean(0)) throw new CurrencyException("The primary currency does not need an exchange rate."); if (!reader.GetBoolean(1)) throw new CurrencyException("Only active currencies can have an exchange rate."); if (!reader.IsDBNull(2)) currentRate = reader.GetDecimal(2); }
                if (currentRate.HasValue && currentRate.Value == update.Rate) continue;
                await using var insert = db.CreateCommand(); insert.Transaction = tx; insert.CommandText = "INSERT INTO dbo.CurrencyRateHistory(CurrencyId,BaseCurrencyId,Rate) VALUES(@currency,@base,@rate)"; Add(insert, "@currency", update.CurrencyId, DbType.Int32); Add(insert, "@base", baseCurrencyId, DbType.Int32); Add(insert, "@rate", update.Rate, DbType.Decimal); insert.Parameters["@rate"].Precision = 19; insert.Parameters["@rate"].Scale = 8; await insert.ExecuteNonQueryAsync(ct); changed++;
            }
            await tx.CommitAsync(ct); return changed;
        }
        catch { await tx.RollbackAsync(ct); throw; }
    }
    private static void Validate(CurrencyWriteRequest r) { if (string.IsNullOrWhiteSpace(r.CurrencyNameEn) || string.IsNullOrWhiteSpace(r.CurrencyNameAr)) throw new CurrencyException("Arabic and English currency names are required."); if (r.CurrencyNameEn.Trim().Length > 150 || r.CurrencyNameAr.Trim().Length > 150 || (r.Symbol?.Trim().Length ?? 0) > 20) throw new CurrencyException("Currency fields exceed their maximum length."); if (!string.IsNullOrWhiteSpace(r.FlagBase64) && (r.FlagBase64.Length > 1000000 || !r.FlagBase64.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))) throw new CurrencyException("Flag must be a supported image smaller than 750 KB."); }
    private async Task<DbConnection> OpenAsync(CancellationToken ct) { var db = factory.CreateConnection(); await db.OpenAsync(ct); return db; }
    private static CurrencyDto Read(DbDataReader r) => new(r.GetInt32(0), r.GetString(1), r.GetString(2), r.GetString(3), r.GetString(4), r.GetBoolean(5), r.GetBoolean(6), r.GetDateTime(7), r.IsDBNull(8) ? null : r.GetDecimal(8), r.IsDBNull(9) ? null : r.GetString(9));
    private static void Add(DbCommand c, string n, object? v, DbType t, int? size = null) { var p = c.CreateParameter(); p.ParameterName = n; p.DbType = t; if (size.HasValue) p.Size = size.Value; p.Value = v ?? DBNull.Value; c.Parameters.Add(p); }
}
public sealed class CurrencyException(string message, int statusCode = 400) : Exception(message) { public int StatusCode { get; } = statusCode; }
