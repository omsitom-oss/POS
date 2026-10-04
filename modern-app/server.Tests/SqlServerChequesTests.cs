using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ElitePos.LocalService.Security;

namespace ElitePos.LocalService.Tests;

// Received and issued cheques against the real SQL Server schema: vouchers, status moves, journals, history and branch scoping.
[Collection(SqlServerCollection.Name)]
public sealed class SqlServerChequesTests(SqlServerApiFixture fixture) : IClassFixture<SqlServerApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;
    private static void SkipWithoutSqlServer() => Assert.SkipWhen(string.IsNullOrWhiteSpace(SqlServerApiFixture.ServerConnectionString), "POS_TEST_SQLSERVER is not set.");
    private HttpClient Admin => fixture.Client(fixture.AdminToken);
    private static string Today => DateTime.UtcNow.ToString("yyyy-MM-dd");

    [Fact]
    public async Task A_received_cheque_settles_the_customer_at_once_and_reaches_the_bank_only_when_it_clears()
    {
        SkipWithoutSqlServer();
        var partner = await PartnerAsync();
        var bank = await BankAsync();
        var partnerBefore = await PartnerBalanceAsync(partner);
        var bankBefore = await TreasuryBalanceAsync(bank);

        var voucher = await ChequeVoucherAsync("RECEIPT", partner, "IN-1001", 250m);
        var voucherNo = voucher.GetProperty("receiptNo").GetString()!;
        Assert.StartsWith("CHQ-IN-", voucherNo);
        Assert.Equal("CHEQUE", voucher.GetProperty("method").GetString());
        Assert.Equal(partnerBefore - 250m, await PartnerBalanceAsync(partner));
        Assert.Equal(bankBefore, await TreasuryBalanceAsync(bank));
        Assert.Equal(250m, await fixture.Database.ScalarAsync<decimal>($"SELECT Debit FROM dbo.Transactions WHERE RefNo=N'{voucherNo}' AND AccountId=N'1250' AND TreasuryId IS NULL", Ct));

        var receipts = await Admin.GetFromJsonAsync<JsonElement[]>("/api/receipts?type=RECEIPT", Ct);
        var listed = receipts!.Single(row => row.GetProperty("receiptNo").GetString() == voucherNo);
        Assert.Equal("CHEQUE", listed.GetProperty("method").GetString());
        Assert.Equal("IN-1001", listed.GetProperty("chequeNo").GetString());
        Assert.Equal(bank, listed.GetProperty("treasuryId").GetInt32());

        var id = voucher.GetProperty("chequeId").GetInt32();
        var cheque = (await Admin.GetFromJsonAsync<JsonElement[]>("/api/cheques?direction=IN&status=PENDING", Ct))!.Single(row => row.GetProperty("chequeId").GetInt32() == id);
        Assert.Equal("IN-1001", cheque.GetProperty("chequeNo").GetString());

        var deposited = await ActAsync(id, "DEPOSIT", note: "Slip 55");
        Assert.Equal("DEPOSITED", deposited.GetProperty("cheque").GetProperty("status").GetString());
        Assert.Equal(bankBefore, await TreasuryBalanceAsync(bank));

        var cleared = await ActAsync(id, "CLEAR");
        Assert.Equal("CLEARED", cleared.GetProperty("cheque").GetProperty("status").GetString());
        Assert.Equal("admin", cleared.GetProperty("cheque").GetProperty("statusByName").GetString());
        Assert.Equal(bankBefore + 250m, await TreasuryBalanceAsync(bank));
        Assert.Equal(0m, await fixture.Database.ScalarAsync<decimal>($"SELECT SUM(Debit-Credit) FROM dbo.Transactions WHERE RefNo=N'{voucherNo}' AND AccountId=N'1250'", Ct));
        // Dated the day it happened, not the due date, and both lines carry the branch.
        Assert.Equal(0, await fixture.Database.CountAsync($"SELECT COUNT(*) FROM dbo.Transactions WHERE TransactionType=N'CHEQUE_CLEAR' AND RefNo=N'{voucherNo}' AND (TransactionDate<>CONVERT(date,SYSUTCDATETIME()) OR BranchId IS NULL OR BranchId<>{fixture.BranchA})", Ct));
        Assert.Equal(partnerBefore - 250m, await PartnerBalanceAsync(partner));

        var events = cleared.GetProperty("events").EnumerateArray().ToArray();
        Assert.Equal(["PENDING", "DEPOSITED", "CLEARED"], events.Select(e => e.GetProperty("toStatus").GetString()));
        Assert.Equal("Slip 55", events[1].GetProperty("note").GetString());
        Assert.All(events, e => Assert.Equal("admin", e.GetProperty("savedByName").GetString()));

        var again = await Admin.PostAsJsonAsync($"/api/cheques/{id}/actions", new { action = "CLEAR" }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, again.StatusCode);
    }

    [Fact]
    public async Task A_bounced_received_cheque_reopens_the_customer_balance_even_after_it_cleared()
    {
        SkipWithoutSqlServer();
        var partner = await PartnerAsync();
        var bank = await BankAsync();
        var partnerBefore = await PartnerBalanceAsync(partner);
        var bankBefore = await TreasuryBalanceAsync(bank);

        var pending = (await ChequeVoucherAsync("RECEIPT", partner, "IN-2001", 80m)).GetProperty("chequeId").GetInt32();
        Assert.Equal("BOUNCED", (await ActAsync(pending, "BOUNCE", note: "Insufficient funds")).GetProperty("cheque").GetProperty("status").GetString());
        Assert.Equal(partnerBefore, await PartnerBalanceAsync(partner));

        var handedBack = (await ChequeVoucherAsync("RECEIPT", partner, "IN-2002", 30m)).GetProperty("chequeId").GetInt32();
        Assert.Equal("RETURNED", (await ActAsync(handedBack, "RETURN")).GetProperty("cheque").GetProperty("status").GetString());
        Assert.Equal(partnerBefore, await PartnerBalanceAsync(partner));

        var cleared = (await ChequeVoucherAsync("RECEIPT", partner, "IN-2003", 45m)).GetProperty("chequeId").GetInt32();
        await ActAsync(cleared, "CLEAR");
        Assert.Equal(bankBefore + 45m, await TreasuryBalanceAsync(bank));
        await ActAsync(cleared, "BOUNCE");
        Assert.Equal(bankBefore, await TreasuryBalanceAsync(bank));
        Assert.Equal(partnerBefore, await PartnerBalanceAsync(partner));

        // A bounced cheque is final, and a received cheque is returned rather than cancelled.
        Assert.Equal(HttpStatusCode.BadRequest, (await Admin.PostAsJsonAsync($"/api/cheques/{pending}/actions", new { action = "CLEAR" }, Ct)).StatusCode);
        var cancel = await Admin.PostAsJsonAsync($"/api/cheques/{(await ChequeVoucherAsync("RECEIPT", partner, "IN-2004", 5m)).GetProperty("chequeId").GetInt32()}/actions", new { action = "CANCEL" }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, cancel.StatusCode);
        Assert.Contains("returned to the customer", await cancel.Content.ReadAsStringAsync(Ct));
    }

    [Fact]
    public async Task An_issued_cheque_pays_the_supplier_through_cheques_payable_and_can_be_cancelled()
    {
        SkipWithoutSqlServer();
        var partner = await PartnerAsync();
        var bank = await BankAsync();
        var partnerBefore = await PartnerBalanceAsync(partner);
        var bankBefore = await TreasuryBalanceAsync(bank);

        var voucher = await ChequeVoucherAsync("PAYMENT", partner, "OUT-3001", 120m);
        var voucherNo = voucher.GetProperty("receiptNo").GetString()!;
        Assert.StartsWith("CHQ-OUT-", voucherNo);
        Assert.Equal(partnerBefore + 120m, await PartnerBalanceAsync(partner));
        Assert.Equal(120m, await fixture.Database.ScalarAsync<decimal>($"SELECT Credit FROM dbo.Transactions WHERE RefNo=N'{voucherNo}' AND AccountId=N'2150'", Ct));
        var id = voucher.GetProperty("chequeId").GetInt32();
        Assert.Equal(HttpStatusCode.BadRequest, (await Admin.PostAsJsonAsync($"/api/cheques/{id}/actions", new { action = "DEPOSIT" }, Ct)).StatusCode);
        await ActAsync(id, "CLEAR");
        Assert.Equal(bankBefore - 120m, await TreasuryBalanceAsync(bank));
        Assert.Equal(0m, await fixture.Database.ScalarAsync<decimal>($"SELECT SUM(Debit-Credit) FROM dbo.Transactions WHERE RefNo=N'{voucherNo}' AND AccountId=N'2150'", Ct));

        var cancelled = (await ChequeVoucherAsync("PAYMENT", partner, "OUT-3002", 60m)).GetProperty("chequeId").GetInt32();
        Assert.Equal("CANCELLED", (await ActAsync(cancelled, "CANCEL", note: "Wrong amount")).GetProperty("cheque").GetProperty("status").GetString());
        Assert.Equal(partnerBefore + 120m, await PartnerBalanceAsync(partner));
        Assert.Equal(bankBefore - 120m, await TreasuryBalanceAsync(bank));
        // Once cancelled, the cheque number can be written again.
        Assert.Equal(HttpStatusCode.Created, (await PostChequeVoucherAsync("PAYMENT", partner, "OUT-3002", 60m)).StatusCode);
    }

    [Fact]
    public async Task Cheque_vouchers_and_moves_are_validated()
    {
        SkipWithoutSqlServer();
        var partner = await PartnerAsync();
        var bank = await BankAsync();
        async Task<string> Refused(object body, HttpStatusCode status = HttpStatusCode.BadRequest)
        {
            var response = await Admin.PostAsJsonAsync("/api/receipts", body, Ct);
            Assert.Equal(status, response.StatusCode);
            return await response.Content.ReadAsStringAsync(Ct);
        }
        Assert.Contains("cheque number", await Refused(new { type = "RECEIPT", method = "CHEQUE", partnerId = partner, treasuryId = bank, amount = 10m, exchangeRate = 1m, chequeDueDate = Today }));
        Assert.Contains("due date", await Refused(new { type = "RECEIPT", method = "CHEQUE", chequeNo = "X-1", partnerId = partner, treasuryId = bank, amount = 10m, exchangeRate = 1m }));
        Assert.Contains("CASH or CHEQUE", await Refused(new { type = "RECEIPT", method = "CARD", partnerId = partner, treasuryId = bank, amount = 10m, exchangeRate = 1m }));

        var first = await ChequeVoucherAsync("RECEIPT", partner, "DUP-1", 10m);
        Assert.Contains(first.GetProperty("receiptNo").GetString()!, await Refused(new { type = "RECEIPT", method = "CHEQUE", chequeNo = " DUP-1 ", chequeDueDate = Today, partnerId = partner, treasuryId = bank, amount = 10m, exchangeRate = 1m }, HttpStatusCode.Conflict));

        var id = first.GetProperty("chequeId").GetInt32();
        var early = await Admin.PostAsJsonAsync($"/api/cheques/{id}/actions", new { action = "CLEAR", date = DateTime.UtcNow.AddDays(-3) }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, early.StatusCode);
        Assert.Contains("before the voucher date", await early.Content.ReadAsStringAsync(Ct));
        Assert.Equal(HttpStatusCode.BadRequest, (await Admin.PostAsJsonAsync($"/api/cheques/{id}/actions", new { action = "LOSE" }, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Admin.PostAsJsonAsync("/api/cheques/999999/actions", new { action = "CLEAR" }, Ct)).StatusCode);
        Assert.Equal("PENDING", (await Admin.GetFromJsonAsync<JsonElement>($"/api/cheques/{id}", Ct)).GetProperty("cheque").GetProperty("status").GetString());
    }

    [Fact]
    public async Task A_cheque_uses_a_bank_treasury_and_a_deposit_can_move_it_to_another_bank()
    {
        SkipWithoutSqlServer();
        var partner = await PartnerAsync();
        var bank = await BankAsync();
        var cashTill = fixture.TreasuryA;
        var refused = await Admin.PostAsJsonAsync("/api/receipts", new { type = "RECEIPT", method = "CHEQUE", chequeNo = "CASH-1", chequeDueDate = Today, partnerId = partner, treasuryId = cashTill, amount = 10m, exchangeRate = 1m }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
        Assert.Contains("bank treasury", await refused.Content.ReadAsStringAsync(Ct));

        var second = await BankAsync("T-CHQ-BANK2");
        var secondBefore = await TreasuryBalanceAsync(second);
        var id = (await ChequeVoucherAsync("RECEIPT", partner, "MOVE-1", 70m)).GetProperty("chequeId").GetInt32();
        var toCash = await Admin.PostAsJsonAsync($"/api/cheques/{id}/actions", new { action = "DEPOSIT", treasuryId = cashTill }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, toCash.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Admin.PostAsJsonAsync($"/api/cheques/{id}/actions", new { action = "CLEAR", treasuryId = second }, Ct)).StatusCode);

        var deposited = await Admin.PostAsJsonAsync($"/api/cheques/{id}/actions", new { action = "DEPOSIT", treasuryId = second }, Ct);
        Assert.Equal(HttpStatusCode.OK, deposited.StatusCode);
        var body = await deposited.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal(second, body.GetProperty("cheque").GetProperty("treasuryId").GetInt32());
        Assert.Equal(second, body.GetProperty("events").EnumerateArray().Last().GetProperty("treasuryId").GetInt32());
        await ActAsync(id, "CLEAR");
        Assert.Equal(secondBefore + 70m, await TreasuryBalanceAsync(second));
        Assert.NotEqual(bank, second);
    }

    [Fact]
    public async Task Another_branchs_cheques_are_not_found_and_moving_them_needs_the_permission()
    {
        SkipWithoutSqlServer();
        var partner = await PartnerAsync();
        var bank = await BankAsync();
        var id = (await ChequeVoucherAsync("RECEIPT", partner, "BR-1", 15m)).GetProperty("chequeId").GetInt32();

        var (other, _, _) = await fixture.CreateUserAsync("cheques-branch-b", fixture.BranchB, PermissionCodes.TreasuryView, PermissionCodes.ChequesManage);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/cheques/{id}", Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.PostAsJsonAsync($"/api/cheques/{id}/actions", new { action = "CLEAR" }, Ct)).StatusCode);
        Assert.DoesNotContain(await other.GetFromJsonAsync<JsonElement[]>("/api/cheques", Ct) ?? [], row => row.GetProperty("chequeId").GetInt32() == id);

        var (viewer, _, _) = await fixture.CreateUserAsync("cheques-viewer", fixture.BranchA, PermissionCodes.TreasuryView);
        Assert.Equal(HttpStatusCode.OK, (await viewer.GetAsync($"/api/cheques/{id}", Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await viewer.PostAsJsonAsync($"/api/cheques/{id}/actions", new { action = "CLEAR" }, Ct)).StatusCode);
    }

    // A bank treasury in branch A, in the fixture currency. Safe to run more than once.
    private async Task<int> BankAsync(string code = "T-CHQ-BANK")
    {
        await fixture.Database.ExecuteAsync($"""
            IF NOT EXISTS (SELECT 1 FROM dbo.Banks WHERE BankCode=N'CHQ-BANK')
                INSERT dbo.Banks(BankCode,NameAr,NameEn) VALUES(N'CHQ-BANK',N'بنك الشيكات',N'Cheque bank');
            IF NOT EXISTS (SELECT 1 FROM dbo.Treasuries WHERE TreasuryCode=N'{code}')
                INSERT dbo.Treasuries(TreasuryCode,NameAr,NameEn,TreasureType,BankId,CurrencyId,BranchId) SELECT N'{code}',N'{code}',N'{code}',N'BANK',BankId,{fixture.CurrencyId},{fixture.BranchA} FROM dbo.Banks WHERE BankCode=N'CHQ-BANK';
            """, "cheque bank", Ct);
        return await fixture.Database.CountAsync($"SELECT TreasuryId FROM dbo.Treasuries WHERE TreasuryCode=N'{code}'", Ct);
    }

    private async Task<int> PartnerAsync() => await fixture.Database.CountAsync("SELECT PartnerId FROM dbo.Partners WHERE PartnerCode=N'P-SEC'", Ct);

    private async Task<HttpResponseMessage> PostChequeVoucherAsync(string type, int partner, string chequeNo, decimal amount) =>
        await Admin.PostAsJsonAsync("/api/receipts", new { type, method = "CHEQUE", chequeNo, chequeDueDate = DateTime.UtcNow.AddDays(30).ToString("yyyy-MM-dd"), partnerId = partner, treasuryId = await BankAsync(), amount, exchangeRate = 1m }, Ct);

    private async Task<JsonElement> ChequeVoucherAsync(string type, int partner, string chequeNo, decimal amount)
    {
        var response = await PostChequeVoucherAsync(type, partner, chequeNo, amount);
        Assert.True(response.StatusCode == HttpStatusCode.Created, await response.Content.ReadAsStringAsync(Ct));
        return await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
    }

    private async Task<JsonElement> ActAsync(int id, string action, string? note = null)
    {
        var response = await Admin.PostAsJsonAsync($"/api/cheques/{id}/actions", new { action, note }, Ct);
        Assert.True(response.StatusCode == HttpStatusCode.OK, await response.Content.ReadAsStringAsync(Ct));
        return await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
    }

    private async Task<decimal> PartnerBalanceAsync(int partner) =>
        (await Admin.GetFromJsonAsync<JsonElement>($"/api/transactions/partner/{partner}/balance?currencyId={fixture.CurrencyId}", Ct)).GetProperty("amount").GetDecimal();

    private Task<decimal> TreasuryBalanceAsync(int treasury) =>
        fixture.Database.ScalarAsync<decimal>($"SELECT COALESCE(SUM(Debit-Credit),0) FROM dbo.Transactions WHERE TreasuryId={treasury}", Ct);
}
