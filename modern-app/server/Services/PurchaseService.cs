using System.Data;
using System.Data.Common;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

public sealed class PurchaseService(DbConnectionFactory factory, TransactionService transactions)
{
    public async Task<IReadOnlyList<PurchaseListItem>> GetAsync(int? branchId, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct); await using var cmd = db.CreateCommand(); cmd.CommandText = "SELECT p.PurchaseId,p.InvoiceNo,p.PurchaseDate,p.SupplierPartnerId,partner.PartnerName,p.Status,p.CurrencyId,c.CurrencyCode,c.Symbol,p.Total,COUNT(l.PurchaseLineId),CASE WHEN p.PurchaseType=N'IMPORT' OR p.Description LIKE N'IMPORT:%' THEN N'IMPORT' ELSE p.PurchaseType END,p.LandedCostBase,p.CountryId FROM dbo.Purchases p JOIN dbo.Partners partner ON partner.PartnerId=p.SupplierPartnerId JOIN dbo.Currencies c ON c.CurrencyId=p.CurrencyId LEFT JOIN dbo.PurchaseLines l ON l.PurchaseId=p.PurchaseId WHERE (@branch IS NULL OR p.BranchId=@branch) GROUP BY p.PurchaseId,p.InvoiceNo,p.PurchaseDate,p.SupplierPartnerId,partner.PartnerName,p.Status,p.CurrencyId,c.CurrencyCode,c.Symbol,p.Total,p.PurchaseType,p.Description,p.LandedCostBase,p.CountryId ORDER BY p.PurchaseDate DESC,p.PurchaseId DESC"; Add(cmd, "@branch", branchId, DbType.Int32);
        var rows = new List<PurchaseListItem>(); await using var reader = await cmd.ExecuteReaderAsync(ct); while (await reader.ReadAsync(ct)) rows.Add(new(reader.GetInt64(0),reader.GetString(1),reader.GetDateTime(2),reader.GetInt32(3),reader.GetString(4),reader.GetString(5),reader.GetInt32(6),reader.GetString(7),reader.GetString(8),reader.GetDecimal(9),reader.GetInt32(10),reader.GetString(11),reader.IsDBNull(12)?null:reader.GetDecimal(12),reader.IsDBNull(13)?null:reader.GetInt32(13))); return rows;
    }
    public async Task<int?> GetBranchIdAsync(long purchaseId, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct); await using var cmd = db.CreateCommand(); cmd.CommandText = "SELECT BranchId FROM dbo.Purchases WHERE PurchaseId=@id"; Add(cmd, "@id", purchaseId, DbType.Int64);
        return await cmd.ExecuteScalarAsync(ct) is { } value and not DBNull ? Convert.ToInt32(value) : null;
    }
    public async Task<PurchaseDetail?> GetByIdAsync(long id, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        await using var head = db.CreateCommand();
        head.CommandText = "SELECT p.PurchaseId,p.InvoiceNo,p.PurchaseDate,p.SupplierPartnerId,partner.PartnerName,p.Status,p.CurrencyId,c.CurrencyCode,c.Symbol,p.Total,p.Discount,p.Description,p.PurchaseType,p.ExchangeRateToBase,p.LandedCostBase,p.CountryId FROM dbo.Purchases p JOIN dbo.Partners partner ON partner.PartnerId=p.SupplierPartnerId JOIN dbo.Currencies c ON c.CurrencyId=p.CurrencyId WHERE p.PurchaseId=@id";
        Add(head, "@id", id, DbType.Int64);
        await using var reader = await head.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        var detailDescription = reader.IsDBNull(11) ? null : reader.GetString(11);
        var detailPurchaseType = reader.IsDBNull(12) ? "LOCAL" : reader.GetString(12);
        if (detailPurchaseType != "IMPORT" && detailDescription?.StartsWith("IMPORT:", StringComparison.OrdinalIgnoreCase) == true) detailPurchaseType = "IMPORT";
        var detail = new PurchaseDetail(reader.GetInt64(0), reader.GetString(1), reader.GetDateTime(2), reader.GetInt32(3), reader.GetString(4), reader.GetString(5), reader.GetInt32(6), reader.GetString(7), reader.GetString(8), reader.GetDecimal(9), reader.GetDecimal(10), reader.IsDBNull(11) ? null : reader.GetString(11), [], detailPurchaseType, reader.GetDecimal(13), reader.IsDBNull(14)?null:reader.GetDecimal(14), reader.IsDBNull(15)?null:reader.GetInt32(15));
        await reader.CloseAsync();
        await using var lines = db.CreateCommand();
        lines.CommandText = "SELECT l.PurchaseLineId,l.ItemId,COALESCE(i.NameEn,i.NameAr),u.ValueEn,l.Quantity,l.UnitPrice,l.LineTotal,l.ExpiryDate,l.Barcode,l.BatchNo FROM dbo.PurchaseLines l JOIN dbo.Items i ON i.ItemId=l.ItemId LEFT JOIN dbo.Settings u ON u.SettingId=l.UnitSettingId WHERE l.PurchaseId=@id ORDER BY l.PurchaseLineId";
        Add(lines, "@id", id, DbType.Int64);
        var items = new List<PurchaseLineDetail>();
        await using var lineReader = await lines.ExecuteReaderAsync(ct);
        while (await lineReader.ReadAsync(ct)) items.Add(new(lineReader.GetInt64(0), lineReader.GetInt64(1), lineReader.GetString(2), lineReader.IsDBNull(3) ? null : lineReader.GetString(3), lineReader.GetDecimal(4), lineReader.GetDecimal(5), lineReader.GetDecimal(6), lineReader.IsDBNull(7) ? null : lineReader.GetDateTime(7), lineReader.IsDBNull(8) ? null : lineReader.GetString(8), lineReader.IsDBNull(9) ? null : lineReader.GetString(9)));
        return detail with { Lines = items };
    }
    public async Task<PurchaseDetail?> PostDraftAsync(long id, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct); await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            await using var head = db.CreateCommand(); head.Transaction = tx; head.CommandText = "SELECT BranchId,SupplierPartnerId,InvoiceNo,CurrencyId,Total,Description,SavedBy,Status,PurchaseType,ExchangeRateToBase FROM dbo.Purchases WHERE PurchaseId=@id"; Add(head,"@id",id,DbType.Int64);
            await using var reader = await head.ExecuteReaderAsync(ct); if (!await reader.ReadAsync(ct)) return null; var branch=reader.GetInt32(0); var supplier=reader.GetInt32(1); var invoice=reader.GetString(2); var currency=reader.GetInt32(3); var total=reader.GetDecimal(4); var description=reader.IsDBNull(5)?null:reader.GetString(5); var savedBy=reader.IsDBNull(6)?(int?)null:reader.GetInt32(6); var status=reader.GetString(7); var purchaseType=reader.GetString(8); if (purchaseType != "IMPORT" && description?.StartsWith("IMPORT:", StringComparison.OrdinalIgnoreCase) == true) purchaseType = "IMPORT"; var exchangeRate=reader.GetDecimal(9); await reader.CloseAsync(); if (status != "DRAFT") throw new PurchaseException("Only draft invoices can be received."); if (exchangeRate <= 0) throw new PurchaseException("A positive exchange rate is required.");
            await using var costs=db.CreateCommand(); costs.Transaction=tx; costs.CommandText="SELECT COALESCE(SUM(BaseAmount),0) FROM dbo.PurchaseAdditionalCosts WHERE PurchaseId=@id"; Add(costs,"@id",id,DbType.Int64); var additionalBase=Convert.ToDecimal(await costs.ExecuteScalarAsync(ct));
            await using var lines=db.CreateCommand();lines.Transaction=tx;lines.CommandText="SELECT PurchaseLineId,ItemId,Quantity,UnitPrice FROM dbo.PurchaseLines WHERE PurchaseId=@id";Add(lines,"@id",id,DbType.Int64);await using var lineReader=await lines.ExecuteReaderAsync(ct);var draftRows=new List<(long line,long item,decimal qty,decimal sourcePrice)>();while(await lineReader.ReadAsync(ct))draftRows.Add((lineReader.GetInt64(0),lineReader.GetInt64(1),lineReader.GetDecimal(2),lineReader.GetDecimal(3)));await lineReader.CloseAsync();
            var goodsBase=draftRows.Sum(row=>row.qty*row.sourcePrice*exchangeRate); var landedBase=goodsBase+additionalBase;
            if (purchaseType == "IMPORT" && goodsBase <= 0) throw new PurchaseException("Imported goods must have a positive total.");
            foreach(var row in draftRows){ var goodsLineBase=row.qty*row.sourcePrice*exchangeRate; var allocated=row.qty<=0||goodsBase<=0?0:additionalBase*(goodsLineBase/goodsBase); var finalUnitCost=(goodsLineBase+allocated)/row.qty; await using(var update=db.CreateCommand()){update.Transaction=tx;update.CommandText="UPDATE dbo.PurchaseLines SET UnitPrice=@price WHERE PurchaseLineId=@line";Add(update,"@price",finalUnitCost,DbType.Decimal);Add(update,"@line",row.line,DbType.Int64);await update.ExecuteNonQueryAsync(ct);} await using var stock=db.CreateCommand();stock.Transaction=tx;stock.CommandText="INSERT INTO dbo.StockMovements(BranchId,ItemId,PurchaseId,PurchaseLineId,Quantity,UnitCost,PostingStatus) VALUES(@branch,@item,@purchase,@line,@quantity,@price,N'POSTED')";Add(stock,"@branch",branch,DbType.Int32);Add(stock,"@item",row.item,DbType.Int64);Add(stock,"@purchase",id,DbType.Int64);Add(stock,"@line",row.line,DbType.Int64);Add(stock,"@quantity",row.qty,DbType.Decimal);Add(stock,"@price",finalUnitCost,DbType.Decimal);await stock.ExecuteNonQueryAsync(ct); }
            await using(var received=db.CreateCommand()){received.Transaction=tx;received.CommandText="UPDATE dbo.Purchases SET Status=N'POSTED',PostedAt=SYSUTCDATETIME(),ReceivedAt=SYSUTCDATETIME(),LandedCostBase=@landed WHERE PurchaseId=@id AND Status=N'DRAFT'";Add(received,"@landed",landedBase,DbType.Decimal);Add(received,"@id",id,DbType.Int64);await received.ExecuteNonQueryAsync(ct);}
            if (purchaseType != "IMPORT")
            {
                await transactions.PostAsync(db, tx, new TransactionWriteRequest("PURCHASE", "PURCHASE", invoice, description, currency, 1, [new("1300", null, null, total, 0, total, 0, currency, 1), new("2100", supplier, null, 0, total, 0, total, currency, 1)], branch, null, savedBy, exchangeRate), ct);
            }
            await tx.CommitAsync(ct);
        }
        catch (TransactionException ex) { await tx.RollbackAsync(ct); throw new PurchaseException(ex.Message, ex.StatusCode); }
        catch { await tx.RollbackAsync(ct); throw; }
        return await GetByIdAsync(id,ct);
    }
    public async Task<bool> UpdateLineMetadataAsync(long purchaseId, long lineId, PurchaseLineMetadataUpdateRequest request, CancellationToken ct)
    {
        if (request.Barcode?.Trim().Length > 100) throw new PurchaseException("Barcode must be 100 characters or fewer.");
        await using var db = await OpenAsync(ct);
        await using var command = db.CreateCommand();
        command.CommandText = "UPDATE dbo.PurchaseLines SET ExpiryDate=@expiry,Barcode=@barcode WHERE PurchaseLineId=@line AND PurchaseId=@purchase";
        Add(command, "@expiry", request.ExpiryDate?.Date, DbType.Date);
        Add(command, "@barcode", string.IsNullOrWhiteSpace(request.Barcode) ? null : request.Barcode.Trim(), DbType.String);
        Add(command, "@line", lineId, DbType.Int64);
        Add(command, "@purchase", purchaseId, DbType.Int64);
        return await command.ExecuteNonQueryAsync(ct) > 0;
    }
    public async Task<bool> DeleteDraftAsync(long id, CancellationToken ct)
    {
        await using var db=await OpenAsync(ct); await using var tx=await db.BeginTransactionAsync(IsolationLevel.Serializable,ct);
        try
        {
            await using var cmd=db.CreateCommand(); cmd.Transaction=tx; cmd.CommandText="DELETE t FROM dbo.Transactions t JOIN dbo.Purchases p ON (t.RefNo=p.InvoiceNo OR t.RefNo LIKE p.InvoiceNo + N':%') WHERE p.PurchaseId=@id AND p.Status=N'DRAFT'; DELETE FROM dbo.Purchases WHERE PurchaseId=@id AND Status=N'DRAFT';"; Add(cmd,"@id",id,DbType.Int64); var changed=await cmd.ExecuteNonQueryAsync(ct); await tx.CommitAsync(ct); return changed>0;
        }
        catch { await tx.RollbackAsync(ct); throw; }
    }
    public async Task<IReadOnlyList<PurchaseAdditionalCost>> GetCostsAsync(long purchaseId, CancellationToken ct)
    {
        await using var db=await OpenAsync(ct); await using var cmd=db.CreateCommand(); cmd.CommandText="SELECT k.PurchaseCostId,k.CostType,k.Amount,k.CurrencyId,c.CurrencyCode,c.Symbol,k.ExchangeRateToBase,k.BaseAmount,k.Description FROM dbo.PurchaseAdditionalCosts k JOIN dbo.Currencies c ON c.CurrencyId=k.CurrencyId WHERE k.PurchaseId=@id ORDER BY k.PurchaseCostId"; Add(cmd,"@id",purchaseId,DbType.Int64);
        var rows=new List<PurchaseAdditionalCost>(); await using var reader=await cmd.ExecuteReaderAsync(ct); while(await reader.ReadAsync(ct)) rows.Add(new(reader.GetInt64(0),reader.GetString(1),reader.GetDecimal(2),reader.GetInt32(3),reader.GetString(4),reader.GetString(5),reader.GetDecimal(6),reader.GetDecimal(7),reader.IsDBNull(8)?null:reader.GetString(8))); return rows;
    }
    public async Task<PurchaseAdditionalCost> AddCostAsync(long purchaseId, PurchaseAdditionalCostWriteRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.CostType) || request.Amount < 0 || request.ExchangeRateToBase <= 0 || request.CurrencyId <= 0) throw new PurchaseException("Cost type, currency, amount and exchange rate are required.");
        await using var db=await OpenAsync(ct); await using var tx=await db.BeginTransactionAsync(IsolationLevel.Serializable,ct); long id;
        try { await using var check=db.CreateCommand(); check.Transaction=tx; check.CommandText="SELECT PurchaseType,Status,InvoiceNo,BranchId,SupplierPartnerId,Description FROM dbo.Purchases WHERE PurchaseId=@id"; Add(check,"@id",purchaseId,DbType.Int64); await using var reader=await check.ExecuteReaderAsync(ct); if(!await reader.ReadAsync(ct)) throw new PurchaseException("Import invoice was not found.",404); var type=reader.GetString(0); var status=reader.GetString(1); var invoice=reader.GetString(2); var branch=reader.GetInt32(3); var supplier=reader.GetInt32(4); var description=reader.IsDBNull(5)?null:reader.GetString(5); if(type!="IMPORT" && description?.StartsWith("IMPORT:", StringComparison.OrdinalIgnoreCase)==true) type="IMPORT"; await reader.CloseAsync(); if(type!="IMPORT"||status!="DRAFT") throw new PurchaseException("Costs can only be added to an import draft.");
            var baseAmount=decimal.Round(request.Amount*request.ExchangeRateToBase,4); await using var insert=db.CreateCommand(); insert.Transaction=tx; insert.CommandText="INSERT INTO dbo.PurchaseAdditionalCosts(PurchaseId,CostType,Amount,CurrencyId,ExchangeRateToBase,BaseAmount,Description) OUTPUT INSERTED.PurchaseCostId VALUES(@purchase,@type,@amount,@currency,@rate,@base,@description)"; Add(insert,"@purchase",purchaseId,DbType.Int64);Add(insert,"@type",request.CostType.Trim(),DbType.String);Add(insert,"@amount",request.Amount,DbType.Decimal);Add(insert,"@currency",request.CurrencyId,DbType.Int32);Add(insert,"@rate",request.ExchangeRateToBase,DbType.Decimal);Add(insert,"@base",baseAmount,DbType.Decimal);Add(insert,"@description",request.Description,DbType.String); id=Convert.ToInt64(await insert.ExecuteScalarAsync(ct));
            if (baseAmount > 0) { var primary=await GetPrimaryCurrencyIdAsync(db,tx,ct); await transactions.PostAsync(db,tx,new TransactionWriteRequest("PURCHASE_COST","IMPORT_COST",invoice+":COST:"+id,request.Description,primary,1,[new("1300",null,null,baseAmount,0,baseAmount,0,primary,1),new("2100",supplier,null,0,baseAmount,0,baseAmount,primary,1)],branch,null,null),ct); }
            await tx.CommitAsync(ct);
        }
        catch (TransactionException ex) { await tx.RollbackAsync(ct); throw new PurchaseException(ex.Message, ex.StatusCode); }
        catch { await tx.RollbackAsync(ct); throw; }
        return (await GetCostsAsync(purchaseId,ct)).First(x=>x.PurchaseCostId==id);
    }
    public async Task<PurchaseListItem> SaveAsync(PurchaseWriteRequest request, CancellationToken ct)
    {
        if (request.SupplierPartnerId <= 0 || request.Lines is null || request.Lines.Count == 0) throw new PurchaseException("Supplier, currency and at least one item are required.");
        var status = string.Equals(request.Status, "POSTED", StringComparison.OrdinalIgnoreCase) ? "POSTED" : "DRAFT"; var branch = request.BranchId; long id;
        await using var db = await OpenAsync(ct); await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            if (!branch.HasValue) { await using var b=db.CreateCommand(); b.Transaction=tx; b.CommandText="SELECT TOP 1 BranchId FROM dbo.Branches WHERE IsActive=1 ORDER BY BranchId"; branch=Convert.ToInt32(await b.ExecuteScalarAsync(ct)); }
            var currencyId = request.CurrencyId;
            if (string.Equals(request.PurchaseType, "IMPORT", StringComparison.OrdinalIgnoreCase))
            {
                if (!request.CountryId.HasValue || request.CountryId.Value <= 0) throw new PurchaseException("Country is required for an import shipment.");
                await using var country = db.CreateCommand(); country.Transaction = tx; country.CommandText = "SELECT 1 FROM dbo.Countries WHERE CountryId=@country AND IsActive=1"; Add(country, "@country", request.CountryId.Value, DbType.Int32);
                if (await country.ExecuteScalarAsync(ct) is null) throw new PurchaseException("The selected country is not active.");
            }
            await using (var currency = db.CreateCommand())
            {
                currency.Transaction = tx;
                currency.CommandText = "SELECT TOP 1 CurrencyId FROM dbo.Currencies WHERE CurrencyId=@requested AND IsActive=1;";
                Add(currency, "@requested", currencyId, DbType.Int32);
                var existing = await currency.ExecuteScalarAsync(ct);
                if (existing is null || existing == DBNull.Value)
                {
                    currency.Parameters.Clear();
                    currency.CommandText = "SELECT TOP 1 CurrencyId FROM dbo.Currencies WHERE IsPrimary=1 AND IsActive=1";
                    existing = await currency.ExecuteScalarAsync(ct);
                }
                if (existing is null || existing == DBNull.Value)
                    throw new PurchaseException("An active currency is required before saving a purchase.");
                currencyId = Convert.ToInt32(existing);
            }
            // Invoice numbers are generated inside the serializable transaction so concurrent users
            // cannot receive the same number for the same branch.
            await using var sequence = db.CreateCommand(); sequence.Transaction = tx;
            sequence.CommandText = factory.ProviderName.Equals("SQLite", StringComparison.OrdinalIgnoreCase)
                ? "SELECT COALESCE(MAX(CAST(substr(InvoiceNo, length(@prefix) + 1) AS INTEGER)), 0) + 1 FROM Purchases WHERE BranchId=@branch AND InvoiceNo LIKE @prefix"
                : "SELECT ISNULL(MAX(TRY_CONVERT(int, SUBSTRING(InvoiceNo, LEN(@prefix), 20))), 0) + 1 FROM dbo.Purchases WITH (UPDLOCK, HOLDLOCK) WHERE BranchId=@branch AND InvoiceNo LIKE @prefix";
            Add(sequence, "@branch", branch, DbType.Int32); Add(sequence, "@prefix", $"PO-{branch}-%", DbType.String);
            var nextInvoiceNumber = Convert.ToInt32(await sequence.ExecuteScalarAsync(ct));
            var invoice = $"PO-{branch}-{nextInvoiceNumber:D5}";
            var subtotal=request.Lines.Sum(x=>x.Quantity*x.UnitPrice); if(request.Discount<0 || request.Discount>subtotal) throw new PurchaseException("Discount must be between zero and the items total."); var total=subtotal-request.Discount;
            var purchaseType=string.Equals(request.PurchaseType,"IMPORT",StringComparison.OrdinalIgnoreCase)?"IMPORT":"LOCAL"; if(request.ExchangeRateToBase<=0) throw new PurchaseException("A positive exchange rate is required."); if(purchaseType=="IMPORT" && subtotal*request.ExchangeRateToBase<=0) throw new PurchaseException("Imported goods must have a positive total.");
            await using var insert=db.CreateCommand(); insert.Transaction=tx; insert.CommandText="INSERT INTO dbo.Purchases(BranchId,SupplierPartnerId,InvoiceNo,PurchaseDate,Status,PostedAt,CurrencyId,Total,Discount,Description,SavedBy,PurchaseType,ExchangeRateToBase,CountryId) OUTPUT INSERTED.PurchaseId VALUES(@branch,@supplier,@invoice,@date,@status,@posted,@currency,@total,@discount,@description,@saved,@type,@rate,@country)"; Add(insert,"@branch",branch,DbType.Int32); Add(insert,"@supplier",request.SupplierPartnerId,DbType.Int32); Add(insert,"@invoice",invoice,DbType.String); Add(insert,"@date",(request.PurchaseDate??DateTime.Today).Date,DbType.Date); Add(insert,"@status",status,DbType.String); Add(insert,"@posted",status=="POSTED" ? DateTime.UtcNow : null,DbType.DateTime2); Add(insert,"@currency",currencyId,DbType.Int32); Add(insert,"@total",total,DbType.Decimal); Add(insert,"@discount",request.Discount,DbType.Decimal); Add(insert,"@description",request.Description,DbType.String); Add(insert,"@saved",request.SavedBy,DbType.Int32); Add(insert,"@type",purchaseType,DbType.String); Add(insert,"@rate",request.ExchangeRateToBase,DbType.Decimal); Add(insert,"@country",request.CountryId,DbType.Int32); id=Convert.ToInt64(await insert.ExecuteScalarAsync(ct));
            foreach (var line in request.Lines)
            {
                await using var unit = db.CreateCommand(); unit.Transaction = tx; unit.CommandText = "SELECT TOP 1 UnitSettingId FROM dbo.ItemUnits WHERE ItemId=@item AND IsBase=1"; Add(unit, "@item", line.ItemId, DbType.Int64); var baseUnitValue = await unit.ExecuteScalarAsync(ct); if (baseUnitValue is null) throw new PurchaseException("A base unit is required for every item."); var baseUnitId = Convert.ToInt32(baseUnitValue); var conversion = 1m; if (line.UnitSettingId.HasValue) { await using var selected = db.CreateCommand(); selected.Transaction = tx; selected.CommandText = "SELECT ConversionToBase FROM dbo.ItemUnits WHERE ItemId=@item AND UnitSettingId=@unit"; Add(selected,"@item",line.ItemId,DbType.Int64); Add(selected,"@unit",line.UnitSettingId,DbType.Int32); var selectedValue = await selected.ExecuteScalarAsync(ct); if(selectedValue is null) throw new PurchaseException("The selected unit is not valid for this item."); conversion = Convert.ToDecimal(selectedValue); }
                var baseQuantity = line.Quantity * conversion; var basePrice = conversion <= 0 ? line.UnitPrice : line.UnitPrice / conversion;
                string batchNo;
                if (!string.IsNullOrWhiteSpace(line.BatchNo)) batchNo = line.BatchNo.Trim();
                else { await using var batch = db.CreateCommand(); batch.Transaction = tx; batch.CommandText = "SELECT COUNT(*) + 1 FROM dbo.PurchaseLines pl JOIN dbo.Purchases p ON p.PurchaseId=pl.PurchaseId WHERE p.BranchId=@branch AND pl.ItemId=@item AND pl.BatchNo IS NOT NULL"; Add(batch,"@branch",branch,DbType.Int32); Add(batch,"@item",line.ItemId,DbType.Int64); batchNo = $"BCH{branch}-{line.ItemId}-{Convert.ToInt32(await batch.ExecuteScalarAsync(ct))}"; }
                await using var l=db.CreateCommand(); l.Transaction=tx; l.CommandText="INSERT INTO dbo.PurchaseLines(PurchaseId,ItemId,UnitSettingId,Quantity,UnitPrice,OriginalUnitSettingId,OriginalQuantity,OriginalUnitPrice,ExpiryDate,Barcode,BatchNo) OUTPUT INSERTED.PurchaseLineId VALUES(@purchase,@item,@unit,@quantity,@price,@originalUnit,@originalQuantity,@originalPrice,@expiry,@barcode,@batch)"; Add(l,"@purchase",id,DbType.Int64); Add(l,"@item",line.ItemId,DbType.Int64); Add(l,"@unit",baseUnitId,DbType.Int32); Add(l,"@quantity",baseQuantity,DbType.Decimal); Add(l,"@price",basePrice,DbType.Decimal); Add(l,"@originalUnit",line.UnitSettingId,DbType.Int32); Add(l,"@originalQuantity",line.Quantity,DbType.Decimal); Add(l,"@originalPrice",line.UnitPrice,DbType.Decimal); Add(l,"@expiry",line.ExpiryDate?.Date,DbType.Date); Add(l,"@barcode",line.Barcode,DbType.String); Add(l,"@batch",batchNo,DbType.String); var purchaseLineId=Convert.ToInt64(await l.ExecuteScalarAsync(ct));
                if(status=="POSTED"){ await using var stock=db.CreateCommand(); stock.Transaction=tx; stock.CommandText="INSERT INTO dbo.StockMovements(BranchId,ItemId,PurchaseId,PurchaseLineId,Quantity,UnitCost,PostingStatus) VALUES(@branch,@item,@purchase,@line,@quantity,@price,N'POSTED')"; Add(stock,"@branch",branch,DbType.Int32); Add(stock,"@item",line.ItemId,DbType.Int64); Add(stock,"@purchase",id,DbType.Int64); Add(stock,"@line",purchaseLineId,DbType.Int64); Add(stock,"@quantity",baseQuantity,DbType.Decimal); Add(stock,"@price",basePrice,DbType.Decimal); await stock.ExecuteNonQueryAsync(ct); }
            }
            if ((status == "POSTED" || purchaseType == "IMPORT") && (purchaseType != "IMPORT" || subtotal * request.ExchangeRateToBase > 0))
            {
                var transactionCurrency = purchaseType == "IMPORT" ? await GetPrimaryCurrencyIdAsync(db, tx, ct) : currencyId;
                var transactionAmount = purchaseType == "IMPORT" ? subtotal * request.ExchangeRateToBase : total;
                await transactions.PostAsync(db, tx, new TransactionWriteRequest("PURCHASE", purchaseType == "IMPORT" ? "IMPORT_OPEN" : "PURCHASE", invoice, request.Description, transactionCurrency, 1, new[]
                {
                    new TransactionLineRequest("1300", null, null, transactionAmount, 0, transactionAmount, 0, transactionCurrency, 1),
                    new TransactionLineRequest("2100", request.SupplierPartnerId, null, 0, transactionAmount, 0, transactionAmount, transactionCurrency, 1)
                }, branch, request.PurchaseDate, request.SavedBy, purchaseType == "IMPORT" ? null : request.ExchangeRateToBase), ct);
            }
            // The stock and the journal commit together, so a failed journal leaves no received goods behind.
            await tx.CommitAsync(ct);
        }
        catch (TransactionException ex) { await tx.RollbackAsync(ct); throw new PurchaseException(ex.Message, ex.StatusCode); }
        catch { await tx.RollbackAsync(ct); throw; }
        return (await GetAsync(branch, ct)).First(x=>x.PurchaseId==id);
    }
    private static async Task<int> GetPrimaryCurrencyIdAsync(DbConnection db,DbTransaction tx,CancellationToken ct){await using var cmd=db.CreateCommand();cmd.Transaction=tx;cmd.CommandText="SELECT TOP 1 CurrencyId FROM dbo.Currencies WHERE IsPrimary=1 AND IsActive=1";var value=await cmd.ExecuteScalarAsync(ct);return value is null||value==DBNull.Value?1:Convert.ToInt32(value);}
    private async Task<DbConnection> OpenAsync(CancellationToken ct){var db=factory.CreateConnection();await db.OpenAsync(ct);return db;} private static void Add(DbCommand c,string n,object? v,DbType t){var p=c.CreateParameter();p.ParameterName=n;p.DbType=t;p.Value=v??DBNull.Value;c.Parameters.Add(p);}
}
public sealed class PurchaseException(string message,int statusCode=400):Exception(message){public int StatusCode{get;}=statusCode;}
