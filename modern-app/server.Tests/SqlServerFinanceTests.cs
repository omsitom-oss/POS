using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ElitePos.LocalService.Security;

namespace ElitePos.LocalService.Tests;

// A money document and its journal commit together or not at all, against the real SQL Server schema.
[Collection(SqlServerCollection.Name)]
public sealed class SqlServerFinanceTests(SqlServerApiFixture fixture) : IClassFixture<SqlServerApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;
    private static void SkipWithoutSqlServer() => Assert.SkipWhen(string.IsNullOrWhiteSpace(SqlServerApiFixture.ServerConnectionString), "POS_TEST_SQLSERVER is not set.");
    private HttpClient Admin => fixture.Client(fixture.AdminToken);

    [Fact]
    public async Task A_purchase_whose_journal_is_refused_leaves_no_invoice_or_stock_behind()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var item = await NewItemAsync("FN-INACTIVE");
        await fixture.Database.ExecuteAsync("""
            IF NOT EXISTS (SELECT 1 FROM dbo.Partners WHERE PartnerCode=N'P-OFF')
                INSERT dbo.Partners(PartnerCode,PartnerName,Status,PartnerTypeSettingId) SELECT N'P-OFF',N'Inactive supplier',N'INACTIVE',PartnerTypeSettingId FROM dbo.Partners WHERE PartnerCode=N'P-SEC';
            """, "inactive supplier", Ct);
        var supplier = await fixture.Database.CountAsync("SELECT PartnerId FROM dbo.Partners WHERE PartnerCode=N'P-OFF'", Ct);

        var response = await Admin.PostAsJsonAsync("/api/purchases", new { supplierPartnerId = supplier, currencyId = refs.Currency, status = "POSTED", lines = new[] { new { itemId = item, quantity = 5m, unitPrice = 4m } } }, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("inactive partner", await response.Content.ReadAsStringAsync(Ct));
        Assert.Equal(0, await fixture.Database.CountAsync($"SELECT COUNT(*) FROM dbo.Purchases WHERE SupplierPartnerId={supplier}", Ct));
        Assert.Equal(0, await StockAsync(item));
    }

    [Fact]
    public async Task A_sale_whose_journal_is_refused_leaves_no_invoice_or_stock_movement_behind()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var item = await NewItemAsync("FN-SALE");
        await BuyAsync(refs, item, 5m, 4m);
        var sales = await fixture.Database.CountAsync("SELECT COUNT(*) FROM dbo.Sales", Ct);
        // The sale itself accepts an inactive primary currency; the journal does not.
        await fixture.Database.ExecuteAsync($"UPDATE dbo.Currencies SET IsActive=0 WHERE CurrencyId={refs.Currency}", "deactivate", Ct);
        try
        {
            var response = await Admin.PostAsJsonAsync("/api/sales", new { treasuryId = refs.Treasury, currencyId = refs.Currency, discount = 0m, lines = new[] { new { itemId = item, quantity = 2m, unitPrice = 10m } } }, Ct);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }
        finally
        {
            await fixture.Database.ExecuteAsync($"UPDATE dbo.Currencies SET IsActive=1 WHERE CurrencyId={refs.Currency}", "reactivate", Ct);
        }
        Assert.Equal(sales, await fixture.Database.CountAsync("SELECT COUNT(*) FROM dbo.Sales", Ct));
        Assert.Equal(5, await StockAsync(item));
    }

    [Fact]
    public async Task A_disposal_approved_twice_at_once_moves_stock_and_posts_its_journal_once()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var item = await NewItemAsync("FN-DISPOSE");
        var purchase = await BuyAsync(refs, item, 10m, 3m);
        var line = await fixture.Database.ScalarAsync<long>($"SELECT PurchaseLineId FROM dbo.PurchaseLines WHERE PurchaseId={purchase}", Ct);
        var created = await Admin.PostAsJsonAsync("/api/inventory/disposals", new { itemId = item, purchaseLineId = line, quantity = 2m, reason = "Expired", branchId = fixture.BranchA }, Ct);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var request = (await created.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("requestId").GetInt64();

        var approvals = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => Admin.PostAsync($"/api/inventory/requests/{request}/approve", null, Ct)));

        Assert.Equal([HttpStatusCode.OK, HttpStatusCode.BadRequest], approvals.Select(a => a.StatusCode).Order());
        Assert.Equal(8, await StockAsync(item));
        Assert.Equal(6m, await fixture.Database.ScalarAsync<decimal>($"SELECT SUM(Debit) FROM dbo.Transactions WHERE RefNo=N'DISPOSAL:{request}'", Ct));
        Assert.Equal(refs.Currency, await fixture.Database.CountAsync($"SELECT MAX(CurrencyId) FROM dbo.Transactions WHERE RefNo=N'DISPOSAL:{request}'", Ct));
    }

    [Fact]
    public async Task A_disposal_without_approval_is_approved_with_its_stock_and_journal_in_one_step()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var item = await NewItemAsync("FN-DIRECT");
        var purchase = await BuyAsync(refs, item, 10m, 3m);
        var line = await fixture.Database.ScalarAsync<long>($"SELECT PurchaseLineId FROM dbo.PurchaseLines WHERE PurchaseId={purchase}", Ct);
        await fixture.Database.ExecuteAsync("MERGE dbo.ApprovalSettings t USING (SELECT N'INVENTORY_DISPOSAL' RequestType) s ON t.RequestType=s.RequestType WHEN MATCHED THEN UPDATE SET RequiresApproval=0 WHEN NOT MATCHED THEN INSERT(RequestType,RequiresApproval) VALUES(s.RequestType,0);", "no approval", Ct);
        try
        {
            var created = await Admin.PostAsJsonAsync("/api/inventory/disposals", new { itemId = item, purchaseLineId = line, quantity = 1m, reason = "Broken", branchId = fixture.BranchA }, Ct);
            Assert.Equal(HttpStatusCode.Created, created.StatusCode);
            var body = await created.Content.ReadFromJsonAsync<JsonElement>(Ct);
            Assert.Equal("APPROVED", body.GetProperty("status").GetString());
            var request = body.GetProperty("requestId").GetInt64();
            Assert.Equal("APPROVED", await fixture.Database.ScalarAsync<string>($"SELECT Status FROM dbo.InventoryRequests WHERE RequestId={request}", Ct));
            Assert.Equal(9, await StockAsync(item));
            Assert.Equal(3m, await fixture.Database.ScalarAsync<decimal>($"SELECT SUM(Credit) FROM dbo.Transactions WHERE RefNo=N'DISPOSAL:{request}'", Ct));
        }
        finally
        {
            await fixture.Database.ExecuteAsync("UPDATE dbo.ApprovalSettings SET RequiresApproval=1 WHERE RequestType=N'INVENTORY_DISPOSAL'", "approval back on", Ct);
        }
    }

    [Fact]
    public async Task A_treasury_with_transactions_keeps_its_currency()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var item = await NewItemAsync("FN-TILL");
        await BuyAsync(refs, item, 5m, 4m);
        var sale = await Admin.PostAsJsonAsync("/api/sales", new { treasuryId = refs.Treasury, currencyId = refs.Currency, discount = 0m, lines = new[] { new { itemId = item, quantity = 1m, unitPrice = 10m } } }, Ct);
        Assert.Equal(HttpStatusCode.Created, sale.StatusCode);
        var other = await fixture.Database.CountAsync("SELECT CurrencyId FROM dbo.Currencies WHERE CurrencyCode=N'TST'", Ct);

        var moved = await Admin.PutAsJsonAsync($"/api/treasuries/{refs.Treasury}", new { nameAr = "خزنة المالية", nameEn = "Finance till", treasureType = "CASH", currencyId = other, isActive = true }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, moved.StatusCode);
        Assert.Equal(refs.Currency, await fixture.Database.CountAsync($"SELECT CurrencyId FROM dbo.Treasuries WHERE TreasuryId={refs.Treasury}", Ct));

        var renamed = await Admin.PutAsJsonAsync($"/api/treasuries/{refs.Treasury}", new { nameAr = "خزنة المالية", nameEn = "Finance till", treasureType = "CASH", currencyId = refs.Currency, isActive = true }, Ct);
        Assert.Equal(HttpStatusCode.OK, renamed.StatusCode);
    }

    [Fact]
    public async Task A_receipt_posts_to_the_partner_and_treasury_whatever_account_codes_the_client_sends()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var response = await Admin.PostAsJsonAsync("/api/receipts", new { type = "RECEIPT", partnerId = refs.Supplier, treasuryId = refs.Treasury, amount = 25m, exchangeRate = 1m, partnerAccountId = "4100", treasuryAccountId = "1300" }, Ct);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var receiptNo = (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("receiptNo").GetString();
        var accounts = await fixture.Database.ScalarAsync<string>($"SELECT STRING_AGG(AccountId, N',') WITHIN GROUP (ORDER BY AccountId) FROM dbo.Transactions WHERE RefNo=N'{receiptNo}'", Ct);
        Assert.Equal($"PARTNER:{refs.Supplier},TREASURY:{refs.Treasury}", accounts);
    }

    [Fact]
    public async Task A_cashier_sells_at_list_price_and_within_the_role_discount_limit()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var item = await NewItemAsync("FN-PRICE");
        await BuyAsync(refs, item, 20m, 4m);
        var (cashier, _, _) = await fixture.CreateUserAsync("fn-cashier", fixture.BranchA, PermissionCodes.SalesCreate);
        Task<HttpResponseMessage> Sell(HttpClient client, decimal price, decimal discount) =>
            client.PostAsJsonAsync("/api/sales", new { treasuryId = refs.Treasury, currencyId = refs.Currency, discount, lines = new[] { new { itemId = item, quantity = 1m, unitPrice = price } } }, Ct);

        Assert.Equal(HttpStatusCode.Forbidden, (await Sell(cashier, 8m, 0m)).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await Sell(cashier, 10m, 0m)).StatusCode);
        var noDiscount = await Sell(cashier, 10m, 1m);
        Assert.Equal(HttpStatusCode.Forbidden, noDiscount.StatusCode);
        Assert.Contains("not allowed to give a discount", await noDiscount.Content.ReadAsStringAsync(Ct));

        // Allow 10% on the cashier's role through the roles screen's API.
        var role = (await Admin.GetFromJsonAsync<JsonElement[]>("/api/roles", Ct))!.Single(r => r.GetProperty("name").GetString() == "role-fn-cashier");
        Assert.Equal(0m, role.GetProperty("maxDiscountPercent").GetDecimal());
        var permissionIds = role.GetProperty("permissions").EnumerateArray().Select(p => p.GetProperty("permissionId").GetInt32()).ToArray();
        var saved = await Admin.PutAsJsonAsync($"/api/roles/{role.GetProperty("roleId").GetInt32()}", new { name = "role-fn-cashier", isActive = true, permissionIds, maxDiscountPercent = 10m }, Ct);
        Assert.Equal(10m, (await saved.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("maxDiscountPercent").GetDecimal());

        Assert.Equal(HttpStatusCode.Created, (await Sell(cashier, 10m, 1m)).StatusCode);
        var tooMuch = await Sell(cashier, 10m, 1.5m);
        Assert.Equal(HttpStatusCode.Forbidden, tooMuch.StatusCode);
        Assert.Contains("limit of 10%", await tooMuch.Content.ReadAsStringAsync(Ct));

        var (supervisor, _, _) = await fixture.CreateUserAsync("fn-supervisor", fixture.BranchA, PermissionCodes.SalesCreate, PermissionCodes.SalesPriceOverride);
        Assert.Equal(HttpStatusCode.Created, (await Sell(supervisor, 8m, 0m)).StatusCode);
        Assert.Equal(17, await StockAsync(item));
    }

    [Fact]
    public async Task A_till_cannot_pay_out_more_than_it_holds()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        await fixture.Database.ExecuteAsync($"""
            IF NOT EXISTS (SELECT 1 FROM dbo.Treasuries WHERE TreasuryCode=N'T-EMPTY')
                INSERT dbo.Treasuries(TreasuryCode,NameAr,NameEn,CurrencyId,BranchId) VALUES(N'T-EMPTY',N'خزنة فارغة',N'Empty till',{refs.Currency},{fixture.BranchA});
            """, "empty till", Ct);
        var till = await fixture.Database.CountAsync("SELECT TreasuryId FROM dbo.Treasuries WHERE TreasuryCode=N'T-EMPTY'", Ct);
        Task<HttpResponseMessage> Receipt(string type, decimal amount) =>
            Admin.PostAsJsonAsync("/api/receipts", new { type, partnerId = refs.Supplier, treasuryId = till, amount, exchangeRate = 1m, branchId = fixture.BranchA }, Ct);

        var overdraw = await Receipt("PAYMENT", 5m);
        Assert.Equal(HttpStatusCode.BadRequest, overdraw.StatusCode);
        Assert.Contains("Empty till has only 0 P", await overdraw.Content.ReadAsStringAsync(Ct));

        Assert.Equal(HttpStatusCode.Created, (await Receipt("RECEIPT", 30m)).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await Receipt("PAYMENT", 30m)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Receipt("PAYMENT", 0.01m)).StatusCode);
        Assert.Equal(0m, await fixture.Database.ScalarAsync<decimal>($"SELECT SUM(ForeignDebit-ForeignCredit) FROM dbo.Transactions WHERE TreasuryId={till}", Ct));
    }

    [Fact]
    public async Task Journal_debits_and_credits_are_kept_in_the_primary_currency()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        await fixture.Database.ExecuteAsync($"""
            IF NOT EXISTS (SELECT 1 FROM dbo.Currencies WHERE CurrencyCode=N'USX')
                INSERT dbo.Currencies(CurrencyCode,CurrencyNameEn,CurrencyNameAr,Symbol,IsPrimary) VALUES(N'USX',N'Dollar',N'دولار',N'$',0);
            DECLARE @usd int = (SELECT CurrencyId FROM dbo.Currencies WHERE CurrencyCode=N'USX');
            INSERT dbo.CurrencyRateHistory(CurrencyId,BaseCurrencyId,Rate) VALUES(@usd,{refs.Currency},50);
            IF NOT EXISTS (SELECT 1 FROM dbo.Treasuries WHERE TreasuryCode=N'T-USD')
                INSERT dbo.Treasuries(TreasuryCode,NameAr,NameEn,CurrencyId,BranchId) VALUES(N'T-USD',N'خزنة دولار',N'Dollar till',@usd,{fixture.BranchA});
            """, "dollar seed", Ct);
        var usd = await fixture.Database.CountAsync("SELECT CurrencyId FROM dbo.Currencies WHERE CurrencyCode=N'USX'", Ct);
        var till = await fixture.Database.CountAsync("SELECT TreasuryId FROM dbo.Treasuries WHERE TreasuryCode=N'T-USD'", Ct);

        // A dollar receipt: the till and the supplier keep dollars, the journal's base columns hold primary currency at the stored rate.
        var receipt = await Admin.PostAsJsonAsync("/api/receipts", new { type = "RECEIPT", partnerId = refs.Supplier, treasuryId = till, amount = 10m, exchangeRate = 1m, branchId = fixture.BranchA }, Ct);
        Assert.Equal(HttpStatusCode.Created, receipt.StatusCode);
        var receiptNo = (await receipt.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("receiptNo").GetString();
        Assert.Equal(500m, await fixture.Database.ScalarAsync<decimal>($"SELECT Debit FROM dbo.Transactions WHERE RefNo=N'{receiptNo}' AND TreasuryId={till}", Ct));
        Assert.Equal(10m, await fixture.Database.ScalarAsync<decimal>($"SELECT ForeignDebit FROM dbo.Transactions WHERE RefNo=N'{receiptNo}' AND TreasuryId={till}", Ct));
        var listed = (await Admin.GetFromJsonAsync<JsonElement[]>("/api/receipts", Ct))!.Single(row => row.GetProperty("receiptNo").GetString() == receiptNo);
        Assert.Equal(10m, listed.GetProperty("amount").GetDecimal());

        // A dollar purchase uses its own invoice rate, not the stored one.
        var item = await NewItemAsync("FN-USD");
        var purchase = await Admin.PostAsJsonAsync("/api/purchases", new { supplierPartnerId = refs.Supplier, currencyId = usd, exchangeRateToBase = 48m, status = "POSTED", lines = new[] { new { itemId = item, quantity = 2m, unitPrice = 3m } } }, Ct);
        Assert.Equal(HttpStatusCode.Created, purchase.StatusCode);
        var invoice = (await purchase.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("invoiceNo").GetString();
        Assert.Equal(288m, await fixture.Database.ScalarAsync<decimal>($"SELECT Debit FROM dbo.Transactions WHERE RefNo=N'{invoice}' AND AccountId=N'1300'", Ct));
        Assert.Equal(6m, await fixture.Database.ScalarAsync<decimal>($"SELECT ForeignCredit FROM dbo.Transactions WHERE RefNo=N'{invoice}' AND AccountId=N'2100'", Ct));

        // Without a stored rate a foreign-currency payment is refused instead of being booked at 1:1.
        await fixture.Database.ExecuteAsync($"DELETE FROM dbo.CurrencyRateHistory WHERE CurrencyId={usd}", "drop rate", Ct);
        var noRate = await Admin.PostAsJsonAsync("/api/receipts", new { type = "RECEIPT", partnerId = refs.Supplier, treasuryId = till, amount = 1m, exchangeRate = 1m, branchId = fixture.BranchA }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, noRate.StatusCode);
        Assert.Contains("Set an exchange rate from USX", await noRate.Content.ReadAsStringAsync(Ct));
    }

    private sealed record Refs(int Currency, int Treasury, int Supplier);

    private async Task<Refs> SeedAsync()
    {
        await fixture.Database.ExecuteAsync($"""
            IF NOT EXISTS (SELECT 1 FROM dbo.Currencies WHERE CurrencyCode=N'PRI')
                INSERT dbo.Currencies(CurrencyCode,CurrencyNameEn,CurrencyNameAr,Symbol,IsPrimary) VALUES(N'PRI',N'Primary',N'أساسية',N'P',1);
            DECLARE @currency int = (SELECT CurrencyId FROM dbo.Currencies WHERE CurrencyCode=N'PRI');
            IF NOT EXISTS (SELECT 1 FROM dbo.Treasuries WHERE TreasuryCode=N'T-FIN')
                INSERT dbo.Treasuries(TreasuryCode,NameAr,NameEn,CurrencyId,BranchId) VALUES(N'T-FIN',N'خزنة المالية',N'Finance till',@currency,{fixture.BranchA});
            IF NOT EXISTS (SELECT 1 FROM dbo.Settings WHERE Code=N'U-FIN')
                INSERT dbo.Settings(SettingTypeId,ParentSettingId,Code,ValueAr,ValueEn,SortOrder,IsActive) SELECT SettingTypeId,NULL,N'U-FIN',N'حبة',N'Piece',99,1 FROM dbo.SettingTypes WHERE Code=N'UNIT';
            """, "finance seed", Ct);
        return new(
            await fixture.Database.CountAsync("SELECT CurrencyId FROM dbo.Currencies WHERE CurrencyCode=N'PRI'", Ct),
            await fixture.Database.CountAsync("SELECT TreasuryId FROM dbo.Treasuries WHERE TreasuryCode=N'T-FIN'", Ct),
            await fixture.Database.CountAsync("SELECT PartnerId FROM dbo.Partners WHERE PartnerCode=N'P-SEC'", Ct));
    }

    private async Task<long> NewItemAsync(string code)
    {
        var unit = await fixture.Database.CountAsync("SELECT SettingId FROM dbo.Settings WHERE Code=N'U-FIN'", Ct);
        await fixture.Database.ExecuteAsync($"INSERT dbo.Items(ItemCode,NameAr,NameEn,SellPrice) VALUES(N'{code}',N'{code}',N'{code}',10); INSERT dbo.ItemUnits(ItemId,UnitSettingId,ConversionToBase,IsBase) VALUES(SCOPE_IDENTITY(),{unit},1,1);", "item", Ct);
        return await fixture.Database.ScalarAsync<long>($"SELECT ItemId FROM dbo.Items WHERE ItemCode=N'{code}'", Ct);
    }

    private async Task<long> BuyAsync(Refs refs, long item, decimal quantity, decimal price)
    {
        var response = await Admin.PostAsJsonAsync("/api/purchases", new { supplierPartnerId = refs.Supplier, currencyId = refs.Currency, status = "POSTED", discount = 0m, lines = new[] { new { itemId = item, quantity, unitPrice = price } } }, Ct);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("purchaseId").GetInt64();
    }

    private Task<int> StockAsync(long item) => fixture.Database.CountAsync($"SELECT COALESCE(SUM(Quantity),0) FROM dbo.StockMovements WHERE ItemId={item} AND BranchId={fixture.BranchA} AND PostingStatus=N'POSTED'", Ct);
}
