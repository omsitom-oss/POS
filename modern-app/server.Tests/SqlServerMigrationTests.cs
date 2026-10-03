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
        await LegacySource.EnsureAsync(ServerConnectionString!, ct);
        await using var database = await ScratchDatabase.CreateAsync(ServerConnectionString!, ct);

        foreach (var migration in PosMigrationRunner.GetMigrations())
        {
            // 031 requires a branch, which a real install creates in the Branches screen after 008 has run.
            if (migration.Version == 31)
                await database.ExecuteAsync("IF NOT EXISTS (SELECT 1 FROM dbo.Branches) INSERT INTO dbo.Branches (BranchCode, NameAr, NameEn) VALUES (N'MAIN', N'الفرع الرئيسي', N'Main branch');", "Seed first branch", ct);
            await database.ExecuteAsync(MigrationSql.Read(migration.Name), $"POS {migration.Version:D3} {migration.Title}", ct);
        }

        foreach (var table in new[] { "SettingTypes", "Settings", "Items", "Purchases", "Sales", "StockMovements", "Transactions", "Users", "Roles" })
            Assert.True(await database.TableExistsAsync(table, ct), $"Expected table dbo.{table} after POS migrations.");

        // The legacy import migrations (016, 017, 022) copy the seeded legacy rows.
        Assert.Equal(1, await database.CountAsync("SELECT COUNT(*) FROM dbo.Items WHERE LegacyItemId = 1", ct));
        Assert.Equal(2, await database.CountAsync("SELECT COUNT(*) FROM dbo.ItemUnits iu JOIN dbo.Items i ON i.ItemId = iu.ItemId WHERE i.LegacyItemId = 1", ct));
        Assert.Equal(1, await database.CountAsync("SELECT COUNT(*) FROM dbo.Partners WHERE LegacyPartnerId = 1", ct));
    }

    // Migrations 016, 017 and 022 import reference data from the legacy [Hsain-Default] database by name, so a fresh
    // database can only be migrated when that database exists. CI recreates its tables (columns from
    // docs/legacy-analysis/03-database-schema.md) with one row each.
    internal static class LegacySource
    {
        private const string CreateDatabase = """
            IF DB_ID(N'Hsain-Default') IS NULL CREATE DATABASE [Hsain-Default];
            """;

        private const string Tables = """
            IF OBJECT_ID(N'dbo.SettingsGenerics', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.SettingsGenerics (GenericID int NOT NULL, GenericName nvarchar(250) NULL);
                CREATE TABLE dbo.SettingsCategories (CategoryID int NOT NULL, CategoryName nvarchar(250) NULL);
                CREATE TABLE dbo.SettingsUnits (UnitID int NOT NULL, UnitName nvarchar(150) NULL);
                CREATE TABLE dbo.SettingsItems (ItemID int NOT NULL, ManufacturerName nvarchar(250) NULL, CategoryID int NULL, GenericID int NULL,
                    ItemName nvarchar(250) NOT NULL, UnitName nvarchar(150) NOT NULL, BigUnitName nvarchar(150) NOT NULL, SellPrice float NOT NULL,
                    NoOfUnits bigint NOT NULL, MinimumLevelForAlert int NOT NULL);
                CREATE TABLE dbo.SettingsPartners (PartnerID int NOT NULL, Client int NOT NULL, Supplier int NOT NULL, PartnerName nvarchar(250) NOT NULL,
                    PartnerPhone nvarchar(50) NULL, PartnerCity nvarchar(150) NULL, PartnerAddress nvarchar(350) NULL, PartnerEmail nvarchar(150) NULL,
                    SalesManName nvarchar(250) NOT NULL);
                INSERT INTO dbo.SettingsGenerics VALUES (1, N'Paracetamol');
                INSERT INTO dbo.SettingsCategories VALUES (1, N'Analgesics');
                INSERT INTO dbo.SettingsUnits VALUES (1, N'حبة'), (2, N'علبة');
                INSERT INTO dbo.SettingsItems VALUES (1, N'GSK', 1, 1, N'Panadol 500mg', N'حبة', N'علبة', 12.5, 24, 5);
                INSERT INTO dbo.SettingsPartners VALUES (1, 1, 0, N'Walk-in clinic', N'0500000000', N'Dubai', NULL, NULL, N'');
            END;
            """;

        public static async Task EnsureAsync(string serverConnectionString, CancellationToken ct)
        {
            await using (var master = new SqlConnection(serverConnectionString))
            {
                await master.OpenAsync(ct);
                await using var create = new SqlCommand(CreateDatabase, master);
                await create.ExecuteNonQueryAsync(ct);
            }

            await using var legacy = new SqlConnection(new SqlConnectionStringBuilder(serverConnectionString) { InitialCatalog = "Hsain-Default", Pooling = false }.ConnectionString);
            await legacy.OpenAsync(ct);
            await using var tables = new SqlCommand(Tables, legacy);
            await tables.ExecuteNonQueryAsync(ct);
        }
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

    internal sealed class ScratchDatabase : IAsyncDisposable
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

        // Connection string for the scratch database itself, for hosting the API against it.
        public string ConnectionString => new SqlConnectionStringBuilder(serverConnectionString) { InitialCatalog = name, Pooling = false }.ConnectionString;

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

        public async Task<int> CountAsync(string sql, CancellationToken ct)
        {
            await using var command = new SqlCommand(sql, connection);
            return Convert.ToInt32(await command.ExecuteScalarAsync(ct));
        }

        public async Task<T?> ScalarAsync<T>(string sql, CancellationToken ct)
        {
            await using var command = new SqlCommand(sql, connection);
            return await command.ExecuteScalarAsync(ct) is T value ? value : default;
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
