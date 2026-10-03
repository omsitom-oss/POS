using System.Reflection;
using Microsoft.Data.SqlClient;

namespace ElitePos.LocalService.Data.Management;

public sealed class ManagementMigrationRunner(ManagementConnectionFactory connectionFactory)
{
    private const string HistoryTable = "dbo.ManagementSchemaMigrations";

    public async Task<int> ApplyAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            await EnsureTargetDatabaseAsync(connection, transaction, cancellationToken);
            var hasHistory = await TableExistsAsync(connection, transaction, HistoryTable, cancellationToken);
            if (!hasHistory)
            {
                var conflictingObjectCount = await GetConflictingObjectCountAsync(connection, transaction, cancellationToken);
                if (conflictingObjectCount != 0)
                {
                    throw new InvalidOperationException(
                        "POSManagement contains user tables but no Management migration history. No schema changes were made.");
                }
            }
            var currentVersion = hasHistory ? await GetCurrentVersionAsync(connection, transaction, cancellationToken) : 0;
            if (currentVersion > 2)
                throw new InvalidOperationException("POSManagement has a newer Management migration version than this service supports.");
            if (currentVersion == 0 && hasHistory)
            {
                var conflictingObjectCount = await GetConflictingObjectCountAsync(connection, transaction, cancellationToken);
                if (conflictingObjectCount != 0)
                    throw new InvalidOperationException("POSManagement contains user objects but no applied Management migration. No schema changes were made.");
            }
            if (currentVersion < 1)
            {
                await ExecuteMigrationAsync(connection, transaction, 1, "Initial Management schema", cancellationToken);
                currentVersion = 1;
            }
            if (currentVersion < 2)
            {
                await ExecuteMigrationAsync(connection, transaction, 2, "Partner type migration", cancellationToken);
                currentVersion = 2;
            }

            await transaction.CommitAsync(cancellationToken);
            return currentVersion;
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private static async Task EnsureTargetDatabaseAsync(SqlConnection connection, SqlTransaction transaction, CancellationToken cancellationToken)
    {
        await using var command = new SqlCommand("SELECT DB_NAME();", connection, transaction);
        var databaseName = (string?)await command.ExecuteScalarAsync(cancellationToken);
        if (!string.Equals(databaseName, "POSManagement", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("The Management migration stopped because the active database is not POSManagement.");
        }
    }

    private static async Task<bool> TableExistsAsync(SqlConnection connection, SqlTransaction transaction, string tableName, CancellationToken cancellationToken)
    {
        await using var command = new SqlCommand("SELECT CASE WHEN OBJECT_ID(@tableName, N'U') IS NULL THEN 0 ELSE 1 END;", connection, transaction);
        command.Parameters.AddWithValue("@tableName", tableName);
        return Convert.ToInt32(await command.ExecuteScalarAsync(cancellationToken)) == 1;
    }

    private static async Task<int> GetConflictingObjectCountAsync(SqlConnection connection, SqlTransaction transaction, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT COUNT(*)
            FROM sys.objects
            WHERE is_ms_shipped = 0
              AND type IN ('U', 'V', 'P', 'FN', 'IF', 'TF', 'FS', 'FT', 'TR')
              AND name <> 'ManagementSchemaMigrations';
            """;
        await using var command = new SqlCommand(sql, connection, transaction);
        return Convert.ToInt32(await command.ExecuteScalarAsync(cancellationToken));
    }

    private static async Task<int> GetCurrentVersionAsync(SqlConnection connection, SqlTransaction transaction, CancellationToken cancellationToken)
    {
        await using var command = new SqlCommand($"SELECT COALESCE(MAX(Version), 0) FROM {HistoryTable};", connection, transaction);
        return Convert.ToInt32(await command.ExecuteScalarAsync(cancellationToken));
    }

    private static async Task ExecuteAsync(SqlConnection connection, SqlTransaction transaction, string sql, CancellationToken cancellationToken)
    {
        await using var command = new SqlCommand(sql, connection, transaction);
        command.CommandTimeout = 60;
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task ExecuteMigrationAsync(SqlConnection connection, SqlTransaction transaction, int version, string description, CancellationToken cancellationToken)
    {
        var resourceName = $"server.Data.Management.Migrations.{version:D3}_{(version == 1 ? "InitialManagementSchema" : "AddPartnerTypeAndMigrateLegacyPartners")}.sql";
        await using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"Management migration resource '{resourceName}' was not found.");
        using var reader = new StreamReader(stream);
        await ExecuteAsync(connection, transaction, await reader.ReadToEndAsync(cancellationToken), cancellationToken);
        await ExecuteAsync(connection, transaction, $"INSERT INTO dbo.ManagementSchemaMigrations (Version, Description, AppliedAtUtc) VALUES ({version}, N'{description.Replace("'", "''")}', SYSUTCDATETIME());", cancellationToken);
    }
}
