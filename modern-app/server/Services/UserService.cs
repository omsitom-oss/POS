using System.Data;
using System.Data.Common;
using System.Security.Cryptography;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

public sealed class UserService(DbConnectionFactory factory)
{
    public async Task<IReadOnlyList<UserDto>> GetAsync(bool includeInactive, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct); await using var cmd = db.CreateCommand(); cmd.CommandText = "SELECT UserId,UserName,Email,Phone,BranchId,EmployeeId,IsActive,MustChangePassword,LastLoginAt,CreatedAt,UpdatedAt FROM dbo.Users WHERE (@inactive=1 OR IsActive=1) ORDER BY UserName"; Add(cmd, "@inactive", includeInactive, DbType.Boolean); await using var reader = await cmd.ExecuteReaderAsync(ct); var rows = new List<UserDto>(); while (await reader.ReadAsync(ct)) rows.Add(Read(reader)); await reader.CloseAsync();
        await using var roleCommand = db.CreateCommand(); roleCommand.CommandText = "SELECT UserId,RoleId FROM dbo.UserRoles"; await using var roleReader = await roleCommand.ExecuteReaderAsync(ct); var roles = new Dictionary<int,List<int>>(); while (await roleReader.ReadAsync(ct)) { if (!roles.TryGetValue(roleReader.GetInt32(0), out var list)) roles[roleReader.GetInt32(0)] = list = []; list.Add(roleReader.GetInt32(1)); }
        return rows.Select(item => item with { RoleIds = roles.GetValueOrDefault(item.UserId) ?? [] }).ToArray();
    }
    public async Task<UserDto> SaveAsync(int? id, UserWriteRequest request, CancellationToken ct)
    {
        Validate(request, id.HasValue); await using var db = await OpenAsync(ct); await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            int userId;
            if (id.HasValue)
            {
                await using var update = db.CreateCommand(); update.Transaction = tx; update.CommandText = string.IsNullOrWhiteSpace(request.Password) ? "UPDATE dbo.Users SET UserName=@name,Email=@email,Phone=@phone,BranchId=@branch,EmployeeId=@employee,IsActive=@active,UpdatedAt=SYSUTCDATETIME() WHERE UserId=@id" : "UPDATE dbo.Users SET UserName=@name,Email=@email,Phone=@phone,BranchId=@branch,EmployeeId=@employee,PasswordHash=@hash,MustChangePassword=1,IsActive=@active,UpdatedAt=SYSUTCDATETIME() WHERE UserId=@id";
                Add(update, "@name", request.UserName!.Trim(), DbType.String, 100); Add(update, "@email", NullIfBlank(request.Email), DbType.String, 150); Add(update, "@phone", NullIfBlank(request.Phone), DbType.String, 50); Add(update, "@branch", request.BranchId, DbType.Int32); Add(update, "@employee", request.EmployeeId, DbType.Int32); Add(update, "@active", request.IsActive, DbType.Boolean); Add(update, "@id", id.Value, DbType.Int32); if (!string.IsNullOrWhiteSpace(request.Password)) Add(update, "@hash", HashPassword(request.Password), DbType.String, 300); if (await update.ExecuteNonQueryAsync(ct) == 0) throw new UserException("User was not found.", 404); userId = id.Value;
            }
            else
            {
                await using var insert = db.CreateCommand(); insert.Transaction = tx; insert.CommandText = "INSERT INTO dbo.Users(UserName,Email,Phone,BranchId,EmployeeId,PasswordHash,MustChangePassword,IsActive) OUTPUT INSERTED.UserId VALUES(@name,@email,@phone,@branch,@employee,@hash,1,@active)"; Add(insert, "@name", request.UserName!.Trim(), DbType.String, 100); Add(insert, "@email", NullIfBlank(request.Email), DbType.String, 150); Add(insert, "@phone", NullIfBlank(request.Phone), DbType.String, 50); Add(insert, "@branch", request.BranchId, DbType.Int32); Add(insert, "@employee", request.EmployeeId, DbType.Int32); Add(insert, "@hash", HashPassword(string.IsNullOrWhiteSpace(request.Password) ? "123456" : request.Password), DbType.String, 300); Add(insert, "@active", request.IsActive, DbType.Boolean); userId = Convert.ToInt32(await insert.ExecuteScalarAsync(ct));
            }
            await using (var clearRoles = db.CreateCommand()) { clearRoles.Transaction = tx; clearRoles.CommandText = "DELETE FROM dbo.UserRoles WHERE UserId=@user"; Add(clearRoles, "@user", userId, DbType.Int32); await clearRoles.ExecuteNonQueryAsync(ct); }
            foreach (var roleId in (request.RoleIds ?? []).Distinct()) { await using var role = db.CreateCommand(); role.Transaction = tx; role.CommandText = "INSERT INTO dbo.UserRoles(UserId,RoleId) SELECT @user,@role WHERE EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleId=@role AND IsActive=1)"; Add(role, "@user", userId, DbType.Int32); Add(role, "@role", roleId, DbType.Int32); await role.ExecuteNonQueryAsync(ct); }
            await tx.CommitAsync(ct); return (await GetAsync(true, ct)).First(item => item.UserId == userId);
        }
        catch (Exception ex) when (ex.ToString().Contains("2601", StringComparison.Ordinal) || ex.ToString().Contains("2627", StringComparison.Ordinal)) { await tx.RollbackAsync(ct); throw new UserException("That username is already in use.", 409); }
        catch (Exception ex) when (ex.ToString().Contains("547", StringComparison.Ordinal)) { await tx.RollbackAsync(ct); throw new UserException("The selected branch or employee does not exist.", 400); }
        catch { await tx.RollbackAsync(ct); throw; }
    }
    public async Task<bool> SetActiveAsync(int id, bool active, CancellationToken ct) { await using var db = await OpenAsync(ct); await using var cmd = db.CreateCommand(); cmd.CommandText = "UPDATE dbo.Users SET IsActive=@active,UpdatedAt=SYSUTCDATETIME() WHERE UserId=@id"; Add(cmd, "@active", active, DbType.Boolean); Add(cmd, "@id", id, DbType.Int32); return await cmd.ExecuteNonQueryAsync(ct) > 0; }
    public async Task<bool> ResetPasswordAsync(int id, CancellationToken ct) { await using var db = await OpenAsync(ct); await using var cmd = db.CreateCommand(); cmd.CommandText = "UPDATE dbo.Users SET PasswordHash=@hash,MustChangePassword=1,UpdatedAt=SYSUTCDATETIME() WHERE UserId=@id"; Add(cmd, "@hash", HashPassword("123456"), DbType.String, 300); Add(cmd, "@id", id, DbType.Int32); return await cmd.ExecuteNonQueryAsync(ct) > 0; }
    private static void Validate(UserWriteRequest request, bool update) { if (string.IsNullOrWhiteSpace(request.UserName) || request.UserName.Trim().Length > 100) throw new UserException("Username is required and must be 100 characters or fewer."); if (!request.BranchId.HasValue) throw new UserException("Branch is required."); if ((request.Email?.Length ?? 0) > 150 || (request.Phone?.Length ?? 0) > 50) throw new UserException("Contact fields exceed their maximum length."); }
    private static string? NullIfBlank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static string HashPassword(string password) { var salt = RandomNumberGenerator.GetBytes(16); var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, 120000, HashAlgorithmName.SHA256, 32); return $"PBKDF2-SHA256$120000${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}"; }
    private static UserDto Read(DbDataReader r) => new(r.GetInt32(0), r.GetString(1), r.IsDBNull(2) ? null : r.GetString(2), r.IsDBNull(3) ? null : r.GetString(3), r.IsDBNull(4) ? null : r.GetInt32(4), r.IsDBNull(5) ? null : r.GetInt32(5), r.GetBoolean(6), r.GetBoolean(7), r.IsDBNull(8) ? null : r.GetDateTime(8), r.GetDateTime(9), r.GetDateTime(10), []);
    private async Task<DbConnection> OpenAsync(CancellationToken ct) { var db = factory.CreateConnection(); await db.OpenAsync(ct); return db; }
    private static void Add(DbCommand c, string n, object? v, DbType t, int? size = null) { var p = c.CreateParameter(); p.ParameterName = n; p.DbType = t; if (size.HasValue) p.Size = size.Value; p.Value = v ?? DBNull.Value; c.Parameters.Add(p); }
}

public sealed class UserException(string message, int statusCode = 400) : Exception(message) { public int StatusCode { get; } = statusCode; }

