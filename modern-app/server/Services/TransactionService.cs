using System.Data;
using System.Data.Common;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

public sealed class TransactionService(DbConnectionFactory factory)
{
    public Task<TransactionStatement> GetAccountStatementAsync(string accountId, int? branchId, DateTime? from, DateTime? to, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(accountId)) throw new TransactionException("Account ID is required.");
        return GetStatementAsync("account", accountId.Trim(), branchId, from, to, ct);
    }

    public Task<TransactionStatement> GetTreasuryStatementAsync(int treasuryId, int? branchId, DateTime? from, DateTime? to, CancellationToken ct)
    {
        if (treasuryId <= 0) throw new TransactionException("Treasury ID is required.");
        return GetStatementAsync("treasury", treasuryId.ToString(), branchId, from, to, ct);
    }

    public async Task<PartnerBalance> GetPartnerBalanceAsync(int partnerId, int currencyId, CancellationToken ct)
    {
        if (partnerId <= 0 || currencyId <= 0) throw new TransactionException("Partner and currency are required.");
        await using var db = await OpenAsync(ct);
        await using var command = db.CreateCommand();
        command.CommandText = "SELECT c.CurrencyCode,c.Symbol,c.CurrencyNameEn,c.CurrencyNameAr,c.FlagBase64,COALESCE(SUM(t.ForeignDebit),0),COALESCE(SUM(t.ForeignCredit),0) FROM dbo.Currencies c LEFT JOIN dbo.Transactions t ON t.CurrencyId=c.CurrencyId AND t.PartnerId=@partner AND t.CurrencyId=@currency WHERE c.CurrencyId=@currency GROUP BY c.CurrencyCode,c.Symbol,c.CurrencyNameEn,c.CurrencyNameAr,c.FlagBase64";
        Add(command, "@partner", partnerId, DbType.Int32); Add(command, "@currency", currencyId, DbType.Int32);
        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) throw new TransactionException("Currency was not found.", 404);
        var debit = reader.GetDecimal(5); var credit = reader.GetDecimal(6);
        return new PartnerBalance(debit - credit, debit, credit, currencyId, reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.IsDBNull(4) ? null : reader.GetString(4));
    }

    public async Task<IReadOnlyList<PartnerBalance>> GetPartnerBalancesAsync(int partnerId, CancellationToken ct)
    {
        if (partnerId <= 0) throw new TransactionException("Partner is required.");
        await using var db = await OpenAsync(ct);
        await using var command = db.CreateCommand();
        command.CommandText = "SELECT t.CurrencyId,c.CurrencyCode,c.Symbol,c.CurrencyNameEn,c.CurrencyNameAr,c.FlagBase64,COALESCE(SUM(t.ForeignDebit),0),COALESCE(SUM(t.ForeignCredit),0) FROM dbo.Transactions t JOIN dbo.Currencies c ON c.CurrencyId=t.CurrencyId WHERE t.PartnerId=@partner GROUP BY t.CurrencyId,c.CurrencyCode,c.Symbol,c.CurrencyNameEn,c.CurrencyNameAr,c.FlagBase64 ORDER BY c.CurrencyCode";
        Add(command, "@partner", partnerId, DbType.Int32);
        var rows = new List<PartnerBalance>(); await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) { var debit = reader.GetDecimal(6); var credit = reader.GetDecimal(7); rows.Add(new PartnerBalance(debit - credit, debit, credit, reader.GetInt32(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetString(4), reader.IsDBNull(5) ? null : reader.GetString(5))); }
        return rows;
    }

    public async Task<IReadOnlyList<PartnerBalance>> GetPartnerBalancesByPublicIdAsync(Guid publicId, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        await using var command = db.CreateCommand(); command.CommandText = "SELECT PartnerId FROM dbo.Partners WHERE PublicId=@id"; Add(command, "@id", publicId, DbType.Guid);
        var value = await command.ExecuteScalarAsync(ct); if (value is null) throw new TransactionException("Partner was not found.", 404);
        return await GetPartnerBalancesAsync(Convert.ToInt32(value), ct);
    }

    public async Task<TransactionWriteResult> SaveAsync(TransactionWriteRequest request, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            var result = await PostAsync(db, tx, request, ct);
            await tx.CommitAsync(ct);
            return result;
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }

    // Writes the journal inside the caller's transaction, so a document and its journal commit or roll back together.
    public async Task<TransactionWriteResult> PostAsync(DbConnection db, DbTransaction tx, TransactionWriteRequest request, CancellationToken ct)
    {
        Validate(request);
        var lines = request.Lines!;
        var transactionDate = (request.TransactionDate ?? DateTime.UtcNow).Date;
        var branchId = request.BranchId ?? await ReadDefaultBranchAsync(db, tx, ct);
        await ValidateReferencesAsync(db, tx, request, branchId, lines, ct);
        var moveNo = await NextMoveNoAsync(db, tx, ct);
        var ids = new List<long>(lines.Count);

        foreach (var line in lines)
        {
            await using var insert = db.CreateCommand();
            insert.Transaction = tx;
            insert.CommandText = "INSERT INTO dbo.Transactions (BranchId,TransactionDate,MoveNo,TransactionType,Pattern,AccountId,PartnerId,TreasuryId,RefNo,Description,Debit,Credit,ForeignDebit,ForeignCredit,CurrencyId,ExchangeRate,SavedBy) OUTPUT INSERTED.TransactionId VALUES (@branch,@date,@move,@type,@pattern,@account,@partner,@treasury,@ref,@description,@debit,@credit,@foreignDebit,@foreignCredit,@currency,@rate,@savedBy)";
            Add(insert, "@branch", branchId, DbType.Int32);
            Add(insert, "@date", transactionDate, DbType.Date);
            Add(insert, "@move", moveNo, DbType.Int32);
            Add(insert, "@type", request.TransactionType!.Trim(), DbType.String, 50);
            Add(insert, "@pattern", NullIfBlank(request.Pattern), DbType.String, 50);
            Add(insert, "@account", line.AccountId!.Trim(), DbType.String, 50);
            Add(insert, "@partner", line.PartnerId, DbType.Int32);
            Add(insert, "@treasury", line.TreasuryId, DbType.Int32);
            Add(insert, "@ref", NullIfBlank(request.RefNo), DbType.String, 50);
            Add(insert, "@description", NullIfBlank(request.Description), DbType.String, 250);
            AddDecimal(insert, "@debit", line.Debit, 19, 4);
            AddDecimal(insert, "@credit", line.Credit, 19, 4);
            AddDecimal(insert, "@foreignDebit", line.ForeignDebit, 19, 4);
            AddDecimal(insert, "@foreignCredit", line.ForeignCredit, 19, 4);
            Add(insert, "@currency", line.CurrencyId ?? request.CurrencyId, DbType.Int32);
            AddDecimal(insert, "@rate", line.ExchangeRate ?? request.ExchangeRate, 19, 8);
            Add(insert, "@savedBy", request.SavedBy, DbType.Int32);
            ids.Add(Convert.ToInt64(await insert.ExecuteScalarAsync(ct)));
        }

        return new TransactionWriteResult(moveNo, transactionDate, request.CurrencyId, request.ExchangeRate, ids);
    }

    private static async Task<int> ReadDefaultBranchAsync(DbConnection db, DbTransaction tx, CancellationToken ct)
    {
        await using var command = db.CreateCommand(); command.Transaction = tx; command.CommandText = "SELECT TOP 1 BranchId FROM dbo.Branches WHERE IsActive=1 ORDER BY BranchId";
        var value = await command.ExecuteScalarAsync(ct); if (value is null) throw new TransactionException("An active branch is required before recording transactions."); return Convert.ToInt32(value);
    }

    private async Task<TransactionStatement> GetStatementAsync(string kind, string value, int? branchId, DateTime? from, DateTime? to, CancellationToken ct)
    {
        if (from.HasValue && to.HasValue && from.Value.Date > to.Value.Date)
            throw new TransactionException("The start date cannot be after the end date.");

        await using var db = await OpenAsync(ct);
        await using var command = db.CreateCommand();
        command.CommandText = kind == "account"
            ? "SELECT t.TransactionId,t.TransactionDate,t.MoveNo,t.TransactionType,t.Pattern,t.AccountId,t.PartnerId,t.TreasuryId,t.RefNo,t.Description,t.Debit,t.Credit,t.ForeignDebit,t.ForeignCredit,t.CurrencyId,c.CurrencyCode,c.Symbol,t.ExchangeRate,t.SavedBy,t.SavedOn FROM dbo.Transactions t JOIN dbo.Currencies c ON c.CurrencyId=t.CurrencyId WHERE t.AccountId=@value AND (@branch IS NULL OR t.BranchId=@branch) AND (@from IS NULL OR t.TransactionDate>=@from) AND (@to IS NULL OR t.TransactionDate<=@to) ORDER BY t.TransactionDate,t.TransactionId"
            : "SELECT t.TransactionId,t.TransactionDate,t.MoveNo,t.TransactionType,t.Pattern,t.AccountId,t.PartnerId,t.TreasuryId,t.RefNo,t.Description,t.Debit,t.Credit,t.ForeignDebit,t.ForeignCredit,t.CurrencyId,c.CurrencyCode,c.Symbol,t.ExchangeRate,t.SavedBy,t.SavedOn FROM dbo.Transactions t JOIN dbo.Currencies c ON c.CurrencyId=t.CurrencyId WHERE t.TreasuryId=@value AND (@branch IS NULL OR t.BranchId=@branch) AND (@from IS NULL OR t.TransactionDate>=@from) AND (@to IS NULL OR t.TransactionDate<=@to) ORDER BY t.TransactionDate,t.TransactionId";
        Add(command, "@value", kind == "account" ? value : int.Parse(value), kind == "account" ? DbType.String : DbType.Int32, kind == "account" ? 50 : null);
        Add(command, "@branch", branchId, DbType.Int32);
        Add(command, "@from", from?.Date, DbType.Date);
        Add(command, "@to", to?.Date, DbType.Date);

        var rows = new List<TransactionStatementRow>();
        decimal balance = 0;
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var debit = reader.GetDecimal(10);
            var credit = reader.GetDecimal(11);
            var rowBalance = kind == "account" ? debit - credit : reader.GetDecimal(12) - reader.GetDecimal(13);
            balance += rowBalance;
            rows.Add(new TransactionStatementRow(
                reader.GetInt64(0), reader.GetDateTime(1), reader.GetInt32(2), reader.GetString(3), reader.IsDBNull(4) ? null : reader.GetString(4), reader.GetString(5),
                reader.IsDBNull(6) ? null : reader.GetInt32(6), reader.IsDBNull(7) ? null : reader.GetInt32(7), reader.IsDBNull(8) ? null : reader.GetString(8), reader.IsDBNull(9) ? null : reader.GetString(9),
                debit, credit, reader.GetDecimal(12), reader.GetDecimal(13), reader.GetInt32(14), reader.GetString(15), reader.GetString(16), reader.GetDecimal(17),
                reader.IsDBNull(18) ? null : reader.GetInt32(18), reader.GetDateTime(19), balance));
        }

        return new TransactionStatement(kind == "account" ? value : $"Treasury:{value}", rows, kind == "account" ? rows.Sum(row => row.Debit) : rows.Sum(row => row.ForeignDebit), kind == "account" ? rows.Sum(row => row.Credit) : rows.Sum(row => row.ForeignCredit), balance, from?.Date, to?.Date);
    }

    private static void Validate(TransactionWriteRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.TransactionType) || request.TransactionType.Trim().Length > 50)
            throw new TransactionException("Transaction type is required and must be 50 characters or fewer.");
        if (!request.Lines?.Any() ?? true)
            throw new TransactionException("A transaction must contain at least two lines.");
        if (request.Lines!.Count < 2)
            throw new TransactionException("A transaction must contain at least two lines.");
        if (request.CurrencyId <= 0)
            throw new TransactionException("Choose a currency.");
        if (request.ExchangeRate <= 0)
            throw new TransactionException("Exchange rate must be greater than zero.");
        if (request.Lines.Any(line => string.IsNullOrWhiteSpace(line.AccountId) || line.AccountId.Trim().Length > 50))
            throw new TransactionException("Every transaction line must have an account ID of 50 characters or fewer.");
        if (request.Lines.Any(line => line.Debit < 0 || line.Credit < 0 || line.ForeignDebit < 0 || line.ForeignCredit < 0))
            throw new TransactionException("Transaction amounts cannot be negative.");
        if (request.Lines.Any(line => (line.Debit > 0) == (line.Credit > 0)))
            throw new TransactionException("Each line must contain either a debit or a credit amount.");
        if (request.Lines.Any(line => line.ForeignDebit > 0 && line.ForeignCredit > 0))
            throw new TransactionException("Each line cannot contain both foreign debit and foreign credit.");

        var debit = request.Lines.Sum(line => line.Debit);
        var credit = request.Lines.Sum(line => line.Credit);
        if (debit != credit)
            throw new TransactionException($"The transaction is not balanced. Debit is {debit} and credit is {credit}.");
    }

    private static async Task ValidateReferencesAsync(DbConnection db, DbTransaction tx, TransactionWriteRequest request, int branchId, IReadOnlyList<TransactionLineRequest> lines, CancellationToken ct)
    {
        foreach (var currencyId in lines.Select(line => line.CurrencyId ?? request.CurrencyId).Distinct())
        {
            await using var currency = db.CreateCommand();
            currency.Transaction = tx; currency.CommandText = "SELECT IsActive FROM dbo.Currencies WHERE CurrencyId=@id"; Add(currency, "@id", currencyId, DbType.Int32);
            var value = await currency.ExecuteScalarAsync(ct);
            if (value is null) throw new TransactionException("Currency was not found.", 404);
            if (!Convert.ToBoolean(value)) throw new TransactionException("The selected currency is inactive.");
        }

        await EnsureExistsAsync(db, tx, "Branches", "BranchId", branchId, "Branch", ct);
        if (request.SavedBy.HasValue)
            await EnsureExistsAsync(db, tx, "Users", "UserId", request.SavedBy.Value, "User", ct);

        foreach (var partnerId in lines.Select(line => line.PartnerId).Where(id => id.HasValue).Select(id => id!.Value).Distinct())
        {
            await using var partner = db.CreateCommand(); partner.Transaction = tx; partner.CommandText = "SELECT Status FROM dbo.Partners WHERE PartnerId=@id"; Add(partner, "@id", partnerId, DbType.Int32);
            var status = await partner.ExecuteScalarAsync(ct);
            if (status is null) throw new TransactionException("Partner was not found.", 404);
            if (!string.Equals(Convert.ToString(status), "ACTIVE", StringComparison.OrdinalIgnoreCase)) throw new TransactionException("An inactive partner cannot be used in a transaction.");
        }

        foreach (var line in lines.Where(line => line.TreasuryId.HasValue))
        {
            await using var treasury = db.CreateCommand(); treasury.Transaction = tx; // A treasury from another branch answers as not found, so a document can only move its own branch's money.
            treasury.CommandText = "SELECT CurrencyId,IsActive FROM dbo.Treasuries WHERE TreasuryId=@id AND BranchId=@branch"; Add(treasury, "@id", line.TreasuryId, DbType.Int32); Add(treasury, "@branch", branchId, DbType.Int32);
            await using var reader = await treasury.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) throw new TransactionException("Treasury was not found.", 404);
            if (!reader.GetBoolean(1)) throw new TransactionException("An inactive treasury cannot be used in a transaction.");
            if (reader.GetInt32(0) != (line.CurrencyId ?? request.CurrencyId)) throw new TransactionException("The transaction line currency must match the treasury currency.");
        }
    }

    private static async Task<int> NextMoveNoAsync(DbConnection db, DbTransaction tx, CancellationToken ct)
    {
        await using var command = db.CreateCommand(); command.Transaction = tx; command.CommandText = "SELECT ISNULL(MAX(MoveNo),0)+1 FROM dbo.Transactions WITH (TABLOCKX,HOLDLOCK)";
        return Convert.ToInt32(await command.ExecuteScalarAsync(ct));
    }

    private static async Task EnsureExistsAsync(DbConnection db, DbTransaction tx, string table, string key, int id, string label, CancellationToken ct)
    {
        await using var command = db.CreateCommand(); command.Transaction = tx; command.CommandText = $"SELECT 1 FROM dbo.{table} WHERE {key}=@id"; Add(command, "@id", id, DbType.Int32);
        if (await command.ExecuteScalarAsync(ct) is null) throw new TransactionException($"{label} was not found.", 404);
    }

    private async Task<DbConnection> OpenAsync(CancellationToken ct) { var db = factory.CreateConnection(); await db.OpenAsync(ct); return db; }
    private static object? NullIfBlank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static void Add(DbCommand command, string name, object? value, DbType type, int? size = null) { var parameter = command.CreateParameter(); parameter.ParameterName = name; parameter.DbType = type; if (size.HasValue) parameter.Size = size.Value; parameter.Value = value ?? DBNull.Value; command.Parameters.Add(parameter); }
    private static void AddDecimal(DbCommand command, string name, decimal value, byte precision, byte scale) { var parameter = command.CreateParameter(); parameter.ParameterName = name; parameter.DbType = DbType.Decimal; parameter.Precision = precision; parameter.Scale = scale; parameter.Value = value; command.Parameters.Add(parameter); }
}

public sealed class TransactionException(string message, int statusCode = 400) : Exception(message) { public int StatusCode { get; } = statusCode; }
