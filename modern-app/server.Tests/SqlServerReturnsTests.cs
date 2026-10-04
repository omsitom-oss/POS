using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ElitePos.LocalService.Security;

namespace ElitePos.LocalService.Tests;

// Sales and purchase returns against the real SQL Server schema: limits, stock, journals, approval and branch scoping.
// Each test buys and sells its own items, so stock checks do not depend on test order.
[Collection(SqlServerCollection.Name)]
public sealed class SqlServerReturnsTests(SqlServerApiFixture fixture) : IClassFixture<SqlServerApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;
    private static void SkipWithoutSqlServer() => Assert.SkipWhen(string.IsNullOrWhiteSpace(SqlServerApiFixture.ServerConnectionString), "POS_TEST_SQLSERVER is not set.");
    private HttpClient Admin => fixture.Client(fixture.AdminToken);

    [Fact]
    public async Task A_sales_return_refunds_the_discounted_amount_restocks_and_posts_the_journal()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var x = await NewItemAsync("SR-X"); var y = await NewItemAsync("SR-Y");
        await BuyAsync(refs, 0, (x, 10, 5m, null), (y, 4, 20m, null));
        // Subtotal 62, discount 2, total 60.
        var sale = await SellAsync(refs, 2, (x, 4, 8m), (y, 1, 30m));
        var source = await Admin.GetFromJsonAsync<JsonElement>($"/api/sales-returns/invoices/{sale.Id}", Ct);
        var lines = source.GetProperty("lines").EnumerateArray().ToArray();
        Assert.Equal([4m, 1m], lines.Select(line => line.GetProperty("returnableQuantity").GetDecimal()));
        long LineOf(long item) => lines.Single(line => line.GetProperty("itemId").GetInt64() == item).GetProperty("saleLineId").GetInt64();

        // 2 of X at 8 = 16 gross; its share of the discount is 2 * 16 / 62.
        var first = await Admin.PostAsJsonAsync("/api/sales-returns", new { saleId = sale.Id, reason = "Damaged box", lines = new[] { new { lineId = LineOf(x), quantity = 2m } } }, Ct);
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        var firstBody = await first.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal(15.48m, firstBody.GetProperty("total").GetDecimal());
        Assert.Equal(16m, firstBody.GetProperty("subtotal").GetDecimal());
        var returnNo = firstBody.GetProperty("returnNo").GetString()!;
        Assert.StartsWith($"SR-{fixture.BranchA}-", returnNo);
        Assert.Equal(10 - 4 + 2, await StockAsync(x));

        Assert.Equal(15.48m, await fixture.Database.ScalarAsync<decimal>($"SELECT Debit FROM dbo.Transactions WHERE RefNo=N'{returnNo}' AND AccountId=N'4100'", Ct));
        Assert.Equal(15.48m, await fixture.Database.ScalarAsync<decimal>($"SELECT Credit FROM dbo.Transactions WHERE RefNo=N'{returnNo}' AND TreasuryId={refs.Treasury} AND BranchId={fixture.BranchA}", Ct));

        var tooMany = await Admin.PostAsJsonAsync("/api/sales-returns", new { saleId = sale.Id, lines = new[] { new { lineId = LineOf(x), quantity = 3m } } }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, tooMany.StatusCode);
        Assert.Contains("Only 2", await tooMany.Content.ReadAsStringAsync(Ct));

        // Returning everything left refunds exactly what is left of the invoice total.
        var rest = await Admin.PostAsJsonAsync("/api/sales-returns", new { saleId = sale.Id, lines = new[] { new { lineId = LineOf(x), quantity = 2m }, new { lineId = LineOf(y), quantity = 1m } } }, Ct);
        Assert.Equal(HttpStatusCode.Created, rest.StatusCode);
        Assert.Equal(60m - 15.48m, (await rest.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("total").GetDecimal());
        Assert.Equal(10, await StockAsync(x));
        var open = await Admin.GetFromJsonAsync<JsonElement[]>($"/api/sales-returns/invoices?search={sale.No}", Ct);
        Assert.Empty(open!);
        var list = await Admin.GetFromJsonAsync<JsonElement[]>("/api/sales-returns", Ct);
        Assert.Equal(2, list!.Count(row => row.GetProperty("saleNo").GetString() == sale.No));
    }

    [Fact]
    public async Task A_customer_sale_goes_on_account_without_a_treasury_and_its_return_credits_the_customer()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var customer = await CustomerAsync();
        var x = await NewItemAsync("SR-ACC");
        await BuyAsync(refs, 0, (x, 5, 5m, null));

        // A customer sale cannot take a till, and a walk-in sale cannot skip one.
        var withTill = await Admin.PostAsJsonAsync("/api/sales", new { customerPartnerId = customer, treasuryId = refs.Treasury, currencyId = refs.Currency, lines = new[] { new { itemId = x, quantity = 1m, unitPrice = 8m } } }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, withTill.StatusCode);
        Assert.Contains("customer's account", await withTill.Content.ReadAsStringAsync(Ct));
        // A supplier-only partner is not a customer, so nothing can be sold to it on account.
        var toSupplier = await Admin.PostAsJsonAsync("/api/sales", new { customerPartnerId = await SupplierOnlyAsync(), currencyId = refs.Currency, lines = new[] { new { itemId = x, quantity = 1m, unitPrice = 8m } } }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, toSupplier.StatusCode);
        Assert.Contains("supplier", await toSupplier.Content.ReadAsStringAsync(Ct));
        var walkInWithoutTill = await Admin.PostAsJsonAsync("/api/sales", new { currencyId = refs.Currency, lines = new[] { new { itemId = x, quantity = 1m, unitPrice = 8m } } }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, walkInWithoutTill.StatusCode);

        var response = await Admin.PostAsJsonAsync("/api/sales", new { customerPartnerId = customer, currencyId = refs.Currency, lines = new[] { new { itemId = x, quantity = 3m, unitPrice = 8m } } }, Ct);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        var saleId = body.GetProperty("saleId").GetInt64(); var saleNo = body.GetProperty("saleNo").GetString()!;
        Assert.Equal(0, await fixture.Database.CountAsync($"SELECT COUNT(*) FROM dbo.Sales WHERE SaleId={saleId} AND TreasuryId IS NOT NULL", Ct));
        Assert.Equal(24m, await fixture.Database.ScalarAsync<decimal>($"SELECT Debit FROM dbo.Transactions WHERE RefNo=N'{saleNo}' AND AccountId=N'PARTNER:{customer}' AND PartnerId={customer} AND TreasuryId IS NULL", Ct));
        Assert.Equal(0, await fixture.Database.CountAsync($"SELECT COUNT(*) FROM dbo.Transactions WHERE RefNo=N'{saleNo}' AND TreasuryId IS NOT NULL", Ct));
        Assert.Equal(24m, await CustomerBalanceAsync(customer, refs));
        var listed = await Admin.GetFromJsonAsync<JsonElement[]>("/api/sales", Ct);
        Assert.Equal(JsonValueKind.Null, listed!.Single(row => row.GetProperty("saleNo").GetString() == saleNo).GetProperty("treasuryName").ValueKind);

        var source = await Admin.GetFromJsonAsync<JsonElement>($"/api/sales-returns/invoices/{saleId}", Ct);
        Assert.Equal(JsonValueKind.Null, source.GetProperty("treasuryId").ValueKind);
        Assert.Equal(customer, source.GetProperty("customerPartnerId").GetInt32());
        var line = source.GetProperty("lines")[0].GetProperty("saleLineId").GetInt64();
        var paidOut = await Admin.PostAsJsonAsync("/api/sales-returns", new { saleId, treasuryId = refs.Treasury, lines = new[] { new { lineId = line, quantity = 1m } } }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, paidOut.StatusCode);

        var returned = await Admin.PostAsJsonAsync("/api/sales-returns", new { saleId, lines = new[] { new { lineId = line, quantity = 1m } } }, Ct);
        Assert.Equal(HttpStatusCode.Created, returned.StatusCode);
        var returnBody = await returned.Content.ReadFromJsonAsync<JsonElement>(Ct);
        var returnNo = returnBody.GetProperty("returnNo").GetString()!;
        Assert.Equal(JsonValueKind.Null, returnBody.GetProperty("treasuryId").ValueKind);
        Assert.Equal(8m, await fixture.Database.ScalarAsync<decimal>($"SELECT Credit FROM dbo.Transactions WHERE RefNo=N'{returnNo}' AND AccountId=N'PARTNER:{customer}' AND PartnerId={customer}", Ct));
        Assert.Equal(0, await fixture.Database.CountAsync($"SELECT COUNT(*) FROM dbo.Transactions WHERE RefNo=N'{returnNo}' AND TreasuryId IS NOT NULL", Ct));
        Assert.Equal(16m, await CustomerBalanceAsync(customer, refs));
        var returns = await Admin.GetFromJsonAsync<JsonElement[]>("/api/sales-returns", Ct);
        Assert.Equal(JsonValueKind.Null, returns!.Single(row => row.GetProperty("returnNo").GetString() == returnNo).GetProperty("treasuryNameEn").ValueKind);
    }

    [Fact]
    public async Task A_sales_return_refuses_bad_requests_with_a_message()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var x = await NewItemAsync("SR-BAD");
        await BuyAsync(refs, 0, (x, 5, 5m, null));
        var sale = await SellAsync(refs, 0, (x, 2, 8m));
        var line = (await Admin.GetFromJsonAsync<JsonElement>($"/api/sales-returns/invoices/{sale.Id}", Ct)).GetProperty("lines")[0].GetProperty("saleLineId").GetInt64();

        async Task<string> Refused(object body)
        {
            var response = await Admin.PostAsJsonAsync("/api/sales-returns", body, Ct);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            return await response.Content.ReadAsStringAsync(Ct);
        }
        Assert.Contains("at least one line", await Refused(new { saleId = sale.Id, lines = new[] { new { lineId = line, quantity = 0m } } }));
        Assert.Contains("negative", await Refused(new { saleId = sale.Id, lines = new[] { new { lineId = line, quantity = -1m } } }));
        Assert.Contains("not on this invoice", await Refused(new { saleId = sale.Id, lines = new[] { new { lineId = line + 100000, quantity = 1m } } }));
        Assert.Contains("treasury", await Refused(new { saleId = sale.Id, treasuryId = refs.TreasuryB, lines = new[] { new { lineId = line, quantity = 1m } } }));
        Assert.Contains("before the invoice date", await Refused(new { saleId = sale.Id, returnDate = DateTime.UtcNow.AddDays(-5), lines = new[] { new { lineId = line, quantity = 1m } } }));
        Assert.Equal(3, await StockAsync(x));
        Assert.Equal(HttpStatusCode.NotFound, (await Admin.PostAsJsonAsync("/api/sales-returns", new { saleId = 999999, lines = new[] { new { lineId = line, quantity = 1m } } }, Ct)).StatusCode);
    }

    [Fact]
    public async Task Another_branchs_invoices_and_returns_are_not_found()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var x = await NewItemAsync("SR-BR");
        await BuyAsync(refs, 0, (x, 5, 5m, null));
        var sale = await SellAsync(refs, 0, (x, 2, 8m));
        var line = (await Admin.GetFromJsonAsync<JsonElement>($"/api/sales-returns/invoices/{sale.Id}", Ct)).GetProperty("lines")[0].GetProperty("saleLineId").GetInt64();
        var created = await (await Admin.PostAsJsonAsync("/api/sales-returns", new { saleId = sale.Id, lines = new[] { new { lineId = line, quantity = 1m } } }, Ct)).Content.ReadFromJsonAsync<JsonElement>(Ct);

        var (other, _, _) = await fixture.CreateUserAsync("returns-branch-b", fixture.BranchB, PermissionCodes.SalesView, PermissionCodes.SalesReturn);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/sales-returns/invoices/{sale.Id}", Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/sales-returns/{created.GetProperty("salesReturnId").GetInt64()}", Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.PostAsJsonAsync("/api/sales-returns", new { saleId = sale.Id, lines = new[] { new { lineId = line, quantity = 1m } } }, Ct)).StatusCode);
        Assert.DoesNotContain(await other.GetFromJsonAsync<JsonElement[]>("/api/sales-returns/invoices", Ct) ?? [], row => row.GetProperty("invoiceId").GetInt64() == sale.Id);
        Assert.Empty(await other.GetFromJsonAsync<JsonElement[]>("/api/sales-returns", Ct) ?? []);
        Assert.Equal(5 - 2 + 1, await StockAsync(x));
    }

    [Fact]
    public async Task A_purchase_return_waits_for_approval_then_takes_stock_out_and_reduces_the_supplier_balance()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var x = await NewItemAsync("PR-X"); var y = await NewItemAsync("PR-Y");
        // Subtotal 10*5 + 4*25 = 150, discount 10, total 140.
        var purchase = await BuyAsync(refs, 10, (x, 10, 5m, "BATCH-X"), (y, 4, 25m, null));
        var source = await Admin.GetFromJsonAsync<JsonElement>($"/api/purchase-returns/invoices/{purchase}", Ct);
        Assert.True(source.GetProperty("requiresApproval").GetBoolean());
        var lineX = source.GetProperty("lines").EnumerateArray().Single(line => line.GetProperty("itemId").GetInt64() == x);
        Assert.Equal("BATCH-X", lineX.GetProperty("batchNo").GetString());
        var supplierBefore = await SupplierBalanceAsync(refs);

        var created = await Admin.PostAsJsonAsync("/api/purchase-returns", new { purchaseId = purchase, reason = "Short expiry", lines = new[] { new { lineId = lineX.GetProperty("purchaseLineId").GetInt64(), quantity = 3m } } }, Ct);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var pending = await created.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal("PENDING", pending.GetProperty("status").GetString());
        // 3 at 5 = 15 gross; discount share 10 * 15 / 150 = 1.
        Assert.Equal(14m, pending.GetProperty("total").GetDecimal());
        var returnNo = pending.GetProperty("returnNo").GetString()!;
        Assert.StartsWith($"PR-{fixture.BranchA}-", returnNo);
        Assert.Equal(10, await StockAsync(x));
        Assert.Equal(0, await fixture.Database.CountAsync($"SELECT COUNT(*) FROM dbo.Transactions WHERE RefNo=N'{returnNo}'", Ct));
        // The pending quantity is reserved, so it cannot be returned twice.
        var reserved = await Admin.GetFromJsonAsync<JsonElement>($"/api/purchase-returns/invoices/{purchase}", Ct);
        Assert.Equal(7m, reserved.GetProperty("lines").EnumerateArray().Single(line => line.GetProperty("itemId").GetInt64() == x).GetProperty("returnableQuantity").GetDecimal());

        var (clerk, _, _) = await fixture.CreateUserAsync("returns-clerk", fixture.BranchA, PermissionCodes.PurchasesView, PermissionCodes.PurchaseReturn);
        var id = pending.GetProperty("purchaseReturnId").GetInt64();
        Assert.Equal(HttpStatusCode.Forbidden, (await clerk.PostAsJsonAsync($"/api/purchase-returns/{id}/approve", new { }, Ct)).StatusCode);

        // Requested on an earlier day: once approved, the return and its journal both carry the approval date.
        await fixture.Database.ExecuteAsync($"UPDATE dbo.PurchaseReturns SET ReturnDate=DATEADD(day,-3,ReturnDate) WHERE PurchaseReturnId={id}", "backdate return", Ct);
        var approved = await Admin.PostAsJsonAsync($"/api/purchase-returns/{id}/approve", new { note = "Supplier agreed" }, Ct);
        Assert.Equal(HttpStatusCode.OK, approved.StatusCode);
        Assert.Equal("POSTED", (await approved.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("status").GetString());
        Assert.Equal(7, await StockAsync(x));
        Assert.Equal(14m, await fixture.Database.ScalarAsync<decimal>($"SELECT Debit FROM dbo.Transactions WHERE RefNo=N'{returnNo}' AND AccountId=N'2100' AND PartnerId={refs.Supplier}", Ct));
        Assert.Equal(14m, await fixture.Database.ScalarAsync<decimal>($"SELECT Credit FROM dbo.Transactions WHERE RefNo=N'{returnNo}' AND AccountId=N'1300'", Ct));
        Assert.Equal(supplierBefore + 14m, await SupplierBalanceAsync(refs));
        Assert.Equal(0, await fixture.Database.CountAsync($"SELECT COUNT(*) FROM dbo.Transactions t JOIN dbo.PurchaseReturns r ON r.ReturnNo=t.RefNo WHERE t.RefNo=N'{returnNo}' AND (t.TransactionDate<>r.ReturnDate OR r.ReturnDate<>CONVERT(date,SYSUTCDATETIME()))", Ct));
        Assert.Equal(HttpStatusCode.BadRequest, (await Admin.PostAsJsonAsync($"/api/purchase-returns/{id}/approve", new { }, Ct)).StatusCode);
        var batches = await Admin.GetFromJsonAsync<JsonElement[]>($"/api/inventory/{x}/batches", Ct);
        Assert.Equal(7m, batches!.Single().GetProperty("availableQuantity").GetDecimal());
    }

    [Fact]
    public async Task A_purchase_return_cannot_take_out_stock_that_was_already_sold()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var x = await NewItemAsync("PR-SOLD");
        var purchase = await BuyAsync(refs, 0, (x, 5, 5m, null));
        await SellAsync(refs, 0, (x, 4, 8m));
        var line = (await Admin.GetFromJsonAsync<JsonElement>($"/api/purchase-returns/invoices/{purchase}", Ct)).GetProperty("lines")[0];
        Assert.Equal(1m, line.GetProperty("returnableQuantity").GetDecimal());
        var response = await Admin.PostAsJsonAsync("/api/purchase-returns", new { purchaseId = purchase, lines = new[] { new { lineId = line.GetProperty("purchaseLineId").GetInt64(), quantity = 2m } } }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("in stock", await response.Content.ReadAsStringAsync(Ct));

        // Once the rest is sold too, the invoice drops out of the picker.
        await SellAsync(refs, 0, (x, 1, 8m));
        Assert.DoesNotContain(await Admin.GetFromJsonAsync<JsonElement[]>("/api/purchase-returns/invoices", Ct) ?? [], row => row.GetProperty("invoiceId").GetInt64() == purchase);
    }

    [Fact]
    public async Task Without_approval_a_purchase_return_posts_at_once_and_approval_rechecks_stock()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var x = await NewItemAsync("PR-NOAPP");
        var purchase = await BuyAsync(refs, 0, (x, 6, 5m, null));
        var line = (await Admin.GetFromJsonAsync<JsonElement>($"/api/purchase-returns/invoices/{purchase}", Ct)).GetProperty("lines")[0].GetProperty("purchaseLineId").GetInt64();

        Assert.Equal(HttpStatusCode.OK, (await Admin.PutAsJsonAsync("/api/approvals/PURCHASE_RETURN", new { requiresApproval = false }, Ct)).StatusCode);
        try
        {
            var posted = await (await Admin.PostAsJsonAsync("/api/purchase-returns", new { purchaseId = purchase, lines = new[] { new { lineId = line, quantity = 1m } } }, Ct)).Content.ReadFromJsonAsync<JsonElement>(Ct);
            Assert.Equal("POSTED", posted.GetProperty("status").GetString());
            Assert.Equal(5, await StockAsync(x));
        }
        finally
        {
            await Admin.PutAsJsonAsync("/api/approvals/PURCHASE_RETURN", new { requiresApproval = true }, Ct);
        }

        // A pending return of 4 is fine while 5 are in stock, but not after 3 of them are sold.
        var pending = await (await Admin.PostAsJsonAsync("/api/purchase-returns", new { purchaseId = purchase, lines = new[] { new { lineId = line, quantity = 4m } } }, Ct)).Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal("PENDING", pending.GetProperty("status").GetString());
        // Sales see physical stock, so a pending return does not hold stock back and approval checks again.
        await SellAsync(refs, 0, (x, 3, 8m));
        var approve = await Admin.PostAsJsonAsync($"/api/purchase-returns/{pending.GetProperty("purchaseReturnId").GetInt64()}/approve", new { }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, approve.StatusCode);
        Assert.Equal(2, await StockAsync(x));

        var rejected = await (await Admin.PostAsJsonAsync($"/api/purchase-returns/{pending.GetProperty("purchaseReturnId").GetInt64()}/reject", new { note = "Sold meanwhile" }, Ct)).Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal("REJECTED", rejected.GetProperty("status").GetString());
        var after = (await Admin.GetFromJsonAsync<JsonElement>($"/api/purchase-returns/invoices/{purchase}", Ct)).GetProperty("lines")[0];
        Assert.Equal(1m, after.GetProperty("returnedQuantity").GetDecimal());
        Assert.Equal(2m, after.GetProperty("returnableQuantity").GetDecimal());
    }

    [Fact]
    public async Task Reports_subtract_returns_from_the_margin()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var x = await NewItemAsync("RP-X");
        await BuyAsync(refs, 0, (x, 5, 5m, null));
        var before = await Admin.GetFromJsonAsync<JsonElement>($"/api/reports/summary?branchId={fixture.BranchA}", Ct);
        var sale = await SellAsync(refs, 0, (x, 2, 10m));
        var line = (await Admin.GetFromJsonAsync<JsonElement>($"/api/sales-returns/invoices/{sale.Id}", Ct)).GetProperty("lines")[0].GetProperty("saleLineId").GetInt64();
        await Admin.PostAsJsonAsync("/api/sales-returns", new { saleId = sale.Id, lines = new[] { new { lineId = line, quantity = 1m } } }, Ct);
        var after = await Admin.GetFromJsonAsync<JsonElement>($"/api/reports/summary?branchId={fixture.BranchA}", Ct);
        Assert.Equal(10m, after.GetProperty("salesReturnsTotal").GetDecimal() - before.GetProperty("salesReturnsTotal").GetDecimal());
        // Margin is net sales less cost of goods: 2 sold at 10 cost 2 x 5, 1 returned gives back 10 of sales and 5 of cost.
        Assert.Equal(5m, after.GetProperty("grossMargin").GetDecimal() - before.GetProperty("grossMargin").GetDecimal());
    }

    [Fact]
    public async Task A_sale_moves_its_cost_out_of_inventory_and_a_return_moves_it_back()
    {
        SkipWithoutSqlServer();
        var refs = await SeedAsync();
        var x = await NewItemAsync("RP-COGS");
        await BuyAsync(refs, 0, (x, 5, 4m, null));
        var sale = await SellAsync(refs, 0, (x, 3, 10m));
        var saleNo = await fixture.Database.ScalarAsync<string>($"SELECT SaleNo FROM dbo.Sales WHERE SaleId={sale.Id}", Ct);
        Task<decimal> Sum(string refNo, string account, string column) => fixture.Database.ScalarAsync<decimal>($"SELECT COALESCE(SUM({column}),0) FROM dbo.Transactions WHERE RefNo=N'{refNo}' AND AccountId=N'{account}'", Ct);
        Assert.Equal(12m, await Sum(saleNo, "5050", "Debit"));
        Assert.Equal(12m, await Sum(saleNo, "1300", "Credit"));
        Assert.Equal(30m, await Sum(saleNo, "4100", "Credit"));

        var line = (await Admin.GetFromJsonAsync<JsonElement>($"/api/sales-returns/invoices/{sale.Id}", Ct)).GetProperty("lines")[0].GetProperty("saleLineId").GetInt64();
        var response = await Admin.PostAsJsonAsync("/api/sales-returns", new { saleId = sale.Id, lines = new[] { new { lineId = line, quantity = 1m } } }, Ct);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var returnNo = await fixture.Database.ScalarAsync<string>($"SELECT TOP 1 ReturnNo FROM dbo.SalesReturns WHERE SaleId={sale.Id} ORDER BY SalesReturnId DESC", Ct);
        Assert.Equal(4m, await Sum(returnNo, "1300", "Debit"));
        Assert.Equal(4m, await Sum(returnNo, "5050", "Credit"));

        // Expenses cannot be typed against the cost-of-goods account.
        var expense = await Admin.PostAsJsonAsync("/api/expenses", new { expenseAccountId = "5050", treasuryId = refs.Treasury, amount = 1m, branchId = fixture.BranchA }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, expense.StatusCode);
    }

    private sealed record Refs(int Currency, int Treasury, int TreasuryB, int Supplier, int Unit);

    // A primary currency with one treasury per branch, a supplier and a unit. Safe to run more than once.
    private async Task<Refs> SeedAsync()
    {
        await fixture.Database.ExecuteAsync($"""
            IF NOT EXISTS (SELECT 1 FROM dbo.Currencies WHERE CurrencyCode=N'PRI')
                INSERT dbo.Currencies(CurrencyCode,CurrencyNameEn,CurrencyNameAr,Symbol,IsPrimary) VALUES(N'PRI',N'Primary',N'أساسية',N'P',1);
            DECLARE @currency int = (SELECT CurrencyId FROM dbo.Currencies WHERE CurrencyCode=N'PRI');
            IF NOT EXISTS (SELECT 1 FROM dbo.Treasuries WHERE TreasuryCode=N'T-RET')
                INSERT dbo.Treasuries(TreasuryCode,NameAr,NameEn,CurrencyId,BranchId) VALUES(N'T-RET',N'خزنة المرتجعات',N'Returns till',@currency,{fixture.BranchA}),(N'T-RET-B',N'خزنة ب',N'Returns till B',@currency,{fixture.BranchB});
            IF NOT EXISTS (SELECT 1 FROM dbo.Settings WHERE Code=N'U-RET')
                INSERT dbo.Settings(SettingTypeId,ParentSettingId,Code,ValueAr,ValueEn,SortOrder,IsActive) SELECT SettingTypeId,NULL,N'U-RET',N'حبة',N'Piece',99,1 FROM dbo.SettingTypes WHERE Code=N'UNIT';
            """, "returns seed", Ct);
        return new(
            await fixture.Database.CountAsync("SELECT CurrencyId FROM dbo.Currencies WHERE CurrencyCode=N'PRI'", Ct),
            await fixture.Database.CountAsync("SELECT TreasuryId FROM dbo.Treasuries WHERE TreasuryCode=N'T-RET'", Ct),
            await fixture.Database.CountAsync("SELECT TreasuryId FROM dbo.Treasuries WHERE TreasuryCode=N'T-RET-B'", Ct),
            await fixture.Database.CountAsync("SELECT PartnerId FROM dbo.Partners WHERE PartnerCode=N'P-SEC'", Ct),
            await fixture.Database.CountAsync("SELECT SettingId FROM dbo.Settings WHERE Code=N'U-RET'", Ct));
    }

    private async Task<long> NewItemAsync(string code)
    {
        var unit = await fixture.Database.CountAsync("SELECT SettingId FROM dbo.Settings WHERE Code=N'U-RET'", Ct);
        await fixture.Database.ExecuteAsync($"INSERT dbo.Items(ItemCode,NameAr,NameEn,SellPrice) VALUES(N'{code}',N'{code}',N'{code}',10); INSERT dbo.ItemUnits(ItemId,UnitSettingId,ConversionToBase,IsBase) VALUES(SCOPE_IDENTITY(),{unit},1,1);", "item", Ct);
        return await fixture.Database.ScalarAsync<long>($"SELECT ItemId FROM dbo.Items WHERE ItemCode=N'{code}'", Ct);
    }

    private async Task<long> BuyAsync(Refs refs, decimal discount, params (long Item, decimal Quantity, decimal Price, string? Batch)[] lines)
    {
        var response = await Admin.PostAsJsonAsync("/api/purchases", new { supplierPartnerId = refs.Supplier, currencyId = refs.Currency, status = "POSTED", discount, lines = lines.Select(line => new { itemId = line.Item, quantity = line.Quantity, unitPrice = line.Price, batchNo = line.Batch }) }, Ct);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("purchaseId").GetInt64();
    }

    private async Task<(long Id, string No)> SellAsync(Refs refs, decimal discount, params (long Item, decimal Quantity, decimal Price)[] lines)
    {
        var response = await Admin.PostAsJsonAsync("/api/sales", new { treasuryId = refs.Treasury, currencyId = refs.Currency, discount, lines = lines.Select(line => new { itemId = line.Item, quantity = line.Quantity, unitPrice = line.Price }) }, Ct);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        return (body.GetProperty("saleId").GetInt64(), body.GetProperty("saleNo").GetString()!);
    }

    private Task<int> StockAsync(long item) => fixture.Database.CountAsync($"SELECT COALESCE(SUM(Quantity),0) FROM dbo.StockMovements WHERE ItemId={item} AND BranchId={fixture.BranchA} AND PostingStatus=N'POSTED'", Ct);

    private async Task<int> CustomerAsync()
    {
        await fixture.Database.ExecuteAsync("""
            IF NOT EXISTS (SELECT 1 FROM dbo.Partners WHERE PartnerCode=N'P-ACC')
                INSERT dbo.Partners(PartnerCode,PartnerName,Status,PartnerTypeSettingId) SELECT N'P-ACC',N'Account customer',N'ACTIVE',PartnerTypeSettingId FROM dbo.Partners WHERE PartnerCode=N'P-SEC';
            """, "customer", Ct);
        return await fixture.Database.CountAsync("SELECT PartnerId FROM dbo.Partners WHERE PartnerCode=N'P-ACC'", Ct);
    }

    private async Task<int> SupplierOnlyAsync()
    {
        await fixture.Database.ExecuteAsync("""
            IF NOT EXISTS (SELECT 1 FROM dbo.Partners WHERE PartnerCode=N'P-SUP')
                INSERT dbo.Partners(PartnerCode,PartnerName,Status,PartnerTypeSettingId) SELECT TOP 1 N'P-SUP',N'Supplier only',N'ACTIVE',s.SettingId FROM dbo.Settings s JOIN dbo.SettingTypes t ON t.SettingTypeId=s.SettingTypeId WHERE t.Code=N'PARTNER_TYPE' AND (s.Code=N'SUPPLIER' OR s.ValueEn=N'Supplier') ORDER BY s.SettingId;
            """, "supplier", Ct);
        return await fixture.Database.CountAsync("SELECT PartnerId FROM dbo.Partners WHERE PartnerCode=N'P-SUP'", Ct);
    }

    // Debit minus credit on the customer: what they still owe us.
    private async Task<decimal> CustomerBalanceAsync(int customer, Refs refs)
    {
        var balance = await Admin.GetFromJsonAsync<JsonElement>($"/api/transactions/partner/{customer}/balance?currencyId={refs.Currency}", Ct);
        return balance.GetProperty("amount").GetDecimal();
    }

    // Debit minus credit on the supplier, in the purchase currency: negative while we owe them.
    private async Task<decimal> SupplierBalanceAsync(Refs refs)
    {
        var balance = await Admin.GetFromJsonAsync<JsonElement>($"/api/transactions/partner/{refs.Supplier}/balance?currencyId={refs.Currency}", Ct);
        return balance.GetProperty("amount").GetDecimal();
    }
}
