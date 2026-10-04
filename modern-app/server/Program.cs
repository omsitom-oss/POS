using ElitePos.LocalService.Data;
using ElitePos.LocalService.Data.Management;
using ElitePos.LocalService.Data.Pos;
using ElitePos.LocalService.Endpoints;
using ElitePos.LocalService.Models;
using ElitePos.LocalService.Security;
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

var createAdminIndex = Array.FindIndex(args, arg => arg.Equals("--create-admin", StringComparison.OrdinalIgnoreCase));
if (createAdminIndex >= 0)
{
    var posOptions = builder.Configuration.GetSection(DatabaseOptions.SectionName).Get<DatabaseOptions>() ?? new DatabaseOptions();
    try
    {
        var userName = createAdminIndex + 1 < args.Length ? args[createAdminIndex + 1] : throw new InvalidOperationException("Usage: --create-admin <username>");
        var temporaryPassword = await new AdminBootstrap(new DbConnectionFactory(posOptions, builder.Configuration, builder.Environment)).CreateAsync(userName);
        Console.WriteLine($"Administrator '{userName}' created with the {AdminBootstrap.RoleName} role.");
        Console.WriteLine($"One-time password: {temporaryPassword}");
        Console.WriteLine("Sign in with it and choose a new password. It is not shown again.");
        return;
    }
    catch (Exception exception)
    {
        Console.Error.WriteLine($"Creating the administrator failed: {exception.Message}");
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
builder.Services.AddSingleton<ImportShipmentService>();
builder.Services.AddSingleton<SalesService>();
builder.Services.AddSingleton<SalesReturnService>();
builder.Services.AddSingleton<PurchaseReturnService>();
builder.Services.AddSingleton<ReportService>();
builder.Services.AddSingleton<RoleService>();
builder.Services.AddSingleton<ItemService>();
builder.Services.AddSingleton<InventoryService>();
builder.Services.AddSingleton<TransactionService>();
builder.Services.AddSingleton<ReceiptService>();
builder.Services.AddSingleton<ExpenseService>();
builder.Services.AddSingleton<TreasuryTransferService>();
builder.Services.AddPosSecurity(builder.Configuration);
builder.Services.AddCors(options =>
{
    options.AddPolicy("DesignLab", policy => policy
        .WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
        .WithMethods("GET", "POST", "PUT"));
});

var app = builder.Build();
app.UseCors("DesignLab");
app.UsePosSecurity();

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
    Results.Ok(await health.CheckAsync(cancellationToken))).AllowAnonymous();

// Every API route requires a signed-in user unless it opts out with AllowAnonymous (health, login).
var api = app.MapGroup("").RequireAuthorization();
api.MapGet("/api/database/provider", (DbConnectionFactory factory) =>
    Results.Ok(new { provider = factory.ProviderName }));
api.MapManagementEndpoints();
api.MapSettingsEndpoints();
api.MapLocationEndpoints();
api.MapCompanyProfileEndpoints();
api.MapCurrencyEndpoints();
api.MapBranchEndpoints();
api.MapTreasuryEndpoints();
api.MapBankEndpoints();
api.MapPartnerEndpoints();
api.MapUserEndpoints();
api.MapAuthEndpoints();
api.MapApprovalEndpoints();
api.MapAccountEndpoints();
api.MapPurchaseEndpoints();
api.MapImportEndpoints();
api.MapSalesEndpoints();
api.MapReturnEndpoints();
api.MapReportEndpoints();
api.MapRoleEndpoints();
api.MapItemEndpoints();
api.MapInventoryEndpoints();
api.MapTransactionEndpoints();
api.MapReceiptEndpoints();
api.MapExpenseEndpoints();
api.MapTreasuryTransferEndpoints();

app.Run();
