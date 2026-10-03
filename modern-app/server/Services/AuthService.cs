using System.Data;
using System.Data.Common;
using System.Security.Cryptography;
using System.Text;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;
using ElitePos.LocalService.Security;

namespace ElitePos.LocalService.Services;

public enum LoginStatus { Success, Invalid, LockedOut }
public sealed record LoginOutcome(LoginStatus Status, LoginResult? Result = null);

public sealed class AuthService(DbConnectionFactory factory, AuthOptions options, TimeProvider clock)
{
    // Verified against when the identifier is unknown so a miss costs the same time as a wrong password.
    private static readonly string DummyHash = PasswordHasher.Hash(Guid.NewGuid().ToString());

    public async Task<LoginOutcome> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Identifier) || string.IsNullOrEmpty(request.Password)) return new(LoginStatus.Invalid);
        var now = Now();
        await using var db = await OpenAsync(ct);

        int userId; string passwordHash; DateTime? lockedUntil;
        await using (var command = db.CreateCommand())
        {
            command.CommandText = "SELECT TOP 1 u.UserId,u.PasswordHash,u.LockedUntil FROM dbo.Users u JOIN dbo.Branches b ON b.BranchId=u.BranchId WHERE u.IsActive=1 AND b.IsActive=1 AND (u.UserName=@identifier OR u.Email=@identifier OR u.Phone=@identifier) ORDER BY CASE WHEN u.UserName=@identifier THEN 0 ELSE 1 END,u.UserId";
            Add(command, "@identifier", request.Identifier.Trim(), DbType.String, 254);
            await using var reader = await command.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
            {
                PasswordHasher.Verify(request.Password, DummyHash);
                return new(LoginStatus.Invalid);
            }
            userId = reader.GetInt32(0); passwordHash = reader.GetString(1); lockedUntil = reader.IsDBNull(2) ? null : reader.GetDateTime(2);
        }

        if (lockedUntil > now) return new(LoginStatus.LockedOut);
        if (!PasswordHasher.Verify(request.Password, passwordHash)) return new(await RecordFailedLoginAsync(db, userId, now, ct));

        await using (var success = db.CreateCommand())
        {
            success.CommandText = "UPDATE dbo.Users SET FailedLoginCount=0,LockedUntil=NULL,LastLoginAt=@now WHERE UserId=@user";
            Add(success, "@now", now, DbType.DateTime2); Add(success, "@user", userId, DbType.Int32);
            await success.ExecuteNonQueryAsync(ct);
        }

        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var expiresAt = now.AddMinutes(options.SessionLifetimeMinutes);
        await using (var session = db.CreateCommand())
        {
            session.CommandText = "INSERT INTO dbo.UserSessions(SessionId,UserId,TokenHash,CreatedAt,LastSeenAt,ExpiresAt) VALUES(@id,@user,@hash,@now,@now,@expires)";
            Add(session, "@id", Guid.NewGuid(), DbType.Guid); Add(session, "@user", userId, DbType.Int32); Add(session, "@hash", HashToken(token), DbType.Binary, 32);
            Add(session, "@now", now, DbType.DateTime2); Add(session, "@expires", expiresAt, DbType.DateTime2);
            await session.ExecuteNonQueryAsync(ct);
        }

        var result = await ReadProfileAsync(db, userId, ct);
        return new(LoginStatus.Success, result! with { Token = token, ExpiresAt = expiresAt });
    }

    // Resolves a bearer token to its session, or null when the token is unknown, expired, idle too long or revoked,
    // or when the user or their branch has been deactivated. Permissions are read fresh on every request.
    public async Task<AuthenticatedSession?> ValidateSessionAsync(string token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 200) return null;
        var now = Now();
        await using var db = await OpenAsync(ct);
        await using var command = db.CreateCommand();
        command.CommandText = """
            SELECT s.SessionId,s.LastSeenAt,u.UserId,u.UserName,u.BranchId,u.MustChangePassword
            FROM dbo.UserSessions s JOIN dbo.Users u ON u.UserId=s.UserId JOIN dbo.Branches b ON b.BranchId=u.BranchId
            WHERE s.TokenHash=@hash AND s.RevokedAt IS NULL AND s.ExpiresAt>@now AND s.LastSeenAt>@idle AND u.IsActive=1 AND b.IsActive=1;
            SELECT DISTINCT p.Code FROM dbo.UserSessions s JOIN dbo.UserRoles ur ON ur.UserId=s.UserId JOIN dbo.Roles r ON r.RoleId=ur.RoleId AND r.IsActive=1
            JOIN dbo.RolePermissions rp ON rp.RoleId=r.RoleId JOIN dbo.Permissions p ON p.PermissionId=rp.PermissionId
            WHERE s.TokenHash=@hash;
            """;
        Add(command, "@hash", HashToken(token), DbType.Binary, 32); Add(command, "@now", now, DbType.DateTime2); Add(command, "@idle", now.AddMinutes(-options.SessionIdleMinutes), DbType.DateTime2);
        Guid sessionId; DateTime lastSeen; int userId; string userName; int branchId; bool mustChange;
        var permissions = new List<string>();
        await using (var reader = await command.ExecuteReaderAsync(ct))
        {
            if (!await reader.ReadAsync(ct)) return null;
            sessionId = reader.GetGuid(0); lastSeen = reader.GetDateTime(1); userId = reader.GetInt32(2); userName = reader.GetString(3); branchId = reader.GetInt32(4); mustChange = reader.GetBoolean(5);
            await reader.NextResultAsync(ct);
            while (await reader.ReadAsync(ct)) permissions.Add(reader.GetString(0));
        }

        // Sliding idle timeout; written at most once a minute to keep requests cheap.
        if (now - lastSeen > TimeSpan.FromMinutes(1))
        {
            await using var touch = db.CreateCommand();
            touch.CommandText = "UPDATE dbo.UserSessions SET LastSeenAt=@now WHERE SessionId=@id";
            Add(touch, "@now", now, DbType.DateTime2); Add(touch, "@id", sessionId, DbType.Guid);
            await touch.ExecuteNonQueryAsync(ct);
        }
        return new(sessionId, userId, userName, branchId, mustChange, permissions);
    }

    public async Task LogoutAsync(Guid sessionId, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        await using var command = db.CreateCommand();
        command.CommandText = "UPDATE dbo.UserSessions SET RevokedAt=@now WHERE SessionId=@id AND RevokedAt IS NULL";
        Add(command, "@now", Now(), DbType.DateTime2); Add(command, "@id", sessionId, DbType.Guid);
        await command.ExecuteNonQueryAsync(ct);
    }

    public async Task<LoginResult?> GetProfileAsync(int userId, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        return await ReadProfileAsync(db, userId, ct);
    }

    // A user changing their own password must prove the current one. Other sessions of the user are signed out.
    public async Task<string?> ChangeOwnPasswordAsync(int userId, Guid currentSessionId, ChangePasswordRequest request, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(request.CurrentPassword)) return "Current password is required.";
        if (PasswordHasher.Validate(request.NewPassword) is { } invalid) return invalid;
        if (request.NewPassword == request.CurrentPassword) return "The new password must be different from the current password.";
        await using var db = await OpenAsync(ct);
        await using (var read = db.CreateCommand())
        {
            read.CommandText = "SELECT PasswordHash FROM dbo.Users WHERE UserId=@user AND IsActive=1";
            Add(read, "@user", userId, DbType.Int32);
            if (await read.ExecuteScalarAsync(ct) is not string hash || !PasswordHasher.Verify(request.CurrentPassword, hash)) return "Current password is incorrect.";
        }
        await using var tx = await db.BeginTransactionAsync(ct);
        await using (var update = db.CreateCommand())
        {
            update.Transaction = tx;
            update.CommandText = "UPDATE dbo.Users SET PasswordHash=@hash,MustChangePassword=0,UpdatedAt=SYSUTCDATETIME() WHERE UserId=@user";
            Add(update, "@hash", PasswordHasher.Hash(request.NewPassword!), DbType.String, 300); Add(update, "@user", userId, DbType.Int32);
            await update.ExecuteNonQueryAsync(ct);
        }
        await RevokeUserSessionsAsync(db, tx, userId, currentSessionId, ct);
        await SecurityAudit.WriteAsync(db, tx, "PASSWORD_CHANGED", userId, userId, null, ct);
        await tx.CommitAsync(ct);
        return null;
    }

    // An administrator setting another user's password. The user must change it at next login and is signed out everywhere.
    public async Task<(bool Found, string? Error)> SetPasswordByAdminAsync(int actorUserId, int targetUserId, string? newPassword, CancellationToken ct)
    {
        if (PasswordHasher.Validate(newPassword) is { } invalid) return (true, invalid);
        await using var db = await OpenAsync(ct);
        await using var tx = await db.BeginTransactionAsync(ct);
        await using (var update = db.CreateCommand())
        {
            update.Transaction = tx;
            update.CommandText = "UPDATE dbo.Users SET PasswordHash=@hash,MustChangePassword=1,FailedLoginCount=0,LockedUntil=NULL,UpdatedAt=SYSUTCDATETIME() WHERE UserId=@user";
            Add(update, "@hash", PasswordHasher.Hash(newPassword!), DbType.String, 300); Add(update, "@user", targetUserId, DbType.Int32);
            if (await update.ExecuteNonQueryAsync(ct) == 0) { await tx.RollbackAsync(ct); return (false, null); }
        }
        await RevokeUserSessionsAsync(db, tx, targetUserId, null, ct);
        await SecurityAudit.WriteAsync(db, tx, "PASSWORD_SET_BY_ADMIN", actorUserId, targetUserId, null, ct);
        await tx.CommitAsync(ct);
        return (true, null);
    }

    public static async Task RevokeUserSessionsAsync(DbConnection db, DbTransaction tx, int userId, Guid? exceptSessionId, CancellationToken ct)
    {
        await using var command = db.CreateCommand();
        command.Transaction = tx;
        command.CommandText = "UPDATE dbo.UserSessions SET RevokedAt=SYSUTCDATETIME() WHERE UserId=@user AND RevokedAt IS NULL AND (@except IS NULL OR SessionId<>@except)";
        Add(command, "@user", userId, DbType.Int32); Add(command, "@except", exceptSessionId, DbType.Guid);
        await command.ExecuteNonQueryAsync(ct);
    }

    private async Task<LoginStatus> RecordFailedLoginAsync(DbConnection db, int userId, DateTime now, CancellationToken ct)
    {
        await using var tx = await db.BeginTransactionAsync(ct);
        await using var increment = db.CreateCommand();
        increment.Transaction = tx;
        increment.CommandText = "UPDATE dbo.Users SET FailedLoginCount=FailedLoginCount+1 OUTPUT INSERTED.FailedLoginCount WHERE UserId=@user";
        Add(increment, "@user", userId, DbType.Int32);
        var failures = Convert.ToInt32(await increment.ExecuteScalarAsync(ct));
        var status = LoginStatus.Invalid;
        if (options.MaxFailedLogins > 0 && failures >= options.MaxFailedLogins)
        {
            await using var lockout = db.CreateCommand();
            lockout.Transaction = tx;
            lockout.CommandText = "UPDATE dbo.Users SET FailedLoginCount=0,LockedUntil=@until WHERE UserId=@user";
            Add(lockout, "@until", now.AddMinutes(options.LockoutMinutes), DbType.DateTime2); Add(lockout, "@user", userId, DbType.Int32);
            await lockout.ExecuteNonQueryAsync(ct);
            await SecurityAudit.WriteAsync(db, tx, "LOCKED_OUT", null, userId, $"{failures} failed logins", ct);
            status = LoginStatus.LockedOut;
        }
        else
        {
            await SecurityAudit.WriteAsync(db, tx, "LOGIN_FAILED", null, userId, null, ct);
        }
        await tx.CommitAsync(ct);
        return status;
    }

    private static async Task<LoginResult?> ReadProfileAsync(DbConnection db, int userId, CancellationToken ct)
    {
        await using var command = db.CreateCommand();
        command.CommandText = """
            SELECT u.UserId,u.UserName,u.BranchId,b.BranchCode,b.NameAr,b.NameEn,u.MustChangePassword FROM dbo.Users u JOIN dbo.Branches b ON b.BranchId=u.BranchId WHERE u.UserId=@user;
            SELECT ur.RoleId FROM dbo.UserRoles ur JOIN dbo.Roles r ON r.RoleId=ur.RoleId AND r.IsActive=1 WHERE ur.UserId=@user ORDER BY ur.RoleId;
            SELECT DISTINCT p.Code FROM dbo.UserRoles ur JOIN dbo.Roles r ON r.RoleId=ur.RoleId AND r.IsActive=1 JOIN dbo.RolePermissions rp ON rp.RoleId=r.RoleId JOIN dbo.Permissions p ON p.PermissionId=rp.PermissionId WHERE ur.UserId=@user ORDER BY p.Code;
            """;
        Add(command, "@user", userId, DbType.Int32);
        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        var result = new LoginResult(reader.GetInt32(0), reader.GetString(1), reader.GetInt32(2), reader.GetString(3), reader.GetString(4), reader.GetString(5), reader.GetBoolean(6), [], []);
        var roles = new List<int>(); var permissions = new List<string>();
        await reader.NextResultAsync(ct); while (await reader.ReadAsync(ct)) roles.Add(reader.GetInt32(0));
        await reader.NextResultAsync(ct); while (await reader.ReadAsync(ct)) permissions.Add(reader.GetString(0));
        return result with { RoleIds = roles, Permissions = permissions };
    }

    private DateTime Now() => clock.GetUtcNow().UtcDateTime;
    private static byte[] HashToken(string token) => SHA256.HashData(Encoding.UTF8.GetBytes(token));
    private async Task<DbConnection> OpenAsync(CancellationToken ct) { var db = factory.CreateConnection(); await db.OpenAsync(ct); return db; }
    private static void Add(DbCommand command, string name, object? value, DbType type, int? size = null) { var parameter = command.CreateParameter(); parameter.ParameterName = name; parameter.DbType = type; if (size.HasValue) parameter.Size = size.Value; parameter.Value = value ?? DBNull.Value; command.Parameters.Add(parameter); }
}
