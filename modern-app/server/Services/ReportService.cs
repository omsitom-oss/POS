using System.Data;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

public sealed class ReportService(DbConnectionFactory factory)
{
    public async Task<ReportSummary> GetSummaryAsync(int? branchId, DateTime? from, DateTime? to, CancellationToken ct)
    {
        var start=(from??DateTime.UtcNow.Date.AddDays(-30)).Date;var end=(to??DateTime.UtcNow).Date;
        await using var db=factory.CreateConnection();await db.OpenAsync(ct);await using var command=db.CreateCommand();command.CommandText="SELECT COALESCE((SELECT SUM(Total) FROM dbo.Sales WHERE (@branch IS NULL OR BranchId=@branch) AND Status=N'POSTED' AND SaleDate BETWEEN @from AND @to),0),COALESCE((SELECT SUM(Total) FROM dbo.Purchases WHERE (@branch IS NULL OR BranchId=@branch) AND Status=N'POSTED' AND PurchaseDate BETWEEN @from AND @to),0),COALESCE((SELECT SUM(Amount) FROM (SELECT MoveNo,SUM(CASE WHEN TreasuryId IS NOT NULL THEN ForeignCredit ELSE 0 END) Amount,TransactionDate FROM dbo.Transactions WHERE (@branch IS NULL OR BranchId=@branch) AND TransactionType=N'EXPENSE' AND TransactionDate BETWEEN @from AND @to GROUP BY MoveNo,TransactionDate) x),0),COALESCE((SELECT SUM(CASE WHEN TransactionType=N'RECEIPT' THEN Debit ELSE 0 END) FROM dbo.Transactions WHERE (@branch IS NULL OR BranchId=@branch) AND TransactionType=N'RECEIPT' AND TransactionDate BETWEEN @from AND @to),0),COALESCE((SELECT SUM(CASE WHEN TransactionType=N'PAYMENT' THEN Credit ELSE 0 END) FROM dbo.Transactions WHERE (@branch IS NULL OR BranchId=@branch) AND TransactionType=N'PAYMENT' AND TransactionDate BETWEEN @from AND @to),0),(SELECT COUNT(*) FROM dbo.Sales WHERE (@branch IS NULL OR BranchId=@branch) AND Status=N'POSTED' AND SaleDate BETWEEN @from AND @to),(SELECT COUNT(*) FROM dbo.Purchases WHERE (@branch IS NULL OR BranchId=@branch) AND Status=N'POSTED' AND PurchaseDate BETWEEN @from AND @to)";Add(command,"@branch",branchId,DbType.Int32);Add(command,"@from",start,DbType.Date);Add(command,"@to",end,DbType.Date);await using var r=await command.ExecuteReaderAsync(ct);await r.ReadAsync(ct);var sales=r.GetDecimal(0);var purchases=r.GetDecimal(1);var expenses=r.GetDecimal(2);var receipts=r.GetDecimal(3);var payments=r.GetDecimal(4);return new(start,end,sales,purchases,expenses,receipts,payments,sales-purchases-expenses,r.GetInt32(5),r.GetInt32(6));
    }
    private static void Add(System.Data.Common.DbCommand c,string n,object? v,DbType t){var p=c.CreateParameter();p.ParameterName=n;p.DbType=t;p.Value=v??DBNull.Value;c.Parameters.Add(p);}
}
