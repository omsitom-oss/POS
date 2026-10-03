using ElitePos.LocalService.Data.Pos;
using Microsoft.Data.SqlClient;

namespace ElitePos.LocalService.Tests;

// Applies every migration to a brand-new SQL Server database. Runs only when POS_TEST_SQLSERVER holds a
// connection string to a disposable server (CI starts one in a container); otherwise the tests are skipped.
public sealed class SqlServerMigrationTests
{
    private static readonly string? ServerConnectionString = Environment.GetEnvironmentVariable("POS_TEST_SQLSERVER");

    [Fact]
    public async Task Pos_migrations_apply_cleanly_to_an_empty_database()
    {
        Assert.SkipWhen(string.IsNullOrWhiteSpace(ServerConnectionString), "POS_TEST_SQLSERVER is not set.");
        var ct = TestContext.Current.CancellationToken;
        await using var database = await ScratchDatabase.CreateAsync(ServerConnectionString!, ct);

        foreach (var migration in PosMigrationRunner.GetMigrations())
            await database.ExecuteAsync(MigrationSql.Read(migration.Name), $"POS {migration.Version:D3} {migration.Title}", ct);

        foreach (var table in new[] { "SettingTypes", "Settings", "Items", "Purchases", "Sales", "StockMovements", "Transactions", "Users", "Roles" })
            Assert.True(await database.TableExistsAsync(table, ct), $"Expected table dbo.{table} after POS migrations.");
    }

    [Fact]
    public async Task Management_migrations_apply_cleanly_to_an_empty_database()
    {
        Assert.SkipWhen(string.IsNullOrWhiteSpace(ServerConnectionString), "POS_TEST_SQLSERVER is not set.");
        var ct = TestContext.Current.CancellationToken;
        await using var database = await ScratchDatabase.CreateAsync(ServerConnectionString!, ct);

        await database.ExecuteAsync(MigrationSql.Read("server.Data.Management.Migrations.001_InitialManagementSchema.sql"), "Management 001", ct);
        await database.ExecuteAsync(MigrationSql.Read("server.Data.Management.Migrations.002_AddPartnerTypeAndMigrateLegacyPartners.sql"), "Management 002", ct);

        Assert.True(await database.TableExistsAsync("Customers", ct));
        Assert.True(await database.TableExistsAsync("ManagementSchemaMigrations", ct));
    }

    private sealed class ScratchDatabase : IAsyncDisposable
    {
        private readonly string serverConnectionString;
        private readonly string name;
        private readonly SqlConnection connection;

        private ScratchDatabase(string serverConnectionString, string name, SqlConnection connection)
        {
            this.serverConnectionString = serverConnectionString;
            this.name = name;
            this.connection = connection;
        }

        public static async Task<ScratchDatabase> CreateAsync(string serverConnectionString, CancellationToken ct)
        {
            var name = $"PosTest_{Guid.NewGuid():N}";
            await using (var master = new SqlConnection(serverConnectionString))
            {
                await master.OpenAsync(ct);
                await using var create = new SqlCommand($"CREATE DATABASE [{name}]", master);
                await create.ExecuteNonQueryAsync(ct);
            }

            var connection = new SqlConnection(new SqlConnectionStringBuilder(serverConnectionString) { InitialCatalog = name, Pooling = false }.ConnectionString);
            await connection.OpenAsync(ct);
            return new ScratchDatabase(serverConnectionString, name, connection);
        }

        public async Task ExecuteAsync(string sql, string label, CancellationToken ct)
        {
            await using var command = new SqlCommand(sql, connection) { CommandTimeout = 120 };
            try { await command.ExecuteNonQueryAsync(ct); }
            catch (SqlException exception) { throw new InvalidOperationException($"{label} failed: {exception.Message}", exception); }
        }

        public async Task<bool> TableExistsAsync(string table, CancellationToken ct)
        {
            await using var command = new SqlCommand("SELECT CASE WHEN OBJECT_ID(@name, N'U') IS NULL THEN 0 ELSE 1 END", connection);
            command.Parameters.AddWithValue("@name", $"dbo.{table}");
            return Convert.ToInt32(await command.ExecuteScalarAsync(ct)) == 1;
        }

        public async ValueTask DisposeAsync()
        {
            await connection.DisposeAsync();
            await using var master = new SqlConnection(serverConnectionString);
            await master.OpenAsync();
            await using var drop = new SqlCommand($"ALTER DATABASE [{name}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{name}]", master);
            await drop.ExecuteNonQueryAsync();
        }
    }
}
