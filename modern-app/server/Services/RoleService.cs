using System.Data;
using System.Data.Common;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

public sealed class RoleService(DbConnectionFactory factory)
{
    public async Task<IReadOnlyList<PermissionDto>> GetPermissionsAsync(CancellationToken ct)
    {
        await using var db = await OpenAsync(ct); await using var cmd = db.CreateCommand(); cmd.CommandText = "SELECT PermissionId,Code,Name,Description FROM dbo.Permissions ORDER BY Name";
        await using var reader = await cmd.ExecuteReaderAsync(ct); var rows = new List<PermissionDto>(); while (await reader.ReadAsync(ct)) rows.Add(new(reader.GetInt32(0), reader.GetString(1), reader.GetString(2), reader.IsDBNull(3) ? null : reader.GetString(3))); return rows;
    }
    public async Task<IReadOnlyList<RoleDto>> GetAsync(bool includeInactive, CancellationToken ct)
    {
        var permissions = await GetPermissionsAsync(ct); await using var db = await OpenAsync(ct); await using var cmd = db.CreateCommand(); cmd.CommandText = "SELECT RoleId,Name,IsActive,CreatedAt,UpdatedAt FROM dbo.Roles WHERE (@inactive=1 OR IsActive=1) ORDER BY Name"; Add(cmd, "@inactive", includeInactive, DbType.Boolean);
        await using var reader = await cmd.ExecuteReaderAsync(ct); var roles = new List<(int Id,string Name,bool Active,DateTime Created,DateTime Updated)>(); while (await reader.ReadAsync(ct)) roles.Add((reader.GetInt32(0), reader.GetString(1), reader.GetBoolean(2), reader.GetDateTime(3), reader.GetDateTime(4))); await reader.CloseAsync();
        await using var links = db.CreateCommand(); links.CommandText = "SELECT RoleId,PermissionId FROM dbo.RolePermissions"; await using var linkReader = await links.ExecuteReaderAsync(ct); var map = new Dictionary<int,List<PermissionDto>>(); while (await linkReader.ReadAsync(ct)) { var permission = permissions.FirstOrDefault(item => item.PermissionId == linkReader.GetInt32(1)); if (permission is not null) { if (!map.TryGetValue(linkReader.GetInt32(0), out var list)) map[linkReader.GetInt32(0)] = list = []; list.Add(permission); } }
        return roles.Select(item => new RoleDto(item.Id, item.Name, item.Active, map.GetValueOrDefault(item.Id) ?? [], item.Created, item.Updated)).ToArray();
    }
    public async Task<RoleDto> SaveAsync(int? id, RoleWriteRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 100) throw new RoleException("Role name is required and must be 100 characters or fewer.");
        await using var db = await OpenAsync(ct); await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct); try
        {
            int roleId; if (id.HasValue) { await using var cmd = db.CreateCommand(); cmd.Transaction = tx; cmd.CommandText = "UPDATE dbo.Roles SET Name=@name,IsActive=@active,UpdatedAt=SYSUTCDATETIME() WHERE RoleId=@id"; Add(cmd,"@name",request.Name.Trim(),DbType.String,100); Add(cmd,"@active",request.IsActive,DbType.Boolean); Add(cmd,"@id",id.Value,DbType.Int32); if (await cmd.ExecuteNonQueryAsync(ct)==0) throw new RoleException("Role was not found.",404); roleId=id.Value; } else { await using var cmd = db.CreateCommand(); cmd.Transaction=tx; cmd.CommandText="INSERT INTO dbo.Roles(Name,IsActive) OUTPUT INSERTED.RoleId VALUES(@name,@active)"; Add(cmd,"@name",request.Name.Trim(),DbType.String,100); Add(cmd,"@active",request.IsActive,DbType.Boolean); roleId=Convert.ToInt32(await cmd.ExecuteScalarAsync(ct)); }
            await using (var clear = db.CreateCommand()) { clear.Transaction=tx; clear.CommandText="DELETE FROM dbo.RolePermissions WHERE RoleId=@id"; Add(clear,"@id",roleId,DbType.Int32); await clear.ExecuteNonQueryAsync(ct); }
            foreach (var permissionId in (request.PermissionIds ?? []).Distinct()) { await using var link = db.CreateCommand(); link.Transaction=tx; link.CommandText="INSERT INTO dbo.RolePermissions(RoleId,PermissionId) SELECT @role,@permission WHERE EXISTS (SELECT 1 FROM dbo.Permissions WHERE PermissionId=@permission)"; Add(link,"@role",roleId,DbType.Int32); Add(link,"@permission",permissionId,DbType.Int32); await link.ExecuteNonQueryAsync(ct); }
            await tx.CommitAsync(ct); return (await GetAsync(true,ct)).First(item=>item.RoleId==roleId);
        } catch (Exception ex) when (ex.ToString().Contains("2601",StringComparison.Ordinal)||ex.ToString().Contains("2627",StringComparison.Ordinal)) { await tx.RollbackAsync(ct); throw new RoleException("That role name is already in use.",409); } catch { await tx.RollbackAsync(ct); throw; }
    }
    public async Task<bool> SetActiveAsync(int id, bool active, CancellationToken ct) { await using var db=await OpenAsync(ct); await using var cmd=db.CreateCommand(); cmd.CommandText="UPDATE dbo.Roles SET IsActive=@active,UpdatedAt=SYSUTCDATETIME() WHERE RoleId=@id"; Add(cmd,"@active",active,DbType.Boolean); Add(cmd,"@id",id,DbType.Int32); return await cmd.ExecuteNonQueryAsync(ct)>0; }
    private async Task<DbConnection> OpenAsync(CancellationToken ct) { var db=factory.CreateConnection(); await db.OpenAsync(ct); return db; }
    private static void Add(DbCommand c,string n,object? v,DbType t,int? size=null) { var p=c.CreateParameter(); p.ParameterName=n; p.DbType=t; if(size.HasValue)p.Size=size.Value; p.Value=v??DBNull.Value; c.Parameters.Add(p); }
}
public sealed class RoleException(string message,int statusCode=400):Exception(message){public int StatusCode{get;}=statusCode;}
