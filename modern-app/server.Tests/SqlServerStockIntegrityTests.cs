using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace ElitePos.LocalService.Tests;

// Stock and journals stay consistent when a document fails half way, when stock was sold from a batch, when the same
// request is approved twice, and when a branch passes 99,999 documents.
[Collection(SqlServerCollection.Name)]
public sealed class SqlServerStockIntegrityTests(SqlServerApiFixture fixture) : IClassFixture<SqlServerApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;
    private static void SkipWithoutSqlServer() => Assert.SkipWhen(string.IsNullOrWhiteSpace(SqlServerApiFixture.ServerConnectionString), "POS_TEST_SQLSERVER is not set.");
    private HttpClient Admin => fixture.Client(fixture.AdminToken);

    [Fact]
    public async Task A_purchase_whose_journal_is_refused_leaves_no_invoice_and_no_stock()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var x = await NewItemAsync("SI-INACTIVE");
        await fixture.Database.ExecuteAsync("""
            IF NOT EXISTS (SELECT 1 FROM dbo.Partners WHERE PartnerCode=N'P-OFF')
                INSERT dbo.Partners(PartnerCode,PartnerName,PartnerTypeSettingId,Status) SELECT N'P-OFF',N'Inactive supplier',PartnerTypeSettingId,N'INACTIVE' FROM dbo.Partners WHERE PartnerCode=N'P-SEC';
            """, "inactive supplier", Ct);
        var inactive = await fixture.Database.CountAsync("SELECT PartnerId FROM dbo.Partners WHERE PartnerCode=N'P-OFF'", Ct);
        var purchasesBefore = await fixture.Database.CountAsync("SELECT COUNT(*) FROM dbo.Purchases", Ct);

        var response = await Admin.PostAsJsonAsync("/api/purchases", new { supplierPartnerId = inactive, currencyId = refs.Currency, status = "POSTED", lines = new[] { new { itemId = x, quantity = 5m, unitPrice = 4m } } }, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("inactive partner", await response.Content.ReadAsStringAsync(Ct));
        Assert.Equal(purchasesBefore, await fixture.Database.CountAsync("SELECT COUNT(*) FROM dbo.Purchases", Ct));
        Assert.Equal(0, await StockAsync(x));
    }

    [Fact]
    public async Task A_sale_and_its_journal_are_saved_together()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var x = await NewItemAsync("SI-SALE");
        await BuyAsync(refs, x, 3);
        var sale = await SellAsync(refs, x, 2, 7m);
        Assert.Equal(14m, await fixture.Database.ScalarAsync<decimal>($"SELECT Credit FROM dbo.Transactions WHERE RefNo=N'{sale}' AND AccountId=N'4100'", Ct));
        Assert.Equal(1, await StockAsync(x));
    }

    [Fact]
    public async Task A_disposal_cannot_take_out_stock_that_was_already_sold()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var x = await NewItemAsync("SI-SOLD");
        var purchase = await BuyAsync(refs, x, 5);
        var line = await LineOfAsync(purchase);
        await SellAsync(refs, x, 4, 8m);

        // The sale took 4 out of this batch, so only 1 is left in it.
        var tooMany = await Admin.PostAsJsonAsync("/api/inventory/disposals", new { itemId = x, purchaseLineId = line, quantity = 2m, reason = "Expired" }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, tooMany.StatusCode);
        Assert.Contains("available batch quantity", await tooMany.Content.ReadAsStringAsync(Ct));

        var pending = await Admin.PostAsJsonAsync("/api/inventory/disposals", new { itemId = x, purchaseLineId = line, quantity = 1m, reason = "Expired" }, Ct);
        Assert.Equal(HttpStatusCode.Created, pending.StatusCode);
        var requestId = (await pending.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("requestId").GetInt64();

        // The last one is sold while the disposal waits, so approving it would make stock negative.
        await SellAsync(refs, x, 1, 8m);
        var approve = await Admin.PostAsync($"/api/inventory/requests/{requestId}/approve", null, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, approve.StatusCode);
        Assert.Equal(0, await StockAsync(x));
    }

    [Fact]
    public async Task Approving_a_disposal_twice_takes_the_stock_out_once()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var x = await NewItemAsync("SI-TWICE");
        var purchase = await BuyAsync(refs, x, 5);
        var line = await LineOfAsync(purchase);
        var created = await Admin.PostAsJsonAsync("/api/inventory/disposals", new { itemId = x, purchaseLineId = line, quantity = 2m, reason = "Broken" }, Ct);
        var requestId = (await created.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("requestId").GetInt64();

        var approvals = await Task.WhenAll(Enumerable.Range(0, 3).Select(_ => Admin.PostAsync($"/api/inventory/requests/{requestId}/approve", null, Ct)));

        Assert.Single(approvals, response => response.StatusCode == HttpStatusCode.OK);
        Assert.Equal(3, await StockAsync(x));
        Assert.Equal(1, await fixture.Database.CountAsync($"SELECT COUNT(DISTINCT MoveNo) FROM dbo.Transactions WHERE RefNo=N'DISPOSAL:{requestId}'", Ct));
        Assert.Equal(8m, await fixture.Database.ScalarAsync<decimal>($"SELECT Debit FROM dbo.Transactions WHERE RefNo=N'DISPOSAL:{requestId}' AND AccountId=N'5100'", Ct));
    }

    [Fact]
    public async Task Invoice_numbers_keep_counting_past_99999()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var x = await NewItemAsync("SI-SEQ");
        await BuyAsync(refs, x, 5);
        await fixture.Database.ExecuteAsync($"INSERT dbo.Sales(BranchId,SaleNo,SaleDate,TreasuryId,CurrencyId,Status,Total) VALUES({fixture.BranchA},N'SL-{fixture.BranchA}-99999',CAST(SYSUTCDATETIME() AS date),{refs.Treasury},{refs.Currency},N'POSTED',0)", "sale 99999", Ct);

        Assert.Equal($"SL-{fixture.BranchA}-100000", await SellAsync(refs, x, 1, 8m));
        Assert.Equal($"SL-{fixture.BranchA}-100001", await SellAsync(refs, x, 1, 8m));
    }

    private sealed record Refs(int Currency, int Treasury, int Supplier);

    private async Task<Refs> SeedAsync()
    {
        await fixture.Database.ExecuteAsync($"""
            IF NOT EXISTS (SELECT 1 FROM dbo.Currencies WHERE CurrencyCode=N'PRI')
                INSERT dbo.Currencies(CurrencyCode,CurrencyNameEn,CurrencyNameAr,Symbol,IsPrimary) VALUES(N'PRI',N'Primary',N'أساسية',N'P',1);
            DECLARE @currency int = (SELECT CurrencyId FROM dbo.Currencies WHERE CurrencyCode=N'PRI');
            IF NOT EXISTS (SELECT 1 FROM dbo.Treasuries WHERE TreasuryCode=N'T-STK')
                INSERT dbo.Treasuries(TreasuryCode,NameAr,NameEn,CurrencyId,BranchId) VALUES(N'T-STK',N'خزنة المخزون',N'Stock till',@currency,{fixture.BranchA});
            IF NOT EXISTS (SELECT 1 FROM dbo.Settings WHERE Code=N'U-STK')
                INSERT dbo.Settings(SettingTypeId,ParentSettingId,Code,ValueAr,ValueEn,SortOrder,IsActive) SELECT SettingTypeId,NULL,N'U-STK',N'حبة',N'Piece',99,1 FROM dbo.SettingTypes WHERE Code=N'UNIT';
            """, "stock seed", Ct);
        return new(
            await fixture.Database.CountAsync("SELECT CurrencyId FROM dbo.Currencies WHERE CurrencyCode=N'PRI'", Ct),
            await fixture.Database.CountAsync("SELECT TreasuryId FROM dbo.Treasuries WHERE TreasuryCode=N'T-STK'", Ct),
            await fixture.Database.CountAsync("SELECT PartnerId FROM dbo.Partners WHERE PartnerCode=N'P-SEC'", Ct));
    }

    private async Task<long> NewItemAsync(string code)
    {
        var unit = await fixture.Database.CountAsync("SELECT SettingId FROM dbo.Settings WHERE Code=N'U-STK'", Ct);
        await fixture.Database.ExecuteAsync($"INSERT dbo.Items(ItemCode,NameAr,NameEn,SellPrice) VALUES(N'{code}',N'{code}',N'{code}',10); INSERT dbo.ItemUnits(ItemId,UnitSettingId,ConversionToBase,IsBase) VALUES(SCOPE_IDENTITY(),{unit},1,1);", "item", Ct);
        return await fixture.Database.ScalarAsync<long>($"SELECT ItemId FROM dbo.Items WHERE ItemCode=N'{code}'", Ct);
    }

    private async Task<long> BuyAsync(Refs refs, long item, decimal quantity)
    {
        var response = await Admin.PostAsJsonAsync("/api/purchases", new { supplierPartnerId = refs.Supplier, currencyId = refs.Currency, status = "POSTED", lines = new[] { new { itemId = item, quantity, unitPrice = 4m } } }, Ct);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("purchaseId").GetInt64();
    }

    private Task<long> LineOfAsync(long purchase) => fixture.Database.ScalarAsync<long>($"SELECT PurchaseLineId FROM dbo.PurchaseLines WHERE PurchaseId={purchase}", Ct);

    private async Task<string> SellAsync(Refs refs, long item, decimal quantity, decimal price)
    {
        var response = await Admin.PostAsJsonAsync("/api/sales", new { treasuryId = refs.Treasury, currencyId = refs.Currency, lines = new[] { new { itemId = item, quantity, unitPrice = price } } }, Ct);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("saleNo").GetString()!;
    }

    private Task<int> StockAsync(long item) => fixture.Database.CountAsync($"SELECT COALESCE(SUM(Quantity),0) FROM dbo.StockMovements WHERE ItemId={item} AND BranchId={fixture.BranchA} AND PostingStatus=N'POSTED'", Ct);
}
