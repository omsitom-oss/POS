using System.Data;
using System.Data.Common;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

public sealed class InventoryService(DbConnectionFactory factory, TransactionService transactions)
{
    public async Task<IReadOnlyList<InventoryItemDto>> GetAsync(int branchId, CancellationToken ct)
    {
        if (branchId <= 0) throw new InventoryException("A valid branch is required.");
        await using var db = factory.CreateConnection();
        await db.OpenAsync(ct);
        await using var command = db.CreateCommand();
        command.CommandText = """
            SELECT i.ItemId,i.ItemCode,i.NameAr,i.NameEn,baseUnit.ValueAr,baseUnit.ValueEn,
                   COALESCE(SUM(CASE WHEN sm.PostingStatus=N'POSTED' THEN sm.Quantity ELSE 0 END),0),
                   i.SellPrice,lastPurchase.LastPurchasePrice,i.MinimumLevelForAlert,i.IsActive
            FROM dbo.Items i
            OUTER APPLY (SELECT TOP 1 s.ValueAr,s.ValueEn FROM dbo.ItemUnits iu JOIN dbo.Settings s ON s.SettingId=iu.UnitSettingId WHERE iu.ItemId=i.ItemId AND iu.IsBase=1) baseUnit
            LEFT JOIN dbo.StockMovements sm ON sm.ItemId=i.ItemId AND sm.BranchId=@branch
            OUTER APPLY (
                SELECT TOP 1 pl.UnitPrice AS LastPurchasePrice
                FROM dbo.PurchaseLines pl JOIN dbo.Purchases p ON p.PurchaseId=pl.PurchaseId AND p.Status=N'POSTED'
                WHERE pl.ItemId=i.ItemId ORDER BY COALESCE(p.PostedAt,p.CreatedAt) DESC,p.PurchaseId DESC,pl.PurchaseLineId DESC
            ) lastPurchase
            WHERE i.IsActive=1
            GROUP BY i.ItemId,i.ItemCode,i.NameAr,i.NameEn,baseUnit.ValueAr,baseUnit.ValueEn,i.SellPrice,lastPurchase.LastPurchasePrice,i.MinimumLevelForAlert,i.IsActive
            ORDER BY i.ItemCode
            """;
        Add(command, "@branch", branchId, DbType.Int32);
        var rows = new List<InventoryItemDto>();
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) rows.Add(new(
            reader.GetInt64(0), reader.GetString(1), reader.GetString(2), reader.GetString(3),
            reader.IsDBNull(4) ? null : reader.GetString(4), reader.IsDBNull(5) ? null : reader.GetString(5),
            reader.GetDecimal(6), reader.GetDecimal(7), reader.IsDBNull(8) ? null : reader.GetDecimal(8),
            reader.GetInt32(9), reader.GetBoolean(10)));
        return rows;
    }

    public async Task<IReadOnlyList<InventoryBatchDto>> GetBatchesAsync(int branchId, long itemId, CancellationToken ct)
    {
        await using var db = factory.CreateConnection(); await db.OpenAsync(ct); await using var command = db.CreateCommand();
        command.CommandText = $"SELECT pl.PurchaseLineId,p.InvoiceNo,p.PurchaseDate,pl.Barcode,pl.ExpiryDate,pl.BatchNo,pl.Quantity,{StockBatches.RemainingSql},pl.UnitPrice FROM dbo.PurchaseLines pl JOIN dbo.Purchases p ON p.PurchaseId=pl.PurchaseId WHERE p.BranchId=@branch AND pl.ItemId=@item AND p.Status=N'POSTED' ORDER BY pl.ExpiryDate,p.PurchaseDate,pl.PurchaseLineId";
        Add(command,"@branch",branchId,DbType.Int32); Add(command,"@item",itemId,DbType.Int64);
        var rows=new List<InventoryBatchDto>(); await using var reader=await command.ExecuteReaderAsync(ct); while(await reader.ReadAsync(ct)) rows.Add(new(reader.GetInt64(0),reader.GetString(1),reader.GetDateTime(2),reader.IsDBNull(3)?null:reader.GetString(3),reader.IsDBNull(4)?null:reader.GetDateTime(4),reader.GetString(5),reader.GetDecimal(6),reader.GetDecimal(7),reader.GetDecimal(8))); return rows;
    }

    public async Task<InventoryRequestDto> CreateDisposalAsync(InventoryDisposalRequest request, CancellationToken ct)
    {
        if (request.Quantity <= 0 || string.IsNullOrWhiteSpace(request.Reason)) throw new InventoryException("A positive quantity and disposal reason are required.");
        await using var db=factory.CreateConnection(); await db.OpenAsync(ct); await using var tx=await db.BeginTransactionAsync(IsolationLevel.Serializable,ct);
        try
        {
            var branch=request.BranchId ?? 0; if(branch<=0) throw new InventoryException("A valid branch is required.");
            await using var line=db.CreateCommand(); line.Transaction=tx; line.CommandText="SELECT p.BranchId,pl.ItemId,pl.PurchaseId,pl.Quantity,pl.UnitPrice FROM dbo.PurchaseLines pl JOIN dbo.Purchases p ON p.PurchaseId=pl.PurchaseId WHERE pl.PurchaseLineId=@line AND p.BranchId=@branch AND p.Status=N'POSTED'"; Add(line,"@line",request.PurchaseLineId,DbType.Int64); Add(line,"@branch",branch,DbType.Int32);
            await using var reader=await line.ExecuteReaderAsync(ct); if(!await reader.ReadAsync(ct)) throw new InventoryException("The selected batch was not found."); var item=reader.GetInt64(1); var purchase=reader.GetInt64(2); var available=reader.GetDecimal(3); var cost=reader.GetDecimal(4); await reader.CloseAsync(); if(item!=request.ItemId) throw new InventoryException("The selected batch does not belong to this item.");
            // What is still in the batch, less pending disposals and pending purchase returns, is the batch limit; the branch stock
            // check below also covers stock moved before batches were tracked.
            if(request.Quantity>await StockBatches.FreeInBatchAsync(db,tx,request.PurchaseLineId,0,0,ct)) throw new InventoryException("The disposal quantity exceeds the available batch quantity.");
            if(request.Quantity>await BranchStockAsync(db,tx,branch,item,reserved:true,excludeRequestId:0,ct)) throw new InventoryException("The disposal quantity exceeds the stock in this branch.");
            var requires=true; await using(var setting=db.CreateCommand()){setting.Transaction=tx;setting.CommandText="SELECT COALESCE((SELECT RequiresApproval FROM dbo.ApprovalSettings WHERE RequestType=N'INVENTORY_DISPOSAL'),1)";requires=Convert.ToBoolean(await setting.ExecuteScalarAsync(ct));}
            await using var insert=db.CreateCommand(); insert.Transaction=tx; insert.CommandText="INSERT INTO dbo.InventoryRequests(RequestType,BranchId,ItemId,PurchaseLineId,Quantity,Reason,Status,RequestedBy) OUTPUT INSERTED.RequestId,INSERTED.CreatedAt VALUES(N'INVENTORY_DISPOSAL',@branch,@item,@line,@qty,@reason,N'PENDING',@requested)";
            Add(insert,"@branch",branch,DbType.Int32);Add(insert,"@item",item,DbType.Int64);Add(insert,"@line",request.PurchaseLineId,DbType.Int64);Add(insert,"@qty",request.Quantity,DbType.Decimal);Add(insert,"@reason",request.Reason.Trim(),DbType.String);Add(insert,"@requested",request.RequestedBy,DbType.Int32); await using var result=await insert.ExecuteReaderAsync(ct); await result.ReadAsync(ct); var requestId=result.GetInt64(0); var created=result.GetDateTime(1); await result.CloseAsync();
            if(!requires) await PostDisposalAsync(db,tx,requestId,branch,item,purchase,request.PurchaseLineId,request.Quantity,cost,request.RequestedBy,ct);
            await tx.CommitAsync(ct);
            return new(requestId,"INVENTORY_DISPOSAL",item,request.PurchaseLineId,request.Quantity,request.Reason.Trim(),requires?"PENDING":"APPROVED",request.RequestedBy,created,requires?null:request.RequestedBy,requires?null:DateTime.UtcNow);
        }
        catch (TransactionException ex) { await tx.RollbackAsync(ct); throw new InventoryException(ex.Message, ex.StatusCode); }
        catch { await tx.RollbackAsync(ct); throw; }
    }

    // The request row is locked and re-read, so two approvals of the same request cannot both take the stock out.
    public async Task<InventoryRequestDto?> ApproveDisposalAsync(long requestId, int? reviewerId, CancellationToken ct)
    {
        await using var db=factory.CreateConnection(); await db.OpenAsync(ct); await using var tx=await db.BeginTransactionAsync(IsolationLevel.Serializable,ct);
        try
        {
            await using var command=db.CreateCommand(); command.Transaction=tx; command.CommandText="SELECT r.BranchId,r.ItemId,r.PurchaseLineId,r.Quantity,r.RequestedBy,r.Reason,r.Status,r.CreatedAt,pl.PurchaseId,pl.UnitPrice FROM dbo.InventoryRequests r WITH (UPDLOCK,HOLDLOCK) JOIN dbo.PurchaseLines pl ON pl.PurchaseLineId=r.PurchaseLineId WHERE r.RequestId=@id AND r.RequestType=N'INVENTORY_DISPOSAL'"; Add(command,"@id",requestId,DbType.Int64);
            await using var reader=await command.ExecuteReaderAsync(ct); if(!await reader.ReadAsync(ct)) return null; var branch=reader.GetInt32(0);var item=reader.GetInt64(1);var line=reader.GetInt64(2);var qty=reader.GetDecimal(3);var requested=reader.IsDBNull(4)?(int?)null:reader.GetInt32(4);var reason=reader.GetString(5);var status=reader.GetString(6);var created=reader.GetDateTime(7);var purchase=reader.GetInt64(8);var cost=reader.GetDecimal(9);await reader.CloseAsync();
            if(status!="PENDING") throw new InventoryException("Only pending requests can be approved.");
            // Stock may have been sold since the request was made.
            if(qty>await BranchStockAsync(db,tx,branch,item,reserved:false,excludeRequestId:requestId,ct)) throw new InventoryException("The disposal quantity exceeds the stock in this branch.");
            if(qty>await StockBatches.FreeInBatchAsync(db,tx,line,requestId,0,ct)) throw new InventoryException("The disposal quantity exceeds the available batch quantity.");
            await PostDisposalAsync(db,tx,requestId,branch,item,purchase,line,qty,cost,reviewerId,ct);
            await tx.CommitAsync(ct);
            return new(requestId,"INVENTORY_DISPOSAL",item,line,qty,reason,"APPROVED",requested,created,reviewerId,DateTime.UtcNow);
        }
        catch (TransactionException ex) { await tx.RollbackAsync(ct); throw new InventoryException(ex.Message, ex.StatusCode); }
        catch { await tx.RollbackAsync(ct); throw; }
    }

    public async Task<int?> GetRequestBranchIdAsync(long requestId, CancellationToken ct)
    {
        await using var db=factory.CreateConnection(); await db.OpenAsync(ct); await using var command=db.CreateCommand(); command.CommandText="SELECT BranchId FROM dbo.InventoryRequests WHERE RequestId=@id"; Add(command,"@id",requestId,DbType.Int64);
        return await command.ExecuteScalarAsync(ct) is { } value and not DBNull ? Convert.ToInt32(value) : null;
    }

    public async Task<IReadOnlyList<InventoryRequestDto>> GetRequestsAsync(int branchId, string? status, CancellationToken ct)
    {
        await using var db=factory.CreateConnection(); await db.OpenAsync(ct); await using var command=db.CreateCommand(); command.CommandText="SELECT RequestId,RequestType,ItemId,PurchaseLineId,Quantity,Reason,Status,RequestedBy,CreatedAt,ReviewedBy,ReviewedAt FROM dbo.InventoryRequests WHERE BranchId=@branch AND (@status IS NULL OR Status=@status) ORDER BY CreatedAt DESC,RequestId DESC"; Add(command,"@branch",branchId,DbType.Int32); Add(command,"@status",string.IsNullOrWhiteSpace(status)?null:status.Trim().ToUpperInvariant(),DbType.String); var rows=new List<InventoryRequestDto>(); await using var reader=await command.ExecuteReaderAsync(ct); while(await reader.ReadAsync(ct)) rows.Add(new(reader.GetInt64(0),reader.GetString(1),reader.GetInt64(2),reader.IsDBNull(3)?null:reader.GetInt64(3),reader.GetDecimal(4),reader.GetString(5),reader.GetString(6),reader.IsDBNull(7)?null:reader.GetInt32(7),reader.GetDateTime(8),reader.IsDBNull(9)?null:reader.GetInt32(9),reader.IsDBNull(10)?null:reader.GetDateTime(10))); return rows;
    }

    // Posted stock of an item in a branch. With reserved, pending disposals and pending purchase returns are taken off too.
    private static async Task<decimal> BranchStockAsync(DbConnection db,DbTransaction tx,int branch,long item,bool reserved,long excludeRequestId,CancellationToken ct)
    {
        await using var command=db.CreateCommand(); command.Transaction=tx;
        command.CommandText="SELECT COALESCE((SELECT SUM(Quantity) FROM dbo.StockMovements WHERE BranchId=@branch AND ItemId=@item AND PostingStatus=N'POSTED'),0)"+
            (reserved?"-COALESCE((SELECT SUM(Quantity) FROM dbo.InventoryRequests WHERE BranchId=@branch AND ItemId=@item AND RequestType=N'INVENTORY_DISPOSAL' AND Status=N'PENDING' AND RequestId<>@exclude),0)-COALESCE((SELECT SUM(rl.Quantity) FROM dbo.PurchaseReturnLines rl JOIN dbo.PurchaseReturns r ON r.PurchaseReturnId=rl.PurchaseReturnId WHERE r.BranchId=@branch AND rl.ItemId=@item AND r.Status=N'PENDING'),0)":"");
        Add(command,"@branch",branch,DbType.Int32); Add(command,"@item",item,DbType.Int64); Add(command,"@exclude",excludeRequestId,DbType.Int64);
        return Convert.ToDecimal(await command.ExecuteScalarAsync(ct));
    }

    // Takes the stock out and writes the loss journal inside the caller's transaction.
    private async Task PostDisposalAsync(DbConnection db,DbTransaction tx,long requestId,int branch,long item,long purchase,long purchaseLine,decimal quantity,decimal cost,int? reviewer,CancellationToken ct)
    {
        await using(var stock=db.CreateCommand()){stock.Transaction=tx;stock.CommandText="INSERT INTO dbo.StockMovements(BranchId,ItemId,PurchaseId,PurchaseLineId,Quantity,UnitCost,PostingStatus) VALUES(@branch,@item,@purchase,@batch,@qty,@cost,N'POSTED')";Add(stock,"@branch",branch,DbType.Int32);Add(stock,"@item",item,DbType.Int64);Add(stock,"@purchase",purchase,DbType.Int64);Add(stock,"@batch",purchaseLine,DbType.Int64);Add(stock,"@qty",-quantity,DbType.Decimal);Add(stock,"@cost",cost,DbType.Decimal);await stock.ExecuteNonQueryAsync(ct);}
        await using(var update=db.CreateCommand()){update.Transaction=tx;update.CommandText="UPDATE dbo.InventoryRequests SET Status=N'APPROVED',ReviewedBy=@reviewer,ReviewedAt=SYSUTCDATETIME() WHERE RequestId=@id AND Status=N'PENDING'";Add(update,"@reviewer",reviewer,DbType.Int32);Add(update,"@id",requestId,DbType.Int64);if(await update.ExecuteNonQueryAsync(ct)!=1) throw new InventoryException("Only pending requests can be approved.");}
        var amount=quantity*cost;
        if(amount<=0) return;
        int currency; await using(var primary=db.CreateCommand()){primary.Transaction=tx;primary.CommandText="SELECT TOP 1 CurrencyId FROM dbo.Currencies WHERE IsPrimary=1 AND IsActive=1";currency=await primary.ExecuteScalarAsync(ct) is { } value and not DBNull?Convert.ToInt32(value):throw new InventoryException("An active primary currency is required to post a disposal.");}
        await transactions.PostAsync(db,tx,new TransactionWriteRequest("ADJUSTMENT","DISPOSAL",$"DISPOSAL:{requestId}",null,currency,1,[new("5100",null,null,amount,0,amount,0,currency,1),new("1300",null,null,0,amount,0,amount,currency,1)],branch,null,reviewer),ct);
    }

    private static void Add(DbCommand command, string name, object? value, DbType type)
    { var parameter = command.CreateParameter(); parameter.ParameterName = name; parameter.DbType = type; parameter.Value = value ?? DBNull.Value; command.Parameters.Add(parameter); }
}

public sealed class InventoryException(string message, int statusCode = 400) : Exception(message)
{ public int StatusCode { get; } = statusCode; }

