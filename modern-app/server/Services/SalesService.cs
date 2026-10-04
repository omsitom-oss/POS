using System.Data;
using System.Data.Common;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

public sealed class SalesService(DbConnectionFactory factory, TransactionService transactions)
{
    public async Task<IReadOnlyList<SaleListItem>> GetAsync(int? branchId, DateTime? from, DateTime? to, CancellationToken ct)
    {
        await using var db = factory.CreateConnection(); await db.OpenAsync(ct); await using var command = db.CreateCommand();
        command.CommandText = "SELECT s.SaleId,s.SaleNo,s.SaleDate,p.PartnerName,t.NameEn,c.Symbol,s.Total,COUNT(l.SaleLineId),s.Status FROM dbo.Sales s LEFT JOIN dbo.Partners p ON p.PartnerId=s.CustomerPartnerId LEFT JOIN dbo.Treasuries t ON t.TreasuryId=s.TreasuryId JOIN dbo.Currencies c ON c.CurrencyId=s.CurrencyId LEFT JOIN dbo.SaleLines l ON l.SaleId=s.SaleId WHERE (@branch IS NULL OR s.BranchId=@branch) AND (@from IS NULL OR s.SaleDate>=@from) AND (@to IS NULL OR s.SaleDate<=@to) GROUP BY s.SaleId,s.SaleNo,s.SaleDate,p.PartnerName,t.NameEn,c.Symbol,s.Total,s.Status ORDER BY s.SaleDate DESC,s.SaleId DESC";
        Add(command,"@branch",branchId,DbType.Int32); Add(command,"@from",from?.Date,DbType.Date); Add(command,"@to",to?.Date,DbType.Date); var rows=new List<SaleListItem>(); await using var reader=await command.ExecuteReaderAsync(ct); while(await reader.ReadAsync(ct)) rows.Add(new(reader.GetInt64(0),reader.GetString(1),reader.GetDateTime(2),reader.IsDBNull(3)?null:reader.GetString(3),reader.IsDBNull(4)?null:reader.GetString(4),reader.GetString(5),reader.GetDecimal(6),reader.GetInt32(7),reader.GetString(8))); return rows;
    }

    public async Task<SaleResult> CreateAsync(SaleWriteRequest request, CancellationToken ct)
    {
        // A customer sale goes on the customer's account and is settled later with a receipt, so it never takes a treasury.
        // A walk-in sale is paid at the till, so it always does.
        var onAccount = request.CustomerPartnerId.HasValue;
        if (onAccount && request.TreasuryId.HasValue) throw new SalesException("A customer sale goes on the customer's account, so it cannot take a treasury.");
        if (!onAccount && request.TreasuryId is not > 0) throw new SalesException("Treasury, currency and at least one item are required.");
        if (request.CurrencyId <= 0 || request.Lines is null || request.Lines.Count == 0) throw new SalesException("Treasury, currency and at least one item are required.");
        if (request.Discount < 0) throw new SalesException("Discount cannot be negative.");
        await using var db=factory.CreateConnection(); await db.OpenAsync(ct); await using var tx=await db.BeginTransactionAsync(IsolationLevel.Serializable,ct);
        try
        {
            var branch=request.BranchId ?? await DefaultBranchAsync(db,tx,ct); var subtotal=request.Lines.Sum(x=>x.Quantity*x.UnitPrice); if(request.Discount>subtotal) throw new SalesException("Discount cannot exceed the sale total.");
            if(onAccount){await using var customer=db.CreateCommand();customer.Transaction=tx;customer.CommandText="SELECT CASE WHEN pt.Code=N'SUPPLIER' OR pt.ValueEn=N'Supplier' OR pt.ValueAr=N'مورد' THEN 0 ELSE 1 END FROM dbo.Partners p JOIN dbo.Settings pt ON pt.SettingId=p.PartnerTypeSettingId WHERE p.PartnerId=@customer AND p.Status=N'ACTIVE'";Add(customer,"@customer",request.CustomerPartnerId,DbType.Int32);var isCustomer=await customer.ExecuteScalarAsync(ct);if(isCustomer is null)throw new SalesException("Choose an active customer.");if(Convert.ToInt32(isCustomer)==0)throw new SalesException("A supplier cannot be sold to on account. Choose a customer.");await using var currency=db.CreateCommand();currency.Transaction=tx;currency.CommandText="SELECT 1 FROM dbo.Currencies WHERE CurrencyId=@currency AND IsPrimary=1 AND IsActive=1";Add(currency,"@currency",request.CurrencyId,DbType.Int32);if(await currency.ExecuteScalarAsync(ct) is null)throw new SalesException("Sales must be in the primary currency.");}
            else{await using var refs=db.CreateCommand();refs.Transaction=tx;refs.CommandText="SELECT 1 FROM dbo.Treasuries t JOIN dbo.Currencies c ON c.CurrencyId=t.CurrencyId WHERE t.TreasuryId=@treasury AND t.BranchId=@branch AND t.IsActive=1 AND t.CurrencyId=@currency AND c.IsPrimary=1";Add(refs,"@branch",branch,DbType.Int32);Add(refs,"@treasury",request.TreasuryId,DbType.Int32);Add(refs,"@currency",request.CurrencyId,DbType.Int32);if(await refs.ExecuteScalarAsync(ct) is null)throw new SalesException("Sales must use an active treasury of this branch in the primary currency.");}
            await CheckPricesAndDiscountAsync(db,tx,request,subtotal,ct);
            await using var sequence=db.CreateCommand();sequence.Transaction=tx;sequence.CommandText="SELECT ISNULL(MAX(TRY_CONVERT(int,SUBSTRING(SaleNo,LEN(@prefix),20))),0)+1 FROM dbo.Sales WITH (UPDLOCK,HOLDLOCK) WHERE BranchId=@branch AND SaleNo LIKE @prefix";Add(sequence,"@branch",branch,DbType.Int32);Add(sequence,"@prefix",$"SL-{branch}-%",DbType.String);var number=Convert.ToInt32(await sequence.ExecuteScalarAsync(ct));var saleNo=$"SL-{branch}-{number:D5}";var total=subtotal-request.Discount;
            await using var insert=db.CreateCommand();insert.Transaction=tx;insert.CommandText="INSERT INTO dbo.Sales(BranchId,SaleNo,SaleDate,CustomerPartnerId,TreasuryId,CurrencyId,Status,Total,Discount,Description,SavedBy) OUTPUT INSERTED.SaleId VALUES(@branch,@no,@date,@customer,@treasury,@currency,N'POSTED',@total,@discount,@description,@saved)";Add(insert,"@branch",branch,DbType.Int32);Add(insert,"@no",saleNo,DbType.String);Add(insert,"@date",(request.SaleDate??DateTime.Today).Date,DbType.Date);Add(insert,"@customer",request.CustomerPartnerId,DbType.Int32);Add(insert,"@treasury",request.TreasuryId,DbType.Int32);Add(insert,"@currency",request.CurrencyId,DbType.Int32);Add(insert,"@total",total,DbType.Decimal);Add(insert,"@discount",request.Discount,DbType.Decimal);Add(insert,"@description",request.Description,DbType.String);Add(insert,"@saved",request.SavedBy,DbType.Int32);var saleId=Convert.ToInt64(await insert.ExecuteScalarAsync(ct));
            foreach(var line in request.Lines){if(line.ItemId<=0||line.Quantity<=0||line.UnitPrice<0)throw new SalesException("Sale lines must have positive quantities and non-negative prices.");await using var stock=db.CreateCommand();stock.Transaction=tx;stock.CommandText="SELECT COALESCE(SUM(sm.Quantity),0),COALESCE((SELECT TOP 1 pl.UnitPrice FROM dbo.PurchaseLines pl JOIN dbo.Purchases p ON p.PurchaseId=pl.PurchaseId AND p.Status=N'POSTED' WHERE pl.ItemId=@item ORDER BY p.PurchaseDate DESC,p.PurchaseId DESC),0) FROM dbo.StockMovements sm WHERE sm.BranchId=@branch AND sm.ItemId=@item AND sm.PostingStatus=N'POSTED'";Add(stock,"@branch",branch,DbType.Int32);Add(stock,"@item",line.ItemId,DbType.Int64);await using var sr=await stock.ExecuteReaderAsync(ct);await sr.ReadAsync(ct);var available=sr.GetDecimal(0);var unitCost=sr.GetDecimal(1);await sr.CloseAsync();if(line.Quantity>available)throw new SalesException("The requested quantity exceeds available stock.");await using var l=db.CreateCommand();l.Transaction=tx;l.CommandText="INSERT INTO dbo.SaleLines(SaleId,ItemId,Quantity,UnitPrice,UnitCost) VALUES(@sale,@item,@qty,@price,@cost)";Add(l,"@sale",saleId,DbType.Int64);Add(l,"@item",line.ItemId,DbType.Int64);Add(l,"@qty",line.Quantity,DbType.Decimal);Add(l,"@price",line.UnitPrice,DbType.Decimal);Add(l,"@cost",unitCost,DbType.Decimal);await l.ExecuteNonQueryAsync(ct);await using var move=db.CreateCommand();move.Transaction=tx;move.CommandText="INSERT INTO dbo.StockMovements(BranchId,ItemId,SaleId,Quantity,UnitCost,PostingStatus) VALUES(@branch,@item,@sale,@qty,@cost,N'POSTED')";Add(move,"@branch",branch,DbType.Int32);Add(move,"@item",line.ItemId,DbType.Int64);Add(move,"@sale",saleId,DbType.Int64);Add(move,"@qty",-line.Quantity,DbType.Decimal);Add(move,"@cost",unitCost,DbType.Decimal);await move.ExecuteNonQueryAsync(ct);}
            // The journal is written in the same transaction, so a sale never exists without its journal.
            // The debit lands on the customer's receivable for a customer sale and on the till for a walk-in sale.
            var debitLine=onAccount?new TransactionLineRequest($"PARTNER:{request.CustomerPartnerId}",request.CustomerPartnerId,null,total,0,total,0,request.CurrencyId,1):new TransactionLineRequest($"TREASURY:{request.TreasuryId}",null,request.TreasuryId,total,0,total,0,request.CurrencyId,1);
            await transactions.PostAsync(db,tx,new TransactionWriteRequest("SALE","SALE",saleNo,request.Description,request.CurrencyId,1,[debitLine,new("4100",null,null,0,total,0,total,request.CurrencyId,1)],branch,request.SaleDate,request.SavedBy),ct);
            await tx.CommitAsync(ct); return new(saleId,saleNo,total,request.Lines.Count);
        }catch(TransactionException ex){await tx.RollbackAsync(ct);throw new SalesException(ex.Message,ex.StatusCode);}catch{await tx.RollbackAsync(ct);throw;}
    }
    // Lines sell at the item's list price unless the seller may change prices, and the invoice discount stays within
    // the highest limit among the seller's active roles.
    private static async Task CheckPricesAndDiscountAsync(DbConnection db,DbTransaction tx,SaleWriteRequest request,decimal subtotal,CancellationToken ct)
    {
        if(!request.CanOverridePrice)
            foreach(var line in request.Lines!)
            {
                await using var price=db.CreateCommand();price.Transaction=tx;price.CommandText="SELECT SellPrice FROM dbo.Items WHERE ItemId=@item";Add(price,"@item",line.ItemId,DbType.Int64);
                var listPrice=await price.ExecuteScalarAsync(ct);
                if(listPrice is not null&&listPrice is not DBNull&&Convert.ToDecimal(listPrice)!=line.UnitPrice) throw new SalesException("You are not allowed to change sale prices. Sell at the item's list price or ask a user who may change prices.",403);
            }
        if(request.Discount<=0) return;
        await using var limit=db.CreateCommand();limit.Transaction=tx;limit.CommandText="SELECT COALESCE(MAX(r.MaxDiscountPercent),0) FROM dbo.UserRoles ur JOIN dbo.Roles r ON r.RoleId=ur.RoleId AND r.IsActive=1 WHERE ur.UserId=@user";Add(limit,"@user",request.SavedBy,DbType.Int32);
        var maxPercent=Convert.ToDecimal(await limit.ExecuteScalarAsync(ct));
        if(request.Discount*100>subtotal*maxPercent) throw new SalesException(maxPercent==0?"You are not allowed to give a discount.":$"The discount is more than your limit of {maxPercent:0.##}% of the invoice.",403);
    }
    private static async Task<int> DefaultBranchAsync(DbConnection db,DbTransaction tx,CancellationToken ct){await using var b=db.CreateCommand();b.Transaction=tx;b.CommandText="SELECT TOP 1 BranchId FROM dbo.Branches WHERE IsActive=1 ORDER BY BranchId";return Convert.ToInt32(await b.ExecuteScalarAsync(ct));}
    private static void Add(DbCommand c,string n,object? v,DbType t){var p=c.CreateParameter();p.ParameterName=n;p.DbType=t;p.Value=v??DBNull.Value;c.Parameters.Add(p);}
}
public sealed class SalesException(string message,int statusCode=400):Exception(message){public int StatusCode{get;}=statusCode;}
