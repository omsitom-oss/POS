using System.Reflection;
using System.Text.RegularExpressions;
using ElitePos.LocalService.Data;
using Microsoft.Data.SqlClient;

namespace ElitePos.LocalService.Data.Pos;

public sealed class PosMigrationRunner(DbConnectionFactory factory)
{
    public async Task<int> ApplyAsync(CancellationToken cancellationToken = default)
    {
        if (!factory.ProviderName.Equals("SqlServer", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("The customer POS migration currently requires SQL Server.");

        await using var connection = factory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using (var identity = connection.CreateCommand())
        {
            identity.CommandText = "SELECT DB_NAME()";
            var databaseName = (string?)await identity.ExecuteScalarAsync(cancellationToken);
            if (!string.Equals(databaseName, "POS", StringComparison.Ordinal))
                throw new InvalidOperationException($"Refusing customer POS migration because the connected database is '{databaseName}'. Expected 'POS'.");
        }

        var existing = new List<string>();
        await using (var inventory = connection.CreateCommand())
        {
            inventory.CommandText = "SELECT s.name + N'.' + o.name FROM sys.objects o JOIN sys.schemas s ON s.schema_id=o.schema_id WHERE o.is_ms_shipped=0 AND o.type IN ('U','V','P','FN','IF','TF','TR') ORDER BY s.name,o.name";
            await using var reader = await inventory.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken)) existing.Add(reader.GetString(0));
        }

        if (existing.Count > 0)
        {
            var expected = new[] { "dbo.Accounts", "dbo.Banks", "dbo.Branches", "dbo.CashBoxes", "dbo.Treasuries", "dbo.Cities", "dbo.CompanyProfile", "dbo.Currencies", "dbo.CurrencyRateHistory", "dbo.Countries", "dbo.ExpenseSequences", "dbo.ItemPriceHistory", "dbo.ItemUnits", "dbo.Items", "dbo.Partners", "dbo.Permissions", "dbo.PosSchemaMigrations", "dbo.ReceiptSequences", "dbo.RolePermissions", "dbo.Roles", "dbo.Settings", "dbo.SettingTypes", "dbo.Transactions", "dbo.Purchases", "dbo.PurchaseLines", "dbo.PurchaseAdditionalCosts", "dbo.StockMovements", "dbo.UserRoles", "dbo.Users", "dbo.DeletePurchaseByInvoiceNo", "dbo.ApprovalSettings", "dbo.InventoryRequests", "dbo.Sales", "dbo.SaleLines", "dbo.UserSessions", "dbo.SecurityAuditLog" };
            if (existing.Any(item => !expected.Contains(item, StringComparer.Ordinal)))
                throw new InvalidOperationException("Refusing to migrate POS because application objects already exist: " + string.Join(", ", existing));
        }

        var assembly = Assembly.GetExecutingAssembly();
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        try
        {
            await using (var history = connection.CreateCommand())
            {
                history.Transaction = (SqlTransaction)transaction;
                history.CommandText = "IF OBJECT_ID(N'dbo.PosSchemaMigrations', N'U') IS NULL CREATE TABLE dbo.PosSchemaMigrations (Version int NOT NULL CONSTRAINT PK_PosSchemaMigrations PRIMARY KEY, Name nvarchar(200) NOT NULL, AppliedAt datetime2(3) NOT NULL CONSTRAINT DF_PosSchemaMigrations_AppliedAt DEFAULT (SYSUTCDATETIME())); SELECT COALESCE(MAX(Version),0) FROM dbo.PosSchemaMigrations";
                var version = Convert.ToInt32(await history.ExecuteScalarAsync(cancellationToken));

                var migrations = GetMigrations();

                foreach (var migration in migrations.Where(item => item.Version > version))
                {
                    await using var stream = assembly.GetManifestResourceStream(migration.Name)!;
                    using var reader = new StreamReader(stream);
                    await using var command = connection.CreateCommand();
                    command.Transaction = (SqlTransaction)transaction;
                    command.CommandText = await reader.ReadToEndAsync(cancellationToken);
                    await command.ExecuteNonQueryAsync(cancellationToken);

                    await using var record = connection.CreateCommand();
                    record.Transaction = (SqlTransaction)transaction;
                    record.CommandText = "INSERT INTO dbo.PosSchemaMigrations (Version, Name) VALUES (@version, @name)";
                    var versionParameter = record.CreateParameter(); versionParameter.ParameterName = "@version"; versionParameter.Value = migration.Version; record.Parameters.Add(versionParameter);
                    var nameParameter = record.CreateParameter(); nameParameter.ParameterName = "@name"; nameParameter.Value = migration.Title; record.Parameters.Add(nameParameter);
                    await record.ExecuteNonQueryAsync(cancellationToken);
                    version = migration.Version;
                }

                await transaction.CommitAsync(cancellationToken);
                return version;
            }
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    // Only scripts under Data/Pos/Migrations belong to this stream; Management scripts are embedded in the same assembly.
    internal static IReadOnlyList<(string Name, int Version, string Title)> GetMigrations() =>
        Assembly.GetExecutingAssembly().GetManifestResourceNames()
            .Where(name => name.Contains(".Data.Pos.Migrations.", StringComparison.Ordinal))
            .Select(name => new { Name = name, Match = Regex.Match(name, @"(?<version>\d+)_(?<title>[^.]+)\.sql$", RegexOptions.IgnoreCase) })
            .Where(item => item.Match.Success)
            .Select(item => (item.Name, Version: int.Parse(item.Match.Groups["version"].Value), Title: item.Match.Groups["title"].Value.Replace('_', ' ')))
            .OrderBy(item => item.Version)
            .ToArray();
}

