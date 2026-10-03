using System.Data;
using System.Data.Common;

namespace ElitePos.LocalService.Security;

// Writes password and lockout events to dbo.SecurityAuditLog inside the caller's transaction.
public static class SecurityAudit
{
    public static async Task WriteAsync(DbConnection db, DbTransaction? tx, string eventType, int? actorUserId, int? targetUserId, string? detail, CancellationToken ct)
    {
        await using var command = db.CreateCommand();
        command.Transaction = tx;
        command.CommandText = "INSERT INTO dbo.SecurityAuditLog(EventType,ActorUserId,TargetUserId,Detail) VALUES(@type,@actor,@target,@detail)";
        Add(command, "@type", eventType, DbType.String, 50);
        Add(command, "@actor", actorUserId, DbType.Int32);
        Add(command, "@target", targetUserId, DbType.Int32);
        Add(command, "@detail", detail, DbType.String, 300);
        await command.ExecuteNonQueryAsync(ct);
    }

    private static void Add(DbCommand command, string name, object? value, DbType type, int? size = null) { var parameter = command.CreateParameter(); parameter.ParameterName = name; parameter.DbType = type; if (size.HasValue) parameter.Size = size.Value; parameter.Value = value ?? DBNull.Value; command.Parameters.Add(parameter); }
}
