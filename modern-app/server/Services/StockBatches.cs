using System.Data;
using System.Data.Common;

namespace ElitePos.LocalService.Services;

// Batch-level stock. A batch is a posted purchase line; its stock is the sum of the movements that name it.
// Sales take from the batch that expires first and never from an expired one, and returns go back to the batches
// their sale line took from.
public static class StockBatches
{
    // Posted stock of a purchase line, as a correlated subquery on a row aliased pl.
    public const string RemainingSql = "(SELECT COALESCE(SUM(bm.Quantity),0) FROM dbo.StockMovements bm WHERE bm.PurchaseLineId=pl.PurchaseLineId AND bm.PostingStatus=N'POSTED')";

    public sealed record Take(long PurchaseLineId, decimal Quantity);

    // Splits a sale quantity across the branch's unexpired batches of the item, earliest expiry first. A batch with no
    // expiry date is used last. Throws when unexpired stock cannot cover the quantity, saying how much is expired.
    public static async Task<IReadOnlyList<Take>> AllocateAsync(DbConnection db, DbTransaction tx, int branch, long item, decimal quantity, DateTime today, Func<string, Exception> error, CancellationToken ct)
    {
        var batches = new List<(long Line, decimal Remaining, bool Expired)>();
        await using (var command = db.CreateCommand())
        {
            command.Transaction = tx;
            command.CommandText = $"SELECT pl.PurchaseLineId,b.Remaining,CASE WHEN pl.ExpiryDate<@today THEN 1 ELSE 0 END FROM dbo.PurchaseLines pl JOIN dbo.Purchases p ON p.PurchaseId=pl.PurchaseId CROSS APPLY (SELECT {RemainingSql} AS Remaining) b WHERE p.BranchId=@branch AND pl.ItemId=@item AND p.Status=N'POSTED' AND b.Remaining>0 ORDER BY CASE WHEN pl.ExpiryDate IS NULL THEN 1 ELSE 0 END,pl.ExpiryDate,p.PurchaseDate,pl.PurchaseLineId";
            Add(command, "@branch", branch, DbType.Int32); Add(command, "@item", item, DbType.Int64); Add(command, "@today", today.Date, DbType.Date);
            await using var reader = await command.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) batches.Add((reader.GetInt64(0), reader.GetDecimal(1), reader.GetInt32(2) == 1));
        }
        var sellable = batches.Where(batch => !batch.Expired).Sum(batch => batch.Remaining);
        if (quantity > sellable)
        {
            var expired = batches.Where(batch => batch.Expired).Sum(batch => batch.Remaining);
            throw error(expired > 0
                ? $"The requested quantity exceeds available stock. Only {sellable:0.####} can be sold; {expired:0.####} more is expired."
                : $"The requested quantity exceeds available stock. Only {sellable:0.####} is in stock.");
        }
        var takes = new List<Take>();
        var left = quantity;
        foreach (var batch in batches.Where(batch => !batch.Expired))
        {
            if (left <= 0) break;
            var take = Math.Min(left, batch.Remaining);
            takes.Add(new(batch.Line, take));
            left -= take;
        }
        return takes;
    }

    // Spreads a returned quantity back over the batches a sale line took from, latest expiry first. Whatever no batch
    // can take back (a sale from before batches were tracked) comes back without a batch.
    public static async Task<IReadOnlyList<(long? PurchaseLineId, decimal Quantity)>> ReturnAsync(DbConnection db, DbTransaction tx, long saleLineId, decimal quantity, CancellationToken ct)
    {
        var taken = new List<(long Line, decimal Quantity)>();
        await using (var command = db.CreateCommand())
        {
            command.Transaction = tx;
            command.CommandText = "SELECT t.PurchaseLineId,t.Taken FROM (SELECT sm.PurchaseLineId,-SUM(sm.Quantity) AS Taken FROM dbo.StockMovements sm WHERE sm.SaleLineId=@line AND sm.PurchaseLineId IS NOT NULL AND sm.PostingStatus=N'POSTED' GROUP BY sm.PurchaseLineId) t JOIN dbo.PurchaseLines pl ON pl.PurchaseLineId=t.PurchaseLineId WHERE t.Taken>0 ORDER BY CASE WHEN pl.ExpiryDate IS NULL THEN 0 ELSE 1 END,pl.ExpiryDate DESC,pl.PurchaseLineId DESC";
            Add(command, "@line", saleLineId, DbType.Int64);
            await using var reader = await command.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) taken.Add((reader.GetInt64(0), reader.GetDecimal(1)));
        }
        var result = new List<(long? PurchaseLineId, decimal Quantity)>();
        var left = quantity;
        foreach (var (line, available) in taken)
        {
            if (left <= 0) break;
            var back = Math.Min(left, available);
            result.Add((line, back));
            left -= back;
        }
        if (left > 0) result.Add((null, left));
        return result;
    }

    // Stock still in a batch, less what pending disposals and pending purchase returns will take out of it.
    public static async Task<decimal> FreeInBatchAsync(DbConnection db, DbTransaction tx, long purchaseLineId, long excludeRequestId, long excludeReturnId, CancellationToken ct)
    {
        await using var command = db.CreateCommand();
        command.Transaction = tx;
        command.CommandText = $"SELECT {RemainingSql}-COALESCE((SELECT SUM(d.Quantity) FROM dbo.InventoryRequests d WHERE d.PurchaseLineId=pl.PurchaseLineId AND d.RequestType=N'INVENTORY_DISPOSAL' AND d.Status=N'PENDING' AND d.RequestId<>@request),0)-COALESCE((SELECT SUM(rl.Quantity) FROM dbo.PurchaseReturnLines rl JOIN dbo.PurchaseReturns r ON r.PurchaseReturnId=rl.PurchaseReturnId WHERE rl.PurchaseLineId=pl.PurchaseLineId AND r.Status=N'PENDING' AND r.PurchaseReturnId<>@return),0) FROM dbo.PurchaseLines pl WHERE pl.PurchaseLineId=@line";
        Add(command, "@line", purchaseLineId, DbType.Int64); Add(command, "@request", excludeRequestId, DbType.Int64); Add(command, "@return", excludeReturnId, DbType.Int64);
        return await command.ExecuteScalarAsync(ct) is { } value and not DBNull ? Convert.ToDecimal(value) : 0;
    }

    private static void Add(DbCommand command, string name, object? value, DbType type) { var parameter = command.CreateParameter(); parameter.ParameterName = name; parameter.DbType = type; parameter.Value = value ?? DBNull.Value; command.Parameters.Add(parameter); }
}
