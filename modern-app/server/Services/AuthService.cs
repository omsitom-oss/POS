using System.Data;
using System.Data.Common;
using System.Security.Cryptography;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

public sealed class AuthService(DbConnectionFactory factory)
{
    public async Task<bool> ChangePasswordAsync(int userId, ChangePasswordRequest request, CancellationToken ct)
    {
        if (userId <= 0 || string.IsNullOrWhiteSpace(request.NewPassword)) return false;
        await using var db = await OpenAsync(ct); await using var command = db.CreateCommand(); command.CommandText = "UPDATE dbo.Users SET PasswordHash=@hash,MustChangePassword=0,UpdatedAt=SYSUTCDATETIME() WHERE UserId=@user AND IsActive=1"; Add(command, "@hash", HashPassword(request.NewPassword), DbType.String, 300); Add(command, "@user", userId, DbType.Int32); return await command.ExecuteNonQueryAsync(ct) > 0;
    }
    public async Task<LoginResult?> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Identifier) || string.IsNullOrEmpty(request.Password)) return null;
        await using var db = await OpenAsync(ct);
        await using var command = db.CreateCommand(); command.CommandText = "SELECT TOP 1 u.UserId,u.UserName,u.PasswordHash,u.BranchId,u.MustChangePassword,b.BranchCode,b.NameAr,b.NameEn FROM dbo.Users u JOIN dbo.Branches b ON b.BranchId=u.BranchId WHERE u.IsActive=1 AND b.IsActive=1 AND (u.UserName=@identifier OR u.Email=@identifier OR u.Phone=@identifier)"; Add(command, "@identifier", request.Identifier.Trim(), DbType.String, 254);
        await using var reader = await command.ExecuteReaderAsync(ct); if (!await reader.ReadAsync(ct) || !Verify(request.Password, reader.GetString(2))) return null;
        var result = new LoginResult(reader.GetInt32(0), reader.GetString(1), reader.GetInt32(3), reader.GetString(5), reader.GetString(6), reader.GetString(7), reader.GetBoolean(4), []); await reader.CloseAsync();
        await using var roles = db.CreateCommand(); roles.CommandText = "SELECT RoleId FROM dbo.UserRoles WHERE UserId=@user"; Add(roles, "@user", result.UserId, DbType.Int32); var roleIds = new List<int>(); await using var roleReader = await roles.ExecuteReaderAsync(ct); while (await roleReader.ReadAsync(ct)) roleIds.Add(roleReader.GetInt32(0)); await roleReader.CloseAsync();
        await using var lastLogin = db.CreateCommand(); lastLogin.CommandText = "UPDATE dbo.Users SET LastLoginAt=SYSUTCDATETIME() WHERE UserId=@user"; Add(lastLogin, "@user", result.UserId, DbType.Int32); await lastLogin.ExecuteNonQueryAsync(ct); return result with { RoleIds = roleIds };
    }
    private static bool Verify(string password, string encoded) { try { var parts = encoded.Split('$'); if (parts.Length != 4 || !int.TryParse(parts[1], out var iterations)) return false; var salt = Convert.FromBase64String(parts[2]); var expected = Convert.FromBase64String(parts[3]); var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expected.Length); return CryptographicOperations.FixedTimeEquals(actual, expected); } catch (FormatException) { return false; } }
    private static string HashPassword(string password) { var salt = RandomNumberGenerator.GetBytes(16); var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, 120000, HashAlgorithmName.SHA256, 32); return $"PBKDF2-SHA256$120000${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}"; }
    private async Task<DbConnection> OpenAsync(CancellationToken ct) { var db = factory.CreateConnection(); await db.OpenAsync(ct); return db; }
    private static void Add(DbCommand command, string name, object value, DbType type, int? size = null) { var parameter = command.CreateParameter(); parameter.ParameterName = name; parameter.DbType = type; if (size.HasValue) parameter.Size = size.Value; parameter.Value = value; command.Parameters.Add(parameter); }
}

