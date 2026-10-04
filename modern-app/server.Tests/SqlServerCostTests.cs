using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ElitePos.LocalService.Data.Pos;

namespace ElitePos.LocalService.Tests;

// Stock is costed by batch in the main currency: a purchase brings a batch in at its price after the invoice discount
// and exchange rate, and sales, returns and disposals carry the cost of the batches they move.
[Collection(SqlServerCollection.Name)]
public sealed class SqlServerCostTests(SqlServerApiFixture fixture) : IClassFixture<SqlServerApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;
    private static void SkipWithoutSqlServer() => Assert.SkipWhen(string.IsNullOrWhiteSpace(SqlServerApiFixture.ServerConnectionString), "POS_TEST_SQLSERVER is not set.");
    private HttpClient Admin => fixture.Client(fixture.AdminToken);
    private static readonly DateTime Today = DateTime.Today;

    [Fact]
    public async Task A_sale_costs_what_the_batches_it_took_from_cost()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var x = await NewItemAsync("CT-SALE");
        await BuyAsync(refs, refs.Currency, 1m, 0m, (x, 3, 4m, "SOON", Today.AddDays(10)), (x, 3, 6m, "LATE", Today.AddDays(60)));

        var sale = await SellAsync(refs, x, 4);

        // 3 from SOON at 4 and 1 from LATE at 6.
        Assert.Equal(4.5m, await fixture.Database.ScalarAsync<decimal>($"SELECT UnitCost FROM dbo.SaleLines WHERE SaleId={sale}", Ct));
        Assert.Equal(18m, await fixture.Database.ScalarAsync<decimal>($"SELECT SUM(-Quantity*UnitCost) FROM dbo.StockMovements WHERE SaleId={sale}", Ct));
    }

    [Fact]
    public async Task Purchased_stock_is_costed_after_the_discount_in_the_main_currency()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var x = await NewItemAsync("CT-DISC");
        // 10 at 5 is 50, less a discount of 10, at 2 to the main currency: 5 x 0.8 x 2 = 8 a unit.
        await BuyAsync(refs, refs.Secondary, 2m, 10m, (x, 10, 5m, "B1", Today.AddDays(30)));

        var sale = await SellAsync(refs, x, 1);

        Assert.Equal(8m, await fixture.Database.ScalarAsync<decimal>($"SELECT UnitCost FROM dbo.SaleLines WHERE SaleId={sale}", Ct));
    }

    [Fact]
    public async Task A_sales_return_comes_back_at_the_cost_of_its_batch()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var x = await NewItemAsync("CT-RET");
        await BuyAsync(refs, refs.Currency, 1m, 0m, (x, 3, 4m, "SOON", Today.AddDays(10)), (x, 3, 6m, "LATE", Today.AddDays(60)));
        var sale = await SellAsync(refs, x, 4);
        var line = (await Admin.GetFromJsonAsync<JsonElement>($"/api/sales-returns/invoices/{sale}", Ct)).GetProperty("lines")[0].GetProperty("saleLineId").GetInt64();

        // The first unit back refills LATE, so it comes back at LATE's cost.
        var created = await Admin.PostAsJsonAsync("/api/sales-returns", new { saleId = sale, lines = new[] { new { lineId = line, quantity = 1m } } }, Ct);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal(6m, await fixture.Database.ScalarAsync<decimal>($"SELECT UnitCost FROM dbo.SalesReturnLines WHERE SaleLineId={line}", Ct));
    }

    [Fact]
    public async Task A_disposal_writes_off_the_batch_at_its_cost()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var x = await NewItemAsync("CT-DISP");
        var purchase = await BuyAsync(refs, refs.Currency, 1m, 10m, (x, 5, 10m, "B1", Today.AddDays(30)));
        var batch = await fixture.Database.ScalarAsync<long>($"SELECT PurchaseLineId FROM dbo.PurchaseLines WHERE PurchaseId={purchase}", Ct);

        var created = await Admin.PostAsJsonAsync("/api/inventory/disposals", new { itemId = x, purchaseLineId = batch, quantity = 2m, reason = "Broken" }, Ct);
        var requestId = (await created.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("requestId").GetInt64();
        Assert.Equal(HttpStatusCode.OK, (await Admin.PostAsync($"/api/inventory/requests/{requestId}/approve", null, Ct)).StatusCode);

        // 50 less 10 is 40 for 5, so 8 a unit and 16 written off.
        Assert.Equal(16m, await fixture.Database.ScalarAsync<decimal>($"SELECT Debit FROM dbo.Transactions WHERE RefNo=N'DISPOSAL:{requestId}' AND AccountId=N'5100'", Ct));
    }

    [Fact]
    public async Task Migration_054_rewrites_stored_costs_at_batch_cost()
    {
        SkipWithoutSqlServer();
        await using var database = await SqlServerMigrationTests.ScratchDatabase.CreateAsync(SqlServerApiFixture.ServerConnectionString!, Ct);
        var migrations = PosMigrationRunner.GetMigrations();
        foreach (var migration in migrations.Where(m => m.Version < 54))
            await database.ExecuteAsync(MigrationSql.Read(migration.Name), $"POS {migration.Version:D3}", Ct);

        // A purchase posted directly at 10 and 5 with a 20% discount, stored at the list price; a sale of 3 that took
        // 2 from SOON and 1 from LATE, and a return of 1 into LATE, all stored at the old last-price cost of 5.
        await database.ExecuteAsync("""
            DECLARE @branch int = (SELECT MIN(BranchId) FROM dbo.Branches);
            INSERT dbo.Currencies(CurrencyCode,CurrencyNameEn,CurrencyNameAr,Symbol,IsPrimary) VALUES(N'PRI',N'Primary',N'أساسية',N'P',1);
            DECLARE @currency int = SCOPE_IDENTITY();
            INSERT dbo.Partners(PartnerCode,PartnerName,PartnerTypeSettingId) VALUES(N'P-MIG',N'Supplier',(SELECT TOP 1 s.SettingId FROM dbo.Settings s JOIN dbo.SettingTypes t ON t.SettingTypeId=s.SettingTypeId WHERE t.Code=N'PARTNER_TYPE' ORDER BY s.SettingId));
            DECLARE @partner int = SCOPE_IDENTITY();
            INSERT dbo.Treasuries(TreasuryCode,NameAr,NameEn,CurrencyId,BranchId) VALUES(N'T-MIG',N'خزنة',N'Till',@currency,@branch);
            DECLARE @treasury int = SCOPE_IDENTITY();
            INSERT dbo.Items(ItemCode,NameAr,NameEn,SellPrice) VALUES(N'MIG',N'MIG',N'MIG',10);
            DECLARE @item bigint = SCOPE_IDENTITY();
            INSERT dbo.Purchases(BranchId,SupplierPartnerId,InvoiceNo,PurchaseDate,CurrencyId,Status,Total,Discount) VALUES(@branch,@partner,N'PO-MIG',CAST(GETDATE() AS date),@currency,N'POSTED',24,6);
            DECLARE @purchase bigint = SCOPE_IDENTITY();
            INSERT dbo.PurchaseLines(PurchaseId,ItemId,Quantity,UnitPrice,ExpiryDate,BatchNo) VALUES(@purchase,@item,2,10,DATEADD(day,10,GETDATE()),N'SOON');
            DECLARE @soon bigint = SCOPE_IDENTITY();
            INSERT dbo.PurchaseLines(PurchaseId,ItemId,Quantity,UnitPrice,ExpiryDate,BatchNo) VALUES(@purchase,@item,2,5,DATEADD(day,60,GETDATE()),N'LATE');
            DECLARE @late bigint = SCOPE_IDENTITY();
            INSERT dbo.StockMovements(BranchId,ItemId,PurchaseId,PurchaseLineId,Quantity,UnitCost,PostingStatus) VALUES(@branch,@item,@purchase,@soon,2,10,N'POSTED'),(@branch,@item,@purchase,@late,2,5,N'POSTED');
            INSERT dbo.Sales(BranchId,SaleNo,SaleDate,TreasuryId,CurrencyId,Status,Total) VALUES(@branch,N'SL-MIG',CAST(GETDATE() AS date),@treasury,@currency,N'POSTED',30);
            DECLARE @sale bigint = SCOPE_IDENTITY();
            INSERT dbo.SaleLines(SaleId,ItemId,Quantity,UnitPrice,UnitCost) VALUES(@sale,@item,3,10,5);
            DECLARE @saleLine bigint = SCOPE_IDENTITY();
            INSERT dbo.StockMovements(BranchId,ItemId,SaleId,SaleLineId,PurchaseLineId,Quantity,UnitCost,PostingStatus) VALUES(@branch,@item,@sale,@saleLine,@soon,-2,5,N'POSTED'),(@branch,@item,@sale,@saleLine,@late,-1,5,N'POSTED');
            INSERT dbo.SalesReturns(BranchId,ReturnNo,ReturnDate,SaleId,TreasuryId,CurrencyId,Subtotal,Discount,Total,Status) VALUES(@branch,N'SR-MIG',CAST(GETDATE() AS date),@sale,@treasury,@currency,10,0,10,N'POSTED');
            DECLARE @return bigint = SCOPE_IDENTITY();
            INSERT dbo.SalesReturnLines(SalesReturnId,SaleLineId,ItemId,Quantity,UnitPrice,UnitCost) VALUES(@return,@saleLine,@item,1,10,5);
            INSERT dbo.StockMovements(BranchId,ItemId,SalesReturnId,SaleLineId,PurchaseLineId,Quantity,UnitCost,PostingStatus) VALUES(@branch,@item,@return,@saleLine,@late,1,5,N'POSTED');
            """, "stock at old costs", Ct);

        await database.ExecuteAsync(MigrationSql.Read(migrations.Single(m => m.Version == 54).Name), "POS 054", Ct);

        // SOON costs 10 x 0.8 = 8 and LATE 5 x 0.8 = 4. The sale line costs (2 x 8 + 1 x 4) / 3 and the return 4.
        Assert.Equal(6.6667m, await database.ScalarAsync<decimal>("SELECT UnitCost FROM dbo.SaleLines", Ct));
        Assert.Equal(4m, await database.ScalarAsync<decimal>("SELECT UnitCost FROM dbo.SalesReturnLines", Ct));
        // What is left, none of SOON and 2 of LATE, is worth 2 x 4.
        Assert.Equal(8m, await database.ScalarAsync<decimal>("SELECT SUM(Quantity*UnitCost) FROM dbo.StockMovements", Ct));
    }

    private sealed record Refs(int Currency, int Secondary, int Treasury, int Supplier);

    private async Task<Refs> SeedAsync()
    {
        await fixture.Database.ExecuteAsync($"""
            IF NOT EXISTS (SELECT 1 FROM dbo.Currencies WHERE CurrencyCode=N'PRI')
                INSERT dbo.Currencies(CurrencyCode,CurrencyNameEn,CurrencyNameAr,Symbol,IsPrimary) VALUES(N'PRI',N'Primary',N'أساسية',N'P',1);
            IF NOT EXISTS (SELECT 1 FROM dbo.Currencies WHERE CurrencyCode=N'CSX')
                INSERT dbo.Currencies(CurrencyCode,CurrencyNameEn,CurrencyNameAr,Symbol,IsPrimary) VALUES(N'CSX',N'Second',N'ثانية',N'S',0);
            DECLARE @currency int = (SELECT CurrencyId FROM dbo.Currencies WHERE CurrencyCode=N'PRI');
            IF NOT EXISTS (SELECT 1 FROM dbo.Treasuries WHERE TreasuryCode=N'T-CST')
                INSERT dbo.Treasuries(TreasuryCode,NameAr,NameEn,CurrencyId,BranchId) VALUES(N'T-CST',N'خزنة التكلفة',N'Cost till',@currency,{fixture.BranchA});
            IF NOT EXISTS (SELECT 1 FROM dbo.Settings WHERE Code=N'U-CST')
                INSERT dbo.Settings(SettingTypeId,ParentSettingId,Code,ValueAr,ValueEn,SortOrder,IsActive) SELECT SettingTypeId,NULL,N'U-CST',N'حبة',N'Piece',99,1 FROM dbo.SettingTypes WHERE Code=N'UNIT';
            """, "cost seed", Ct);
        return new(
            await fixture.Database.CountAsync("SELECT CurrencyId FROM dbo.Currencies WHERE CurrencyCode=N'PRI'", Ct),
            await fixture.Database.CountAsync("SELECT CurrencyId FROM dbo.Currencies WHERE CurrencyCode=N'CSX'", Ct),
            await fixture.Database.CountAsync("SELECT TreasuryId FROM dbo.Treasuries WHERE TreasuryCode=N'T-CST'", Ct),
            await fixture.Database.CountAsync("SELECT PartnerId FROM dbo.Partners WHERE PartnerCode=N'P-SEC'", Ct));
    }

    private async Task<long> NewItemAsync(string code)
    {
        var unit = await fixture.Database.CountAsync("SELECT SettingId FROM dbo.Settings WHERE Code=N'U-CST'", Ct);
        await fixture.Database.ExecuteAsync($"INSERT dbo.Items(ItemCode,NameAr,NameEn,SellPrice) VALUES(N'{code}',N'{code}',N'{code}',10); INSERT dbo.ItemUnits(ItemId,UnitSettingId,ConversionToBase,IsBase) VALUES(SCOPE_IDENTITY(),{unit},1,1);", "item", Ct);
        return await fixture.Database.ScalarAsync<long>($"SELECT ItemId FROM dbo.Items WHERE ItemCode=N'{code}'", Ct);
    }

    private async Task<long> BuyAsync(Refs refs, int currency, decimal rate, decimal discount, params (long Item, decimal Quantity, decimal Price, string Batch, DateTime Expiry)[] lines)
    {
        var response = await Admin.PostAsJsonAsync("/api/purchases", new { supplierPartnerId = refs.Supplier, currencyId = currency, exchangeRateToBase = rate, discount, status = "POSTED", lines = lines.Select(line => new { itemId = line.Item, quantity = line.Quantity, unitPrice = line.Price, batchNo = line.Batch, expiryDate = line.Expiry.ToString("yyyy-MM-dd") }) }, Ct);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("purchaseId").GetInt64();
    }

    private async Task<long> SellAsync(Refs refs, long item, decimal quantity)
    {
        var response = await Admin.PostAsJsonAsync("/api/sales", new { treasuryId = refs.Treasury, currencyId = refs.Currency, lines = new[] { new { itemId = item, quantity, unitPrice = 10m } } }, Ct);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("saleId").GetInt64();
    }
}
