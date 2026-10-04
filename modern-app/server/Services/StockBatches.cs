using System.Data;
using System.Data.Common;

namespace ElitePos.LocalService.Services;

// Batch-level stock. A batch is a posted purchase line; its stock is the sum of the movements that name it.
// Sales take from the batch that expires first and never from an expired one, and returns go back to the batches
// their sale line took from. Stock is costed by batch: what leaves or returns to a batch carries that batch's cost.
public static class StockBatches
{
    // Posted stock of a purchase line, as a correlated subquery on a row aliased pl.
    public const string RemainingSql = "(SELECT COALESCE(SUM(bm.Quantity),0) FROM dbo.StockMovements bm WHERE bm.PurchaseLineId=pl.PurchaseLineId AND bm.PostingStatus=N'POSTED')";

    // Unit cost of a batch in the main currency, after the invoice discount and any landed costs: the cost its purchase
    // brought it into stock at. {0} is the SQL for the purchase line id.
    public static string CostSql(string purchaseLineId) => $"(SELECT TOP 1 pm.UnitCost FROM dbo.StockMovements pm WHERE pm.PurchaseLineId={purchaseLineId} AND pm.PurchaseId IS NOT NULL AND pm.Quantity>0 ORDER BY pm.StockMovementId)";

    // Unit cost of stock with no batch: the average of what came back into it.
    private const string UnbatchedCostSql = "COALESCE(SUM(CASE WHEN Quantity>0 THEN Quantity*UnitCost END)/NULLIF(SUM(CASE WHEN Quantity>0 THEN Quantity END),0),0)";

    // A null PurchaseLineId takes from stock that has no batch (it came back from a sale made before batches were tracked).
    public sealed record Take(long? PurchaseLineId, decimal Quantity, decimal UnitCost);

    // Cost of a sale line in the main currency: the quantity-weighted cost of the batches it took from.
    public static decimal UnitCostOf(IReadOnlyList<Take> takes)
    {
        var quantity = takes.Sum(take => take.Quantity);
        return quantity <= 0 ? 0 : decimal.Round(takes.Sum(take => take.Quantity * take.UnitCost) / quantity, 4);
    }

    // Splits a sale quantity across the branch's unexpired batches of the item, earliest expiry first. A batch with no
    // expiry date is used after those, and stock with no batch at all is used last. Throws when unexpired stock cannot
    // cover the quantity, saying how much is expired.
    public static async Task<IReadOnlyList<Take>> AllocateAsync(DbConnection db, DbTransaction tx, int branch, long item, decimal quantity, DateTime today, Func<string, Exception> error, CancellationToken ct)
    {
        var batches = new List<(long? Line, decimal Remaining, bool Expired, decimal Cost)>();
        await using (var command = db.CreateCommand())
        {
            command.Transaction = tx;
            command.CommandText = $"SELECT pl.PurchaseLineId,b.Remaining,CASE WHEN pl.ExpiryDate<@today THEN 1 ELSE 0 END,COALESCE({CostSql("pl.PurchaseLineId")},0) FROM dbo.PurchaseLines pl JOIN dbo.Purchases p ON p.PurchaseId=pl.PurchaseId CROSS APPLY (SELECT {RemainingSql} AS Remaining) b WHERE p.BranchId=@branch AND pl.ItemId=@item AND p.Status=N'POSTED' AND b.Remaining>0 ORDER BY CASE WHEN pl.ExpiryDate IS NULL THEN 1 ELSE 0 END,pl.ExpiryDate,p.PurchaseDate,pl.PurchaseLineId";
            Add(command, "@branch", branch, DbType.Int32); Add(command, "@item", item, DbType.Int64); Add(command, "@today", today.Date, DbType.Date);
            await using var reader = await command.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) batches.Add((reader.GetInt64(0), reader.GetDecimal(1), reader.GetInt32(2) == 1, reader.GetDecimal(3)));
        }
        await using (var command = db.CreateCommand())
        {
            command.Transaction = tx;
            command.CommandText = $"SELECT COALESCE(SUM(Quantity),0),{UnbatchedCostSql} FROM dbo.StockMovements WHERE BranchId=@branch AND ItemId=@item AND PurchaseLineId IS NULL AND PostingStatus=N'POSTED'";
            Add(command, "@branch", branch, DbType.Int32); Add(command, "@item", item, DbType.Int64);
            await using var reader = await command.ExecuteReaderAsync(ct);
            await reader.ReadAsync(ct);
            var unbatched = reader.GetDecimal(0);
            if (unbatched > 0) batches.Add((null, unbatched, false, reader.GetDecimal(1)));
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
            takes.Add(new(batch.Line, take, batch.Cost));
            left -= take;
        }
        return takes;
    }

    // Spreads a returned quantity back over the batches a sale line took from, latest expiry first, each at the cost it
    // left that batch at. Whatever no batch can take back (a sale from before batches were tracked) comes back without a
    // batch at the sale line's cost.
    public static async Task<IReadOnlyList<Take>> ReturnAsync(DbConnection db, DbTransaction tx, long saleLineId, decimal quantity, decimal saleLineCost, CancellationToken ct)
    {
        var taken = new List<(long Line, decimal Quantity, decimal Cost)>();
        await using (var command = db.CreateCommand())
        {
            command.Transaction = tx;
            command.CommandText = "SELECT t.PurchaseLineId,t.Taken,t.Cost FROM (SELECT sm.PurchaseLineId,-SUM(sm.Quantity) AS Taken,COALESCE(SUM(CASE WHEN sm.Quantity<0 THEN -sm.Quantity*sm.UnitCost END)/NULLIF(SUM(CASE WHEN sm.Quantity<0 THEN -sm.Quantity END),0),0) AS Cost FROM dbo.StockMovements sm WHERE sm.SaleLineId=@line AND sm.PurchaseLineId IS NOT NULL AND sm.PostingStatus=N'POSTED' GROUP BY sm.PurchaseLineId) t JOIN dbo.PurchaseLines pl ON pl.PurchaseLineId=t.PurchaseLineId WHERE t.Taken>0 ORDER BY CASE WHEN pl.ExpiryDate IS NULL THEN 0 ELSE 1 END,pl.ExpiryDate DESC,pl.PurchaseLineId DESC";
            Add(command, "@line", saleLineId, DbType.Int64);
            await using var reader = await command.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) taken.Add((reader.GetInt64(0), reader.GetDecimal(1), reader.GetDecimal(2)));
        }
        var result = new List<Take>();
        var left = quantity;
        foreach (var (line, available, cost) in taken)
        {
            if (left <= 0) break;
            var back = Math.Min(left, available);
            result.Add(new(line, back, cost));
            left -= back;
        }
        if (left > 0) result.Add(new(null, left, saleLineCost));
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
