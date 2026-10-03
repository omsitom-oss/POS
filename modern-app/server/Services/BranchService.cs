using System.Data;
using System.Data.Common;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

public sealed class BranchService(DbConnectionFactory factory)
{
    public async Task<IReadOnlyList<BranchDto>> GetAsync(bool includeInactive, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct); await using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT BranchId,BranchCode,NameAr,NameEn,IsActive,SortOrder,CreatedAt,UpdatedAt FROM dbo.Branches WHERE (@inactive=1 OR IsActive=1) ORDER BY SortOrder,NameEn";
        Add(cmd, "@inactive", includeInactive, DbType.Boolean); await using var reader = await cmd.ExecuteReaderAsync(ct);
        var rows = new List<BranchDto>(); while (await reader.ReadAsync(ct)) rows.Add(Read(reader)); return rows;
    }

    public async Task<BranchDto> SaveAsync(int? id, BranchWriteRequest request, CancellationToken ct)
    {
        Validate(request); await using var db = await OpenAsync(ct); await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            int branchId;
            if (id.HasValue)
            {
                await using var update = db.CreateCommand(); update.Transaction = tx; update.CommandText = "UPDATE dbo.Branches SET NameAr=@ar,NameEn=@en,IsActive=@active,UpdatedAt=SYSUTCDATETIME() WHERE BranchId=@id";
                Add(update, "@ar", request.NameAr!.Trim(), DbType.String, 150); Add(update, "@en", request.NameEn!.Trim(), DbType.String, 150); Add(update, "@active", request.IsActive, DbType.Boolean); Add(update, "@id", id.Value, DbType.Int32);
                if (await update.ExecuteNonQueryAsync(ct) == 0) throw new BranchException("Branch was not found.", 404); branchId = id.Value;
            }
            else
            {
                await using var next = db.CreateCommand(); next.Transaction = tx; next.CommandText = "SELECT ISNULL(MAX(SortOrder),0)+1 FROM dbo.Branches WITH (TABLOCKX,HOLDLOCK)"; var sort = Convert.ToInt32(await next.ExecuteScalarAsync(ct));
                var pendingCode = $"P-{Guid.NewGuid():N}"[..18];
                await using var insert = db.CreateCommand(); insert.Transaction = tx; insert.CommandText = "INSERT INTO dbo.Branches(BranchCode,NameAr,NameEn,IsActive,SortOrder) OUTPUT INSERTED.BranchId VALUES(@code,@ar,@en,@active,@sort)";
                Add(insert, "@code", pendingCode, DbType.String, 50); Add(insert, "@ar", request.NameAr!.Trim(), DbType.String, 150); Add(insert, "@en", request.NameEn!.Trim(), DbType.String, 150); Add(insert, "@active", request.IsActive, DbType.Boolean); Add(insert, "@sort", sort, DbType.Int32); branchId = Convert.ToInt32(await insert.ExecuteScalarAsync(ct));
                await using var code = db.CreateCommand(); code.Transaction = tx; code.CommandText = "UPDATE dbo.Branches SET BranchCode=@code,UpdatedAt=SYSUTCDATETIME() WHERE BranchId=@id"; Add(code, "@code", $"BR-{branchId:D6}", DbType.String, 50); Add(code, "@id", branchId, DbType.Int32); await code.ExecuteNonQueryAsync(ct);
            }
            await tx.CommitAsync(ct); return (await GetAsync(true, ct)).First(item => item.BranchId == branchId);
        }
        catch { await tx.RollbackAsync(ct); throw; }
    }

    public async Task<bool> SetActiveAsync(int id, bool active, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct); await using var cmd = db.CreateCommand(); cmd.CommandText = "UPDATE dbo.Branches SET IsActive=@active,UpdatedAt=SYSUTCDATETIME() WHERE BranchId=@id"; Add(cmd, "@active", active, DbType.Boolean); Add(cmd, "@id", id, DbType.Int32); return await cmd.ExecuteNonQueryAsync(ct) > 0;
    }

    private static BranchDto Read(DbDataReader r) => new(r.GetInt32(0), r.GetString(1), r.GetString(2), r.GetString(3), r.GetBoolean(4), r.GetInt32(5), r.GetDateTime(6), r.GetDateTime(7));
    private static void Validate(BranchWriteRequest request) { if (string.IsNullOrWhiteSpace(request.NameAr) || string.IsNullOrWhiteSpace(request.NameEn)) throw new BranchException("Arabic and English branch names are required."); if (request.NameAr.Trim().Length > 150 || request.NameEn.Trim().Length > 150) throw new BranchException("Branch names must be 150 characters or fewer."); }
    private async Task<DbConnection> OpenAsync(CancellationToken ct) { var db = factory.CreateConnection(); await db.OpenAsync(ct); return db; }
    private static void Add(DbCommand c, string n, object? v, DbType t, int? size = null) { var p = c.CreateParameter(); p.ParameterName = n; p.DbType = t; if (size.HasValue) p.Size = size.Value; p.Value = v ?? DBNull.Value; c.Parameters.Add(p); }
}

public sealed class BranchException(string message, int statusCode = 400) : Exception(message) { public int StatusCode { get; } = statusCode; }
