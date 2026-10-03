using System.Data;
using System.Data.Common;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

public sealed class ExpenseService(DbConnectionFactory factory, TransactionService transactions)
{
    public async Task<ExpenseWriteResult> SaveAsync(ExpenseWriteRequest request, CancellationToken ct)
    {
        Validate(request);
        await using var db = await OpenAsync(ct);
        var date = (request.ExpenseDate ?? DateTime.UtcNow).Date;
        var refs = await ReadReferencesAsync(db, request, ct);
        var number = await NextNumberAsync(db, date, ct);
        var expenseNo = $"EXP-{date:ddMMyy}-{number:D4}";
        var expenseLine = new TransactionLineRequest(refs.AccountCode, null, null, request.Amount, 0, request.Amount, 0, refs.CurrencyId, 1);
        var treasuryLine = new TransactionLineRequest($"TREASURY:{request.TreasuryId}", null, request.TreasuryId, 0, request.Amount, 0, request.Amount, refs.CurrencyId, 1);
        var transaction = await transactions.SaveAsync(new TransactionWriteRequest("EXPENSE", refs.AccountCode, expenseNo, request.Description, refs.CurrencyId, 1, [expenseLine, treasuryLine], request.BranchId, date, request.SavedBy), ct);
        return new ExpenseWriteResult(expenseNo, request.TreasuryId, refs.AccountCode, request.Amount, transaction);
    }

    public async Task<IReadOnlyList<ExpenseListItem>> GetAsync(DateTime? from, DateTime? to, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        await using var command = db.CreateCommand();
        command.CommandText = "WITH grouped AS (SELECT MoveNo,MAX(RefNo) AS ExpenseNo,TransactionDate,MAX(CASE WHEN TreasuryId IS NULL THEN AccountId END) AS ExpenseAccountId,MAX(TreasuryId) AS TreasuryId,SUM(CASE WHEN TreasuryId IS NOT NULL THEN ForeignCredit ELSE 0 END) AS Amount,MAX(Description) AS Description,MAX(CurrencyId) AS CurrencyId FROM dbo.Transactions WHERE TransactionType='EXPENSE' AND (@from IS NULL OR TransactionDate>=@from) AND (@to IS NULL OR TransactionDate<=@to) GROUP BY MoveNo,TransactionDate) SELECT g.MoveNo,g.ExpenseNo,g.TransactionDate,g.ExpenseAccountId,a.NameEn,a.NameAr,g.TreasuryId,t.NameEn,g.CurrencyId,c.CurrencyCode,c.Symbol,g.Amount,g.Description FROM grouped g JOIN dbo.Accounts a ON a.AccountCode=g.ExpenseAccountId JOIN dbo.Treasuries t ON t.TreasuryId=g.TreasuryId JOIN dbo.Currencies c ON c.CurrencyId=g.CurrencyId ORDER BY g.TransactionDate DESC,g.MoveNo DESC";
        Add(command, "@from", from?.Date, DbType.Date); Add(command, "@to", to?.Date, DbType.Date);
        var rows = new List<ExpenseListItem>(); await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) rows.Add(new ExpenseListItem(reader.GetInt32(0), reader.GetString(1), reader.GetDateTime(2), reader.GetString(3), reader.GetString(4), reader.GetString(5), reader.GetInt32(6), reader.GetString(7), reader.GetInt32(8), reader.GetString(9), reader.GetString(10), reader.GetDecimal(11), reader.IsDBNull(12) ? null : reader.GetString(12)));
        return rows;
    }

    private static void Validate(ExpenseWriteRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ExpenseAccountId)) throw new ExpenseException("Choose an expense account.");
        if (request.ExpenseAccountId.Trim().Length > 50) throw new ExpenseException("Expense account is too long.");
        if (request.TreasuryId <= 0) throw new ExpenseException("Choose a treasury.");
        if (request.Amount <= 0) throw new ExpenseException("Amount must be greater than zero.");
    }

    private static async Task<(string AccountCode, int CurrencyId)> ReadReferencesAsync(DbConnection db, ExpenseWriteRequest request, CancellationToken ct)
    {
        await using var account = db.CreateCommand(); account.CommandText = "SELECT AccountCode FROM dbo.Accounts WHERE AccountCode=@code AND AccountType='EXPENSE' AND IsActive=1"; Add(account, "@code", request.ExpenseAccountId!.Trim(), DbType.String, 50);
        var code = await account.ExecuteScalarAsync(ct) as string; if (string.IsNullOrWhiteSpace(code)) throw new ExpenseException("The selected expense account is not active.", 400);
        await using var treasury = db.CreateCommand(); treasury.CommandText = "SELECT CurrencyId,IsActive FROM dbo.Treasuries WHERE TreasuryId=@id"; Add(treasury, "@id", request.TreasuryId, DbType.Int32); await using var reader = await treasury.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) throw new ExpenseException("Treasury was not found.", 404); if (!reader.GetBoolean(1)) throw new ExpenseException("The selected treasury is inactive."); return (code, reader.GetInt32(0));
    }

    private static async Task<int> NextNumberAsync(DbConnection db, DateTime date, CancellationToken ct)
    {
        if (db.GetType().Name.Contains("Sqlite", StringComparison.OrdinalIgnoreCase))
        {
            await using var create = db.CreateCommand(); create.CommandText = "CREATE TABLE IF NOT EXISTS ExpenseSequences (ExpenseDate TEXT NOT NULL PRIMARY KEY, LastNumber INTEGER NOT NULL DEFAULT 0)"; await create.ExecuteNonQueryAsync(ct);
            await using var read = db.CreateCommand(); read.CommandText = "SELECT LastNumber FROM ExpenseSequences WHERE ExpenseDate=@date"; Add(read, "@date", date.ToString("yyyy-MM-dd"), DbType.String); var current = await read.ExecuteScalarAsync(ct);
            var next = current is null ? 1 : Convert.ToInt32(current) + 1;
            await using var write = db.CreateCommand(); write.CommandText = current is null ? "INSERT INTO ExpenseSequences(ExpenseDate,LastNumber) VALUES(@date,@number)" : "UPDATE ExpenseSequences SET LastNumber=@number WHERE ExpenseDate=@date"; Add(write, "@date", date.ToString("yyyy-MM-dd"), DbType.String); Add(write, "@number", next, DbType.Int32); await write.ExecuteNonQueryAsync(ct); return next;
        }
        await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try { await using var update = db.CreateCommand(); update.Transaction = tx; update.CommandText = "UPDATE dbo.ExpenseSequences WITH (UPDLOCK,HOLDLOCK) SET LastNumber=LastNumber+1 OUTPUT INSERTED.LastNumber WHERE ExpenseDate=@date"; Add(update, "@date", date, DbType.Date); var value = await update.ExecuteScalarAsync(ct); if (value is not null) { await tx.CommitAsync(ct); return Convert.ToInt32(value); } await using var insert = db.CreateCommand(); insert.Transaction = tx; insert.CommandText = "INSERT INTO dbo.ExpenseSequences(ExpenseDate,LastNumber) VALUES(@date,1)"; Add(insert, "@date", date, DbType.Date); await insert.ExecuteNonQueryAsync(ct); await tx.CommitAsync(ct); return 1; } catch { await tx.RollbackAsync(ct); throw; }
    }

    private async Task<DbConnection> OpenAsync(CancellationToken ct) { var db = factory.CreateConnection(); await db.OpenAsync(ct); return db; }
    private static void Add(DbCommand command, string name, object? value, DbType type, int? size = null) { var parameter = command.CreateParameter(); parameter.ParameterName = name; parameter.DbType = type; if (size.HasValue) parameter.Size = size.Value; parameter.Value = value ?? DBNull.Value; command.Parameters.Add(parameter); }
}

public sealed class ExpenseException(string message, int statusCode = 400) : Exception(message) { public int StatusCode { get; } = statusCode; }
