using System.Data;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

public sealed class ReportService(DbConnectionFactory factory)
{
    public const int MaxDays=1096;
    public async Task<ReportSummary> GetSummaryAsync(int? branchId, DateTime? from, DateTime? to, CancellationToken ct)
    {
        var start=(from??DateTime.Today.AddDays(-30)).Date;var end=(to??DateTime.Today).Date;
        await using var db=factory.CreateConnection();await db.OpenAsync(ct);await using var command=db.CreateCommand();command.CommandText="SELECT COALESCE((SELECT SUM(Total) FROM dbo.Sales WHERE (@branch IS NULL OR BranchId=@branch) AND Status=N'POSTED' AND SaleDate BETWEEN @from AND @to),0),COALESCE((SELECT SUM(Total*ExchangeRateToBase) FROM dbo.Purchases WHERE (@branch IS NULL OR BranchId=@branch) AND Status=N'POSTED' AND PurchaseDate BETWEEN @from AND @to),0),COALESCE((SELECT SUM(Amount) FROM (SELECT MoveNo,SUM(CASE WHEN TreasuryId IS NOT NULL THEN Credit ELSE 0 END) Amount,TransactionDate FROM dbo.Transactions WHERE (@branch IS NULL OR BranchId=@branch) AND TransactionType=N'EXPENSE' AND TransactionDate BETWEEN @from AND @to GROUP BY MoveNo,TransactionDate) x),0),COALESCE((SELECT SUM(CASE WHEN TransactionType=N'RECEIPT' AND TreasuryId IS NOT NULL THEN Debit ELSE 0 END) FROM dbo.Transactions WHERE (@branch IS NULL OR BranchId=@branch) AND TransactionType=N'RECEIPT' AND TransactionDate BETWEEN @from AND @to),0),COALESCE((SELECT SUM(CASE WHEN TransactionType=N'PAYMENT' AND TreasuryId IS NOT NULL THEN Credit ELSE 0 END) FROM dbo.Transactions WHERE (@branch IS NULL OR BranchId=@branch) AND TransactionType=N'PAYMENT' AND TransactionDate BETWEEN @from AND @to),0),(SELECT COUNT(*) FROM dbo.Sales WHERE (@branch IS NULL OR BranchId=@branch) AND Status=N'POSTED' AND SaleDate BETWEEN @from AND @to),(SELECT COUNT(*) FROM dbo.Purchases WHERE (@branch IS NULL OR BranchId=@branch) AND Status=N'POSTED' AND PurchaseDate BETWEEN @from AND @to),COALESCE((SELECT SUM(Total) FROM dbo.SalesReturns WHERE (@branch IS NULL OR BranchId=@branch) AND Status=N'POSTED' AND ReturnDate BETWEEN @from AND @to),0),COALESCE((SELECT SUM(r.Total*p.ExchangeRateToBase) FROM dbo.PurchaseReturns r JOIN dbo.Purchases p ON p.PurchaseId=r.PurchaseId WHERE (@branch IS NULL OR r.BranchId=@branch) AND r.Status=N'POSTED' AND r.ReturnDate BETWEEN @from AND @to),0),COALESCE((SELECT SUM(Debit-Credit) FROM dbo.Transactions WHERE (@branch IS NULL OR BranchId=@branch) AND AccountId=N'5050' AND TransactionDate BETWEEN @from AND @to),0)";Add(command,"@branch",branchId,DbType.Int32);Add(command,"@from",start,DbType.Date);Add(command,"@to",end,DbType.Date);await using var r=await command.ExecuteReaderAsync(ct);await r.ReadAsync(ct);var sales=r.GetDecimal(0);var purchases=r.GetDecimal(1);var expenses=r.GetDecimal(2);var receipts=r.GetDecimal(3);var payments=r.GetDecimal(4);var salesReturns=r.GetDecimal(7);var purchaseReturns=r.GetDecimal(8);return new(start,end,sales,purchases,expenses,receipts,payments,(sales-salesReturns)-r.GetDecimal(9),r.GetInt32(5),r.GetInt32(6),salesReturns,purchaseReturns);
    }
    // Everything the Reports page shows for one period: the summary, the same-length period before it, a day-by-day series and the breakdowns.
    // Amounts are in the main currency. Item revenue spreads each invoice's discount over its lines, so the items add up to net sales before returns.
    public async Task<ReportOverview> GetOverviewAsync(int? branchId, DateTime? from, DateTime? to, CancellationToken ct)
    {
        var start=(from??DateTime.Today.AddDays(-30)).Date;var end=(to??DateTime.Today).Date;if(end<start)(start,end)=(end,start);
        // The day series has a row per day, so a report covers at most three years back from its end date.
        if((end-start).Days>MaxDays-1)start=end.AddDays(-(MaxDays-1));
        var length=(end-start).Days+1;
        var summary=await GetSummaryAsync(branchId,start,end,ct);var previous=await GetSummaryAsync(branchId,start.AddDays(-length),start.AddDays(-1),ct);
        await using var db=factory.CreateConnection();await db.OpenAsync(ct);
        async Task<List<T>> Query<T>(string sql,Func<System.Data.Common.DbDataReader,T> map)
        {
            await using var command=db.CreateCommand();command.CommandText=sql;Add(command,"@branch",branchId,DbType.Int32);Add(command,"@from",start,DbType.Date);Add(command,"@to",end,DbType.Date);
            var rows=new List<T>();await using var r=await command.ExecuteReaderAsync(ct);while(await r.ReadAsync(ct))rows.Add(map(r));return rows;
        }
        const string Sales="FROM dbo.Sales s WHERE (@branch IS NULL OR s.BranchId=@branch) AND s.Status=N'POSTED' AND s.SaleDate BETWEEN @from AND @to";
        const string Returns="FROM dbo.SalesReturns sr WHERE (@branch IS NULL OR sr.BranchId=@branch) AND sr.Status=N'POSTED' AND sr.ReturnDate BETWEEN @from AND @to";
        const string Cost="FROM dbo.Transactions t WHERE (@branch IS NULL OR t.BranchId=@branch) AND t.AccountId=N'5050' AND t.TransactionDate BETWEEN @from AND @to";

        var salesByDay=(await Query($"SELECT s.SaleDate,SUM(s.Total),COUNT(*) {Sales} GROUP BY s.SaleDate",r=>(r.GetDateTime(0).Date,r.GetDecimal(1),r.GetInt32(2)))).ToDictionary(x=>x.Item1);
        var returnsByDay=(await Query($"SELECT sr.ReturnDate,SUM(sr.Total) {Returns} GROUP BY sr.ReturnDate",r=>(r.GetDateTime(0).Date,r.GetDecimal(1)))).ToDictionary(x=>x.Item1,x=>x.Item2);
        var costByDay=(await Query($"SELECT t.TransactionDate,SUM(t.Debit-t.Credit) {Cost} GROUP BY t.TransactionDate",r=>(r.GetDateTime(0).Date,r.GetDecimal(1)))).ToDictionary(x=>x.Item1,x=>x.Item2);
        var days=Enumerable.Range(0,length).Select(i=>start.AddDays(i)).Select(d=>new ReportDay(d,salesByDay.TryGetValue(d,out var s)?s.Item2:0,returnsByDay.GetValueOrDefault(d),costByDay.GetValueOrDefault(d),salesByDay.TryGetValue(d,out var c)?c.Item3:0)).ToList();

        var items=await Query("SELECT TOP 10 i.ItemId,i.ItemCode,i.NameAr,i.NameEn,SUM(l.Quantity),SUM(l.LineTotal*CASE WHEN s.Total+s.Discount>0 THEN s.Total/(s.Total+s.Discount) ELSE 1 END),SUM(l.Quantity*l.UnitCost) FROM dbo.SaleLines l JOIN dbo.Sales s ON s.SaleId=l.SaleId JOIN dbo.Items i ON i.ItemId=l.ItemId WHERE (@branch IS NULL OR s.BranchId=@branch) AND s.Status=N'POSTED' AND s.SaleDate BETWEEN @from AND @to GROUP BY i.ItemId,i.ItemCode,i.NameAr,i.NameEn ORDER BY 6 DESC,i.ItemId",r=>new ReportItem(r.GetInt64(0),r.GetString(1),r.GetString(2),r.GetString(3),r.GetDecimal(4),Math.Round(r.GetDecimal(5),2),r.GetDecimal(6)));
        var expenses=await Query("SELECT t.AccountId,COALESCE(MAX(a.NameAr),t.AccountId),COALESCE(MAX(a.NameEn),t.AccountId),SUM(t.Debit-t.Credit) FROM dbo.Transactions t LEFT JOIN dbo.Accounts a ON a.AccountCode=t.AccountId AND a.BranchId=t.BranchId WHERE (@branch IS NULL OR t.BranchId=@branch) AND t.TransactionType=N'EXPENSE' AND t.TreasuryId IS NULL AND t.TransactionDate BETWEEN @from AND @to GROUP BY t.AccountId HAVING SUM(t.Debit-t.Credit)<>0 ORDER BY 4 DESC",r=>new ReportExpense(r.GetString(0),r.GetString(1),r.GetString(2),r.GetDecimal(3)));
        var payments=(await Query($"SELECT COALESCE(SUM(CASE WHEN s.TreasuryId IS NOT NULL THEN s.Total END),0),COALESCE(SUM(CASE WHEN s.TreasuryId IS NULL THEN s.Total END),0),COUNT(CASE WHEN s.TreasuryId IS NOT NULL THEN 1 END),COUNT(CASE WHEN s.TreasuryId IS NULL THEN 1 END) {Sales}",r=>new ReportPayments(r.GetDecimal(0),r.GetDecimal(1),r.GetInt32(2),r.GetInt32(3))))[0];

        var branchSales=await Query($"SELECT s.BranchId,SUM(s.Total),COUNT(*) {Sales} GROUP BY s.BranchId",r=>(r.GetInt32(0),r.GetDecimal(1),r.GetInt32(2)));
        var branchReturns=(await Query($"SELECT sr.BranchId,SUM(sr.Total) {Returns} GROUP BY sr.BranchId",r=>(r.GetInt32(0),r.GetDecimal(1)))).ToDictionary(x=>x.Item1,x=>x.Item2);
        var branchCost=(await Query($"SELECT t.BranchId,SUM(t.Debit-t.Credit) {Cost} AND t.BranchId IS NOT NULL GROUP BY t.BranchId",r=>(r.GetInt32(0),r.GetDecimal(1)))).ToDictionary(x=>x.Item1,x=>x.Item2);
        var branchNames=(await Query("SELECT BranchId,NameAr,NameEn FROM dbo.Branches",r=>(r.GetInt32(0),r.GetString(1),r.GetString(2)))).ToDictionary(x=>x.Item1);
        var branches=branchSales.Select(b=>new ReportBranch(b.Item1,branchNames.TryGetValue(b.Item1,out var n)?n.Item2:b.Item1.ToString(),branchNames.TryGetValue(b.Item1,out var e)?e.Item3:b.Item1.ToString(),b.Item2,b.Item2-branchReturns.GetValueOrDefault(b.Item1)-branchCost.GetValueOrDefault(b.Item1),b.Item3)).OrderByDescending(b=>b.Sales).ToList();
        var cashiers=await Query("SELECT s.SavedBy,MAX(u.UserName),SUM(s.Total),COUNT(*) FROM dbo.Sales s LEFT JOIN dbo.Users u ON u.UserId=s.SavedBy WHERE (@branch IS NULL OR s.BranchId=@branch) AND s.Status=N'POSTED' AND s.SaleDate BETWEEN @from AND @to GROUP BY s.SavedBy ORDER BY 3 DESC",r=>new ReportCashier(r.IsDBNull(0)?null:r.GetInt32(0),r.IsDBNull(1)?null:r.GetString(1),r.GetDecimal(2),r.GetInt32(3)));
        return new(summary,previous,days,items,expenses,payments,branches,cashiers);
    }
    private static void Add(System.Data.Common.DbCommand c,string n,object? v,DbType t){var p=c.CreateParameter();p.ParameterName=n;p.DbType=t;p.Value=v??DBNull.Value;c.Parameters.Add(p);}
}
