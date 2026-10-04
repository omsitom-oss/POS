using System.Data.Common;

namespace ElitePos.LocalService.Security;

// Changes to users and roles must leave at least one active user, in an active branch, who holds USER_MANAGEMENT
// through an active role. Otherwise nobody could sign in to fix users and roles again.
public static class UserManagerGuard
{
    public const string Message = "This change would leave no active user who can manage users. Give another active user the user management permission first.";

    public static async Task<bool> AnyRemainsAsync(DbConnection db, DbTransaction tx, CancellationToken ct)
    {
        await using var command = db.CreateCommand();
        command.Transaction = tx;
        command.CommandText = """
            SELECT CASE WHEN EXISTS (
                SELECT 1 FROM dbo.Users u
                JOIN dbo.Branches b ON b.BranchId=u.BranchId AND b.IsActive=1
                JOIN dbo.UserRoles ur ON ur.UserId=u.UserId
                JOIN dbo.Roles r ON r.RoleId=ur.RoleId AND r.IsActive=1
                JOIN dbo.RolePermissions rp ON rp.RoleId=r.RoleId
                JOIN dbo.Permissions p ON p.PermissionId=rp.PermissionId AND p.Code=N'USER_MANAGEMENT'
                WHERE u.IsActive=1) THEN 1 ELSE 0 END
            """;
        return Convert.ToInt32(await command.ExecuteScalarAsync(ct)) == 1;
    }
}
