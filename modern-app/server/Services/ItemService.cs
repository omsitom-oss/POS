using System.Data;
using System.Data.Common;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

public sealed class ItemService(DbConnectionFactory factory)
{
    public async Task<IReadOnlyList<ItemDto>> GetAsync(bool includeInactive, CancellationToken ct)
    {
        await using var db = factory.CreateConnection();
        await db.OpenAsync(ct);
        await using var command = db.CreateCommand();
        command.CommandText = """
            SELECT i.ItemId, i.ItemCode, i.NameAr, i.NameEn, i.ManufacturerName,
                   i.ImageBase64, i.CategorySettingId, i.GenericSettingId, category.ValueAr, category.ValueEn, unit.ValueAr, unit.ValueEn,
                   i.SellPrice, lastPurchase.LastPurchasePrice, i.MinimumLevelForAlert, i.IsActive
            FROM dbo.Items AS i
            LEFT JOIN dbo.Settings AS category ON category.SettingId = i.CategorySettingId
            OUTER APPLY (
                SELECT TOP (1) setting.ValueAr, setting.ValueEn
                FROM dbo.ItemUnits AS itemUnit
                JOIN dbo.Settings AS setting ON setting.SettingId = itemUnit.UnitSettingId
                WHERE itemUnit.ItemId = i.ItemId AND itemUnit.IsBase = 1
            ) AS unit
            OUTER APPLY (
                SELECT TOP (1) pl.UnitPrice / NULLIF(COALESCE(iu.ConversionToBase, 1), 0) AS LastPurchasePrice
                FROM dbo.PurchaseLines pl
                JOIN dbo.Purchases p ON p.PurchaseId = pl.PurchaseId AND p.Status = N'POSTED'
                LEFT JOIN dbo.ItemUnits iu ON iu.ItemId = pl.ItemId AND iu.UnitSettingId = pl.UnitSettingId
                WHERE pl.ItemId = i.ItemId
                ORDER BY COALESCE(p.PostedAt, p.CreatedAt) DESC, p.PurchaseId DESC, pl.PurchaseLineId DESC
            ) AS lastPurchase
            WHERE @includeInactive = 1 OR i.IsActive = 1
            ORDER BY i.ItemCode
            """;
        Add(command, "@includeInactive", includeInactive, DbType.Boolean);
        await using var reader = await command.ExecuteReaderAsync(ct);
        var rows = new List<ItemDto>();
        while (await reader.ReadAsync(ct)) rows.Add(Read(reader));
        return rows;
    }

    public async Task<ItemDetailsDto?> GetDetailsAsync(long id, CancellationToken ct)
    {
        var item = (await GetAsync(true, ct)).FirstOrDefault(row => row.ItemId == id);
        if (item is null) return null;
        await using var db = factory.CreateConnection(); await db.OpenAsync(ct); await using var command = db.CreateCommand();
        command.CommandText = "SELECT iu.UnitSettingId,u.ValueAr,u.ValueEn,iu.ConversionToBase,iu.IsBase,iu.SortOrder FROM dbo.ItemUnits iu JOIN dbo.Settings u ON u.SettingId=iu.UnitSettingId WHERE iu.ItemId=@id ORDER BY iu.SortOrder,iu.ItemUnitId";
        Add(command, "@id", id, DbType.Int64);
        await using var reader = await command.ExecuteReaderAsync(ct); var units = new List<ItemUnitDto>(); while (await reader.ReadAsync(ct)) units.Add(new ItemUnitDto(reader.GetInt32(0), reader.GetString(1), reader.GetString(2), reader.GetDecimal(3), reader.GetBoolean(4), reader.GetInt32(5))); await reader.CloseAsync();
        await using var historyCommand = db.CreateCommand(); historyCommand.CommandText = "SELECT h.ItemPriceHistoryId,h.PreviousPrice,h.NewPrice,h.UserId,u.UserName,h.ChangedAt FROM dbo.ItemPriceHistory h LEFT JOIN dbo.Users u ON u.UserId=h.UserId WHERE h.ItemId=@id ORDER BY h.ChangedAt DESC,h.ItemPriceHistoryId DESC"; Add(historyCommand, "@id", id, DbType.Int64);
        await using var historyReader = await historyCommand.ExecuteReaderAsync(ct); var history = new List<ItemPriceHistoryDto>(); while (await historyReader.ReadAsync(ct)) history.Add(new ItemPriceHistoryDto(historyReader.GetInt64(0), historyReader.IsDBNull(1) ? null : historyReader.GetDecimal(1), historyReader.GetDecimal(2), historyReader.IsDBNull(3) ? null : historyReader.GetInt32(3), historyReader.IsDBNull(4) ? null : historyReader.GetString(4), historyReader.GetDateTime(5)));
        return new ItemDetailsDto(item, units, history);
    }

    public async Task<ItemDto?> SaveAsync(long? id, ItemWriteRequest request, CancellationToken ct)
    {
        Validate(request);
        await using var db = factory.CreateConnection();
        await db.OpenAsync(ct);
        await using var transaction = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            long itemId;
            decimal? previousPrice = null;
            if (id.HasValue)
            {
                await using (var current = db.CreateCommand()) { current.Transaction = transaction; current.CommandText = "SELECT SellPrice FROM dbo.Items WHERE ItemId=@id"; Add(current, "@id", id.Value, DbType.Int64); var value = await current.ExecuteScalarAsync(ct); if (value is null || value == DBNull.Value) return null; previousPrice = Convert.ToDecimal(value); }
                await using var update = db.CreateCommand();
                update.Transaction = transaction;
                update.CommandText = "UPDATE dbo.Items SET NameAr=@ar,NameEn=@en,ManufacturerName=@manufacturer,CategorySettingId=@category,GenericSettingId=@generic,ImageBase64=@image,SellPrice=@price,MinimumLevelForAlert=@minimum,IsActive=@active,UpdatedAt=SYSUTCDATETIME() WHERE ItemId=@id";
                Add(update, "@ar", request.NameAr!.Trim(), DbType.String, 250); Add(update, "@en", request.NameEn!.Trim(), DbType.String, 250); Add(update, "@manufacturer", request.ManufacturerName?.Trim(), DbType.String, 250); Add(update, "@category", request.CategorySettingId, DbType.Int32); Add(update, "@generic", request.GenericSettingId, DbType.Int32); Add(update, "@image", request.ImageBase64, DbType.String); Add(update, "@price", request.SellPrice, DbType.Decimal); Add(update, "@minimum", request.MinimumLevelForAlert, DbType.Int32); Add(update, "@active", request.IsActive, DbType.Boolean); Add(update, "@id", id.Value, DbType.Int64);
                update.Parameters["@price"].Precision = 19; update.Parameters["@price"].Scale = 4;
                if (await update.ExecuteNonQueryAsync(ct) == 0) return null;
                itemId = id.Value;
            }
            else
            {
                await using var insert = db.CreateCommand();
                insert.Transaction = transaction;
                insert.CommandText = "INSERT INTO dbo.Items(ItemCode,NameAr,NameEn,ManufacturerName,CategorySettingId,GenericSettingId,ImageBase64,SellPrice,MinimumLevelForAlert,IsActive,BranchId) OUTPUT INSERTED.ItemId VALUES(@code,@ar,@en,@manufacturer,@category,@generic,@image,@price,@minimum,@active,(SELECT TOP 1 BranchId FROM dbo.Branches ORDER BY BranchId))";
                Add(insert, "@code", $"P-{Guid.NewGuid():N}"[..18], DbType.String, 50); Add(insert, "@ar", request.NameAr!.Trim(), DbType.String, 250); Add(insert, "@en", request.NameEn!.Trim(), DbType.String, 250); Add(insert, "@manufacturer", request.ManufacturerName?.Trim(), DbType.String, 250); Add(insert, "@category", request.CategorySettingId, DbType.Int32); Add(insert, "@generic", request.GenericSettingId, DbType.Int32); Add(insert, "@image", request.ImageBase64, DbType.String); Add(insert, "@price", request.SellPrice, DbType.Decimal); Add(insert, "@minimum", request.MinimumLevelForAlert, DbType.Int32); Add(insert, "@active", request.IsActive, DbType.Boolean); insert.Parameters["@price"].Precision = 19; insert.Parameters["@price"].Scale = 4;
                itemId = Convert.ToInt64(await insert.ExecuteScalarAsync(ct));
                await using var code = db.CreateCommand(); code.Transaction = transaction; code.CommandText = "UPDATE dbo.Items SET ItemCode=@code,UpdatedAt=SYSUTCDATETIME() WHERE ItemId=@id"; Add(code, "@code", $"ITM-{itemId:D6}", DbType.String, 50); Add(code, "@id", itemId, DbType.Int64); await code.ExecuteNonQueryAsync(ct);
            }

            await using (var deleteUnits = db.CreateCommand()) { deleteUnits.Transaction = transaction; deleteUnits.CommandText = "DELETE FROM dbo.ItemUnits WHERE ItemId=@id"; Add(deleteUnits, "@id", itemId, DbType.Int64); await deleteUnits.ExecuteNonQueryAsync(ct); }
            foreach (var unit in request.Units!)
            {
                await using var addUnit = db.CreateCommand(); addUnit.Transaction = transaction; addUnit.CommandText = "INSERT INTO dbo.ItemUnits(ItemId,UnitSettingId,ConversionToBase,IsBase,SortOrder) VALUES(@item,@unit,@conversion,@base,@sort)"; Add(addUnit, "@item", itemId, DbType.Int64); Add(addUnit, "@unit", unit.UnitSettingId, DbType.Int32); Add(addUnit, "@conversion", unit.ConversionToBase, DbType.Decimal); Add(addUnit, "@base", unit.IsBase, DbType.Boolean); Add(addUnit, "@sort", unit.SortOrder, DbType.Int32); addUnit.Parameters["@conversion"].Precision = 19; addUnit.Parameters["@conversion"].Scale = 6; await addUnit.ExecuteNonQueryAsync(ct);
            }
            if (!previousPrice.HasValue || previousPrice.Value != request.SellPrice)
            {
                await using var priceHistory = db.CreateCommand(); priceHistory.Transaction = transaction; priceHistory.CommandText = "INSERT INTO dbo.ItemPriceHistory(ItemId,PreviousPrice,NewPrice,UserId) VALUES(@item,@previous,@new,@user)"; Add(priceHistory, "@item", itemId, DbType.Int64); Add(priceHistory, "@previous", previousPrice, DbType.Decimal); Add(priceHistory, "@new", request.SellPrice, DbType.Decimal); Add(priceHistory, "@user", request.UserId, DbType.Int32); priceHistory.Parameters["@previous"].Precision = 19; priceHistory.Parameters["@previous"].Scale = 4; priceHistory.Parameters["@new"].Precision = 19; priceHistory.Parameters["@new"].Scale = 4; await priceHistory.ExecuteNonQueryAsync(ct);
            }
            await transaction.CommitAsync(ct);
            return (await GetAsync(true, ct)).First(item => item.ItemId == itemId);
        }
        catch { await transaction.RollbackAsync(ct); throw; }
    }

    private static void Validate(ItemWriteRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NameAr) || string.IsNullOrWhiteSpace(request.NameEn)) throw new ItemException("Arabic and English item names are required.");
        if (request.SellPrice < 0 || request.MinimumLevelForAlert < 0) throw new ItemException("Price and minimum alert level cannot be negative.");
        if (!string.IsNullOrWhiteSpace(request.ImageBase64) && (request.ImageBase64.Length > 2000000 || !request.ImageBase64.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))) throw new ItemException("Item image must be a supported image smaller than 1.5 MB.");
        if (request.Units is null || request.Units.Count == 0 || request.Units.Count(unit => unit.IsBase) != 1) throw new ItemException("Add at least one unit and mark exactly one as the base unit.");
        if (request.Units.Any(unit => unit.UnitSettingId <= 0 || unit.ConversionToBase <= 0 || unit.SortOrder < 0) || request.Units.Select(unit => unit.UnitSettingId).Distinct().Count() != request.Units.Count) throw new ItemException("Each unit must be unique and have a positive conversion.");
    }

    private static ItemDto Read(DbDataReader reader) => new(
        reader.GetInt64(0), reader.GetString(1), reader.GetString(2), reader.GetString(3),
        reader.IsDBNull(4) ? null : reader.GetString(4), reader.IsDBNull(5) ? null : reader.GetString(5), reader.IsDBNull(6) ? null : reader.GetInt32(6), reader.IsDBNull(7) ? null : reader.GetInt32(7),
        reader.IsDBNull(8) ? null : reader.GetString(8), reader.IsDBNull(9) ? null : reader.GetString(9),
        reader.IsDBNull(10) ? null : reader.GetString(10), reader.IsDBNull(11) ? null : reader.GetString(11),
        reader.GetDecimal(12), reader.IsDBNull(13) ? null : reader.GetDecimal(13), reader.GetInt32(14), reader.GetBoolean(15));

    private static void Add(DbCommand command, string name, object? value, DbType type, int? size = null)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.DbType = type;
        if (size.HasValue) parameter.Size = size.Value;
        parameter.Value = value ?? DBNull.Value;
        command.Parameters.Add(parameter);
    }
}

public sealed class ItemException(string message, int statusCode = 400) : Exception(message) { public int StatusCode { get; } = statusCode; }

