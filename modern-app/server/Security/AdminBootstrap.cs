using System.Data;
using System.Data.Common;
using ElitePos.LocalService.Data;

namespace ElitePos.LocalService.Security;

// `dotnet run -- --create-admin <username>` creates the first administrator on a database that has no
// one able to manage users. It prints a one-time password that must be changed at first login.
public sealed class AdminBootstrap(DbConnectionFactory factory)
{
    public const string RoleName = "Administrators";

    public async Task<string> CreateAsync(string userName, CancellationToken ct = default)
    {
        userName = userName.Trim();
        if (userName.Length is 0 or > 100) throw new InvalidOperationException("Username is required and must be 100 characters or fewer.");
        var temporaryPassword = PasswordHasher.GenerateTemporary();
        await using var db = factory.CreateConnection();
        await db.OpenAsync(ct);
        await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            if (await ScalarAsync(db, tx, "SELECT 1 FROM dbo.Users WHERE UserName=@name", ct, ("@name", userName, DbType.String)) is not null)
                throw new InvalidOperationException($"User '{userName}' already exists. Reset their password from the Users screen instead.");
            var branch = await ScalarAsync(db, tx, "SELECT TOP 1 BranchId FROM dbo.Branches WHERE IsActive=1 ORDER BY BranchId", ct)
                ?? throw new InvalidOperationException("Create an active branch before creating an administrator.");

            var roleId = await ScalarAsync(db, tx, "SELECT RoleId FROM dbo.Roles WHERE Name=@name", ct, ("@name", RoleName, DbType.String))
                ?? await ScalarAsync(db, tx, "INSERT INTO dbo.Roles(Name,IsActive) OUTPUT INSERTED.RoleId VALUES(@name,1)", ct, ("@name", RoleName, DbType.String));
            await ScalarAsync(db, tx, "UPDATE dbo.Roles SET IsActive=1 WHERE RoleId=@role; INSERT INTO dbo.RolePermissions(RoleId,PermissionId) SELECT @role,p.PermissionId FROM dbo.Permissions p WHERE NOT EXISTS (SELECT 1 FROM dbo.RolePermissions rp WHERE rp.RoleId=@role AND rp.PermissionId=p.PermissionId)", ct, ("@role", roleId!, DbType.Int32));

            var userId = await ScalarAsync(db, tx, "INSERT INTO dbo.Users(UserName,BranchId,PasswordHash,MustChangePassword,IsActive) OUTPUT INSERTED.UserId VALUES(@name,@branch,@hash,1,1)", ct,
                ("@name", userName, DbType.String), ("@branch", branch, DbType.Int32), ("@hash", PasswordHasher.Hash(temporaryPassword), DbType.String));
            await ScalarAsync(db, tx, "INSERT INTO dbo.UserRoles(UserId,RoleId) VALUES(@user,@role)", ct, ("@user", userId!, DbType.Int32), ("@role", roleId!, DbType.Int32));
            await SecurityAudit.WriteAsync(db, tx, "ADMIN_BOOTSTRAPPED", null, Convert.ToInt32(userId), null, ct);
            await tx.CommitAsync(ct);
            return temporaryPassword;
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }

    private static async Task<object?> ScalarAsync(DbConnection db, DbTransaction tx, string sql, CancellationToken ct, params (string Name, object Value, DbType Type)[] parameters)
    {
        await using var command = db.CreateCommand();
        command.Transaction = tx;
        command.CommandText = sql;
        foreach (var (name, value, type) in parameters)
        {
            var parameter = command.CreateParameter(); parameter.ParameterName = name; parameter.DbType = type; parameter.Value = value; command.Parameters.Add(parameter);
        }
        var result = await command.ExecuteScalarAsync(ct);
        return result is DBNull ? null : result;
    }
}
