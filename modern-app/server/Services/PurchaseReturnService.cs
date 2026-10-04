using System.Data;
using System.Data.Common;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

// Purchase returns against a posted local purchase invoice. Each return is its own document (PR-<branch>-<number>).
// When the PURCHASE_RETURN approval setting is on, a return waits as PENDING (its quantities stay reserved) until
// someone with PURCHASE_RETURN_APPROVE approves it; only then does stock leave and the supplier payable go down.
public sealed class PurchaseReturnService(DbConnectionFactory factory, TransactionService transactions)
{
    // Quantity of a purchase line already returned or waiting for approval. @exclude leaves out the return being approved.
    private const string ReservedPerLine = "(SELECT COALESCE(SUM(rl.Quantity),0) FROM dbo.PurchaseReturnLines rl JOIN dbo.PurchaseReturns r ON r.PurchaseReturnId=rl.PurchaseReturnId WHERE rl.PurchaseLineId=l.PurchaseLineId AND r.Status IN (N'PENDING',N'POSTED') AND r.PurchaseReturnId<>@exclude)";
    private const string DisposedPerLine = "(SELECT COALESCE(SUM(d.Quantity),0) FROM dbo.InventoryRequests d WHERE d.PurchaseLineId=l.PurchaseLineId AND d.RequestType=N'INVENTORY_DISPOSAL' AND d.Status IN (N'PENDING',N'APPROVED'))";
    // Branch stock of the item less what other pending returns will take out of it.
    private const string ItemAvailable = "(SELECT COALESCE(SUM(sm.Quantity),0) FROM dbo.StockMovements sm WHERE sm.BranchId=p.BranchId AND sm.ItemId=l.ItemId AND sm.PostingStatus=N'POSTED') - (SELECT COALESCE(SUM(rl.Quantity),0) FROM dbo.PurchaseReturnLines rl JOIN dbo.PurchaseReturns r ON r.PurchaseReturnId=rl.PurchaseReturnId WHERE r.BranchId=p.BranchId AND rl.ItemId=l.ItemId AND r.Status=N'PENDING' AND r.PurchaseReturnId<>@exclude)";
    private const string IsImport = "(p.PurchaseType=N'IMPORT' OR p.Description LIKE N'IMPORT:%')";

    public async Task<IReadOnlyList<ReturnableInvoice>> GetInvoicesAsync(int? branchId, string? search, DateTime? from, DateTime? to, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        await using var command = db.CreateCommand();
        command.CommandText = $"""
            SELECT TOP (200) p.PurchaseId,p.InvoiceNo,p.PurchaseDate,partner.PartnerName,c.Symbol,p.Total,
                   COALESCE((SELECT SUM(r.Total) FROM dbo.PurchaseReturns r WHERE r.PurchaseId=p.PurchaseId AND r.Status IN (N'PENDING',N'POSTED')),0)
            FROM dbo.Purchases p
            JOIN dbo.Partners partner ON partner.PartnerId=p.SupplierPartnerId
            JOIN dbo.Currencies c ON c.CurrencyId=p.CurrencyId
            WHERE p.Status=N'POSTED' AND NOT {IsImport} AND (@branch IS NULL OR p.BranchId=@branch)
              AND (@from IS NULL OR p.PurchaseDate>=@from) AND (@to IS NULL OR p.PurchaseDate<=@to)
              AND EXISTS (SELECT 1 FROM dbo.PurchaseLines l WHERE l.PurchaseId=p.PurchaseId AND l.Quantity>{ReservedPerLine}+{DisposedPerLine} AND {ItemAvailable}>0)
              AND (@search IS NULL OR p.InvoiceNo LIKE @search OR partner.PartnerName LIKE @search
                   OR EXISTS (SELECT 1 FROM dbo.PurchaseLines l JOIN dbo.Items i ON i.ItemId=l.ItemId WHERE l.PurchaseId=p.PurchaseId AND (i.NameEn LIKE @search OR i.NameAr LIKE @search OR i.ItemCode LIKE @search OR l.BatchNo LIKE @search)))
            ORDER BY p.PurchaseDate DESC,p.PurchaseId DESC
            """;
        Add(command, "@branch", branchId, DbType.Int32);
        Add(command, "@from", from?.Date, DbType.Date);
        Add(command, "@to", to?.Date, DbType.Date);
        Add(command, "@search", Like(search), DbType.String);
        Add(command, "@exclude", 0L, DbType.Int64);
        var rows = new List<ReturnableInvoice>();
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            rows.Add(new(reader.GetInt64(0), reader.GetString(1), reader.GetDateTime(2), reader.GetString(3), reader.GetString(4), reader.GetDecimal(5), reader.GetDecimal(6)));
        return rows;
    }

    public async Task<PurchaseReturnSource?> GetSourceAsync(long purchaseId, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        return await ReadSourceAsync(db, null, purchaseId, 0, ct);
    }

    public async Task<int?> GetPurchaseBranchIdAsync(long purchaseId, CancellationToken ct) => await ScalarIntAsync("SELECT BranchId FROM dbo.Purchases WHERE PurchaseId=@id", purchaseId, ct);
    public async Task<int?> GetReturnBranchIdAsync(long returnId, CancellationToken ct) => await ScalarIntAsync("SELECT BranchId FROM dbo.PurchaseReturns WHERE PurchaseReturnId=@id", returnId, ct);

    public async Task<IReadOnlyList<PurchaseReturnListItem>> GetAsync(int? branchId, string? status, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        await using var command = db.CreateCommand();
        command.CommandText = """
            SELECT r.PurchaseReturnId,r.ReturnNo,r.ReturnDate,r.PurchaseId,p.InvoiceNo,partner.PartnerName,c.Symbol,r.Total,
                   (SELECT COUNT(*) FROM dbo.PurchaseReturnLines rl WHERE rl.PurchaseReturnId=r.PurchaseReturnId),r.Status,r.ReviewNote
            FROM dbo.PurchaseReturns r
            JOIN dbo.Purchases p ON p.PurchaseId=r.PurchaseId
            JOIN dbo.Partners partner ON partner.PartnerId=r.SupplierPartnerId
            JOIN dbo.Currencies c ON c.CurrencyId=r.CurrencyId
            WHERE (@branch IS NULL OR r.BranchId=@branch) AND (@status IS NULL OR r.Status=@status)
            ORDER BY r.ReturnDate DESC,r.PurchaseReturnId DESC
            """;
        Add(command, "@branch", branchId, DbType.Int32);
        Add(command, "@status", string.IsNullOrWhiteSpace(status) ? null : status.Trim().ToUpperInvariant(), DbType.String);
        var rows = new List<PurchaseReturnListItem>();
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            rows.Add(new(reader.GetInt64(0), reader.GetString(1), reader.GetDateTime(2), reader.GetInt64(3), reader.GetString(4), reader.GetString(5), reader.GetString(6), reader.GetDecimal(7), reader.GetInt32(8), reader.GetString(9), reader.IsDBNull(10) ? null : reader.GetString(10)));
        return rows;
    }

    public async Task<PurchaseReturnDetail?> GetByIdAsync(long id, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        await using var head = db.CreateCommand();
        head.CommandText = "SELECT r.PurchaseReturnId,r.ReturnNo,r.ReturnDate,r.PurchaseId,p.InvoiceNo,partner.PartnerName,c.Symbol,r.Subtotal,r.Discount,r.Total,r.Reason,r.Status,r.ReviewNote FROM dbo.PurchaseReturns r JOIN dbo.Purchases p ON p.PurchaseId=r.PurchaseId JOIN dbo.Partners partner ON partner.PartnerId=r.SupplierPartnerId JOIN dbo.Currencies c ON c.CurrencyId=r.CurrencyId WHERE r.PurchaseReturnId=@id";
        Add(head, "@id", id, DbType.Int64);
        PurchaseReturnDetail detail;
        await using (var reader = await head.ExecuteReaderAsync(ct))
        {
            if (!await reader.ReadAsync(ct)) return null;
            detail = new(reader.GetInt64(0), reader.GetString(1), reader.GetDateTime(2), reader.GetInt64(3), reader.GetString(4), reader.GetString(5), reader.GetString(6), reader.GetDecimal(7), reader.GetDecimal(8), reader.GetDecimal(9), reader.IsDBNull(10) ? null : reader.GetString(10), reader.GetString(11), reader.IsDBNull(12) ? null : reader.GetString(12), []);
        }
        await using var lines = db.CreateCommand();
        lines.CommandText = "SELECT rl.PurchaseLineId,rl.ItemId,i.NameAr,i.NameEn,pl.BatchNo,rl.Quantity,rl.UnitCost,rl.LineTotal FROM dbo.PurchaseReturnLines rl JOIN dbo.PurchaseLines pl ON pl.PurchaseLineId=rl.PurchaseLineId JOIN dbo.Items i ON i.ItemId=rl.ItemId WHERE rl.PurchaseReturnId=@id ORDER BY rl.PurchaseReturnLineId";
        Add(lines, "@id", id, DbType.Int64);
        var items = new List<PurchaseReturnLineDetail>();
        await using var lineReader = await lines.ExecuteReaderAsync(ct);
        while (await lineReader.ReadAsync(ct))
            items.Add(new(lineReader.GetInt64(0), lineReader.GetInt64(1), lineReader.GetString(2), lineReader.GetString(3), lineReader.IsDBNull(4) ? null : lineReader.GetString(4), lineReader.GetDecimal(5), lineReader.GetDecimal(6), lineReader.GetDecimal(7)));
        return detail with { Lines = items };
    }

    public async Task<PurchaseReturnDetail> CreateAsync(PurchaseReturnWriteRequest request, CancellationToken ct)
    {
        var requested = ReturnRequests.Normalize(request.Lines, message => new PurchaseReturnException(message));
        long returnId;
        await using (var db = await OpenAsync(ct))
        await using (var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct))
        try
        {
            await using (var lockPurchase = db.CreateCommand())
            {
                lockPurchase.Transaction = tx;
                lockPurchase.CommandText = $"SELECT p.Status,CASE WHEN {IsImport} THEN 1 ELSE 0 END FROM dbo.Purchases p WITH (UPDLOCK,HOLDLOCK) WHERE p.PurchaseId=@id";
                Add(lockPurchase, "@id", request.PurchaseId, DbType.Int64);
                await using var reader = await lockPurchase.ExecuteReaderAsync(ct);
                if (!await reader.ReadAsync(ct)) throw new PurchaseReturnException("The purchase invoice was not found.", 404);
                if (reader.GetString(0) != "POSTED") throw new PurchaseReturnException("Only received (posted) purchase invoices can be returned.");
                if (reader.GetInt32(1) == 1) throw new PurchaseReturnException("Import shipments cannot be returned from this screen yet.");
            }
            var source = (await ReadSourceAsync(db, tx, request.PurchaseId, 0, ct))!;
            var returning = Match(source, requested);

            var returnDate = (request.ReturnDate ?? DateTime.Today).Date;
            if (returnDate < source.PurchaseDate.Date) throw new PurchaseReturnException("The return date cannot be before the invoice date.");

            var gross = returning.Sum(item => item.Quantity * item.Line.UnitCost);
            var completes = source.Lines.All(line => line.PurchasedQuantity - line.ReturnedQuantity == returning.Where(item => item.Line.PurchaseLineId == line.PurchaseLineId).Sum(item => item.Quantity));
            var net = ReturnMath.NetRefund(gross, source.Subtotal, source.Discount, source.Total, source.ReturnedTotal, completes);
            var status = source.RequiresApproval ? "PENDING" : "POSTED";

            await using var sequence = db.CreateCommand();
            sequence.Transaction = tx;
            sequence.CommandText = "SELECT ISNULL(MAX(TRY_CONVERT(int,SUBSTRING(ReturnNo,LEN(@prefix),20))),0)+1 FROM dbo.PurchaseReturns WITH (UPDLOCK,HOLDLOCK) WHERE BranchId=@branch AND ReturnNo LIKE @prefix";
            Add(sequence, "@branch", source.BranchId, DbType.Int32);
            Add(sequence, "@prefix", $"PR-{source.BranchId}-%", DbType.String);
            var returnNo = $"PR-{source.BranchId}-{Convert.ToInt32(await sequence.ExecuteScalarAsync(ct)):D5}";

            await using var insert = db.CreateCommand();
            insert.Transaction = tx;
            insert.CommandText = "INSERT INTO dbo.PurchaseReturns(BranchId,ReturnNo,ReturnDate,PurchaseId,SupplierPartnerId,CurrencyId,Subtotal,Discount,Total,Reason,Status,SavedBy,ReviewedBy,ReviewedAt) OUTPUT INSERTED.PurchaseReturnId VALUES(@branch,@no,@date,@purchase,@supplier,@currency,@subtotal,@discount,@total,@reason,@status,@saved,CASE WHEN @status=N'POSTED' THEN @saved END,CASE WHEN @status=N'POSTED' THEN SYSUTCDATETIME() END)";
            Add(insert, "@branch", source.BranchId, DbType.Int32);
            Add(insert, "@no", returnNo, DbType.String);
            Add(insert, "@date", returnDate, DbType.Date);
            Add(insert, "@purchase", request.PurchaseId, DbType.Int64);
            Add(insert, "@supplier", source.SupplierPartnerId, DbType.Int32);
            Add(insert, "@currency", source.CurrencyId, DbType.Int32);
            Add(insert, "@subtotal", gross, DbType.Decimal);
            Add(insert, "@discount", Math.Max(0, gross - net), DbType.Decimal);
            Add(insert, "@total", net, DbType.Decimal);
            Add(insert, "@reason", string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim(), DbType.String);
            Add(insert, "@status", status, DbType.String);
            Add(insert, "@saved", request.SavedBy, DbType.Int32);
            returnId = Convert.ToInt64(await insert.ExecuteScalarAsync(ct));

            foreach (var (line, quantity) in returning)
            {
                await using var lineInsert = db.CreateCommand();
                lineInsert.Transaction = tx;
                lineInsert.CommandText = "INSERT INTO dbo.PurchaseReturnLines(PurchaseReturnId,PurchaseLineId,ItemId,Quantity,UnitCost) VALUES(@return,@line,@item,@qty,@cost)";
                Add(lineInsert, "@return", returnId, DbType.Int64);
                Add(lineInsert, "@line", line.PurchaseLineId, DbType.Int64);
                Add(lineInsert, "@item", line.ItemId, DbType.Int64);
                Add(lineInsert, "@qty", quantity, DbType.Decimal);
                Add(lineInsert, "@cost", line.UnitCost, DbType.Decimal);
                await lineInsert.ExecuteNonQueryAsync(ct);
            }

            if (status == "POSTED") await PostAsync(db, tx, returnId, returnNo, source, net, returnDate, request.SavedBy, ct);
            await tx.CommitAsync(ct);
        }
        catch (TransactionException ex)
        {
            await tx.RollbackAsync(ct);
            throw new PurchaseReturnException(ex.Message, ex.StatusCode);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
        return (await GetByIdAsync(returnId, ct))!;
    }

    // Approving checks stock again, because it may have been sold or disposed of since the return was requested.
    public async Task<PurchaseReturnDetail?> ApproveAsync(long returnId, int? reviewerId, string? note, CancellationToken ct)
    {
        await using (var db = await OpenAsync(ct))
        await using (var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct))
        try
        {
            var pending = await LockPendingAsync(db, tx, returnId, ct);
            if (pending is null) return null;
            var (purchaseId, returnNo, total) = pending.Value;
            var source = (await ReadSourceAsync(db, tx, purchaseId, returnId, ct))!;
            var lines = new List<(long LineId, decimal Quantity)>();
            await using (var read = db.CreateCommand())
            {
                read.Transaction = tx;
                read.CommandText = "SELECT PurchaseLineId,Quantity FROM dbo.PurchaseReturnLines WHERE PurchaseReturnId=@id";
                Add(read, "@id", returnId, DbType.Int64);
                await using var reader = await read.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct)) lines.Add((reader.GetInt64(0), reader.GetDecimal(1)));
            }
            Match(source, lines);

            // The return is dated the day it is approved, so the ledger and the reports put it in the same period.
            var postedOn = DateTime.Today;
            await using (var update = db.CreateCommand())
            {
                update.Transaction = tx;
                update.CommandText = "UPDATE dbo.PurchaseReturns SET Status=N'POSTED',ReturnDate=@date,ReviewedBy=@reviewer,ReviewedAt=SYSUTCDATETIME(),ReviewNote=@note WHERE PurchaseReturnId=@id";
                Add(update, "@date", postedOn, DbType.Date);
                Add(update, "@reviewer", reviewerId, DbType.Int32);
                Add(update, "@note", string.IsNullOrWhiteSpace(note) ? null : note.Trim(), DbType.String);
                Add(update, "@id", returnId, DbType.Int64);
                await update.ExecuteNonQueryAsync(ct);
            }
            await PostAsync(db, tx, returnId, returnNo, source, total, postedOn, reviewerId, ct);
            await tx.CommitAsync(ct);
        }
        catch (TransactionException ex)
        {
            await tx.RollbackAsync(ct);
            throw new PurchaseReturnException(ex.Message, ex.StatusCode);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
        return await GetByIdAsync(returnId, ct);
    }

    // A rejected return releases the quantities it reserved. Nothing was posted, so nothing is reversed.
    public async Task<PurchaseReturnDetail?> RejectAsync(long returnId, int? reviewerId, string? note, CancellationToken ct)
    {
        await using (var db = await OpenAsync(ct))
        await using (var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct))
        try
        {
            if (await LockPendingAsync(db, tx, returnId, ct) is null) return null;
            await using var update = db.CreateCommand();
            update.Transaction = tx;
            update.CommandText = "UPDATE dbo.PurchaseReturns SET Status=N'REJECTED',ReviewedBy=@reviewer,ReviewedAt=SYSUTCDATETIME(),ReviewNote=@note WHERE PurchaseReturnId=@id";
            Add(update, "@reviewer", reviewerId, DbType.Int32);
            Add(update, "@note", string.IsNullOrWhiteSpace(note) ? null : note.Trim(), DbType.String);
            Add(update, "@id", returnId, DbType.Int64);
            await update.ExecuteNonQueryAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
        return await GetByIdAsync(returnId, ct);
    }

    // Checks each requested line against what is left on the invoice line and in stock, item by item.
    private static List<(PurchaseReturnSourceLine Line, decimal Quantity)> Match(PurchaseReturnSource source, IReadOnlyList<(long LineId, decimal Quantity)> requested)
    {
        var returning = new List<(PurchaseReturnSourceLine Line, decimal Quantity)>();
        foreach (var (lineId, quantity) in requested)
        {
            var line = source.Lines.FirstOrDefault(candidate => candidate.PurchaseLineId == lineId)
                ?? throw new PurchaseReturnException("A returned line is not on this invoice.");
            var left = line.PurchasedQuantity - line.ReturnedQuantity;
            if (quantity > left)
                throw new PurchaseReturnException($"Only {Math.Max(0, left):0.####} of {line.ItemNameEn} can still be returned from this invoice.");
            if (quantity > line.ReturnableQuantity)
                throw new PurchaseReturnException($"Only {line.ReturnableQuantity:0.####} of {line.ItemNameEn} is still in stock for this batch.");
            returning.Add((line, quantity));
        }
        foreach (var item in returning.GroupBy(entry => entry.Line.ItemId))
        {
            var available = item.First().Line.AvailableQuantity;
            if (item.Sum(entry => entry.Quantity) > available)
                throw new PurchaseReturnException($"Only {Math.Max(0, available):0.####} of {item.First().Line.ItemNameEn} is in stock in this branch.");
        }
        return returning;
    }

    // Stock leaves the branch at the invoice cost and the supplier payable goes down: the reverse of the purchase journal.
    private async Task PostAsync(DbConnection db, DbTransaction tx, long returnId, string returnNo, PurchaseReturnSource source, decimal total, DateTime date, int? savedBy, CancellationToken ct)
    {
        await using (var stock = db.CreateCommand())
        {
            stock.Transaction = tx;
            stock.CommandText = "INSERT INTO dbo.StockMovements(BranchId,ItemId,PurchaseReturnId,Quantity,UnitCost,PostingStatus) SELECT @branch,ItemId,PurchaseReturnId,-Quantity,UnitCost,N'POSTED' FROM dbo.PurchaseReturnLines WHERE PurchaseReturnId=@id";
            Add(stock, "@branch", source.BranchId, DbType.Int32);
            Add(stock, "@id", returnId, DbType.Int64);
            await stock.ExecuteNonQueryAsync(ct);
        }
        if (total <= 0) return;
        // The return is valued at the invoice's own exchange rate, as the purchase was.
        await using var rate = db.CreateCommand(); rate.Transaction = tx; rate.CommandText = "SELECT ExchangeRateToBase FROM dbo.Purchases WHERE PurchaseId=@id";
        var idParameter = rate.CreateParameter(); idParameter.ParameterName = "@id"; idParameter.DbType = DbType.Int64; idParameter.Value = source.PurchaseId; rate.Parameters.Add(idParameter);
        var baseRate = await rate.ExecuteScalarAsync(ct) is { } value and not DBNull ? Convert.ToDecimal(value) : (decimal?)null;
        await transactions.PostAsync(db, tx, new TransactionWriteRequest("PURCHASE_RETURN", "PURCHASE_RETURN", returnNo, $"Return of {source.InvoiceNo}", source.CurrencyId, 1,
        [
            new("2100", source.SupplierPartnerId, null, total, 0, total, 0, source.CurrencyId, 1),
            new("1300", null, null, 0, total, 0, total, source.CurrencyId, 1),
        ], source.BranchId, date, savedBy, baseRate is > 0 ? baseRate : null), ct);
    }

    private static async Task<(long PurchaseId, string ReturnNo, decimal Total)?> LockPendingAsync(DbConnection db, DbTransaction tx, long returnId, CancellationToken ct)
    {
        await using var command = db.CreateCommand();
        command.Transaction = tx;
        command.CommandText = "SELECT PurchaseId,ReturnNo,Total,Status FROM dbo.PurchaseReturns WITH (UPDLOCK,HOLDLOCK) WHERE PurchaseReturnId=@id";
        Add(command, "@id", returnId, DbType.Int64);
        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        if (reader.GetString(3) != "PENDING") throw new PurchaseReturnException("Only pending returns can be approved or rejected.");
        return (reader.GetInt64(0), reader.GetString(1), reader.GetDecimal(2));
    }

    private static async Task<PurchaseReturnSource?> ReadSourceAsync(DbConnection db, DbTransaction? tx, long purchaseId, long excludeReturnId, CancellationToken ct)
    {
        await using var head = db.CreateCommand();
        head.Transaction = tx;
        head.CommandText = "SELECT p.PurchaseId,p.InvoiceNo,p.PurchaseDate,p.BranchId,p.SupplierPartnerId,partner.PartnerName,p.CurrencyId,c.Symbol,p.Total,p.Discount,COALESCE((SELECT SUM(r.Total) FROM dbo.PurchaseReturns r WHERE r.PurchaseId=p.PurchaseId AND r.Status IN (N'PENDING',N'POSTED') AND r.PurchaseReturnId<>@exclude),0),COALESCE((SELECT RequiresApproval FROM dbo.ApprovalSettings WHERE RequestType=N'PURCHASE_RETURN'),1) FROM dbo.Purchases p JOIN dbo.Partners partner ON partner.PartnerId=p.SupplierPartnerId JOIN dbo.Currencies c ON c.CurrencyId=p.CurrencyId WHERE p.PurchaseId=@id";
        Add(head, "@id", purchaseId, DbType.Int64);
        Add(head, "@exclude", excludeReturnId, DbType.Int64);
        PurchaseReturnSource source;
        await using (var reader = await head.ExecuteReaderAsync(ct))
        {
            if (!await reader.ReadAsync(ct)) return null;
            var total = reader.GetDecimal(8);
            var discount = reader.GetDecimal(9);
            source = new(reader.GetInt64(0), reader.GetString(1), reader.GetDateTime(2), reader.GetInt32(3), reader.GetInt32(4), reader.GetString(5), reader.GetInt32(6), reader.GetString(7), total + discount, discount, total, reader.GetDecimal(10), Convert.ToBoolean(reader.GetValue(11)), []);
        }
        await using var lines = db.CreateCommand();
        lines.Transaction = tx;
        lines.CommandText = $"SELECT l.PurchaseLineId,l.ItemId,i.ItemCode,i.NameAr,i.NameEn,u.ValueEn,l.BatchNo,l.ExpiryDate,l.Quantity,{ReservedPerLine},{DisposedPerLine},{ItemAvailable},l.UnitPrice FROM dbo.PurchaseLines l JOIN dbo.Purchases p ON p.PurchaseId=l.PurchaseId JOIN dbo.Items i ON i.ItemId=l.ItemId LEFT JOIN dbo.Settings u ON u.SettingId=l.UnitSettingId WHERE l.PurchaseId=@id ORDER BY l.PurchaseLineId";
        Add(lines, "@id", purchaseId, DbType.Int64);
        Add(lines, "@exclude", excludeReturnId, DbType.Int64);
        var items = new List<PurchaseReturnSourceLine>();
        await using var lineReader = await lines.ExecuteReaderAsync(ct);
        while (await lineReader.ReadAsync(ct))
        {
            var purchased = lineReader.GetDecimal(8);
            var returned = lineReader.GetDecimal(9);
            var batchLeft = purchased - returned - lineReader.GetDecimal(10);
            var itemAvailable = Math.Max(0, lineReader.GetDecimal(11));
            items.Add(new(lineReader.GetInt64(0), lineReader.GetInt64(1), lineReader.GetString(2), lineReader.GetString(3), lineReader.GetString(4), lineReader.IsDBNull(5) ? null : lineReader.GetString(5), lineReader.IsDBNull(6) ? null : lineReader.GetString(6), lineReader.IsDBNull(7) ? null : lineReader.GetDateTime(7),
                purchased, returned, itemAvailable, Math.Max(0, Math.Min(batchLeft, itemAvailable)), lineReader.GetDecimal(12)));
        }
        return source with { Lines = items };
    }

    private async Task<int?> ScalarIntAsync(string sql, long id, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        await using var command = db.CreateCommand();
        command.CommandText = sql;
        Add(command, "@id", id, DbType.Int64);
        return await command.ExecuteScalarAsync(ct) is { } value and not DBNull ? Convert.ToInt32(value) : null;
    }

    private static string? Like(string? search) => string.IsNullOrWhiteSpace(search) ? null : $"%{search.Trim().Replace("[", "[[]").Replace("%", "[%]").Replace("_", "[_]")}%";
    private async Task<DbConnection> OpenAsync(CancellationToken ct) { var db = factory.CreateConnection(); await db.OpenAsync(ct); return db; }
    private static void Add(DbCommand command, string name, object? value, DbType type) { var parameter = command.CreateParameter(); parameter.ParameterName = name; parameter.DbType = type; parameter.Value = value ?? DBNull.Value; command.Parameters.Add(parameter); }
}

public sealed class PurchaseReturnException(string message, int statusCode = 400) : Exception(message) { public int StatusCode { get; } = statusCode; }
