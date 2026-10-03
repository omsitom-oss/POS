using ElitePos.LocalService.Data;
using ElitePos.LocalService.Data.Management;
using ElitePos.LocalService.Data.Pos;
using ElitePos.LocalService.Endpoints;
using ElitePos.LocalService.Models;
using ElitePos.LocalService.Services;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls(Environment.GetEnvironmentVariable("ASPNETCORE_URLS") ?? "http://127.0.0.1:5080");

if (args.Contains("--migrate-management", StringComparer.OrdinalIgnoreCase))
{
    var migrationFactory = new ManagementConnectionFactory(builder.Configuration);
    try
    {
        var version = await new ManagementMigrationRunner(migrationFactory).ApplyAsync();
        Console.WriteLine($"POSManagement schema is at version {version}.");
        return;
    }
    catch (Exception exception)
    {
        Console.Error.WriteLine($"POSManagement migration failed: {exception.Message}");
        Environment.ExitCode = 1;
        return;
    }
}

if (args.Contains("--migrate-pos", StringComparer.OrdinalIgnoreCase))
{
    var posOptions = builder.Configuration.GetSection(DatabaseOptions.SectionName).Get<DatabaseOptions>() ?? new DatabaseOptions();
    try
    {
        var version = await new PosMigrationRunner(new DbConnectionFactory(posOptions, builder.Configuration, builder.Environment)).ApplyAsync();
        Console.WriteLine($"POS customer schema is at version {version}.");
        return;
    }
    catch (Exception exception)
    {
        Console.Error.WriteLine($"POS migration failed: {exception.Message}");
        Environment.ExitCode = 1;
        return;
    }
}

var databaseOptions = builder.Configuration
    .GetSection(DatabaseOptions.SectionName)
    .Get<DatabaseOptions>() ?? new DatabaseOptions();

builder.Services.AddSingleton(databaseOptions);
builder.Services.AddSingleton<DbConnectionFactory>();
builder.Services.AddSingleton<ManagementConnectionFactory>();
builder.Services.AddSingleton<SchemaVersionStore>();
builder.Services.AddSingleton<DatabaseHealthService>();
builder.Services.AddSingleton<ManagementService>();
builder.Services.AddSingleton<SettingsService>();
builder.Services.AddSingleton<LocationService>();
builder.Services.AddSingleton<CompanyProfileService>();
builder.Services.AddSingleton<CurrencyService>();
builder.Services.AddSingleton<BranchService>();
builder.Services.AddSingleton<TreasuryService>();
builder.Services.AddSingleton<BankService>();
builder.Services.AddSingleton<PartnerService>();
builder.Services.AddSingleton<UserService>();
builder.Services.AddSingleton<AuthService>();
builder.Services.AddSingleton<ApprovalService>();
builder.Services.AddSingleton<AccountService>();
builder.Services.AddSingleton<PurchaseService>();
builder.Services.AddSingleton<SalesService>();
builder.Services.AddSingleton<ReportService>();
builder.Services.AddSingleton<RoleService>();
builder.Services.AddSingleton<ItemService>();
builder.Services.AddSingleton<InventoryService>();
builder.Services.AddSingleton<TransactionService>();
builder.Services.AddSingleton<ReceiptService>();
builder.Services.AddSingleton<ExpenseService>();
builder.Services.AddSingleton<TreasuryTransferService>();
builder.Services.AddCors(options =>
{
    options.AddPolicy("DesignLab", policy => policy
        .WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
        .WithMethods("GET", "POST", "PUT"));
});

var app = builder.Build();
app.UseCors("DesignLab");

// SQLite is a fresh local destination in this foundation. SQL Server is connection-only
// until a destination schema is explicitly selected for a future migration.
try
{
    if (databaseOptions.Provider.Equals("SQLite", StringComparison.OrdinalIgnoreCase))
    {
        await app.Services.GetRequiredService<SchemaVersionStore>().EnsureInfrastructureAsync();
    }
}
catch (Exception exception)
{
    app.Logger.LogError(exception, "Could not initialize the schema version store.");
    throw;
}

app.MapGet("/api/health", async (DatabaseHealthService health, CancellationToken cancellationToken) =>
    Results.Ok(await health.CheckAsync(cancellationToken)));

app.MapGet("/api/database/provider", (DbConnectionFactory factory) =>
    Results.Ok(new { provider = factory.ProviderName }));
app.MapManagementEndpoints();
app.MapSettingsEndpoints();
app.MapLocationEndpoints();
app.MapCompanyProfileEndpoints();
app.MapCurrencyEndpoints();
app.MapBranchEndpoints();
app.MapTreasuryEndpoints();
app.MapBankEndpoints();
app.MapPartnerEndpoints();
app.MapUserEndpoints();
app.MapAuthEndpoints();
app.MapApprovalEndpoints();
app.MapAccountEndpoints();
app.MapPurchaseEndpoints();
app.MapSalesEndpoints();
app.MapReportEndpoints();
app.MapRoleEndpoints();
app.MapItemEndpoints();
app.MapInventoryEndpoints();
app.MapTransactionEndpoints();
app.MapReceiptEndpoints();
app.MapExpenseEndpoints();
app.MapTreasuryTransferEndpoints();

app.Run();
