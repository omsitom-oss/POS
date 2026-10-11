using System.Data;
using System.Data.Common;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

public sealed class AccountService(DbConnectionFactory factory)
{
    public async Task<IReadOnlyList<ChartAccountDto>> GetChartAsync(int? branchId, CancellationToken ct)
    {
        await using var db = factory.CreateConnection(); await db.OpenAsync(ct); await using var command = db.CreateCommand();
        // Tills post to TREASURY:<id> lines, shown under 1100. A partner's lines (PARTNER:<id> from sales, receipts and payments,
        // 2100 from purchases) make one running account per partner: a partner who owes us is shown under 1200 Trade debtors
        // and one we owe under 2100 Trade creditors, so every journal line is counted once and the chart balances.
        command.CommandText = @"WITH partnerNet AS (
    SELECT BranchId, PartnerId, SUM(Debit-Credit) AS Net FROM dbo.Transactions
    WHERE PartnerId IS NOT NULL AND (AccountId LIKE N'PARTNER:%' OR AccountId IN (N'1200', N'2100'))
    GROUP BY BranchId, PartnerId),
other AS (
    SELECT BranchId, CASE WHEN AccountId LIKE N'TREASURY:%' THEN N'1100' ELSE AccountId END AS AccountCode, SUM(Debit-Credit) AS Balance FROM dbo.Transactions
    WHERE NOT (PartnerId IS NOT NULL AND (AccountId LIKE N'PARTNER:%' OR AccountId IN (N'1200', N'2100')))
    GROUP BY BranchId, CASE WHEN AccountId LIKE N'TREASURY:%' THEN N'1100' ELSE AccountId END)
SELECT a.AccountId,a.BranchId,a.AccountCode,a.NameAr,a.NameEn,a.AccountType,
    COALESCE((SELECT SUM(o.Balance) FROM other o WHERE o.BranchId=a.BranchId AND o.AccountCode=a.AccountCode),0)
    + CASE a.AccountCode
        WHEN N'1200' THEN COALESCE((SELECT SUM(p.Net) FROM partnerNet p WHERE p.BranchId=a.BranchId AND p.Net>0),0)
        WHEN N'2100' THEN COALESCE((SELECT SUM(p.Net) FROM partnerNet p WHERE p.BranchId=a.BranchId AND p.Net<0),0)
        ELSE 0 END,
    a.IsSystem,a.IsActive
FROM dbo.Accounts a WHERE a.IsActive=1 AND (@branch IS NULL OR a.BranchId=@branch) ORDER BY a.AccountCode"; var branch = command.CreateParameter(); branch.ParameterName = "@branch"; branch.DbType = DbType.Int32; branch.Value = (object?)branchId ?? DBNull.Value; command.Parameters.Add(branch);
        var rows = new List<ChartAccountDto>(); await using var reader = await command.ExecuteReaderAsync(ct); while (await reader.ReadAsync(ct)) rows.Add(new(reader.GetInt32(0),reader.GetInt32(1),reader.GetString(2),reader.GetString(3),reader.GetString(4),reader.GetString(5),reader.GetDecimal(6),reader.GetBoolean(7),reader.GetBoolean(8))); return rows;
    }
}
