using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ElitePos.LocalService.Security;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Tests;

// Import shipments: the supplier is owed the goods in the invoice currency, each cost is owed to its own payee or
// paid from a till, and the goods wait in transit until they are received at their landed cost.
[Collection(SqlServerCollection.Name)]
public sealed class SqlServerImportTests(SqlServerApiFixture fixture) : IClassFixture<SqlServerApiFixture>
{
    private const decimal Rate = 160m;
    private static CancellationToken Ct => TestContext.Current.CancellationToken;
    private static void SkipWithoutSqlServer() => Assert.SkipWhen(string.IsNullOrWhiteSpace(SqlServerApiFixture.ServerConnectionString), "POS_TEST_SQLSERVER is not set.");
    private HttpClient Admin => fixture.Client(fixture.AdminToken);

    [Fact]
    public void Costs_are_shared_by_value_or_quantity_and_always_add_up()
    {
        var lines = new List<(decimal, decimal)> { (600m, 30m), (400m, 100m), (0.01m, 1m) };
        var byValue = ImportShipmentService.Allocate(lines, 100m, "VALUE");
        Assert.Equal(100m, byValue.Sum());
        Assert.Equal(59.9994m, byValue[0]);
        var byQuantity = ImportShipmentService.Allocate(lines, 131m, "QUANTITY");
        Assert.Equal([30m, 100m, 1m], byQuantity);
    }

    [Fact]
    public async Task The_purchase_screen_does_not_take_imports()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var item = await NewItemAsync("IM-OLD");
        var response = await Admin.PostAsJsonAsync("/api/purchases", new { supplierPartnerId = refs.Supplier, currencyId = refs.Foreign, countryId = refs.Country, status = "DRAFT", purchaseType = "IMPORT", exchangeRateToBase = Rate, lines = new[] { new { itemId = item, quantity = 1m, unitPrice = 2m } } }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task A_shipment_in_the_main_currency_is_always_at_rate_one()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var item = await NewItemAsync("IM-MAIN");
        var shipment = await CreateAsync(Shipment(refs, refs.Primary, 3m, [Line(item, 10m, 2m)]));
        Assert.Equal(1m, shipment.GetProperty("exchangeRateToBase").GetDecimal());
        Assert.Equal(20m, await SumAsync($"SELECT SUM(Credit) FROM dbo.Transactions WHERE RefNo=N'{Invoice(shipment)}' AND PartnerId={refs.Supplier}"));
    }

    [Fact]
    public async Task A_received_shipment_lands_its_costs_on_the_right_payees_and_moves_transit_to_stock()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var a = await NewItemAsync("IM-A");
        var b = await NewItemAsync("IM-B");
        var shipment = await CreateAsync(Shipment(refs, refs.Foreign, Rate, [Line(a, 30m, 20m, "LOT-A"), Line(b, 100m, 4m)]));
        var id = Id(shipment);
        var invoice = Invoice(shipment);

        // The supplier is owed 1,000 in the invoice currency, worth 160,000 in the main currency.
        Assert.Equal(1000m, await SumAsync($"SELECT SUM(ForeignCredit) FROM dbo.Transactions WHERE RefNo=N'{invoice}' AND PartnerId={refs.Supplier} AND CurrencyId={refs.Foreign}"));
        Assert.Equal(160000m, await SumAsync($"SELECT SUM(Debit) FROM dbo.Transactions WHERE RefNo=N'{invoice}' AND AccountId=N'1350'"));

        await FundTillAsync(refs, 500m);
        var till = await TillBalanceAsync(refs);
        Assert.Equal(HttpStatusCode.OK, (await AddCostAsync(id, new { costType = "FREIGHT", amount = 200m, currencyId = refs.Foreign, exchangeRateToBase = Rate, payeeType = "PARTNER", payeePartnerId = refs.Shipper })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await AddCostAsync(id, new { costType = "CUSTOMS", amount = 300m, currencyId = refs.Primary, exchangeRateToBase = 1m, payeeType = "TREASURY", payeeTreasuryId = refs.Till })).StatusCode);
        var accrued = await AddCostAsync(id, new { costType = "CLEARANCE", amount = 50m, currencyId = refs.Primary, exchangeRateToBase = 9m, payeeType = "ACCOUNT", payeeAccountCode = "2200" });
        Assert.Equal(HttpStatusCode.OK, accrued.StatusCode);

        // Freight is owed to the shipping line in its own currency, not to the goods supplier.
        Assert.Equal(200m, await SumAsync($"SELECT SUM(ForeignCredit) FROM dbo.Transactions WHERE RefNo LIKE N'{invoice}:COST:%' AND PartnerId={refs.Shipper} AND CurrencyId={refs.Foreign}"));
        Assert.Equal(0m, await SumAsync($"SELECT COALESCE(SUM(Credit),0) FROM dbo.Transactions WHERE RefNo LIKE N'{invoice}:COST:%' AND PartnerId={refs.Supplier}"));
        Assert.Equal(till - 300m, await TillBalanceAsync(refs));
        Assert.Equal(50m, await SumAsync($"SELECT SUM(Credit) FROM dbo.Transactions WHERE RefNo LIKE N'{invoice}:COST:%' AND AccountId=N'2200'"));

        var received = await Admin.PostAsync($"/api/imports/{id}/receive", null, Ct);
        Assert.Equal(HttpStatusCode.OK, received.StatusCode);

        // Landed: 160,000 goods + 32,000 freight + 300 customs + 50 clearance = 192,350, shared 60/40 by value.
        Assert.Equal(115410m / 30m, await SumAsync($"SELECT UnitCost FROM dbo.StockMovements WHERE PurchaseId={id} AND ItemId={a}"), 4);
        Assert.Equal(769.4m, await SumAsync($"SELECT UnitCost FROM dbo.StockMovements WHERE PurchaseId={id} AND ItemId={b}"), 4);
        Assert.Equal(0m, await SumAsync($"SELECT SUM(Debit-Credit) FROM dbo.Transactions WHERE AccountId=N'1350' AND (RefNo=N'{invoice}' OR RefNo LIKE N'{invoice}:%')"));
        Assert.Equal(192350m, await SumAsync($"SELECT SUM(Debit) FROM dbo.Transactions WHERE RefNo=N'{invoice}:RECEIVE' AND AccountId=N'1300'"));
        Assert.Equal("LOT-A", await fixture.Database.ScalarAsync<string>($"SELECT BatchNo FROM dbo.PurchaseLines WHERE PurchaseId={id} AND ItemId={a}", Ct));

        var body = await received.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal("POSTED", body.GetProperty("status").GetString());
        Assert.Equal(192350m, body.GetProperty("landedBase").GetDecimal());
        Assert.Equal(HttpStatusCode.BadRequest, (await AddCostAsync(id, new { costType = "OTHER", amount = 1m, currencyId = refs.Primary, exchangeRateToBase = 1m, payeeType = "PARTNER", payeePartnerId = refs.Shipper })).StatusCode);
    }

    [Fact]
    public async Task Received_import_stock_is_sold_from_the_batch_that_expires_first()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var item = await NewItemAsync("IM-FEFO");
        var late = new { itemId = item, quantity = 3m, unitPrice = 5m, expiryDate = (DateTime?)DateTime.Today.AddDays(90), batchNo = "IMP-LATE" };
        var soon = new { itemId = item, quantity = 3m, unitPrice = 5m, expiryDate = (DateTime?)DateTime.Today.AddDays(20), batchNo = "IMP-SOON" };
        var id = Id(await CreateAsync(Shipment(refs, refs.Foreign, Rate, [late, soon])));
        Assert.Equal(HttpStatusCode.OK, (await Admin.PostAsync($"/api/imports/{id}/receive", null, Ct)).StatusCode);
        Assert.Equal(0, await fixture.Database.CountAsync($"SELECT COUNT(*) FROM dbo.StockMovements WHERE PurchaseId={id} AND PurchaseLineId IS NULL", Ct));

        var sale = await Admin.PostAsJsonAsync("/api/sales", new { treasuryId = refs.Till, currencyId = refs.Primary, lines = new[] { new { itemId = item, quantity = 4m, unitPrice = 2000m } } }, Ct);

        Assert.Equal(HttpStatusCode.Created, sale.StatusCode);
        Assert.Equal(0m, await BatchLeftAsync(id, "IMP-SOON"));
        Assert.Equal(2m, await BatchLeftAsync(id, "IMP-LATE"));
    }

    [Fact]
    public async Task A_till_cannot_pay_more_than_it_holds()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var item = await NewItemAsync("IM-TILL");
        var id = Id(await CreateAsync(Shipment(refs, refs.Foreign, Rate, [Line(item, 1m, 5m)])));
        var balance = await TillBalanceAsync(refs);

        var response = await AddCostAsync(id, new { costType = "CUSTOMS", amount = balance + 1m, currencyId = refs.Primary, exchangeRateToBase = 1m, payeeType = "TREASURY", payeeTreasuryId = refs.Till });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(balance, await TillBalanceAsync(refs));
    }

    [Fact]
    public async Task Only_a_treasury_user_can_change_a_cost_paid_from_a_till()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        await FundTillAsync(refs, 30m);
        var item = await NewItemAsync("IM-PERM");
        var id = Id(await CreateAsync(Shipment(refs, refs.Foreign, Rate, [Line(item, 1m, 5m)])));
        var added = await (await AddCostAsync(id, new { costType = "CUSTOMS", amount = 30m, currencyId = refs.Primary, exchangeRateToBase = 1m, payeeType = "TREASURY", payeeTreasuryId = refs.Till })).Content.ReadFromJsonAsync<JsonElement>(Ct);
        var cost = added.GetProperty("costs")[0].GetProperty("costId").GetInt64();
        var balance = await TillBalanceAsync(refs);
        var (clerk, _, _) = await fixture.CreateUserAsync("import-clerk", fixture.BranchA, PermissionCodes.PurchasesView, PermissionCodes.PurchasesManage);

        Assert.Equal(HttpStatusCode.Forbidden, (await clerk.DeleteAsync($"/api/imports/{id}/costs/{cost}", Ct)).StatusCode);
        var moved = await clerk.PutAsJsonAsync($"/api/imports/{id}/costs/{cost}", new { costType = "CUSTOMS", amount = 30m, currencyId = refs.Primary, exchangeRateToBase = 1m, payeeType = "ACCOUNT", payeeAccountCode = "2200" }, Ct);
        Assert.Equal(HttpStatusCode.Forbidden, moved.StatusCode);
        Assert.Equal(balance, await TillBalanceAsync(refs));
    }

    [Fact]
    public async Task Editing_and_removing_a_cost_reverse_its_entry()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var item = await NewItemAsync("IM-EDIT");
        var id = Id(await CreateAsync(Shipment(refs, refs.Foreign, Rate, [Line(item, 10m, 10m)])));
        var added = await (await AddCostAsync(id, new { costType = "FREIGHT", amount = 20m, currencyId = refs.Foreign, exchangeRateToBase = Rate, payeeType = "PARTNER", payeePartnerId = refs.Shipper })).Content.ReadFromJsonAsync<JsonElement>(Ct);
        var cost = added.GetProperty("costs")[0].GetProperty("costId").GetInt64();

        var edited = await Admin.PutAsJsonAsync($"/api/imports/{id}/costs/{cost}", new { costType = "FREIGHT", amount = 25m, currencyId = refs.Foreign, exchangeRateToBase = Rate, payeeType = "PARTNER", payeePartnerId = refs.Shipper }, Ct);
        Assert.Equal(HttpStatusCode.OK, edited.StatusCode);
        var detail = await edited.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal(1, detail.GetProperty("costs").GetArrayLength());
        Assert.Equal(4000m, detail.GetProperty("costsBase").GetDecimal());
        Assert.Equal(25m, await ShipperOwesAsync(refs, id));

        var newCost = detail.GetProperty("costs")[0].GetProperty("costId").GetInt64();
        Assert.Equal(HttpStatusCode.OK, (await Admin.DeleteAsync($"/api/imports/{id}/costs/{newCost}", Ct)).StatusCode);
        Assert.Equal(0m, await ShipperOwesAsync(refs, id));
    }

    [Fact]
    public async Task Changing_a_draft_reposts_what_the_supplier_is_owed()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var item = await NewItemAsync("IM-CHANGE");
        var shipment = await CreateAsync(Shipment(refs, refs.Foreign, Rate, [Line(item, 10m, 10m)]));

        var changed = await Admin.PutAsJsonAsync($"/api/imports/{Id(shipment)}", Shipment(refs, refs.Foreign, 150m, [Line(item, 12m, 10m)], "QUANTITY"), Ct);

        Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
        var body = await changed.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal("QUANTITY", body.GetProperty("allocationMethod").GetString());
        Assert.Equal(120m, await SumAsync($"SELECT SUM(ForeignCredit-ForeignDebit) FROM dbo.Transactions WHERE RefNo=N'{Invoice(shipment)}' AND PartnerId={refs.Supplier}"));
        Assert.Equal(18000m, await SumAsync($"SELECT SUM(Credit-Debit) FROM dbo.Transactions WHERE RefNo=N'{Invoice(shipment)}' AND PartnerId={refs.Supplier}"));
    }

    [Fact]
    public async Task Cancelling_a_draft_reverses_everything_and_keeps_its_history()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var item = await NewItemAsync("IM-CANCEL");
        var shipment = await CreateAsync(Shipment(refs, refs.Foreign, Rate, [Line(item, 10m, 10m)]));
        var id = Id(shipment);
        await FundTillAsync(refs, 100m);
        var before = await TillBalanceAsync(refs);
        Assert.Equal(HttpStatusCode.OK, (await AddCostAsync(id, new { costType = "CUSTOMS", amount = 40m, currencyId = refs.Primary, exchangeRateToBase = 1m, payeeType = "TREASURY", payeeTreasuryId = refs.Till })).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await Admin.PostAsync($"/api/imports/{id}/cancel", null, Ct)).StatusCode);

        Assert.Equal("CANCELLED", await fixture.Database.ScalarAsync<string>($"SELECT Status FROM dbo.Purchases WHERE PurchaseId={id}", Ct));
        Assert.Equal(before, await TillBalanceAsync(refs));
        Assert.Equal(0m, await SumAsync($"SELECT COALESCE(SUM(Debit-Credit),0) FROM dbo.Transactions WHERE (RefNo=N'{Invoice(shipment)}' OR RefNo LIKE N'{Invoice(shipment)}:%') AND AccountId=N'1350'"));
        Assert.Equal(4, await fixture.Database.CountAsync($"SELECT COUNT(*) FROM dbo.Transactions WHERE RefNo=N'{Invoice(shipment)}'", Ct));
        Assert.Equal(0, await StockAsync(item));
    }

    private sealed record Refs(int Primary, int Foreign, int Supplier, int Shipper, int Country, int Till);

    private static object Line(long item, decimal quantity, decimal price, string? batch = null) =>
        new { itemId = item, quantity, unitPrice = price, expiryDate = (DateTime?)new DateTime(2028, 5, 31), batchNo = batch };

    private static object Shipment(Refs refs, int currency, decimal rate, object[] lines, string allocation = "VALUE") => new
    {
        supplierPartnerId = refs.Supplier,
        currencyId = currency,
        exchangeRateToBase = rate,
        countryId = refs.Country,
        supplierInvoiceNo = "INV-77",
        shipmentReference = "BL-9",
        allocationMethod = allocation,
        lines,
    };

    private async Task<JsonElement> CreateAsync(object request)
    {
        var response = await Admin.PostAsJsonAsync("/api/imports", request, Ct);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
    }

    private Task<HttpResponseMessage> AddCostAsync(long id, object cost) => Admin.PostAsJsonAsync($"/api/imports/{id}/costs", cost, Ct);

    private static long Id(JsonElement shipment) => shipment.GetProperty("purchaseId").GetInt64();
    private static string Invoice(JsonElement shipment) => shipment.GetProperty("invoiceNo").GetString()!;

    private async Task FundTillAsync(Refs refs, decimal amount)
    {
        var response = await Admin.PostAsJsonAsync("/api/receipts", new { type = "RECEIPT", partnerId = refs.Shipper, treasuryId = refs.Till, amount, exchangeRate = 1m }, Ct);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    private Task<decimal> TillBalanceAsync(Refs refs) => SumAsync($"SELECT COALESCE(SUM(ForeignDebit-ForeignCredit),0) FROM dbo.Transactions WHERE TreasuryId={refs.Till}");

    private Task<decimal> ShipperOwesAsync(Refs refs, long id) =>
        SumAsync($"SELECT COALESCE(SUM(t.ForeignCredit-t.ForeignDebit),0) FROM dbo.Transactions t JOIN dbo.Purchases p ON t.RefNo LIKE p.InvoiceNo+N':COST:%' WHERE p.PurchaseId={id} AND t.PartnerId={refs.Shipper}");

    private Task<decimal> BatchLeftAsync(long id, string batch) =>
        SumAsync($"SELECT COALESCE(SUM(sm.Quantity),0) FROM dbo.StockMovements sm JOIN dbo.PurchaseLines pl ON pl.PurchaseLineId=sm.PurchaseLineId WHERE pl.PurchaseId={id} AND pl.BatchNo=N'{batch}' AND sm.PostingStatus=N'POSTED'");

    private Task<decimal> SumAsync(string sql) => fixture.Database.ScalarAsync<decimal>(sql, Ct);

    private async Task<Refs> SeedAsync()
    {
        await fixture.Database.ExecuteAsync($"""
            IF NOT EXISTS (SELECT 1 FROM dbo.Currencies WHERE CurrencyCode=N'PRI')
                INSERT dbo.Currencies(CurrencyCode,CurrencyNameEn,CurrencyNameAr,Symbol,IsPrimary) VALUES(N'PRI',N'Primary',N'أساسية',N'P',1);
            IF NOT EXISTS (SELECT 1 FROM dbo.Countries WHERE NameEn=N'Import land')
                INSERT dbo.Countries(NameAr,NameEn) VALUES(N'بلد الاستيراد',N'Import land');
            IF NOT EXISTS (SELECT 1 FROM dbo.Partners WHERE PartnerCode=N'P-SHIP')
                INSERT dbo.Partners(PartnerCode,PartnerName,PartnerTypeSettingId) SELECT N'P-SHIP',N'Shipping line',PartnerTypeSettingId FROM dbo.Partners WHERE PartnerCode=N'P-SEC';
            IF NOT EXISTS (SELECT 1 FROM dbo.Treasuries WHERE TreasuryCode=N'T-IMP')
                INSERT dbo.Treasuries(TreasuryCode,NameAr,NameEn,CurrencyId,BranchId) SELECT N'T-IMP',N'خزنة الاستيراد',N'Import till',CurrencyId,{fixture.BranchA} FROM dbo.Currencies WHERE CurrencyCode=N'PRI';
            IF NOT EXISTS (SELECT 1 FROM dbo.Settings WHERE Code=N'U-FIN')
                INSERT dbo.Settings(SettingTypeId,ParentSettingId,Code,ValueAr,ValueEn,SortOrder,IsActive) SELECT SettingTypeId,NULL,N'U-FIN',N'حبة',N'Piece',99,1 FROM dbo.SettingTypes WHERE Code=N'UNIT';
            IF NOT EXISTS (SELECT 1 FROM dbo.Accounts WHERE AccountCode=N'2200')
                INSERT dbo.Accounts(BranchId,AccountCode,NameAr,NameEn,AccountType) VALUES({fixture.BranchA},N'2200',N'مستحقات تكاليف الاستيراد',N'Accrued import costs',N'LIABILITY');
            """, "import seed", Ct);
        return new(
            await fixture.Database.CountAsync("SELECT CurrencyId FROM dbo.Currencies WHERE CurrencyCode=N'PRI'", Ct),
            await fixture.Database.CountAsync("SELECT CurrencyId FROM dbo.Currencies WHERE CurrencyCode=N'TST'", Ct),
            await fixture.Database.CountAsync("SELECT PartnerId FROM dbo.Partners WHERE PartnerCode=N'P-SEC'", Ct),
            await fixture.Database.CountAsync("SELECT PartnerId FROM dbo.Partners WHERE PartnerCode=N'P-SHIP'", Ct),
            await fixture.Database.CountAsync("SELECT CountryId FROM dbo.Countries WHERE NameEn=N'Import land'", Ct),
            await fixture.Database.CountAsync("SELECT TreasuryId FROM dbo.Treasuries WHERE TreasuryCode=N'T-IMP'", Ct));
    }

    private async Task<long> NewItemAsync(string code)
    {
        var unit = await fixture.Database.CountAsync("SELECT SettingId FROM dbo.Settings WHERE Code=N'U-FIN'", Ct);
        await fixture.Database.ExecuteAsync($"INSERT dbo.Items(ItemCode,NameAr,NameEn,SellPrice) VALUES(N'{code}',N'{code}',N'{code}',10); INSERT dbo.ItemUnits(ItemId,UnitSettingId,ConversionToBase,IsBase) VALUES(SCOPE_IDENTITY(),{unit},1,1);", "item", Ct);
        return await fixture.Database.ScalarAsync<long>($"SELECT ItemId FROM dbo.Items WHERE ItemCode=N'{code}'", Ct);
    }

    private Task<int> StockAsync(long item) => fixture.Database.CountAsync($"SELECT COALESCE(SUM(Quantity),0) FROM dbo.StockMovements WHERE ItemId={item} AND BranchId={fixture.BranchA} AND PostingStatus=N'POSTED'", Ct);
}
