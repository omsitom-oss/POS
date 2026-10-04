using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Data.Pos;
using ElitePos.LocalService.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.DependencyInjection;

namespace ElitePos.LocalService.Tests;

// Hosts the API against a migrated scratch SQL Server database and signs in for real. Runs only when
// POS_TEST_SQLSERVER is set (CI starts a container); otherwise every test is skipped.
public sealed class SqlServerApiFixture : IAsyncLifetime
{
    public static readonly string? ServerConnectionString = Environment.GetEnvironmentVariable("POS_TEST_SQLSERVER");
    public const int MaxFailedLogins = 3;

    private SqlServerMigrationTests.ScratchDatabase? database;
    public WebApplicationFactory<Program> Api { get; private set; } = null!;
    public string AdminToken { get; private set; } = "";
    public int BranchA { get; private set; }
    public int BranchB { get; private set; }
    public int TreasuryA { get; private set; }
    public int TreasuryB { get; private set; }
    public string? ExpenseAccount { get; private set; }
    public int CurrencyId { get; private set; }

    public async ValueTask InitializeAsync()
    {
        if (string.IsNullOrWhiteSpace(ServerConnectionString)) return;
        var ct = TestContext.Current.CancellationToken;
        database = await SqlServerMigrationTests.ScratchDatabase.CreateAsync(ServerConnectionString, ct);
        foreach (var migration in PosMigrationRunner.GetMigrations())
            await database.ExecuteAsync(MigrationSql.Read(migration.Name), $"POS {migration.Version:D3}", ct);

        // Two branches with one sale and one purchase each.
        await database.ExecuteAsync("""
            INSERT dbo.Branches(BranchCode,NameAr,NameEn) VALUES(N'BR-B',N'ب',N'Branch B');
            DECLARE @a int = (SELECT MIN(BranchId) FROM dbo.Branches), @b int = (SELECT MAX(BranchId) FROM dbo.Branches);
            INSERT dbo.Currencies(CurrencyCode,CurrencyNameEn,CurrencyNameAr,Symbol,IsPrimary) VALUES(N'TST',N'Test',N'تجربة',N'T',0);
            DECLARE @currency int = SCOPE_IDENTITY();
            INSERT dbo.Partners(PartnerCode,PartnerName,PartnerTypeSettingId) VALUES(N'P-SEC',N'Security test partner',(SELECT TOP 1 s.SettingId FROM dbo.Settings s JOIN dbo.SettingTypes t ON t.SettingTypeId=s.SettingTypeId WHERE t.Code=N'PARTNER_TYPE' ORDER BY s.SettingId));
            DECLARE @partner int = SCOPE_IDENTITY();
            INSERT dbo.Treasuries(TreasuryCode,NameAr,NameEn,CurrencyId,BranchId) VALUES(N'T-SEC',N'خزنة',N'Treasury',@currency,@a);
            DECLARE @treasury int = SCOPE_IDENTITY();
            INSERT dbo.Treasuries(TreasuryCode,NameAr,NameEn,CurrencyId,BranchId) VALUES(N'T-SEC-B',N'خزنة ب',N'Treasury B',@currency,@b);
            INSERT dbo.Purchases(BranchId,SupplierPartnerId,InvoiceNo,PurchaseDate,CurrencyId,Status,Total) VALUES
                (@a,@partner,N'PO-A',CAST(SYSUTCDATETIME() AS date),@currency,N'POSTED',100),(@b,@partner,N'PO-B',CAST(SYSUTCDATETIME() AS date),@currency,N'POSTED',250);
            INSERT dbo.Sales(BranchId,SaleNo,SaleDate,TreasuryId,CurrencyId,Status,Total) VALUES
                (@a,N'SL-A',CAST(SYSUTCDATETIME() AS date),@treasury,@currency,N'POSTED',10),(@b,N'SL-B',CAST(SYSUTCDATETIME() AS date),@treasury,@currency,N'POSTED',20);
            """, "seed", ct);
        BranchA = await database.CountAsync("SELECT MIN(BranchId) FROM dbo.Branches", ct);
        BranchB = await database.CountAsync("SELECT MAX(BranchId) FROM dbo.Branches", ct);
        TreasuryA = await database.CountAsync("SELECT TreasuryId FROM dbo.Treasuries WHERE TreasuryCode=N'T-SEC'", ct);
        TreasuryB = await database.CountAsync("SELECT TreasuryId FROM dbo.Treasuries WHERE TreasuryCode=N'T-SEC-B'", ct);
        CurrencyId = await database.CountAsync("SELECT CurrencyId FROM dbo.Currencies WHERE CurrencyCode=N'TST'", ct);
        ExpenseAccount = await database.ScalarAsync<string>("SELECT TOP 1 AccountCode FROM dbo.Accounts WHERE AccountType='EXPENSE' AND IsActive=1 ORDER BY AccountCode", ct);

        var connectionString = database.ConnectionString;
        Api = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("Database:Provider", "SqlServer");
            builder.UseSetting("ConnectionStrings:POS", connectionString);
            builder.UseSetting("Auth:MaxFailedLogins", MaxFailedLogins.ToString());
            // The test container signs in with a SQL login, which the app refuses unless this allowance is registered.
            builder.ConfigureTestServices(services => services.AddSingleton(new SqlCredentialsTestAllowance()));
        });
        // The bootstrap admin signs in with its one-time password, which only allows replacing it.
        var oneTime = await new AdminBootstrap(Api.Services.GetRequiredService<DbConnectionFactory>()).CreateAsync("admin", ct);
        var client = Api.CreateClient();
        var first = await (await client.PostAsJsonAsync("/api/auth/login", new { identifier = "admin", password = oneTime }, ct)).Content.ReadFromJsonAsync<JsonElement>(ct);
        Assert.True(first.GetProperty("mustChangePassword").GetBoolean());
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", first.GetProperty("token").GetString());
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/users", ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsJsonAsync("/api/auth/change-password", new { currentPassword = oneTime, newPassword = "Admin-Pass-1" }, ct)).StatusCode);
        var signedIn = await (await Api.CreateClient().PostAsJsonAsync("/api/auth/login", new { identifier = "admin", password = "Admin-Pass-1" }, ct)).Content.ReadFromJsonAsync<JsonElement>(ct);
        AdminToken = signedIn.GetProperty("token").GetString()!;
    }

    // The scratch database, for tests that check rows the API wrote.
    internal SqlServerMigrationTests.ScratchDatabase Database => database!;

    public HttpClient Client(string token)
    {
        var client = Api.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    public async Task<(HttpStatusCode Status, JsonElement Body)> LoginAsync(string userName, string password)
    {
        var ct = TestContext.Current.CancellationToken;
        var response = await Api.CreateClient().PostAsJsonAsync("/api/auth/login", new { identifier = userName, password }, ct);
        return (response.StatusCode, await response.Content.ReadFromJsonAsync<JsonElement>(ct));
    }

    // Creates a user with the given permissions through the API and returns a signed-in client.
    public async Task<(HttpClient Client, int UserId, string Password)> CreateUserAsync(string userName, int branchId, params string[] permissions)
    {
        var ct = TestContext.Current.CancellationToken;
        var admin = Client(AdminToken);
        var allPermissions = await admin.GetFromJsonAsync<JsonElement[]>("/api/permissions", ct);
        var ids = allPermissions!.Where(p => permissions.Contains(p.GetProperty("code").GetString())).Select(p => p.GetProperty("permissionId").GetInt32()).ToArray();
        var role = await (await admin.PostAsJsonAsync("/api/roles", new { name = $"role-{userName}", permissionIds = ids }, ct)).Content.ReadFromJsonAsync<JsonElement>(ct);
        var created = await admin.PostAsJsonAsync("/api/users", new { userName, branchId, roleIds = new[] { role.GetProperty("roleId").GetInt32() }, password = "User-Pass-123" }, ct);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var user = await created.Content.ReadFromJsonAsync<JsonElement>(ct);
        // An admin-set password must be changed at first sign-in.
        var (_, login) = await LoginAsync(userName, "User-Pass-123");
        Assert.True(login.GetProperty("mustChangePassword").GetBoolean());
        var change = await Client(login.GetProperty("token").GetString()!).PostAsJsonAsync("/api/auth/change-password", new { currentPassword = "User-Pass-123", newPassword = "Changed-Pass-1" }, ct);
        Assert.Equal(HttpStatusCode.NoContent, change.StatusCode);
        var (_, fresh) = await LoginAsync(userName, "Changed-Pass-1");
        return (Client(fresh.GetProperty("token").GetString()!), user.GetProperty("userId").GetInt32(), "Changed-Pass-1");
    }

    public async ValueTask DisposeAsync()
    {
        if (Api is not null) await Api.DisposeAsync();
        if (database is not null) await database.DisposeAsync();
    }
}

[Collection(SqlServerCollection.Name)]
public sealed class SqlServerSecurityTests(SqlServerApiFixture fixture) : IClassFixture<SqlServerApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;
    private static void SkipWithoutSqlServer() => Assert.SkipWhen(string.IsNullOrWhiteSpace(SqlServerApiFixture.ServerConnectionString), "POS_TEST_SQLSERVER is not set.");

    private Task<(HttpStatusCode Status, JsonElement Body)> LoginAsync(string userName, string password) => fixture.LoginAsync(userName, password);
    private HttpClient Client(string token) => fixture.Client(token);
    private Task<HttpClient> AdminAsync() => Task.FromResult(Client(fixture.AdminToken));
    private Task<(HttpClient Client, int UserId, string Password)> UserAsync(string userName, int branchId, params string[] permissions) => fixture.CreateUserAsync(userName, branchId, permissions);

    [Fact]
    public async Task Bootstrap_admin_holds_every_permission()
    {
        SkipWithoutSqlServer();
        var me = await (await AdminAsync()).GetFromJsonAsync<JsonElement>("/api/auth/me", Ct);
        Assert.False(me.GetProperty("mustChangePassword").GetBoolean());
        Assert.Equal(PermissionCodes.All.Order(), me.GetProperty("permissions").EnumerateArray().Select(p => p.GetString()!).Order());
    }

    [Fact]
    public async Task Logout_ends_the_session()
    {
        SkipWithoutSqlServer();
        var (client, _, _) = await UserAsync("logout-user", fixture.BranchA, PermissionCodes.SalesView);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/me", Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync("/api/auth/logout", null, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/sales", Ct)).StatusCode);
    }

    [Fact]
    public async Task Changing_a_password_needs_the_current_one()
    {
        SkipWithoutSqlServer();
        var (client, _, password) = await UserAsync("change-user", fixture.BranchA);
        var wrong = await client.PostAsJsonAsync("/api/auth/change-password", new { currentPassword = "nope", newPassword = "Another-Pass-1" }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, wrong.StatusCode);
        var missing = await client.PostAsJsonAsync("/api/auth/change-password", new { newPassword = "Another-Pass-1" }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync("change-user", password)).Status);
    }

    [Fact]
    public async Task Repeated_failures_lock_the_account_until_an_admin_resets_it()
    {
        SkipWithoutSqlServer();
        var (_, userId, password) = await UserAsync("lockout-user", fixture.BranchA);
        for (var attempt = 1; attempt < SqlServerApiFixture.MaxFailedLogins; attempt++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync("lockout-user", "wrong")).Status);
        // Locked: even the right password is refused, with the same answer as a wrong one.
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync("lockout-user", "wrong")).Status);
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync("lockout-user", password)).Status);

        var admin = await AdminAsync();
        var reset = await (await admin.PostAsync($"/api/users/{userId}/reset-password", null, Ct)).Content.ReadFromJsonAsync<JsonElement>(Ct);
        var temporary = reset.GetProperty("temporaryPassword").GetString()!;
        Assert.NotEqual("123456", temporary);
        var (status, body) = await LoginAsync("lockout-user", temporary);
        Assert.Equal(HttpStatusCode.OK, status);
        Assert.True(body.GetProperty("mustChangePassword").GetBoolean());
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync("lockout-user", password)).Status);
    }

    [Fact]
    public async Task New_users_get_a_one_time_password_instead_of_a_default()
    {
        SkipWithoutSqlServer();
        var admin = await AdminAsync();
        var created = await (await admin.PostAsJsonAsync("/api/users", new { userName = "no-default", branchId = fixture.BranchA }, Ct)).Content.ReadFromJsonAsync<JsonElement>(Ct);
        var temporary = created.GetProperty("temporaryPassword").GetString()!;
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync("no-default", "123456")).Status);
        var (status, body) = await LoginAsync("no-default", temporary);
        Assert.Equal(HttpStatusCode.OK, status);
        var gated = await Client(body.GetProperty("token").GetString()!).GetAsync("/api/items", Ct);
        Assert.Equal(HttpStatusCode.Forbidden, gated.StatusCode);
    }

    [Fact]
    public async Task Deactivating_a_user_ends_their_sessions()
    {
        SkipWithoutSqlServer();
        var (client, userId, _) = await UserAsync("deactivated-user", fixture.BranchA, PermissionCodes.SalesView);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/sales", Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await (await AdminAsync()).PostAsync($"/api/users/{userId}/deactivate", null, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/sales", Ct)).StatusCode);
    }

    [Fact]
    public async Task A_user_without_user_management_is_refused()
    {
        SkipWithoutSqlServer();
        var (client, _, _) = await UserAsync("plain-user", fixture.BranchA, PermissionCodes.SalesView);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/users", Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/branches", new { nameAr = "x", nameEn = "x" }, Ct)).StatusCode);
    }

    [Fact]
    public async Task Branch_users_only_see_their_own_branch()
    {
        SkipWithoutSqlServer();
        var (client, _, _) = await UserAsync("branch-a-user", fixture.BranchA, PermissionCodes.SalesView, PermissionCodes.PurchasesView, PermissionCodes.ReportsView);
        var sales = await client.GetFromJsonAsync<JsonElement[]>("/api/sales", Ct);
        Assert.Equal(["SL-A"], sales!.Select(s => s.GetProperty("saleNo").GetString()));
        var purchases = await client.GetFromJsonAsync<JsonElement[]>("/api/purchases", Ct);
        Assert.Equal(["PO-A"], purchases!.Select(p => p.GetProperty("invoiceNo").GetString()));
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/purchases/{await OtherBranchPurchaseIdAsync()}", Ct)).StatusCode);
        var report = await client.GetFromJsonAsync<JsonElement>("/api/reports/summary", Ct);
        Assert.Equal(10m, report.GetProperty("salesTotal").GetDecimal());
        Assert.Equal(100m, report.GetProperty("purchasesTotal").GetDecimal());

        var admin = await AdminAsync();
        var all = await admin.GetFromJsonAsync<JsonElement>("/api/reports/summary", Ct);
        Assert.Equal(30m, all.GetProperty("salesTotal").GetDecimal());
        var branchB = await admin.GetFromJsonAsync<JsonElement>($"/api/reports/summary?branchId={fixture.BranchB}", Ct);
        Assert.Equal(250m, branchB.GetProperty("purchasesTotal").GetDecimal());
    }

    [Fact]
    public async Task Treasuries_of_another_branch_cannot_be_used_or_seen()
    {
        SkipWithoutSqlServer();
        var (client, _, _) = await UserAsync("branch-b-cashier", fixture.BranchB, PermissionCodes.TreasuryManage, PermissionCodes.TreasuryView, PermissionCodes.JournalPost);
        var treasuries = await client.GetFromJsonAsync<JsonElement[]>("/api/treasuries", Ct);
        Assert.Equal([fixture.TreasuryB], treasuries!.Select(t => t.GetProperty("treasuryId").GetInt32()));
        var branches = await client.GetFromJsonAsync<JsonElement[]>("/api/branches", Ct);
        Assert.Equal([fixture.BranchB], branches!.Select(b => b.GetProperty("branchId").GetInt32()));

        var transfer = await client.PostAsJsonAsync("/api/treasury-transfers", new { sourceTreasuryId = fixture.TreasuryA, destinationTreasuryId = fixture.TreasuryB, sourceAmount = 1, destinationAmount = 1, exchangeRate = 1 }, Ct);
        Assert.Equal(HttpStatusCode.NotFound, transfer.StatusCode);
        Assert.NotNull(fixture.ExpenseAccount);
        var expense = await client.PostAsJsonAsync("/api/expenses", new { expenseAccountId = fixture.ExpenseAccount, treasuryId = fixture.TreasuryA, amount = 1 }, Ct);
        Assert.Equal(HttpStatusCode.NotFound, expense.StatusCode);
        var manual = await client.PostAsJsonAsync("/api/transactions", new { transactionType = "MANUAL", pattern = "TEST", currencyId = fixture.CurrencyId, exchangeRate = 1, lines = new object[]
        {
            new { accountId = $"TREASURY:{fixture.TreasuryA}", treasuryId = fixture.TreasuryA, debit = 0, credit = 1, foreignDebit = 0, foreignCredit = 1 },
            new { accountId = fixture.ExpenseAccount, debit = 1, credit = 0, foreignDebit = 1, foreignCredit = 0 },
        } }, Ct);
        Assert.Equal(HttpStatusCode.NotFound, manual.StatusCode);
        var editOther = await client.PostAsync($"/api/treasuries/{fixture.TreasuryA}/deactivate", null, Ct);
        Assert.Equal(HttpStatusCode.Forbidden, editOther.StatusCode);
    }

    [Fact]
    public async Task Manual_journal_entries_are_always_typed_manual()
    {
        SkipWithoutSqlServer();
        Assert.NotNull(fixture.ExpenseAccount);
        var (client, _, _) = await UserAsync("journal-user", fixture.BranchA, PermissionCodes.TreasuryView, PermissionCodes.JournalPost);
        var posted = await client.PostAsJsonAsync("/api/transactions", new { transactionType = "RECEIPT", pattern = "TEST", refNo = "JOURNAL-TYPE-TEST", currencyId = fixture.CurrencyId, exchangeRate = 1, lines = new object[]
        {
            new { accountId = $"TREASURY:{fixture.TreasuryA}", treasuryId = fixture.TreasuryA, debit = 0, credit = 1, foreignDebit = 0, foreignCredit = 1 },
            new { accountId = fixture.ExpenseAccount, debit = 1, credit = 0, foreignDebit = 1, foreignCredit = 0 },
        } }, Ct);
        Assert.Equal(HttpStatusCode.Created, posted.StatusCode);
        Assert.Equal(2, await fixture.Database.CountAsync("SELECT COUNT(*) FROM dbo.Transactions WHERE RefNo=N'JOURNAL-TYPE-TEST' AND TransactionType=N'MANUAL'", Ct));
    }

    [Fact]
    public async Task The_last_user_manager_cannot_be_removed()
    {
        SkipWithoutSqlServer();
        var admin = await AdminAsync();
        var me = await admin.GetFromJsonAsync<JsonElement>("/api/auth/me", Ct);
        var adminId = me.GetProperty("userId").GetInt32();
        var roles = await admin.GetFromJsonAsync<JsonElement[]>("/api/roles", Ct);
        var adminRole = roles!.Single(r => r.GetProperty("name").GetString() == AdminBootstrap.RoleName).GetProperty("roleId").GetInt32();

        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsync($"/api/users/{adminId}/deactivate", null, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsync($"/api/roles/{adminRole}/deactivate", null, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PutAsJsonAsync($"/api/roles/{adminRole}", new { name = AdminBootstrap.RoleName, isActive = true, permissionIds = Array.Empty<int>() }, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PutAsJsonAsync($"/api/users/{adminId}", new { userName = "admin", branchId = fixture.BranchA, roleIds = Array.Empty<int>() }, Ct)).StatusCode);

        // Nothing was changed: the admin still manages users and the role keeps every permission.
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/users", Ct)).StatusCode);
        var after = await admin.GetFromJsonAsync<JsonElement>("/api/auth/me", Ct);
        Assert.Equal(PermissionCodes.All.Order(), after.GetProperty("permissions").EnumerateArray().Select(p => p.GetString()!).Order());
    }

    private async Task<long> OtherBranchPurchaseIdAsync()
    {
        var all = await (await AdminAsync()).GetFromJsonAsync<JsonElement[]>("/api/purchases", Ct);
        return all!.Single(p => p.GetProperty("invoiceNo").GetString() == "PO-B").GetProperty("purchaseId").GetInt64();
    }
}
