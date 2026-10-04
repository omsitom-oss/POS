using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ElitePos.LocalService.Data.Pos;

namespace ElitePos.LocalService.Tests;

// Batch-level stock: sales take from the batch that expires first and never sell expired stock, returns go back to the
// batch they came from, and migration 052 gives existing movements their batches.
[Collection(SqlServerCollection.Name)]
public sealed class SqlServerBatchTests(SqlServerApiFixture fixture) : IClassFixture<SqlServerApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;
    private static void SkipWithoutSqlServer() => Assert.SkipWhen(string.IsNullOrWhiteSpace(SqlServerApiFixture.ServerConnectionString), "POS_TEST_SQLSERVER is not set.");
    private HttpClient Admin => fixture.Client(fixture.AdminToken);
    private static readonly DateTime Today = DateTime.Today;

    [Fact]
    public async Task A_sale_takes_from_the_batch_that_expires_first()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var x = await NewItemAsync("BT-FEFO");
        await BuyAsync(refs, (x, 3, "LATE", Today.AddDays(60)), (x, 3, "SOON", Today.AddDays(10)));

        await SellAsync(refs, x, 4);

        var batches = await BatchesAsync(x);
        Assert.Equal(0m, batches["SOON"]);
        Assert.Equal(2m, batches["LATE"]);
    }

    [Fact]
    public async Task Expired_stock_is_not_sold()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var x = await NewItemAsync("BT-EXP");
        await BuyAsync(refs, (x, 5, "OLD", Today.AddDays(-1)), (x, 2, "NEW", Today.AddDays(30)));

        var refused = await Admin.PostAsJsonAsync("/api/sales", SaleBody(refs, x, 3), Ct);
        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
        Assert.Contains("Only 2 can be sold; 5 more is expired", await refused.Content.ReadAsStringAsync(Ct));

        await SellAsync(refs, x, 2);
        var batches = await BatchesAsync(x);
        Assert.Equal(5m, batches["OLD"]);
        Assert.Equal(0m, batches["NEW"]);
        // Stock expiring today can still be sold today.
        var y = await NewItemAsync("BT-TODAY");
        await BuyAsync(refs, (y, 1, "TODAY", Today));
        await SellAsync(refs, y, 1);
    }

    [Fact]
    public async Task A_sales_return_goes_back_to_the_batch_it_was_sold_from()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var x = await NewItemAsync("BT-RET");
        await BuyAsync(refs, (x, 3, "SOON", Today.AddDays(10)), (x, 3, "LATE", Today.AddDays(60)));
        var sale = await SellAsync(refs, x, 4);
        var line = (await Admin.GetFromJsonAsync<JsonElement>($"/api/sales-returns/invoices/{sale}", Ct)).GetProperty("lines")[0].GetProperty("saleLineId").GetInt64();

        // The sale took 3 from SOON and 1 from LATE. The first unit back refills LATE, the rest go to SOON.
        Assert.Equal(HttpStatusCode.Created, (await Admin.PostAsJsonAsync("/api/sales-returns", new { saleId = sale, lines = new[] { new { lineId = line, quantity = 1m } } }, Ct)).StatusCode);
        var batches = await BatchesAsync(x);
        Assert.Equal(3m, batches["LATE"]);
        Assert.Equal(0m, batches["SOON"]);
        Assert.Equal(HttpStatusCode.Created, (await Admin.PostAsJsonAsync("/api/sales-returns", new { saleId = sale, lines = new[] { new { lineId = line, quantity = 2m } } }, Ct)).StatusCode);
        Assert.Equal(2m, (await BatchesAsync(x))["SOON"]);
    }

    [Fact]
    public async Task Stock_with_no_batch_is_sold_after_the_batches()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var x = await NewItemAsync("BT-NONE");
        await BuyAsync(refs, (x, 2, "ONLY", Today.AddDays(30)));
        // Three units came back from a sale made before batches were tracked, so they have no batch.
        await fixture.Database.ExecuteAsync($"INSERT dbo.StockMovements(BranchId,ItemId,Quantity,UnitCost,PostingStatus) VALUES({fixture.BranchA},{x},3,4,N'POSTED')", "unbatched stock", Ct);

        await SellAsync(refs, x, 4);

        Assert.Equal(0m, (await BatchesAsync(x))["ONLY"]);
        Assert.Equal(1, await fixture.Database.CountAsync($"SELECT SUM(Quantity) FROM dbo.StockMovements WHERE ItemId={x} AND PurchaseLineId IS NULL AND PostingStatus=N'POSTED'", Ct));
        var refused = await Admin.PostAsJsonAsync("/api/sales", SaleBody(refs, x, 2), Ct);
        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
    }

    [Fact]
    public async Task A_purchase_return_can_only_take_what_is_left_in_the_batch()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var x = await NewItemAsync("BT-PR");
        var purchase = await BuyAsync(refs, (x, 3, "SOON", Today.AddDays(10)), (x, 3, "LATE", Today.AddDays(60)));
        await SellAsync(refs, x, 2);

        var lines = (await Admin.GetFromJsonAsync<JsonElement>($"/api/purchase-returns/invoices/{purchase}", Ct)).GetProperty("lines").EnumerateArray().ToArray();
        decimal Returnable(string batch) => lines.Single(line => line.GetProperty("batchNo").GetString() == batch).GetProperty("returnableQuantity").GetDecimal();
        Assert.Equal(1m, Returnable("SOON"));
        Assert.Equal(3m, Returnable("LATE"));
        var soon = lines.Single(line => line.GetProperty("batchNo").GetString() == "SOON").GetProperty("purchaseLineId").GetInt64();
        var tooMany = await Admin.PostAsJsonAsync("/api/purchase-returns", new { purchaseId = purchase, lines = new[] { new { lineId = soon, quantity = 2m } } }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, tooMany.StatusCode);
    }

    [Fact]
    public async Task Migration_052_puts_existing_movements_into_batches()
    {
        SkipWithoutSqlServer();
        await using var database = await SqlServerMigrationTests.ScratchDatabase.CreateAsync(SqlServerApiFixture.ServerConnectionString!, Ct);
        var migrations = PosMigrationRunner.GetMigrations();
        foreach (var migration in migrations.Where(m => m.Version < 52))
            await database.ExecuteAsync(MigrationSql.Read(migration.Name), $"POS {migration.Version:D3}", Ct);

        // Stock as the app wrote it before batches: two batches bought, 4 sold, 1 returned, 1 disposed from LATE.
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
            INSERT dbo.Purchases(BranchId,SupplierPartnerId,InvoiceNo,PurchaseDate,CurrencyId,Status,Total) VALUES(@branch,@partner,N'PO-MIG',CAST(GETDATE() AS date),@currency,N'POSTED',30);
            DECLARE @purchase bigint = SCOPE_IDENTITY();
            INSERT dbo.PurchaseLines(PurchaseId,ItemId,Quantity,UnitPrice,ExpiryDate,BatchNo) VALUES(@purchase,@item,3,5,DATEADD(day,60,GETDATE()),N'LATE');
            DECLARE @late bigint = SCOPE_IDENTITY();
            INSERT dbo.PurchaseLines(PurchaseId,ItemId,Quantity,UnitPrice,ExpiryDate,BatchNo) VALUES(@purchase,@item,3,5,DATEADD(day,10,GETDATE()),N'SOON');
            INSERT dbo.StockMovements(BranchId,ItemId,PurchaseId,Quantity,UnitCost,PostingStatus) VALUES(@branch,@item,@purchase,3,5,N'POSTED'),(@branch,@item,@purchase,3,5,N'POSTED');
            INSERT dbo.Sales(BranchId,SaleNo,SaleDate,TreasuryId,CurrencyId,Status,Total) VALUES(@branch,N'SL-MIG',CAST(GETDATE() AS date),@treasury,@currency,N'POSTED',40);
            DECLARE @sale bigint = SCOPE_IDENTITY();
            INSERT dbo.SaleLines(SaleId,ItemId,Quantity,UnitPrice,UnitCost) VALUES(@sale,@item,4,10,5);
            DECLARE @saleLine bigint = SCOPE_IDENTITY();
            INSERT dbo.StockMovements(BranchId,ItemId,SaleId,Quantity,UnitCost,PostingStatus) VALUES(@branch,@item,@sale,-4,5,N'POSTED');
            INSERT dbo.SalesReturns(BranchId,ReturnNo,ReturnDate,SaleId,TreasuryId,CurrencyId,Subtotal,Discount,Total,Status) VALUES(@branch,N'SR-MIG',CAST(GETDATE() AS date),@sale,@treasury,@currency,10,0,10,N'POSTED');
            DECLARE @return bigint = SCOPE_IDENTITY();
            INSERT dbo.SalesReturnLines(SalesReturnId,SaleLineId,ItemId,Quantity,UnitPrice,UnitCost) VALUES(@return,@saleLine,@item,1,10,5);
            INSERT dbo.StockMovements(BranchId,ItemId,SalesReturnId,Quantity,UnitCost,PostingStatus) VALUES(@branch,@item,@return,1,5,N'POSTED');
            INSERT dbo.InventoryRequests(RequestType,BranchId,ItemId,PurchaseLineId,Quantity,Reason,Status,ReviewedAt) VALUES(N'INVENTORY_DISPOSAL',@branch,@item,@late,1,N'Broken',N'APPROVED',SYSUTCDATETIME());
            INSERT dbo.StockMovements(BranchId,ItemId,PurchaseId,Quantity,UnitCost,PostingStatus) VALUES(@branch,@item,@purchase,-1,5,N'POSTED');
            """, "pre-batch stock", Ct);

        await database.ExecuteAsync(MigrationSql.Read(migrations.Single(m => m.Version == 52).Name), "POS 052", Ct);

        // Every movement has a batch, the total is unchanged, and each batch holds what FEFO says it should:
        // the sale took 3 SOON + 1 LATE, the return put 1 back into LATE, and the disposal took 1 from LATE.
        Assert.Equal(0, await database.CountAsync("SELECT COUNT(*) FROM dbo.StockMovements WHERE PurchaseLineId IS NULL", Ct));
        Assert.Equal(2, await database.CountAsync("SELECT SUM(Quantity) FROM dbo.StockMovements", Ct));
        Assert.Equal(0, await database.CountAsync("SELECT SUM(sm.Quantity) FROM dbo.StockMovements sm JOIN dbo.PurchaseLines pl ON pl.PurchaseLineId=sm.PurchaseLineId WHERE pl.BatchNo=N'SOON'", Ct));
        Assert.Equal(2, await database.CountAsync("SELECT SUM(sm.Quantity) FROM dbo.StockMovements sm JOIN dbo.PurchaseLines pl ON pl.PurchaseLineId=sm.PurchaseLineId WHERE pl.BatchNo=N'LATE'", Ct));
        Assert.Equal(0, await database.CountAsync("SELECT COUNT(*) FROM dbo.StockMovements WHERE (SaleId IS NOT NULL OR SalesReturnId IS NOT NULL) AND SaleLineId IS NULL", Ct));
    }

    private sealed record Refs(int Currency, int Treasury, int Supplier);

    private async Task<Refs> SeedAsync()
    {
        await fixture.Database.ExecuteAsync($"""
            IF NOT EXISTS (SELECT 1 FROM dbo.Currencies WHERE CurrencyCode=N'PRI')
                INSERT dbo.Currencies(CurrencyCode,CurrencyNameEn,CurrencyNameAr,Symbol,IsPrimary) VALUES(N'PRI',N'Primary',N'أساسية',N'P',1);
            DECLARE @currency int = (SELECT CurrencyId FROM dbo.Currencies WHERE CurrencyCode=N'PRI');
            IF NOT EXISTS (SELECT 1 FROM dbo.Treasuries WHERE TreasuryCode=N'T-BAT')
                INSERT dbo.Treasuries(TreasuryCode,NameAr,NameEn,CurrencyId,BranchId) VALUES(N'T-BAT',N'خزنة الدفعات',N'Batch till',@currency,{fixture.BranchA});
            IF NOT EXISTS (SELECT 1 FROM dbo.Settings WHERE Code=N'U-BAT')
                INSERT dbo.Settings(SettingTypeId,ParentSettingId,Code,ValueAr,ValueEn,SortOrder,IsActive) SELECT SettingTypeId,NULL,N'U-BAT',N'حبة',N'Piece',99,1 FROM dbo.SettingTypes WHERE Code=N'UNIT';
            """, "batch seed", Ct);
        return new(
            await fixture.Database.CountAsync("SELECT CurrencyId FROM dbo.Currencies WHERE CurrencyCode=N'PRI'", Ct),
            await fixture.Database.CountAsync("SELECT TreasuryId FROM dbo.Treasuries WHERE TreasuryCode=N'T-BAT'", Ct),
            await fixture.Database.CountAsync("SELECT PartnerId FROM dbo.Partners WHERE PartnerCode=N'P-SEC'", Ct));
    }

    private async Task<long> NewItemAsync(string code)
    {
        var unit = await fixture.Database.CountAsync("SELECT SettingId FROM dbo.Settings WHERE Code=N'U-BAT'", Ct);
        await fixture.Database.ExecuteAsync($"INSERT dbo.Items(ItemCode,NameAr,NameEn,SellPrice) VALUES(N'{code}',N'{code}',N'{code}',10); INSERT dbo.ItemUnits(ItemId,UnitSettingId,ConversionToBase,IsBase) VALUES(SCOPE_IDENTITY(),{unit},1,1);", "item", Ct);
        return await fixture.Database.ScalarAsync<long>($"SELECT ItemId FROM dbo.Items WHERE ItemCode=N'{code}'", Ct);
    }

    private async Task<long> BuyAsync(Refs refs, params (long Item, decimal Quantity, string Batch, DateTime Expiry)[] lines)
    {
        var response = await Admin.PostAsJsonAsync("/api/purchases", new { supplierPartnerId = refs.Supplier, currencyId = refs.Currency, status = "POSTED", lines = lines.Select(line => new { itemId = line.Item, quantity = line.Quantity, unitPrice = 4m, batchNo = line.Batch, expiryDate = line.Expiry.ToString("yyyy-MM-dd") }) }, Ct);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("purchaseId").GetInt64();
    }

    private static object SaleBody(Refs refs, long item, decimal quantity) => new { treasuryId = refs.Treasury, currencyId = refs.Currency, lines = new[] { new { itemId = item, quantity, unitPrice = 8m } } };

    private async Task<long> SellAsync(Refs refs, long item, decimal quantity)
    {
        var response = await Admin.PostAsJsonAsync("/api/sales", SaleBody(refs, item, quantity), Ct);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("saleId").GetInt64();
    }

    private async Task<Dictionary<string, decimal>> BatchesAsync(long item) =>
        (await Admin.GetFromJsonAsync<JsonElement[]>($"/api/inventory/{item}/batches?branchId={fixture.BranchA}", Ct))!
            .ToDictionary(batch => batch.GetProperty("batchNo").GetString()!, batch => batch.GetProperty("availableQuantity").GetDecimal());
}
