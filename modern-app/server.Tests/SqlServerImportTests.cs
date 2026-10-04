using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace ElitePos.LocalService.Tests;

// Import shipments: saved as a draft, costed in the main currency, then received with their landed cost.
[Collection(SqlServerCollection.Name)]
public sealed class SqlServerImportTests(SqlServerApiFixture fixture) : IClassFixture<SqlServerApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;
    private static void SkipWithoutSqlServer() => Assert.SkipWhen(string.IsNullOrWhiteSpace(SqlServerApiFixture.ServerConnectionString), "POS_TEST_SQLSERVER is not set.");
    private HttpClient Admin => fixture.Client(fixture.AdminToken);

    [Fact]
    public async Task An_import_cannot_be_saved_straight_as_posted()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var item = await NewItemAsync("IM-POSTED");

        var response = await Admin.PostAsJsonAsync("/api/purchases", Import(refs, refs.Foreign, 50m, item, "POSTED"), Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, await fixture.Database.CountAsync($"SELECT COUNT(*) FROM dbo.PurchaseLines WHERE ItemId={item}", Ct));
        Assert.Equal(0, await StockAsync(item));
    }

    [Fact]
    public async Task An_import_with_an_invoice_discount_is_refused()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var item = await NewItemAsync("IM-DISC");

        var response = await Admin.PostAsJsonAsync("/api/purchases", Import(refs, refs.Foreign, 50m, item, "DRAFT", discount: 5m), Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, await fixture.Database.CountAsync($"SELECT COUNT(*) FROM dbo.PurchaseLines WHERE ItemId={item}", Ct));
    }

    [Fact]
    public async Task An_import_in_the_main_currency_is_always_at_rate_one()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var item = await NewItemAsync("IM-MAIN");

        var id = await SaveDraftAsync(Import(refs, refs.Primary, 3m, item, "DRAFT"));

        Assert.Equal(1m, await fixture.Database.ScalarAsync<decimal>($"SELECT ExchangeRateToBase FROM dbo.Purchases WHERE PurchaseId={id}", Ct));
        // 10 x 2 at rate 1, not 60 at the rate the screen sent.
        Assert.Equal(20m, await fixture.Database.ScalarAsync<decimal>($"SELECT SUM(t.Debit) FROM dbo.Transactions t JOIN dbo.Purchases p ON t.RefNo=p.InvoiceNo WHERE p.PurchaseId={id}", Ct));
    }

    [Fact]
    public async Task A_received_import_puts_stock_at_its_landed_cost_with_its_expiry_and_batch()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var item = await NewItemAsync("IM-LANDED");
        var id = await SaveDraftAsync(Import(refs, refs.Foreign, 50m, item, "DRAFT"));

        var zero = await Admin.PostAsJsonAsync($"/api/purchases/{id}/costs", new { costType = "FREIGHT", amount = 0m, currencyId = refs.Foreign, exchangeRateToBase = 50m }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, zero.StatusCode);
        // A customs bill in the main currency is taken at rate 1 even when the screen sends another rate.
        var customs = await Admin.PostAsJsonAsync($"/api/purchases/{id}/costs", new { costType = "CUSTOMS", amount = 200m, currencyId = refs.Primary, exchangeRateToBase = 7m }, Ct);
        Assert.Equal(HttpStatusCode.Created, customs.StatusCode);
        Assert.Equal(200m, (await customs.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("baseAmount").GetDecimal());

        var received = await Admin.PostAsync($"/api/purchases/{id}/confirm", null, Ct);

        Assert.Equal(HttpStatusCode.OK, received.StatusCode);
        Assert.Equal(10, await StockAsync(item));
        // Goods 10 x 2 x 50 = 1000, plus 200 customs, over 10 units.
        Assert.Equal(120m, await fixture.Database.ScalarAsync<decimal>($"SELECT UnitCost FROM dbo.StockMovements WHERE PurchaseId={id}", Ct));
        Assert.Equal("LOT-7", await fixture.Database.ScalarAsync<string>($"SELECT BatchNo FROM dbo.PurchaseLines WHERE PurchaseId={id}", Ct));
        Assert.Equal(new DateTime(2028, 5, 31), await fixture.Database.ScalarAsync<DateTime>($"SELECT ExpiryDate FROM dbo.PurchaseLines WHERE PurchaseId={id}", Ct));
        Assert.Equal(1200m, await fixture.Database.ScalarAsync<decimal>($"SELECT SUM(t.Debit) FROM dbo.Transactions t JOIN dbo.Purchases p ON t.RefNo=p.InvoiceNo OR t.RefNo LIKE p.InvoiceNo+N':%' WHERE p.PurchaseId={id} AND t.AccountId=N'1300'", Ct));
    }

    private sealed record Refs(int Primary, int Foreign, int Supplier, int Country);

    private static object Import(Refs refs, int currency, decimal rate, long item, string status, decimal discount = 0m) => new
    {
        supplierPartnerId = refs.Supplier,
        currencyId = currency,
        countryId = refs.Country,
        status,
        purchaseType = "IMPORT",
        exchangeRateToBase = rate,
        discount,
        description = "IMPORT:test",
        lines = new[] { new { itemId = item, quantity = 10m, unitPrice = 2m, expiryDate = (DateTime?)new DateTime(2028, 5, 31), batchNo = "LOT-7" } },
    };

    private async Task<long> SaveDraftAsync(object request)
    {
        var response = await Admin.PostAsJsonAsync("/api/purchases", request, Ct);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("purchaseId").GetInt64();
    }

    private async Task<Refs> SeedAsync()
    {
        await fixture.Database.ExecuteAsync("""
            IF NOT EXISTS (SELECT 1 FROM dbo.Currencies WHERE CurrencyCode=N'PRI')
                INSERT dbo.Currencies(CurrencyCode,CurrencyNameEn,CurrencyNameAr,Symbol,IsPrimary) VALUES(N'PRI',N'Primary',N'أساسية',N'P',1);
            IF NOT EXISTS (SELECT 1 FROM dbo.Countries WHERE NameEn=N'Import land')
                INSERT dbo.Countries(NameAr,NameEn) VALUES(N'بلد الاستيراد',N'Import land');
            IF NOT EXISTS (SELECT 1 FROM dbo.Settings WHERE Code=N'U-FIN')
                INSERT dbo.Settings(SettingTypeId,ParentSettingId,Code,ValueAr,ValueEn,SortOrder,IsActive) SELECT SettingTypeId,NULL,N'U-FIN',N'حبة',N'Piece',99,1 FROM dbo.SettingTypes WHERE Code=N'UNIT';
            """, "import seed", Ct);
        return new(
            await fixture.Database.CountAsync("SELECT CurrencyId FROM dbo.Currencies WHERE CurrencyCode=N'PRI'", Ct),
            await fixture.Database.CountAsync("SELECT CurrencyId FROM dbo.Currencies WHERE CurrencyCode=N'TST'", Ct),
            await fixture.Database.CountAsync("SELECT PartnerId FROM dbo.Partners WHERE PartnerCode=N'P-SEC'", Ct),
            await fixture.Database.CountAsync("SELECT CountryId FROM dbo.Countries WHERE NameEn=N'Import land'", Ct));
    }

    private async Task<long> NewItemAsync(string code)
    {
        var unit = await fixture.Database.CountAsync("SELECT SettingId FROM dbo.Settings WHERE Code=N'U-FIN'", Ct);
        await fixture.Database.ExecuteAsync($"INSERT dbo.Items(ItemCode,NameAr,NameEn,SellPrice) VALUES(N'{code}',N'{code}',N'{code}',10); INSERT dbo.ItemUnits(ItemId,UnitSettingId,ConversionToBase,IsBase) VALUES(SCOPE_IDENTITY(),{unit},1,1);", "item", Ct);
        return await fixture.Database.ScalarAsync<long>($"SELECT ItemId FROM dbo.Items WHERE ItemCode=N'{code}'", Ct);
    }

    private Task<int> StockAsync(long item) => fixture.Database.CountAsync($"SELECT COALESCE(SUM(Quantity),0) FROM dbo.StockMovements WHERE ItemId={item} AND BranchId={fixture.BranchA} AND PostingStatus=N'POSTED'", Ct);
}
