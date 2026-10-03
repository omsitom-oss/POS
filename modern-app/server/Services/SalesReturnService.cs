using System.Data;
using System.Data.Common;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

// Sales returns against a posted sales invoice. Each return is its own document (SR-<branch>-<number>):
// the items go back into the invoice branch's stock and the refund leaves a treasury, all in one transaction.
public sealed class SalesReturnService(DbConnectionFactory factory, TransactionService transactions)
{
    private const string ReturnedPerLine = "(SELECT COALESCE(SUM(rl.Quantity),0) FROM dbo.SalesReturnLines rl JOIN dbo.SalesReturns r ON r.SalesReturnId=rl.SalesReturnId WHERE rl.SaleLineId=l.SaleLineId AND r.Status=N'POSTED')";

    // Posted invoices with something left to return. The search matches the invoice number, the customer or an item.
    public async Task<IReadOnlyList<ReturnableInvoice>> GetInvoicesAsync(int? branchId, string? search, DateTime? from, DateTime? to, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        await using var command = db.CreateCommand();
        command.CommandText = $"""
            SELECT TOP (200) s.SaleId,s.SaleNo,s.SaleDate,p.PartnerName,c.Symbol,s.Total,
                   COALESCE((SELECT SUM(r.Total) FROM dbo.SalesReturns r WHERE r.SaleId=s.SaleId AND r.Status=N'POSTED'),0)
            FROM dbo.Sales s
            LEFT JOIN dbo.Partners p ON p.PartnerId=s.CustomerPartnerId
            JOIN dbo.Currencies c ON c.CurrencyId=s.CurrencyId
            WHERE s.Status=N'POSTED' AND (@branch IS NULL OR s.BranchId=@branch)
              AND (@from IS NULL OR s.SaleDate>=@from) AND (@to IS NULL OR s.SaleDate<=@to)
              AND EXISTS (SELECT 1 FROM dbo.SaleLines l WHERE l.SaleId=s.SaleId AND l.Quantity>{ReturnedPerLine})
              AND (@search IS NULL OR s.SaleNo LIKE @search OR p.PartnerName LIKE @search
                   OR EXISTS (SELECT 1 FROM dbo.SaleLines l JOIN dbo.Items i ON i.ItemId=l.ItemId WHERE l.SaleId=s.SaleId AND (i.NameEn LIKE @search OR i.NameAr LIKE @search OR i.ItemCode LIKE @search)))
            ORDER BY s.SaleDate DESC,s.SaleId DESC
            """;
        Add(command, "@branch", branchId, DbType.Int32);
        Add(command, "@from", from?.Date, DbType.Date);
        Add(command, "@to", to?.Date, DbType.Date);
        Add(command, "@search", Like(search), DbType.String);
        var rows = new List<ReturnableInvoice>();
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            rows.Add(new(reader.GetInt64(0), reader.GetString(1), reader.GetDateTime(2), reader.IsDBNull(3) ? null : reader.GetString(3), reader.GetString(4), reader.GetDecimal(5), reader.GetDecimal(6)));
        return rows;
    }

    public async Task<SalesReturnSource?> GetSourceAsync(long saleId, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        return await ReadSourceAsync(db, null, saleId, ct);
    }

    public async Task<int?> GetSaleBranchIdAsync(long saleId, CancellationToken ct) => await ScalarIntAsync("SELECT BranchId FROM dbo.Sales WHERE SaleId=@id", saleId, ct);
    public async Task<int?> GetReturnBranchIdAsync(long returnId, CancellationToken ct) => await ScalarIntAsync("SELECT BranchId FROM dbo.SalesReturns WHERE SalesReturnId=@id", returnId, ct);

    public async Task<IReadOnlyList<SalesReturnListItem>> GetAsync(int? branchId, DateTime? from, DateTime? to, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        await using var command = db.CreateCommand();
        command.CommandText = """
            SELECT r.SalesReturnId,r.ReturnNo,r.ReturnDate,r.SaleId,s.SaleNo,p.PartnerName,t.NameAr,t.NameEn,c.Symbol,r.Total,
                   (SELECT COUNT(*) FROM dbo.SalesReturnLines rl WHERE rl.SalesReturnId=r.SalesReturnId)
            FROM dbo.SalesReturns r
            JOIN dbo.Sales s ON s.SaleId=r.SaleId
            LEFT JOIN dbo.Partners p ON p.PartnerId=s.CustomerPartnerId
            JOIN dbo.Treasuries t ON t.TreasuryId=r.TreasuryId
            JOIN dbo.Currencies c ON c.CurrencyId=r.CurrencyId
            WHERE (@branch IS NULL OR r.BranchId=@branch) AND (@from IS NULL OR r.ReturnDate>=@from) AND (@to IS NULL OR r.ReturnDate<=@to)
            ORDER BY r.ReturnDate DESC,r.SalesReturnId DESC
            """;
        Add(command, "@branch", branchId, DbType.Int32);
        Add(command, "@from", from?.Date, DbType.Date);
        Add(command, "@to", to?.Date, DbType.Date);
        var rows = new List<SalesReturnListItem>();
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            rows.Add(new(reader.GetInt64(0), reader.GetString(1), reader.GetDateTime(2), reader.GetInt64(3), reader.GetString(4), reader.IsDBNull(5) ? null : reader.GetString(5), reader.GetString(6), reader.GetString(7), reader.GetString(8), reader.GetDecimal(9), reader.GetInt32(10)));
        return rows;
    }

    public async Task<SalesReturnDetail?> GetByIdAsync(long id, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        await using var head = db.CreateCommand();
        head.CommandText = "SELECT r.SalesReturnId,r.ReturnNo,r.ReturnDate,r.SaleId,s.SaleNo,p.PartnerName,r.TreasuryId,c.Symbol,r.Subtotal,r.Discount,r.Total,r.Reason FROM dbo.SalesReturns r JOIN dbo.Sales s ON s.SaleId=r.SaleId LEFT JOIN dbo.Partners p ON p.PartnerId=s.CustomerPartnerId JOIN dbo.Currencies c ON c.CurrencyId=r.CurrencyId WHERE r.SalesReturnId=@id";
        Add(head, "@id", id, DbType.Int64);
        SalesReturnDetail detail;
        await using (var reader = await head.ExecuteReaderAsync(ct))
        {
            if (!await reader.ReadAsync(ct)) return null;
            detail = new(reader.GetInt64(0), reader.GetString(1), reader.GetDateTime(2), reader.GetInt64(3), reader.GetString(4), reader.IsDBNull(5) ? null : reader.GetString(5), reader.GetInt32(6), reader.GetString(7), reader.GetDecimal(8), reader.GetDecimal(9), reader.GetDecimal(10), reader.IsDBNull(11) ? null : reader.GetString(11), []);
        }
        await using var lines = db.CreateCommand();
        lines.CommandText = "SELECT rl.SaleLineId,rl.ItemId,i.NameAr,i.NameEn,rl.Quantity,rl.UnitPrice,rl.LineTotal FROM dbo.SalesReturnLines rl JOIN dbo.Items i ON i.ItemId=rl.ItemId WHERE rl.SalesReturnId=@id ORDER BY rl.SalesReturnLineId";
        Add(lines, "@id", id, DbType.Int64);
        var items = new List<SalesReturnLineDetail>();
        await using var lineReader = await lines.ExecuteReaderAsync(ct);
        while (await lineReader.ReadAsync(ct))
            items.Add(new(lineReader.GetInt64(0), lineReader.GetInt64(1), lineReader.GetString(2), lineReader.GetString(3), lineReader.GetDecimal(4), lineReader.GetDecimal(5), lineReader.GetDecimal(6)));
        return detail with { Lines = items };
    }

    public async Task<SalesReturnDetail> CreateAsync(SalesReturnWriteRequest request, CancellationToken ct)
    {
        var requested = ReturnRequests.Normalize(request.Lines, message => new SalesReturnException(message));
        long returnId;
        await using (var db = await OpenAsync(ct))
        await using (var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct))
        try
        {
            // Locking the invoice row makes concurrent returns of the same invoice wait for each other.
            await using (var lockSale = db.CreateCommand())
            {
                lockSale.Transaction = tx;
                lockSale.CommandText = "SELECT Status FROM dbo.Sales WITH (UPDLOCK,HOLDLOCK) WHERE SaleId=@id";
                Add(lockSale, "@id", request.SaleId, DbType.Int64);
                var status = await lockSale.ExecuteScalarAsync(ct);
                if (status is null) throw new SalesReturnException("The sales invoice was not found.", 404);
                if (!string.Equals(Convert.ToString(status), "POSTED", StringComparison.Ordinal)) throw new SalesReturnException("Only posted sales invoices can be returned.");
            }
            var source = (await ReadSourceAsync(db, tx, request.SaleId, ct))!;

            var returning = new List<(SalesReturnSourceLine Line, decimal Quantity, decimal UnitCost)>();
            var costs = await ReadUnitCostsAsync(db, tx, request.SaleId, ct);
            foreach (var (lineId, quantity) in requested)
            {
                var line = source.Lines.FirstOrDefault(candidate => candidate.SaleLineId == lineId)
                    ?? throw new SalesReturnException("A returned line is not on this invoice.");
                if (quantity > line.ReturnableQuantity)
                    throw new SalesReturnException($"Only {line.ReturnableQuantity:0.####} of {line.ItemNameEn} can still be returned from this invoice.");
                returning.Add((line, quantity, costs[lineId]));
            }

            var treasuryId = request.TreasuryId ?? source.TreasuryId;
            await using (var treasury = db.CreateCommand())
            {
                treasury.Transaction = tx;
                treasury.CommandText = "SELECT 1 FROM dbo.Treasuries WHERE TreasuryId=@treasury AND BranchId=@branch AND CurrencyId=@currency AND IsActive=1";
                Add(treasury, "@treasury", treasuryId, DbType.Int32);
                Add(treasury, "@branch", source.BranchId, DbType.Int32);
                Add(treasury, "@currency", source.CurrencyId, DbType.Int32);
                if (await treasury.ExecuteScalarAsync(ct) is null)
                    throw new SalesReturnException("The refund must come from an active treasury of the invoice's branch in the invoice currency.");
            }

            var returnDate = (request.ReturnDate ?? DateTime.UtcNow).Date;
            if (returnDate < source.SaleDate.Date) throw new SalesReturnException("The return date cannot be before the invoice date.");

            var gross = returning.Sum(item => item.Quantity * item.Line.UnitPrice);
            var completes = source.Lines.All(line => line.ReturnableQuantity == returning.Where(item => item.Line.SaleLineId == line.SaleLineId).Sum(item => item.Quantity));
            var net = ReturnMath.NetRefund(gross, source.Subtotal, source.Discount, source.Total, source.ReturnedTotal, completes);
            var discount = Math.Max(0, gross - net);

            await using var sequence = db.CreateCommand();
            sequence.Transaction = tx;
            sequence.CommandText = "SELECT ISNULL(MAX(TRY_CONVERT(int,RIGHT(ReturnNo,5))),0)+1 FROM dbo.SalesReturns WITH (UPDLOCK,HOLDLOCK) WHERE BranchId=@branch AND ReturnNo LIKE @prefix";
            Add(sequence, "@branch", source.BranchId, DbType.Int32);
            Add(sequence, "@prefix", $"SR-{source.BranchId}-%", DbType.String);
            var returnNo = $"SR-{source.BranchId}-{Convert.ToInt32(await sequence.ExecuteScalarAsync(ct)):D5}";

            await using var insert = db.CreateCommand();
            insert.Transaction = tx;
            insert.CommandText = "INSERT INTO dbo.SalesReturns(BranchId,ReturnNo,ReturnDate,SaleId,TreasuryId,CurrencyId,Subtotal,Discount,Total,Reason,Status,SavedBy) OUTPUT INSERTED.SalesReturnId VALUES(@branch,@no,@date,@sale,@treasury,@currency,@subtotal,@discount,@total,@reason,N'POSTED',@saved)";
            Add(insert, "@branch", source.BranchId, DbType.Int32);
            Add(insert, "@no", returnNo, DbType.String);
            Add(insert, "@date", returnDate, DbType.Date);
            Add(insert, "@sale", request.SaleId, DbType.Int64);
            Add(insert, "@treasury", treasuryId, DbType.Int32);
            Add(insert, "@currency", source.CurrencyId, DbType.Int32);
            Add(insert, "@subtotal", gross, DbType.Decimal);
            Add(insert, "@discount", discount, DbType.Decimal);
            Add(insert, "@total", net, DbType.Decimal);
            Add(insert, "@reason", string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim(), DbType.String);
            Add(insert, "@saved", request.SavedBy, DbType.Int32);
            returnId = Convert.ToInt64(await insert.ExecuteScalarAsync(ct));

            foreach (var (line, quantity, unitCost) in returning)
            {
                await using var lineInsert = db.CreateCommand();
                lineInsert.Transaction = tx;
                lineInsert.CommandText = "INSERT INTO dbo.SalesReturnLines(SalesReturnId,SaleLineId,ItemId,Quantity,UnitPrice,UnitCost) VALUES(@return,@line,@item,@qty,@price,@cost); INSERT INTO dbo.StockMovements(BranchId,ItemId,SalesReturnId,Quantity,UnitCost,PostingStatus) VALUES(@branch,@item,@return,@qty,@cost,N'POSTED')";
                Add(lineInsert, "@return", returnId, DbType.Int64);
                Add(lineInsert, "@line", line.SaleLineId, DbType.Int64);
                Add(lineInsert, "@item", line.ItemId, DbType.Int64);
                Add(lineInsert, "@qty", quantity, DbType.Decimal);
                Add(lineInsert, "@price", line.UnitPrice, DbType.Decimal);
                Add(lineInsert, "@cost", unitCost, DbType.Decimal);
                Add(lineInsert, "@branch", source.BranchId, DbType.Int32);
                await lineInsert.ExecuteNonQueryAsync(ct);
            }

            // The reverse of the sale journal: sales revenue is debited and the refund leaves the treasury.
            if (net > 0)
                await transactions.PostAsync(db, tx, new TransactionWriteRequest("SALES_RETURN", "SALES_RETURN", returnNo, $"Return of {source.SaleNo}", source.CurrencyId, 1,
                [
                    new("4100", null, null, net, 0, net, 0, source.CurrencyId, 1),
                    new($"TREASURY:{treasuryId}", null, treasuryId, 0, net, 0, net, source.CurrencyId, 1),
                ], source.BranchId, returnDate, request.SavedBy), ct);

            await tx.CommitAsync(ct);
        }
        catch (TransactionException ex)
        {
            await tx.RollbackAsync(ct);
            throw new SalesReturnException(ex.Message, ex.StatusCode);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
        return (await GetByIdAsync(returnId, ct))!;
    }

    private static async Task<SalesReturnSource?> ReadSourceAsync(DbConnection db, DbTransaction? tx, long saleId, CancellationToken ct)
    {
        await using var head = db.CreateCommand();
        head.Transaction = tx;
        head.CommandText = "SELECT s.SaleId,s.SaleNo,s.SaleDate,s.BranchId,p.PartnerName,s.TreasuryId,s.CurrencyId,c.Symbol,s.Total,s.Discount,COALESCE((SELECT SUM(r.Total) FROM dbo.SalesReturns r WHERE r.SaleId=s.SaleId AND r.Status=N'POSTED'),0) FROM dbo.Sales s LEFT JOIN dbo.Partners p ON p.PartnerId=s.CustomerPartnerId JOIN dbo.Currencies c ON c.CurrencyId=s.CurrencyId WHERE s.SaleId=@id";
        Add(head, "@id", saleId, DbType.Int64);
        SalesReturnSource source;
        await using (var reader = await head.ExecuteReaderAsync(ct))
        {
            if (!await reader.ReadAsync(ct)) return null;
            var total = reader.GetDecimal(8);
            var discount = reader.GetDecimal(9);
            source = new(reader.GetInt64(0), reader.GetString(1), reader.GetDateTime(2), reader.GetInt32(3), reader.IsDBNull(4) ? null : reader.GetString(4), reader.GetInt32(5), reader.GetInt32(6), reader.GetString(7), total + discount, discount, total, reader.GetDecimal(10), []);
        }
        await using var lines = db.CreateCommand();
        lines.Transaction = tx;
        lines.CommandText = $"SELECT l.SaleLineId,l.ItemId,i.ItemCode,i.NameAr,i.NameEn,l.Quantity,{ReturnedPerLine},l.UnitPrice FROM dbo.SaleLines l JOIN dbo.Items i ON i.ItemId=l.ItemId WHERE l.SaleId=@id ORDER BY l.SaleLineId";
        Add(lines, "@id", saleId, DbType.Int64);
        var items = new List<SalesReturnSourceLine>();
        await using var lineReader = await lines.ExecuteReaderAsync(ct);
        while (await lineReader.ReadAsync(ct))
        {
            var sold = lineReader.GetDecimal(5);
            var returned = lineReader.GetDecimal(6);
            items.Add(new(lineReader.GetInt64(0), lineReader.GetInt64(1), lineReader.GetString(2), lineReader.GetString(3), lineReader.GetString(4), sold, returned, Math.Max(0, sold - returned), lineReader.GetDecimal(7)));
        }
        return source with { Lines = items };
    }

    private static async Task<Dictionary<long, decimal>> ReadUnitCostsAsync(DbConnection db, DbTransaction tx, long saleId, CancellationToken ct)
    {
        await using var command = db.CreateCommand();
        command.Transaction = tx;
        command.CommandText = "SELECT SaleLineId,UnitCost FROM dbo.SaleLines WHERE SaleId=@id";
        Add(command, "@id", saleId, DbType.Int64);
        var costs = new Dictionary<long, decimal>();
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) costs[reader.GetInt64(0)] = reader.GetDecimal(1);
        return costs;
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

// Shared checks on the lines of a return request.
public static class ReturnRequests
{
    // Drops zero-quantity lines and refuses negative quantities, repeated lines and requests with nothing to return.
    public static IReadOnlyList<(long LineId, decimal Quantity)> Normalize(IReadOnlyList<ReturnLineWriteRequest>? lines, Func<string, Exception> error)
    {
        var list = lines ?? [];
        if (list.Any(line => line.Quantity < 0)) throw error("Return quantities cannot be negative.");
        if (list.GroupBy(line => line.LineId).Any(group => group.Count() > 1)) throw error("Each invoice line can appear only once in a return.");
        var result = list.Where(line => line.Quantity > 0).Select(line => (line.LineId, line.Quantity)).ToArray();
        if (result.Length == 0) throw error("Enter a quantity to return for at least one line.");
        return result;
    }
}

public sealed class SalesReturnException(string message, int statusCode = 400) : Exception(message) { public int StatusCode { get; } = statusCode; }
