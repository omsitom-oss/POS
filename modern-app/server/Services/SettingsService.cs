using System.Data;
using System.Data.Common;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

public sealed class SettingsService(DbConnectionFactory factory)
{
    public async Task<IReadOnlyList<SettingTypeDto>> GetTypesAsync(CancellationToken ct, bool includeInactive = false)
    {
        await using var db = await OpenAsync(ct);
        await using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT t.SettingTypeId,t.Code,t.NameAr,t.NameEn,t.IsHierarchical,t.IsActive,t.SortOrder,COUNT(s.SettingId) AS ActiveSettingCount FROM dbo.SettingTypes t LEFT JOIN dbo.Settings s ON s.SettingTypeId=t.SettingTypeId AND s.IsActive=1 WHERE (@includeInactive=1 OR t.IsActive=1) GROUP BY t.SettingTypeId,t.Code,t.NameAr,t.NameEn,t.IsHierarchical,t.IsActive,t.SortOrder ORDER BY t.SortOrder,t.NameEn";
        Add(cmd, "@includeInactive", includeInactive, DbType.Boolean);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var rows = new List<SettingTypeDto>();
        while (await reader.ReadAsync(ct)) rows.Add(ReadType(reader));
        return rows;
    }

    public async Task<SettingTypeDto> CreateTypeAsync(SettingTypeWriteRequest request, CancellationToken ct)
    {
        ValidateTypeText(request);
        await using var db = await OpenAsync(ct);
        await using var transaction = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            await using var order = db.CreateCommand();
            order.Transaction = transaction;
            order.CommandText = "SELECT COALESCE(MAX(SortOrder),0)+1 FROM dbo.SettingTypes WITH (TABLOCKX,HOLDLOCK)";
            var sortOrder = Convert.ToInt32(await order.ExecuteScalarAsync(ct));

            var temporaryCode = $"TYPE-PENDING-{Guid.NewGuid():N}";
            await using var insert = db.CreateCommand();
            insert.Transaction = transaction;
            insert.CommandText = "INSERT INTO dbo.SettingTypes(Code,NameAr,NameEn,IsHierarchical,IsActive,SortOrder) OUTPUT INSERTED.SettingTypeId VALUES(@code,@ar,@en,@hierarchical,@active,@sort)";
            Add(insert, "@code", temporaryCode, DbType.String, 50);
            Add(insert, "@ar", request.NameAr!.Trim(), DbType.String, 150);
            Add(insert, "@en", request.NameEn!.Trim(), DbType.String, 150);
            Add(insert, "@hierarchical", request.IsHierarchical, DbType.Boolean);
            Add(insert, "@active", request.IsActive, DbType.Boolean);
            Add(insert, "@sort", sortOrder, DbType.Int32);
            var id = Convert.ToInt32(await insert.ExecuteScalarAsync(ct));

            var code = $"TYPE-{id:D6}";
            await using var update = db.CreateCommand();
            update.Transaction = transaction;
            update.CommandText = "UPDATE dbo.SettingTypes SET Code=@code,UpdatedAt=SYSUTCDATETIME() WHERE SettingTypeId=@id";
            Add(update, "@code", code, DbType.String, 50);
            Add(update, "@id", id, DbType.Int32);
            await update.ExecuteNonQueryAsync(ct);
            await transaction.CommitAsync(ct);
            return new SettingTypeDto(id, code, request.NameAr!.Trim(), request.NameEn!.Trim(), request.IsHierarchical, request.IsActive, sortOrder, 0);
        }
        catch
        {
            await transaction.RollbackAsync(ct);
            throw;
        }
    }

    public async Task<SettingTypeDto?> UpdateTypeAsync(int id, SettingTypeWriteRequest request, CancellationToken ct)
    {
        ValidateTypeText(request);
        await using var db = await OpenAsync(ct);
        await using var transaction = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            await using var current = db.CreateCommand();
            current.Transaction = transaction;
            current.CommandText = "SELECT SettingTypeId,Code,NameAr,NameEn,IsHierarchical,IsActive,SortOrder FROM dbo.SettingTypes WITH (UPDLOCK,HOLDLOCK) WHERE SettingTypeId=@id";
            Add(current, "@id", id, DbType.Int32);
            int settingTypeId;
            string code;
            int sortOrder;
            await using (var reader = await current.ExecuteReaderAsync(ct))
            {
                if (!await reader.ReadAsync(ct)) { await transaction.RollbackAsync(ct); return null; }
                settingTypeId = reader.GetInt32(0);
                code = reader.GetString(1);
                sortOrder = reader.GetInt32(6);
            }

            if (!request.IsHierarchical)
            {
                await using var hasParent = db.CreateCommand();
                hasParent.Transaction = transaction;
                hasParent.CommandText = "SELECT TOP(1) 1 FROM dbo.Settings WITH (UPDLOCK,HOLDLOCK) WHERE SettingTypeId=@id AND ParentSettingId IS NOT NULL";
                Add(hasParent, "@id", id, DbType.Int32);
                if (await hasParent.ExecuteScalarAsync(ct) is not null)
                    throw new SettingsException("This setting type has parent/child values. Move or remove those relationships before making it flat.");
            }

            await using var update = db.CreateCommand();
            update.Transaction = transaction;
            update.CommandText = "UPDATE dbo.SettingTypes SET NameAr=@ar,NameEn=@en,IsHierarchical=@hierarchical,IsActive=@active,UpdatedAt=SYSUTCDATETIME() WHERE SettingTypeId=@id";
            Add(update, "@ar", request.NameAr!.Trim(), DbType.String, 150);
            Add(update, "@en", request.NameEn!.Trim(), DbType.String, 150);
            Add(update, "@hierarchical", request.IsHierarchical, DbType.Boolean);
            Add(update, "@active", request.IsActive, DbType.Boolean);
            Add(update, "@id", id, DbType.Int32);
            await update.ExecuteNonQueryAsync(ct);
            var count = await GetActiveCountAsync(db, id, transaction, ct);
            await transaction.CommitAsync(ct);
            return new SettingTypeDto(settingTypeId, code, request.NameAr!.Trim(), request.NameEn!.Trim(), request.IsHierarchical, request.IsActive, sortOrder, count);
        }
        catch
        {
            await transaction.RollbackAsync(ct);
            throw;
        }
    }

    public async Task<bool> SetTypeActiveAsync(int id, bool active, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        await using var cmd = db.CreateCommand();
        cmd.CommandText = "UPDATE dbo.SettingTypes SET IsActive=@active,UpdatedAt=SYSUTCDATETIME() WHERE SettingTypeId=@id";
        Add(cmd, "@active", active, DbType.Boolean);
        Add(cmd, "@id", id, DbType.Int32);
        return await cmd.ExecuteNonQueryAsync(ct) > 0;
    }

    public async Task<SettingTypeDto?> GetTypeAsync(string code, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        return await GetTypeAsync(db, code, ct);
    }

    public async Task<IReadOnlyList<SettingDto>?> GetItemsAsync(string code, string? search, bool? active, int? parent, bool roots, CancellationToken ct)
    {
        var type = await GetTypeAsync(code, ct);
        if (type is null) return null;
        await using var db = await OpenAsync(ct);
        await using var cmd = db.CreateCommand();
        var sql = "SELECT s.SettingId,s.SettingTypeId,s.ParentSettingId,s.Code,s.ValueAr,s.ValueEn,s.SortOrder,s.IsActive,s.CreatedAt,s.UpdatedAt FROM dbo.Settings s WHERE s.SettingTypeId=@type";
        Add(cmd, "@type", type.SettingTypeId, DbType.Int32);
        if (active.HasValue) { sql += " AND s.IsActive=@active"; Add(cmd, "@active", active.Value, DbType.Boolean); }
        if (roots) sql += " AND s.ParentSettingId IS NULL";
        else if (parent.HasValue) { sql += " AND s.ParentSettingId=@parent"; Add(cmd, "@parent", parent.Value, DbType.Int32); }
        if (!string.IsNullOrWhiteSpace(search))
        {
            sql += " AND (s.Code LIKE @search OR s.ValueAr LIKE @search OR s.ValueEn LIKE @search)";
            Add(cmd, "@search", "%" + search.Trim() + "%", DbType.String, 420);
        }
        cmd.CommandText = sql + " ORDER BY s.SortOrder,s.ValueEn";
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var result = new List<SettingDto>();
        while (await reader.ReadAsync(ct)) result.Add(ReadSetting(reader));
        return result;
    }

    public async Task<IReadOnlyList<SettingTreeDto>?> GetTreeAsync(string code, CancellationToken ct)
    {
        var type = await GetTypeAsync(code, ct);
        if (type is null) return null;
        if (!type.IsHierarchical) throw new SettingsException("This setting type is not hierarchical.", 400);
        var rows = await GetItemsAsync(code, null, null, null, false, ct) ?? [];
        var nodes = rows.ToDictionary(item => item.SettingId, item => new MutableTree(item));
        var roots = new List<MutableTree>();
        foreach (var node in nodes.Values.OrderBy(item => item.Item.SortOrder).ThenBy(item => item.Item.ValueEn, StringComparer.OrdinalIgnoreCase))
        {
            if (node.Item.ParentSettingId is int parentId && nodes.TryGetValue(parentId, out var parent)) parent.Children.Add(node);
            else roots.Add(node);
        }
        return roots.Select(ToTree).ToArray();
    }

    public async Task<SettingDto?> CreateAsync(string typeCode, SettingWriteRequest request, CancellationToken ct)
    {
        ValidateText(request);
        await using var db = await OpenAsync(ct);
        var type = await GetTypeAsync(db, typeCode, ct);
        if (type is null) return null;
        await ValidateParentAsync(db, type, request.ParentSettingId, null, ct);

        // Serializable isolation plus a range lock on the (type,parent) index makes sibling order allocation safe.
        await using var transaction = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            await using var orderCommand = db.CreateCommand();
            orderCommand.Transaction = transaction;
            orderCommand.CommandText = "SELECT ISNULL(MAX(SortOrder),0)+1 FROM dbo.Settings WITH (UPDLOCK,HOLDLOCK,INDEX(IX_Settings_Type_Parent)) WHERE SettingTypeId=@type AND ((ParentSettingId=@parent) OR (ParentSettingId IS NULL AND @parent IS NULL))";
            Add(orderCommand, "@type", type.SettingTypeId, DbType.Int32);
            Add(orderCommand, "@parent", request.ParentSettingId, DbType.Int32);
            var sortOrder = Convert.ToInt32(await orderCommand.ExecuteScalarAsync(ct));

            await using var insert = db.CreateCommand();
            insert.Transaction = transaction;
            insert.CommandText = "INSERT INTO dbo.Settings(SettingTypeId,ParentSettingId,Code,ValueAr,ValueEn,SortOrder,IsActive) OUTPUT INSERTED.SettingId VALUES(@type,@parent,NULL,@ar,@en,@sort,@active)";
            Add(insert, "@type", type.SettingTypeId, DbType.Int32);
            Add(insert, "@parent", request.ParentSettingId, DbType.Int32);
            Add(insert, "@ar", request.ValueAr!.Trim(), DbType.String, 200);
            Add(insert, "@en", request.ValueEn!.Trim(), DbType.String, 200);
            Add(insert, "@sort", sortOrder, DbType.Int32);
            Add(insert, "@active", request.IsActive, DbType.Boolean);
            var settingId = Convert.ToInt32(await insert.ExecuteScalarAsync(ct));

            var generatedCode = await FindAvailableCodeAsync(db, transaction, type.SettingTypeId, settingId, ct);
            await using var update = db.CreateCommand();
            update.Transaction = transaction;
            update.CommandText = "UPDATE dbo.Settings SET Code=@code WHERE SettingId=@id";
            Add(update, "@code", generatedCode, DbType.String, 50);
            Add(update, "@id", settingId, DbType.Int32);
            await update.ExecuteNonQueryAsync(ct);
            await transaction.CommitAsync(ct);
            return await GetByIdAsync(db, settingId, ct);
        }
        catch
        {
            await transaction.RollbackAsync(ct);
            throw;
        }
    }

    public async Task<SettingDto?> UpdateAsync(int id, SettingWriteRequest request, CancellationToken ct)
    {
        ValidateText(request);
        await using var db = await OpenAsync(ct);
        var existing = await GetByIdAsync(db, id, ct);
        if (existing is null) return null;
        var type = await GetTypeAsyncByIdAsync(db, existing.SettingTypeId, ct);
        if (type is null) return null;
        await ValidateParentAsync(db, type, request.ParentSettingId, id, ct);

        await using var transaction = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            var sortOrder = existing.SortOrder;
            if (existing.ParentSettingId != request.ParentSettingId)
            {
                await using var order = db.CreateCommand();
                order.Transaction = transaction;
                order.CommandText = "SELECT ISNULL(MAX(SortOrder),0)+1 FROM dbo.Settings WITH (UPDLOCK,HOLDLOCK,INDEX(IX_Settings_Type_Parent)) WHERE SettingTypeId=@type AND ((ParentSettingId=@parent) OR (ParentSettingId IS NULL AND @parent IS NULL))";
                Add(order, "@type", type.SettingTypeId, DbType.Int32);
                Add(order, "@parent", request.ParentSettingId, DbType.Int32);
                sortOrder = Convert.ToInt32(await order.ExecuteScalarAsync(ct));
            }
            await using var cmd = db.CreateCommand();
            cmd.Transaction = transaction;
            cmd.CommandText = "UPDATE dbo.Settings SET ParentSettingId=@parent,ValueAr=@ar,ValueEn=@en,IsActive=@active,SortOrder=@sort,UpdatedAt=SYSUTCDATETIME() WHERE SettingId=@id";
            Add(cmd, "@parent", request.ParentSettingId, DbType.Int32);
            Add(cmd, "@ar", request.ValueAr!.Trim(), DbType.String, 200);
            Add(cmd, "@en", request.ValueEn!.Trim(), DbType.String, 200);
            Add(cmd, "@active", request.IsActive, DbType.Boolean);
            Add(cmd, "@sort", sortOrder, DbType.Int32);
            Add(cmd, "@id", id, DbType.Int32);
            await cmd.ExecuteNonQueryAsync(ct);
            await transaction.CommitAsync(ct);
        }
        catch
        {
            await transaction.RollbackAsync(ct);
            throw;
        }
        return await GetByIdAsync(db, id, ct);
    }

    public async Task<bool> SetActiveAsync(int id, bool active, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        var setting = await GetByIdAsync(db, id, ct);
        if (setting is null) return false;
        await using var transaction = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            // Hold the type's hierarchy range while checking and changing status so a concurrent
            // child insert cannot race the active-descendant rule.
            var rows = await GetTypeItemsForUpdateAsync(db, transaction, setting.SettingTypeId, ct);
            if (!active)
            {
                var children = rows.ToLookup(item => item.ParentSettingId);
                var pending = new Queue<int>(children[id].Select(item => item.SettingId));
                var descendants = new HashSet<int>();
                while (pending.TryDequeue(out var descendantId))
                {
                    if (!descendants.Add(descendantId)) continue;
                    foreach (var child in children[descendantId]) pending.Enqueue(child.SettingId);
                }
                if (rows.Any(item => descendants.Contains(item.SettingId) && item.IsActive))
                    throw new SettingsException("Deactivate active descendants before deactivating this setting.");
            }

            await using var cmd = db.CreateCommand();
            cmd.Transaction = transaction;
            cmd.CommandText = "UPDATE dbo.Settings SET IsActive=@active,UpdatedAt=SYSUTCDATETIME() WHERE SettingId=@id";
            Add(cmd, "@active", active, DbType.Boolean);
            Add(cmd, "@id", id, DbType.Int32);
            var updated = await cmd.ExecuteNonQueryAsync(ct) > 0;
            await transaction.CommitAsync(ct);
            return updated;
        }
        catch
        {
            await transaction.RollbackAsync(ct);
            throw;
        }
    }

    private async Task ValidateParentAsync(DbConnection db, SettingTypeDto type, int? parentId, int? currentId, CancellationToken ct)
    {
        if (!type.IsHierarchical && parentId.HasValue) throw new SettingsException("Flat setting types cannot have a parent.");
        if (parentId is null) return;
        if (currentId == parentId) throw new SettingsException("A setting cannot be its own parent.");
        var all = await GetTypeItemsByIdAsync(db, type.SettingTypeId, ct);
        var map = all.ToDictionary(item => item.SettingId);
        if (!map.ContainsKey(parentId.Value)) throw new SettingsException("Parent must belong to the same setting type.");
        if (currentId.HasValue)
        {
            var seen = new HashSet<int>();
            var cursor = parentId;
            while (cursor.HasValue)
            {
                if (cursor == currentId) throw new SettingsException("This parent would create a hierarchy cycle.");
                if (!seen.Add(cursor.Value)) throw new SettingsException("Existing hierarchy contains a cycle.", 409);
                cursor = map.TryGetValue(cursor.Value, out var item) ? item.ParentSettingId : null;
            }
        }
    }

    private async Task<string> FindAvailableCodeAsync(DbConnection db, DbTransaction transaction, int typeId, int settingId, CancellationToken ct)
    {
        var baseCode = $"ST-{settingId:000000}";
        for (var suffix = 0; ; suffix++)
        {
            var candidate = suffix == 0 ? baseCode : $"{baseCode}-{suffix:00}";
            await using var cmd = db.CreateCommand();
            cmd.Transaction = transaction;
            cmd.CommandText = "SELECT CASE WHEN EXISTS(SELECT 1 FROM dbo.Settings WITH (UPDLOCK,HOLDLOCK) WHERE SettingTypeId=@type AND Code=@code AND SettingId<>@id) THEN 1 ELSE 0 END";
            Add(cmd, "@type", typeId, DbType.Int32);
            Add(cmd, "@code", candidate, DbType.String, 50);
            Add(cmd, "@id", settingId, DbType.Int32);
            if (Convert.ToInt32(await cmd.ExecuteScalarAsync(ct)) == 0) return candidate;
        }
    }

    private async Task<IReadOnlyList<SettingDto>> GetTypeItemsByIdAsync(DbConnection db, int typeId, CancellationToken ct)
    {
        await using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT SettingId,SettingTypeId,ParentSettingId,Code,ValueAr,ValueEn,SortOrder,IsActive,CreatedAt,UpdatedAt FROM dbo.Settings WHERE SettingTypeId=@type";
        Add(cmd, "@type", typeId, DbType.Int32);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var rows = new List<SettingDto>();
        while (await reader.ReadAsync(ct)) rows.Add(ReadSetting(reader));
        return rows;
    }

    private async Task<IReadOnlyList<SettingDto>> GetTypeItemsForUpdateAsync(DbConnection db, DbTransaction transaction, int typeId, CancellationToken ct)
    {
        await using var cmd = db.CreateCommand();
        cmd.Transaction = transaction;
        cmd.CommandText = "SELECT SettingId,SettingTypeId,ParentSettingId,Code,ValueAr,ValueEn,SortOrder,IsActive,CreatedAt,UpdatedAt FROM dbo.Settings WITH (UPDLOCK,HOLDLOCK,INDEX(IX_Settings_Type_Parent)) WHERE SettingTypeId=@type";
        Add(cmd, "@type", typeId, DbType.Int32);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var rows = new List<SettingDto>();
        while (await reader.ReadAsync(ct)) rows.Add(ReadSetting(reader));
        return rows;
    }

    private async Task<SettingDto?> GetByIdAsync(DbConnection db, int id, CancellationToken ct)
    {
        await using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT SettingId,SettingTypeId,ParentSettingId,Code,ValueAr,ValueEn,SortOrder,IsActive,CreatedAt,UpdatedAt FROM dbo.Settings WHERE SettingId=@id";
        Add(cmd, "@id", id, DbType.Int32);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? ReadSetting(reader) : null;
    }

    private async Task<SettingTypeDto?> GetTypeAsyncByIdAsync(DbConnection db, int id, CancellationToken ct)
    {
        await using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT t.SettingTypeId,t.Code,t.NameAr,t.NameEn,t.IsHierarchical,t.IsActive,t.SortOrder,COUNT(s.SettingId) FROM dbo.SettingTypes t LEFT JOIN dbo.Settings s ON s.SettingTypeId=t.SettingTypeId AND s.IsActive=1 WHERE t.SettingTypeId=@id GROUP BY t.SettingTypeId,t.Code,t.NameAr,t.NameEn,t.IsHierarchical,t.IsActive,t.SortOrder";
        Add(cmd, "@id", id, DbType.Int32);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? ReadType(reader) : null;
    }

    private async Task<SettingTypeDto?> GetTypeAsync(DbConnection db, string code, CancellationToken ct)
    {
        await using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT t.SettingTypeId,t.Code,t.NameAr,t.NameEn,t.IsHierarchical,t.IsActive,t.SortOrder,COUNT(s.SettingId) FROM dbo.SettingTypes t LEFT JOIN dbo.Settings s ON s.SettingTypeId=t.SettingTypeId AND s.IsActive=1 WHERE t.Code=@code AND t.IsActive=1 GROUP BY t.SettingTypeId,t.Code,t.NameAr,t.NameEn,t.IsHierarchical,t.IsActive,t.SortOrder";
        Add(cmd, "@code", code, DbType.String, 50);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? ReadType(reader) : null;
    }

    private async Task<DbConnection> OpenAsync(CancellationToken ct)
    {
        var connection = factory.CreateConnection();
        await connection.OpenAsync(ct);
        return connection;
    }

    private static async Task<int> GetActiveCountAsync(DbConnection db, int id, DbTransaction transaction, CancellationToken ct)
    {
        await using var cmd = db.CreateCommand();
        cmd.Transaction = transaction;
        cmd.CommandText = "SELECT COUNT(*) FROM dbo.Settings WHERE SettingTypeId=@id AND IsActive=1";
        Add(cmd, "@id", id, DbType.Int32);
        return Convert.ToInt32(await cmd.ExecuteScalarAsync(ct));
    }

    private static SettingTypeDto ReadType(DbDataReader reader) => new(reader.GetInt32(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetBoolean(4), reader.GetBoolean(5), reader.GetInt32(6), reader.GetInt32(7));
    private static SettingDto ReadSetting(DbDataReader reader) => new(reader.GetInt32(0), reader.GetInt32(1), reader.IsDBNull(2) ? null : reader.GetInt32(2), reader.IsDBNull(3) ? null : reader.GetString(3), reader.GetString(4), reader.GetString(5), reader.GetInt32(6), reader.GetBoolean(7), reader.GetDateTime(8), reader.GetDateTime(9));
    private static void Add(DbCommand command, string name, object? value, DbType type, int? size = null)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.DbType = type;
        if (size.HasValue) parameter.Size = size.Value;
        parameter.Value = value ?? DBNull.Value;
        command.Parameters.Add(parameter);
    }

    private static void ValidateText(SettingWriteRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ValueAr) || request.ValueAr.Trim().Length > 200) throw new SettingsException("Arabic value is required and must be 200 characters or fewer.");
        if (string.IsNullOrWhiteSpace(request.ValueEn) || request.ValueEn.Trim().Length > 200) throw new SettingsException("English value is required and must be 200 characters or fewer.");
    }

    private static void ValidateTypeText(SettingTypeWriteRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NameAr) || request.NameAr.Trim().Length > 150) throw new SettingsException("Arabic name is required and must be 150 characters or fewer.");
        if (string.IsNullOrWhiteSpace(request.NameEn) || request.NameEn.Trim().Length > 150) throw new SettingsException("English name is required and must be 150 characters or fewer.");
    }

    private sealed class MutableTree(SettingDto item)
    {
        public SettingDto Item { get; } = item;
        public List<MutableTree> Children { get; } = [];
    }
    private static SettingTreeDto ToTree(MutableTree node) => new(node.Item.SettingId, node.Item.SettingTypeId, node.Item.ParentSettingId, node.Item.Code, node.Item.ValueAr, node.Item.ValueEn, node.Item.SortOrder, node.Item.IsActive, node.Children.Select(ToTree).ToArray());
}

public sealed class SettingsException(string message, int statusCode = 400) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}
