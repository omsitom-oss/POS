using System.Data;
using System.Data.Common;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

public sealed class AccountService(DbConnectionFactory factory)
{
    public async Task<IReadOnlyList<ChartAccountDto>> GetChartAsync(CancellationToken ct)
    {
        await using var db = factory.CreateConnection(); await db.OpenAsync(ct); await using var command = db.CreateCommand();
        command.CommandText = "SELECT a.AccountId,a.BranchId,a.AccountCode,a.NameAr,a.NameEn,a.AccountType,COALESCE(SUM(CASE WHEN a.AccountCode=N'1100' AND t.TreasuryId IS NOT NULL THEN t.Debit-t.Credit WHEN a.AccountCode=N'1200' AND t.PartnerId IS NOT NULL THEN t.Debit-t.Credit WHEN t.AccountId=a.AccountCode THEN t.Debit-t.Credit ELSE 0 END),0),a.IsSystem,a.IsActive FROM dbo.Accounts a LEFT JOIN dbo.Transactions t ON t.BranchId=a.BranchId AND (t.AccountId=a.AccountCode OR (a.AccountCode=N'1100' AND t.TreasuryId IS NOT NULL) OR (a.AccountCode=N'1200' AND t.PartnerId IS NOT NULL)) WHERE a.IsActive=1 GROUP BY a.AccountId,a.BranchId,a.AccountCode,a.NameAr,a.NameEn,a.AccountType,a.IsSystem,a.IsActive ORDER BY a.AccountCode";
        var rows = new List<ChartAccountDto>(); await using var reader = await command.ExecuteReaderAsync(ct); while (await reader.ReadAsync(ct)) rows.Add(new(reader.GetInt32(0),reader.GetInt32(1),reader.GetString(2),reader.GetString(3),reader.GetString(4),reader.GetString(5),reader.GetDecimal(6),reader.GetBoolean(7),reader.GetBoolean(8))); return rows;
    }
}
