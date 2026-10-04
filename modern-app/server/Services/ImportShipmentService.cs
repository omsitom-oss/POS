using System.Data;
using System.Data.Common;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

// Import shipments. The supplier is owed the goods in the invoice currency; each additional cost is owed to its own
// payee (a partner, a payable account) or paid on the spot from a treasury. Goods and costs wait in 1350 Goods in
// transit and move to 1300 Inventory when the shipment is received, at a landed cost in the main currency.
// Debit/Credit are always in the main currency; the foreign columns carry the document's own currency.
public sealed class ImportShipmentService(DbConnectionFactory factory, TransactionService transactions)
{
    public const string GoodsInTransit = "1350";
    public const string Inventory = "1300";
    public const string TradeCreditors = "2100";
    private const string IsImport = "(p.PurchaseType=N'IMPORT' OR p.Description LIKE N'IMPORT:%')";
    private static readonly string[] PayeeTypes = ["PARTNER", "TREASURY", "ACCOUNT"];

    public async Task<int?> GetBranchIdAsync(long purchaseId, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        await using var command = Command(db, null, $"SELECT p.BranchId FROM dbo.Purchases p WHERE p.PurchaseId=@id AND {IsImport}");
        Add(command, "@id", purchaseId, DbType.Int64);
        return await command.ExecuteScalarAsync(ct) is { } value and not DBNull ? Convert.ToInt32(value) : null;
    }

    public async Task<IReadOnlyList<ImportPayableAccount>> GetPayableAccountsAsync(CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        // Header accounts (x000) and trade creditors (owed per partner) are not offered as a cost's payable account.
        await using var command = Command(db, null, $"SELECT a.AccountCode,MIN(a.NameAr),MIN(a.NameEn) FROM dbo.Accounts a WHERE a.AccountType=N'LIABILITY' AND a.IsActive=1 AND a.AccountCode NOT LIKE N'_000' AND a.AccountCode<>N'{TradeCreditors}' GROUP BY a.AccountCode ORDER BY a.AccountCode");
        var rows = new List<ImportPayableAccount>();
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) rows.Add(new(reader.GetString(0), reader.GetString(1), reader.GetString(2)));
        return rows;
    }

    public async Task<ImportShipmentDetail?> GetAsync(long id, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        return await ReadDetailAsync(db, null, id, ct);
    }

    public async Task<ImportShipmentDetail> CreateAsync(ImportShipmentWriteRequest request, CancellationToken ct)
    {
        Validate(request);
        await using var db = await OpenAsync(ct);
        await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        long id;
        try
        {
            var branch = request.BranchId ?? throw new ImportShipmentException("A branch is required.");
            var header = await ResolveHeaderAsync(db, tx, request, ct);
            var invoice = await NextInvoiceNoAsync(db, tx, branch, ct);
            await using (var insert = Command(db, tx, "INSERT INTO dbo.Purchases(BranchId,SupplierPartnerId,InvoiceNo,PurchaseDate,Status,CurrencyId,Total,Discount,Description,SavedBy,PurchaseType,ExchangeRateToBase,CountryId,AllocationMethod) OUTPUT INSERTED.PurchaseId VALUES(@branch,@supplier,@invoice,@date,N'DRAFT',@currency,0,0,@description,@saved,N'IMPORT',@rate,@country,@allocation)"))
            {
                Add(insert, "@branch", branch, DbType.Int32);
                Add(insert, "@supplier", request.SupplierPartnerId, DbType.Int32);
                Add(insert, "@invoice", invoice, DbType.String);
                Add(insert, "@date", (request.PurchaseDate ?? DateTime.Today).Date, DbType.Date);
                Add(insert, "@currency", request.CurrencyId, DbType.Int32);
                Add(insert, "@description", Describe(request), DbType.String);
                Add(insert, "@saved", request.SavedBy, DbType.Int32);
                Add(insert, "@rate", header.Rate, DbType.Decimal);
                Add(insert, "@country", request.CountryId, DbType.Int32);
                Add(insert, "@allocation", header.Allocation, DbType.String);
                id = Convert.ToInt64(await insert.ExecuteScalarAsync(ct));
            }
            var goods = await WriteLinesAsync(db, tx, id, branch, request.Lines!, ct);
            await SetTotalAsync(db, tx, id, goods, ct);
            await PostOpeningAsync(db, tx, invoice, branch, request.SupplierPartnerId, request.CurrencyId, header.Primary, header.Rate, goods, request.PurchaseDate, request.SavedBy, ct);
            await tx.CommitAsync(ct);
        }
        catch (TransactionException ex) { await tx.RollbackAsync(ct); throw new ImportShipmentException(ex.Message, ex.StatusCode); }
        catch { await tx.RollbackAsync(ct); throw; }
        return (await GetAsync(id, ct))!;
    }

    // Changing a draft reverses the supplier's opening entry and posts it again from the new lines and rate.
    public async Task<ImportShipmentDetail?> UpdateAsync(long id, ImportShipmentWriteRequest request, CancellationToken ct)
    {
        Validate(request);
        await using var db = await OpenAsync(ct);
        await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            var current = await LockDraftAsync(db, tx, id, ct);
            if (current is null) { await tx.RollbackAsync(ct); return null; }
            var header = await ResolveHeaderAsync(db, tx, request, ct);
            await ReverseAsync(db, tx, current.Value.Invoice, current.Value.Invoice, "IMPORT_OPEN_REVERSAL", current.Value.Branch, request.SavedBy, ct);
            await using (var clear = Command(db, tx, "DELETE FROM dbo.PurchaseLines WHERE PurchaseId=@id"))
            {
                Add(clear, "@id", id, DbType.Int64);
                await clear.ExecuteNonQueryAsync(ct);
            }
            await using (var update = Command(db, tx, "UPDATE dbo.Purchases SET SupplierPartnerId=@supplier,PurchaseDate=@date,CurrencyId=@currency,Description=@description,ExchangeRateToBase=@rate,CountryId=@country,AllocationMethod=@allocation WHERE PurchaseId=@id"))
            {
                Add(update, "@supplier", request.SupplierPartnerId, DbType.Int32);
                Add(update, "@date", (request.PurchaseDate ?? DateTime.Today).Date, DbType.Date);
                Add(update, "@currency", request.CurrencyId, DbType.Int32);
                Add(update, "@description", Describe(request), DbType.String);
                Add(update, "@rate", header.Rate, DbType.Decimal);
                Add(update, "@country", request.CountryId, DbType.Int32);
                Add(update, "@allocation", header.Allocation, DbType.String);
                Add(update, "@id", id, DbType.Int64);
                await update.ExecuteNonQueryAsync(ct);
            }
            var goods = await WriteLinesAsync(db, tx, id, current.Value.Branch, request.Lines!, ct);
            await SetTotalAsync(db, tx, id, goods, ct);
            await PostOpeningAsync(db, tx, current.Value.Invoice, current.Value.Branch, request.SupplierPartnerId, request.CurrencyId, header.Primary, header.Rate, goods, request.PurchaseDate, request.SavedBy, ct);
            await tx.CommitAsync(ct);
        }
        catch (TransactionException ex) { await tx.RollbackAsync(ct); throw new ImportShipmentException(ex.Message, ex.StatusCode); }
        catch { await tx.RollbackAsync(ct); throw; }
        return await GetAsync(id, ct);
    }

    public async Task<ImportShipmentDetail?> AddCostAsync(long id, ImportCostWriteRequest request, int? savedBy, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            var shipment = await LockDraftAsync(db, tx, id, ct);
            if (shipment is null) { await tx.RollbackAsync(ct); return null; }
            await InsertCostAsync(db, tx, id, shipment.Value.Invoice, shipment.Value.Branch, request, savedBy, ct);
            await tx.CommitAsync(ct);
        }
        catch (TransactionException ex) { await tx.RollbackAsync(ct); throw new ImportShipmentException(ex.Message, ex.StatusCode); }
        catch { await tx.RollbackAsync(ct); throw; }
        return await GetAsync(id, ct);
    }

    // Editing a cost voids it with a reversing entry and records the corrected cost, so the ledger keeps both.
    public async Task<ImportShipmentDetail?> UpdateCostAsync(long id, long costId, ImportCostWriteRequest request, int? savedBy, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            var shipment = await LockDraftAsync(db, tx, id, ct);
            if (shipment is null || !await VoidCostAsync(db, tx, id, costId, shipment.Value.Invoice, shipment.Value.Branch, savedBy, ct)) { await tx.RollbackAsync(ct); return null; }
            await InsertCostAsync(db, tx, id, shipment.Value.Invoice, shipment.Value.Branch, request, savedBy, ct);
            await tx.CommitAsync(ct);
        }
        catch (TransactionException ex) { await tx.RollbackAsync(ct); throw new ImportShipmentException(ex.Message, ex.StatusCode); }
        catch { await tx.RollbackAsync(ct); throw; }
        return await GetAsync(id, ct);
    }

    public async Task<ImportShipmentDetail?> RemoveCostAsync(long id, long costId, int? savedBy, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            var shipment = await LockDraftAsync(db, tx, id, ct);
            if (shipment is null || !await VoidCostAsync(db, tx, id, costId, shipment.Value.Invoice, shipment.Value.Branch, savedBy, ct)) { await tx.RollbackAsync(ct); return null; }
            await tx.CommitAsync(ct);
        }
        catch (TransactionException ex) { await tx.RollbackAsync(ct); throw new ImportShipmentException(ex.Message, ex.StatusCode); }
        catch { await tx.RollbackAsync(ct); throw; }
        return await GetAsync(id, ct);
    }

    // Receiving puts the goods into stock at their landed cost and moves the shipment's goods-in-transit balance to
    // inventory. Its cost never changes afterwards, because part of the stock may already be sold.
    public async Task<ImportShipmentDetail?> ReceiveAsync(long id, int? savedBy, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            var shipment = await LockDraftAsync(db, tx, id, ct);
            if (shipment is null) { await tx.RollbackAsync(ct); return null; }
            var detail = (await ReadDetailAsync(db, tx, id, ct))!;
            if (detail.Lines.Count == 0 || detail.GoodsBase <= 0) throw new ImportShipmentException("A shipment needs goods with a positive total before it can be received.");
            var baseQuantities = new Dictionary<long, (long Item, decimal Quantity)>();
            await using (var lines = Command(db, tx, "SELECT PurchaseLineId,ItemId,Quantity FROM dbo.PurchaseLines WHERE PurchaseId=@id"))
            {
                Add(lines, "@id", id, DbType.Int64);
                await using var reader = await lines.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct)) baseQuantities[reader.GetInt64(0)] = (reader.GetInt64(1), reader.GetDecimal(2));
            }
            foreach (var line in detail.Lines)
            {
                var (item, quantity) = baseQuantities[line.PurchaseLineId];
                // Stock and its cost are kept per base unit.
                var unitCost = line.LandedTotalBase / quantity;
                await using (var update = Command(db, tx, "UPDATE dbo.PurchaseLines SET UnitPrice=@cost WHERE PurchaseLineId=@line"))
                {
                    Add(update, "@cost", unitCost, DbType.Decimal);
                    Add(update, "@line", line.PurchaseLineId, DbType.Int64);
                    await update.ExecuteNonQueryAsync(ct);
                }
                await using var stock = Command(db, tx, "INSERT INTO dbo.StockMovements(BranchId,ItemId,PurchaseId,Quantity,UnitCost,PostingStatus) VALUES(@branch,@item,@purchase,@quantity,@cost,N'POSTED')");
                Add(stock, "@branch", shipment.Value.Branch, DbType.Int32);
                Add(stock, "@item", item, DbType.Int64);
                Add(stock, "@purchase", id, DbType.Int64);
                Add(stock, "@quantity", quantity, DbType.Decimal);
                Add(stock, "@cost", unitCost, DbType.Decimal);
                await stock.ExecuteNonQueryAsync(ct);
            }
            await using (var received = Command(db, tx, "UPDATE dbo.Purchases SET Status=N'POSTED',PostedAt=SYSUTCDATETIME(),ReceivedAt=SYSUTCDATETIME(),LandedCostBase=@landed WHERE PurchaseId=@id AND Status=N'DRAFT'"))
            {
                Add(received, "@landed", detail.LandedBase, DbType.Decimal);
                Add(received, "@id", id, DbType.Int64);
                if (await received.ExecuteNonQueryAsync(ct) != 1) throw new ImportShipmentException("Only a draft shipment can be received.");
            }
            // Shipments saved before goods in transit existed were debited to inventory directly, so only what is in
            // transit for this shipment moves.
            var inTransit = await TransitBalanceAsync(db, tx, shipment.Value.Invoice, ct);
            if (inTransit > 0)
            {
                var primary = await PrimaryCurrencyAsync(db, tx, ct);
                await transactions.PostAsync(db, tx, new TransactionWriteRequest("PURCHASE", "IMPORT_RECEIVE", shipment.Value.Invoice + ":RECEIVE", "Import received", primary, 1,
                [
                    new(Inventory, null, null, inTransit, 0, inTransit, 0, primary, 1),
                    new(GoodsInTransit, null, null, 0, inTransit, 0, inTransit, primary, 1),
                ], shipment.Value.Branch, null, savedBy), ct);
            }
            await tx.CommitAsync(ct);
        }
        catch (TransactionException ex) { await tx.RollbackAsync(ct); throw new ImportShipmentException(ex.Message, ex.StatusCode); }
        catch { await tx.RollbackAsync(ct); throw; }
        return await GetAsync(id, ct);
    }

    // Cancelling a draft reverses everything it posted and keeps the shipment, its number and its history.
    public async Task<bool> CancelAsync(long id, int? savedBy, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            var shipment = await LockDraftAsync(db, tx, id, ct);
            if (shipment is null) { await tx.RollbackAsync(ct); return false; }
            var refs = new List<string>();
            await using (var list = Command(db, tx, "SELECT DISTINCT RefNo FROM dbo.Transactions WHERE RefNo=@invoice OR RefNo LIKE @prefix"))
            {
                Add(list, "@invoice", shipment.Value.Invoice, DbType.String);
                Add(list, "@prefix", shipment.Value.Invoice + ":%", DbType.String);
                await using var reader = await list.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct)) refs.Add(reader.GetString(0));
            }
            foreach (var refNo in refs) await ReverseAsync(db, tx, refNo, refNo, "IMPORT_CANCEL", shipment.Value.Branch, savedBy, ct);
            await using (var cancel = Command(db, tx, "UPDATE dbo.PurchaseAdditionalCosts SET VoidedAt=SYSUTCDATETIME() WHERE PurchaseId=@id AND VoidedAt IS NULL; UPDATE dbo.Purchases SET Status=N'CANCELLED' WHERE PurchaseId=@id AND Status=N'DRAFT';"))
            {
                Add(cancel, "@id", id, DbType.Int64);
                await cancel.ExecuteNonQueryAsync(ct);
            }
            await tx.CommitAsync(ct);
            return true;
        }
        catch (TransactionException ex) { await tx.RollbackAsync(ct); throw new ImportShipmentException(ex.Message, ex.StatusCode); }
        catch { await tx.RollbackAsync(ct); throw; }
    }

    // Shares the costs over the lines by goods value (the default) or by quantity. Each line is rounded to four
    // decimals and the last line takes the rounding remainder, so the lines always add up to the costs exactly.
    public static decimal[] Allocate(IReadOnlyList<(decimal GoodsBase, decimal Quantity)> lines, decimal costsBase, string method)
    {
        var result = new decimal[lines.Count];
        if (lines.Count == 0 || costsBase == 0) return result;
        var byQuantity = method == "QUANTITY";
        var weights = lines.Select(line => byQuantity ? line.Quantity : line.GoodsBase).ToArray();
        var total = weights.Sum();
        if (total <= 0) { weights = lines.Select(line => line.Quantity).ToArray(); total = weights.Sum(); }
        var allocated = 0m;
        for (var i = 0; i < lines.Count; i++)
        {
            result[i] = i == lines.Count - 1 ? costsBase - allocated : decimal.Round(costsBase * weights[i] / total, 4);
            allocated += result[i];
        }
        return result;
    }

    private async Task InsertCostAsync(DbConnection db, DbTransaction tx, long id, string invoice, int branch, ImportCostWriteRequest request, int? savedBy, CancellationToken ct)
    {
        var payeeType = request.PayeeType?.Trim().ToUpperInvariant() ?? "";
        if (string.IsNullOrWhiteSpace(request.CostType) || request.CostType.Trim().Length > 40) throw new ImportShipmentException("Choose the cost type.");
        if (request.Amount <= 0) throw new ImportShipmentException("A cost amount must be greater than zero.");
        if (request.ExchangeRateToBase <= 0) throw new ImportShipmentException("A positive exchange rate is required.");
        if (!PayeeTypes.Contains(payeeType)) throw new ImportShipmentException("Choose who is paid for this cost.");
        if (request.Description?.Trim().Length > 250) throw new ImportShipmentException("Notes must be 250 characters or fewer.");
        var primary = await PrimaryCurrencyAsync(db, tx, ct);
        await EnsureActiveCurrencyAsync(db, tx, request.CurrencyId, ct);
        var rate = request.CurrencyId == primary ? 1m : request.ExchangeRateToBase;
        var baseAmount = decimal.Round(request.Amount * rate, 4);
        TransactionLineRequest credit;
        int? partner = null, treasury = null; string? account = null;
        switch (payeeType)
        {
            case "PARTNER":
                partner = request.PayeePartnerId is > 0 ? request.PayeePartnerId : throw new ImportShipmentException("Choose the partner who is owed this cost.");
                credit = new(TradeCreditors, partner, null, 0, baseAmount, 0, request.Amount, request.CurrencyId, rate);
                break;
            case "TREASURY":
                treasury = request.PayeeTreasuryId is > 0 ? request.PayeeTreasuryId : throw new ImportShipmentException("Choose the treasury that paid this cost.");
                await EnsureTreasuryCoversAsync(db, tx, treasury.Value, branch, request.CurrencyId, request.Amount, ct);
                credit = new($"TREASURY:{treasury}", null, treasury, 0, baseAmount, 0, request.Amount, request.CurrencyId, rate);
                break;
            default:
                account = request.PayeeAccountCode?.Trim();
                if (string.IsNullOrEmpty(account)) throw new ImportShipmentException("Choose the payable account for this cost.");
                await using (var check = Command(db, tx, $"SELECT 1 FROM dbo.Accounts WHERE AccountCode=@code AND AccountType=N'LIABILITY' AND IsActive=1 AND AccountCode NOT LIKE N'_000' AND AccountCode<>N'{TradeCreditors}'"))
                {
                    Add(check, "@code", account, DbType.String);
                    if (await check.ExecuteScalarAsync(ct) is null) throw new ImportShipmentException("The payable account was not found.");
                }
                credit = new(account, null, null, 0, baseAmount, 0, request.Amount, request.CurrencyId, rate);
                break;
        }
        long costId;
        await using (var insert = Command(db, tx, "INSERT INTO dbo.PurchaseAdditionalCosts(PurchaseId,CostType,Amount,CurrencyId,ExchangeRateToBase,BaseAmount,Description,PayeeType,PayeePartnerId,PayeeTreasuryId,PayeeAccountCode) OUTPUT INSERTED.PurchaseCostId VALUES(@purchase,@type,@amount,@currency,@rate,@base,@description,@payeeType,@partner,@treasury,@account)"))
        {
            Add(insert, "@purchase", id, DbType.Int64);
            Add(insert, "@type", request.CostType.Trim(), DbType.String);
            Add(insert, "@amount", request.Amount, DbType.Decimal);
            Add(insert, "@currency", request.CurrencyId, DbType.Int32);
            Add(insert, "@rate", rate, DbType.Decimal);
            Add(insert, "@base", baseAmount, DbType.Decimal);
            Add(insert, "@description", string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(), DbType.String);
            Add(insert, "@payeeType", payeeType, DbType.String);
            Add(insert, "@partner", partner, DbType.Int32);
            Add(insert, "@treasury", treasury, DbType.Int32);
            Add(insert, "@account", account, DbType.String);
            costId = Convert.ToInt64(await insert.ExecuteScalarAsync(ct));
        }
        await transactions.PostAsync(db, tx, new TransactionWriteRequest("PURCHASE_COST", "IMPORT_COST", $"{invoice}:COST:{costId}", request.Description, primary, 1,
        [
            new(GoodsInTransit, null, null, baseAmount, 0, baseAmount, 0, primary, 1),
            credit,
        ], branch, null, savedBy), ct);
    }

    private async Task<bool> VoidCostAsync(DbConnection db, DbTransaction tx, long id, long costId, string invoice, int branch, int? savedBy, CancellationToken ct)
    {
        await using (var voided = Command(db, tx, "UPDATE dbo.PurchaseAdditionalCosts SET VoidedAt=SYSUTCDATETIME() WHERE PurchaseCostId=@cost AND PurchaseId=@id AND VoidedAt IS NULL"))
        {
            Add(voided, "@cost", costId, DbType.Int64);
            Add(voided, "@id", id, DbType.Int64);
            if (await voided.ExecuteNonQueryAsync(ct) != 1) return false;
        }
        var refNo = $"{invoice}:COST:{costId}";
        await ReverseAsync(db, tx, refNo, refNo, "IMPORT_COST_VOID", branch, savedBy, ct);
        return true;
    }

    // Posts the opposite of whatever is still open under a reference, line by line, so the reference nets to zero.
    private async Task ReverseAsync(DbConnection db, DbTransaction tx, string refNo, string newRefNo, string pattern, int branch, int? savedBy, CancellationToken ct)
    {
        var lines = new List<TransactionLineRequest>();
        int? currency = null;
        await using (var open = Command(db, tx, "SELECT AccountId,PartnerId,TreasuryId,CurrencyId,SUM(Debit-Credit),SUM(ForeignDebit-ForeignCredit),MAX(TransactionType) FROM dbo.Transactions WHERE RefNo=@ref GROUP BY AccountId,PartnerId,TreasuryId,CurrencyId HAVING SUM(Debit-Credit)<>0"))
        {
            Add(open, "@ref", refNo, DbType.String);
            await using var reader = await open.ExecuteReaderAsync(ct);
            string? type = null;
            while (await reader.ReadAsync(ct))
            {
                var net = reader.GetDecimal(4);
                var foreign = reader.GetDecimal(5);
                var lineCurrency = reader.GetInt32(3);
                var rate = foreign == 0 ? 1 : Math.Abs(net / foreign);
                lines.Add(new(reader.GetString(0), reader.IsDBNull(1) ? null : reader.GetInt32(1), reader.IsDBNull(2) ? null : reader.GetInt32(2),
                    net < 0 ? -net : 0, net > 0 ? net : 0, foreign < 0 ? -foreign : 0, foreign > 0 ? foreign : 0, lineCurrency, rate));
                currency ??= lineCurrency;
                type ??= reader.GetString(6);
            }
            if (lines.Count == 0) return;
            await reader.CloseAsync();
            var primary = await PrimaryCurrencyAsync(db, tx, ct);
            await transactions.PostAsync(db, tx, new TransactionWriteRequest(type, pattern, newRefNo, "Reversal", primary, 1, lines, branch, null, savedBy), ct);
        }
    }

    private async Task PostOpeningAsync(DbConnection db, DbTransaction tx, string invoice, int branch, int supplier, int currency, int primary, decimal rate, decimal goods, DateTime? date, int? savedBy, CancellationToken ct)
    {
        var goodsBase = decimal.Round(goods * rate, 4);
        await transactions.PostAsync(db, tx, new TransactionWriteRequest("PURCHASE", "IMPORT_OPEN", invoice, "Import shipment", primary, 1,
        [
            new(GoodsInTransit, null, null, goodsBase, 0, goodsBase, 0, primary, 1),
            new(TradeCreditors, supplier, null, 0, goodsBase, 0, goods, currency, rate),
        ], branch, date, savedBy), ct);
    }

    private static async Task<decimal> TransitBalanceAsync(DbConnection db, DbTransaction tx, string invoice, CancellationToken ct)
    {
        await using var command = Command(db, tx, $"SELECT COALESCE(SUM(Debit-Credit),0) FROM dbo.Transactions WHERE AccountId=N'{GoodsInTransit}' AND (RefNo=@invoice OR RefNo LIKE @prefix)");
        Add(command, "@invoice", invoice, DbType.String);
        Add(command, "@prefix", invoice + ":%", DbType.String);
        return Convert.ToDecimal(await command.ExecuteScalarAsync(ct));
    }

    private static async Task EnsureTreasuryCoversAsync(DbConnection db, DbTransaction tx, int treasury, int branch, int currency, decimal amount, CancellationToken ct)
    {
        await using var command = Command(db, tx, "SELECT t.CurrencyId,(SELECT COALESCE(SUM(x.ForeignDebit-x.ForeignCredit),0) FROM dbo.Transactions x WITH (UPDLOCK,HOLDLOCK) WHERE x.TreasuryId=t.TreasuryId) FROM dbo.Treasuries t WHERE t.TreasuryId=@id AND t.BranchId=@branch AND t.IsActive=1");
        Add(command, "@id", treasury, DbType.Int32);
        Add(command, "@branch", branch, DbType.Int32);
        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) throw new ImportShipmentException("Treasury was not found.", 404);
        if (reader.GetInt32(0) != currency) throw new ImportShipmentException("A cost paid from a treasury must be in the treasury's currency.");
        if (reader.GetDecimal(1) < amount) throw new ImportShipmentException("The treasury balance does not cover this cost.");
    }

    private async Task<(string Invoice, int Branch)?> LockDraftAsync(DbConnection db, DbTransaction tx, long id, CancellationToken ct)
    {
        await using var command = Command(db, tx, $"SELECT p.InvoiceNo,p.BranchId,p.Status FROM dbo.Purchases p WITH (UPDLOCK,HOLDLOCK) WHERE p.PurchaseId=@id AND {IsImport}");
        Add(command, "@id", id, DbType.Int64);
        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        if (reader.GetString(2) != "DRAFT") throw new ImportShipmentException("Only a draft shipment can be changed.");
        return (reader.GetString(0), reader.GetInt32(1));
    }

    private async Task<(int Primary, decimal Rate, string Allocation)> ResolveHeaderAsync(DbConnection db, DbTransaction tx, ImportShipmentWriteRequest request, CancellationToken ct)
    {
        await EnsureActiveCurrencyAsync(db, tx, request.CurrencyId, ct);
        await using (var country = Command(db, tx, "SELECT 1 FROM dbo.Countries WHERE CountryId=@country AND IsActive=1"))
        {
            Add(country, "@country", request.CountryId, DbType.Int32);
            if (await country.ExecuteScalarAsync(ct) is null) throw new ImportShipmentException("The selected country is not active.");
        }
        var primary = await PrimaryCurrencyAsync(db, tx, ct);
        var allocation = string.Equals(request.AllocationMethod, "QUANTITY", StringComparison.OrdinalIgnoreCase) ? "QUANTITY" : "VALUE";
        return (primary, request.CurrencyId == primary ? 1m : request.ExchangeRateToBase, allocation);
    }

    private static void Validate(ImportShipmentWriteRequest request)
    {
        if (request.SupplierPartnerId <= 0) throw new ImportShipmentException("Choose the supplier.");
        if (request.CurrencyId <= 0) throw new ImportShipmentException("Choose the invoice currency.");
        if (request.CountryId <= 0) throw new ImportShipmentException("Country is required for an import shipment.");
        if (request.ExchangeRateToBase <= 0) throw new ImportShipmentException("A positive exchange rate is required.");
        if (request.Lines is null || request.Lines.Count == 0) throw new ImportShipmentException("Add at least one item.");
        if (request.Lines.Any(line => line.ItemId <= 0 || line.Quantity <= 0 || line.UnitPrice < 0)) throw new ImportShipmentException("Every item needs a quantity above zero and a price of zero or more.");
        if (request.Lines.Sum(line => line.Quantity * line.UnitPrice) <= 0) throw new ImportShipmentException("Imported goods must have a positive total.");
        if (request.Lines.Any(line => line.BatchNo?.Trim().Length > 80 || line.Barcode?.Trim().Length > 100)) throw new ImportShipmentException("Batch numbers are limited to 80 characters and barcodes to 100.");
        if (request.SupplierInvoiceNo?.Length > 100 || request.ShipmentReference?.Length > 100) throw new ImportShipmentException("Invoice and shipment references are limited to 100 characters.");
    }

    // The supplier's invoice number and the shipment reference live in the description, as the purchase list reads them.
    private static string Describe(ImportShipmentWriteRequest request)
    {
        var external = string.IsNullOrWhiteSpace(request.SupplierInvoiceNo) ? "external" : request.SupplierInvoiceNo.Trim();
        return string.IsNullOrWhiteSpace(request.ShipmentReference) ? $"IMPORT:{external}" : $"IMPORT:{external} / {request.ShipmentReference.Trim()}";
    }

    private static (string? Invoice, string? Reference) ParseDescription(string? description)
    {
        if (string.IsNullOrWhiteSpace(description)) return (null, null);
        var text = description.StartsWith("IMPORT:", StringComparison.OrdinalIgnoreCase) ? description[7..] : description;
        var parts = text.Split(" / ", 2);
        var invoice = parts[0] == "external" ? null : parts[0];
        return (string.IsNullOrWhiteSpace(invoice) ? null : invoice, parts.Length > 1 ? parts[1] : null);
    }

    private static async Task<decimal> WriteLinesAsync(DbConnection db, DbTransaction tx, long id, int branch, IReadOnlyList<ImportLineWriteRequest> lines, CancellationToken ct)
    {
        var goods = 0m;
        foreach (var line in lines)
        {
            int baseUnit;
            await using (var unit = Command(db, tx, "SELECT TOP 1 UnitSettingId FROM dbo.ItemUnits WHERE ItemId=@item AND IsBase=1"))
            {
                Add(unit, "@item", line.ItemId, DbType.Int64);
                baseUnit = await unit.ExecuteScalarAsync(ct) is { } value and not DBNull ? Convert.ToInt32(value) : throw new ImportShipmentException("A base unit is required for every item.");
            }
            var conversion = 1m;
            if (line.UnitSettingId.HasValue && line.UnitSettingId.Value != baseUnit)
            {
                await using var selected = Command(db, tx, "SELECT ConversionToBase FROM dbo.ItemUnits WHERE ItemId=@item AND UnitSettingId=@unit");
                Add(selected, "@item", line.ItemId, DbType.Int64);
                Add(selected, "@unit", line.UnitSettingId, DbType.Int32);
                conversion = await selected.ExecuteScalarAsync(ct) is { } value and not DBNull ? Convert.ToDecimal(value) : throw new ImportShipmentException("The selected unit is not valid for this item.");
                if (conversion <= 0) throw new ImportShipmentException("The selected unit is not valid for this item.");
            }
            var batchNo = line.BatchNo?.Trim();
            if (string.IsNullOrEmpty(batchNo))
            {
                await using var batch = Command(db, tx, "SELECT COUNT(*) + 1 FROM dbo.PurchaseLines pl JOIN dbo.Purchases p ON p.PurchaseId=pl.PurchaseId WHERE p.BranchId=@branch AND pl.ItemId=@item AND pl.BatchNo IS NOT NULL");
                Add(batch, "@branch", branch, DbType.Int32);
                Add(batch, "@item", line.ItemId, DbType.Int64);
                batchNo = $"BCH{branch}-{line.ItemId}-{Convert.ToInt32(await batch.ExecuteScalarAsync(ct))}";
            }
            await using var insert = Command(db, tx, "INSERT INTO dbo.PurchaseLines(PurchaseId,ItemId,UnitSettingId,Quantity,UnitPrice,OriginalUnitSettingId,OriginalQuantity,OriginalUnitPrice,ExpiryDate,Barcode,BatchNo) VALUES(@purchase,@item,@unit,@quantity,@price,@originalUnit,@originalQuantity,@originalPrice,@expiry,@barcode,@batch)");
            Add(insert, "@purchase", id, DbType.Int64);
            Add(insert, "@item", line.ItemId, DbType.Int64);
            Add(insert, "@unit", baseUnit, DbType.Int32);
            Add(insert, "@quantity", line.Quantity * conversion, DbType.Decimal);
            Add(insert, "@price", line.UnitPrice / conversion, DbType.Decimal);
            Add(insert, "@originalUnit", line.UnitSettingId ?? baseUnit, DbType.Int32);
            Add(insert, "@originalQuantity", line.Quantity, DbType.Decimal);
            Add(insert, "@originalPrice", line.UnitPrice, DbType.Decimal);
            Add(insert, "@expiry", line.ExpiryDate?.Date, DbType.Date);
            Add(insert, "@barcode", string.IsNullOrWhiteSpace(line.Barcode) ? null : line.Barcode.Trim(), DbType.String);
            Add(insert, "@batch", batchNo, DbType.String);
            await insert.ExecuteNonQueryAsync(ct);
            goods += line.Quantity * line.UnitPrice;
        }
        return goods;
    }

    private static async Task SetTotalAsync(DbConnection db, DbTransaction tx, long id, decimal goods, CancellationToken ct)
    {
        await using var command = Command(db, tx, "UPDATE dbo.Purchases SET Total=@total WHERE PurchaseId=@id");
        Add(command, "@total", goods, DbType.Decimal);
        Add(command, "@id", id, DbType.Int64);
        await command.ExecuteNonQueryAsync(ct);
    }

    private static async Task<string> NextInvoiceNoAsync(DbConnection db, DbTransaction tx, int branch, CancellationToken ct)
    {
        await using var command = Command(db, tx, "SELECT ISNULL(MAX(TRY_CONVERT(int, SUBSTRING(InvoiceNo, LEN(@prefix), 20))), 0) + 1 FROM dbo.Purchases WITH (UPDLOCK, HOLDLOCK) WHERE BranchId=@branch AND InvoiceNo LIKE @prefix");
        Add(command, "@branch", branch, DbType.Int32);
        Add(command, "@prefix", $"PO-{branch}-%", DbType.String);
        return $"PO-{branch}-{Convert.ToInt32(await command.ExecuteScalarAsync(ct)):D5}";
    }

    private async Task<ImportShipmentDetail?> ReadDetailAsync(DbConnection db, DbTransaction? tx, long id, CancellationToken ct)
    {
        ImportShipmentDetail detail;
        await using (var head = Command(db, tx, $"SELECT p.PurchaseId,p.InvoiceNo,p.Status,p.BranchId,p.SupplierPartnerId,partner.PartnerName,p.PurchaseDate,p.CurrencyId,c.CurrencyCode,c.Symbol,p.ExchangeRateToBase,p.CountryId,p.Description,p.AllocationMethod,p.ReceivedAt FROM dbo.Purchases p JOIN dbo.Partners partner ON partner.PartnerId=p.SupplierPartnerId JOIN dbo.Currencies c ON c.CurrencyId=p.CurrencyId WHERE p.PurchaseId=@id AND {IsImport}"))
        {
            Add(head, "@id", id, DbType.Int64);
            await using var reader = await head.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) return null;
            var (supplierInvoice, reference) = ParseDescription(reader.IsDBNull(12) ? null : reader.GetString(12));
            detail = new(reader.GetInt64(0), reader.GetString(1), reader.GetString(2), reader.GetInt32(3), reader.GetInt32(4), reader.GetString(5), reader.GetDateTime(6),
                reader.GetInt32(7), reader.GetString(8), reader.GetString(9), reader.GetDecimal(10), reader.IsDBNull(11) ? null : reader.GetInt32(11), supplierInvoice, reference,
                reader.GetString(13), 0, 0, 0, 0, reader.IsDBNull(14) ? null : reader.GetDateTime(14), [], []);
        }

        var costs = new List<ImportCostDetail>();
        await using (var command = Command(db, tx, "SELECT k.PurchaseCostId,k.CostType,k.Amount,k.CurrencyId,c.CurrencyCode,c.Symbol,k.ExchangeRateToBase,k.BaseAmount,k.PayeeType,k.PayeePartnerId,k.PayeeTreasuryId,k.PayeeAccountCode,COALESCE(partner.PartnerName,COALESCE(t.NameEn,t.NameAr),account.NameEn,k.PayeeAccountCode,N''),k.Description FROM dbo.PurchaseAdditionalCosts k JOIN dbo.Currencies c ON c.CurrencyId=k.CurrencyId LEFT JOIN dbo.Partners partner ON partner.PartnerId=k.PayeePartnerId LEFT JOIN dbo.Treasuries t ON t.TreasuryId=k.PayeeTreasuryId OUTER APPLY (SELECT TOP 1 a.NameEn FROM dbo.Accounts a WHERE a.AccountCode=k.PayeeAccountCode ORDER BY a.BranchId) account WHERE k.PurchaseId=@id AND k.VoidedAt IS NULL ORDER BY k.PurchaseCostId"))
        {
            Add(command, "@id", id, DbType.Int64);
            await using var reader = await command.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                costs.Add(new(reader.GetInt64(0), reader.GetString(1), reader.GetDecimal(2), reader.GetInt32(3), reader.GetString(4), reader.GetString(5), reader.GetDecimal(6), reader.GetDecimal(7),
                    reader.GetString(8), reader.IsDBNull(9) ? null : reader.GetInt32(9), reader.IsDBNull(10) ? null : reader.GetInt32(10), reader.IsDBNull(11) ? null : reader.GetString(11), reader.GetString(12), reader.IsDBNull(13) ? null : reader.GetString(13)));
        }

        var raw = new List<(long Line, long Item, string Name, int? Unit, string? UnitName, decimal Quantity, decimal Price, decimal BaseQuantity, decimal StoredPrice, DateTime? Expiry, string? Batch, string? Barcode)>();
        await using (var command = Command(db, tx, "SELECT l.PurchaseLineId,l.ItemId,COALESCE(i.NameEn,i.NameAr),COALESCE(l.OriginalUnitSettingId,l.UnitSettingId),COALESCE(u.ValueEn,u.ValueAr),COALESCE(l.OriginalQuantity,l.Quantity),COALESCE(l.OriginalUnitPrice,l.UnitPrice),l.Quantity,l.UnitPrice,l.ExpiryDate,l.BatchNo,l.Barcode FROM dbo.PurchaseLines l JOIN dbo.Items i ON i.ItemId=l.ItemId LEFT JOIN dbo.Settings u ON u.SettingId=COALESCE(l.OriginalUnitSettingId,l.UnitSettingId) WHERE l.PurchaseId=@id ORDER BY l.PurchaseLineId"))
        {
            Add(command, "@id", id, DbType.Int64);
            await using var reader = await command.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                raw.Add((reader.GetInt64(0), reader.GetInt64(1), reader.GetString(2), reader.IsDBNull(3) ? null : reader.GetInt32(3), reader.IsDBNull(4) ? null : reader.GetString(4),
                    reader.GetDecimal(5), reader.GetDecimal(6), reader.GetDecimal(7), reader.GetDecimal(8), reader.IsDBNull(9) ? null : reader.GetDateTime(9), reader.IsDBNull(10) ? null : reader.GetString(10), reader.IsDBNull(11) ? null : reader.GetString(11)));
        }

        var rate = detail.ExchangeRateToBase;
        var costsBase = costs.Sum(cost => cost.BaseAmount);
        var goodsBases = raw.Select(line => line.Quantity * line.Price * rate).ToArray();
        var allocated = Allocate(raw.Select((line, i) => (goodsBases[i], line.BaseQuantity)).ToList(), costsBase, detail.AllocationMethod);
        var received = detail.Status == "POSTED";
        var lines = raw.Select((line, i) =>
        {
            // A received line stores its landed cost per base unit; a draft shows the cost it would land at today.
            var landed = received ? line.StoredPrice * line.BaseQuantity : goodsBases[i] + allocated[i];
            return new ImportLineDetail(line.Line, line.Item, line.Name, line.Unit, line.UnitName, line.Quantity, line.Price, line.Quantity * line.Price, goodsBases[i],
                received ? landed - goodsBases[i] : allocated[i], landed, line.Quantity == 0 ? 0 : landed / line.Quantity, line.Expiry, line.Batch, line.Barcode);
        }).ToList();
        var goodsTotal = lines.Sum(line => line.LineTotal);
        var goodsBase = goodsBases.Sum();
        return detail with
        {
            GoodsTotal = goodsTotal,
            GoodsBase = goodsBase,
            CostsBase = costsBase,
            LandedBase = received ? lines.Sum(line => line.LandedTotalBase) : goodsBase + costsBase,
            Lines = lines,
            Costs = costs,
        };
    }

    private static async Task EnsureActiveCurrencyAsync(DbConnection db, DbTransaction tx, int currency, CancellationToken ct)
    {
        await using var command = Command(db, tx, "SELECT 1 FROM dbo.Currencies WHERE CurrencyId=@id AND IsActive=1");
        Add(command, "@id", currency, DbType.Int32);
        if (await command.ExecuteScalarAsync(ct) is null) throw new ImportShipmentException("The selected currency is not active.");
    }

    private static async Task<int> PrimaryCurrencyAsync(DbConnection db, DbTransaction? tx, CancellationToken ct)
    {
        await using var command = Command(db, tx, "SELECT TOP 1 CurrencyId FROM dbo.Currencies WHERE IsPrimary=1 AND IsActive=1");
        return await command.ExecuteScalarAsync(ct) is { } value and not DBNull ? Convert.ToInt32(value) : throw new ImportShipmentException("An active main currency is required.");
    }

    private async Task<DbConnection> OpenAsync(CancellationToken ct) { var db = factory.CreateConnection(); await db.OpenAsync(ct); return db; }

    private static DbCommand Command(DbConnection db, DbTransaction? tx, string sql) { var command = db.CreateCommand(); command.Transaction = tx; command.CommandText = sql; return command; }

    private static void Add(DbCommand command, string name, object? value, DbType type) { var parameter = command.CreateParameter(); parameter.ParameterName = name; parameter.DbType = type; parameter.Value = value ?? DBNull.Value; command.Parameters.Add(parameter); }
}

public sealed class ImportShipmentException(string message, int statusCode = 400) : Exception(message) { public int StatusCode { get; } = statusCode; }
