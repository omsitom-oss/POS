using System.Data;
using System.Data.Common;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

public sealed class ReceiptService(DbConnectionFactory factory, TransactionService transactions)
{
    public async Task<ReceiptWriteResult> SaveAsync(ReceiptWriteRequest request, CancellationToken ct)
    {
        Validate(request);
        var type = request.Type!.Trim().ToUpperInvariant();
        await using var db = await OpenAsync(ct);
        var details = await ReadReferencesAsync(db, request, ct);
        var partnerCurrencyId = request.PartnerCurrencyId ?? details.CurrencyId;
        var partnerAmount = request.PartnerAmount ?? request.Amount;
        var expectedTreasuryAmount = Math.Round(partnerAmount * request.ExchangeRate, 4, MidpointRounding.AwayFromZero);
        if (Math.Abs(expectedTreasuryAmount - request.Amount) > 0.01m) throw new ReceiptException("The treasury amount must equal the partner amount multiplied by the exchange rate.");
        var receiptDate = (request.ReceiptDate ?? DateTime.Today).Date;
        var receiptNumber = await NextReceiptNumberAsync(db, receiptDate, type, ct);
        var receiptNo = $"CSH-{(type == "RECEIPT" ? "IN" : "OUT")}-{receiptDate:ddMMyy}-{receiptNumber:D4}";
        // The accounts follow from the partner and treasury; account codes sent by the client are ignored so a receipt cannot post to an arbitrary account.
        var partnerAccount = $"PARTNER:{request.PartnerId}";
        var treasuryAccount = $"TREASURY:{request.TreasuryId}";
        var receiptLine = new TransactionLineRequest(partnerAccount, request.PartnerId, null, type == "RECEIPT" ? 0 : request.Amount, type == "RECEIPT" ? request.Amount : 0, type == "RECEIPT" ? 0 : partnerAmount, type == "RECEIPT" ? partnerAmount : 0, partnerCurrencyId, request.ExchangeRate);
        var treasuryLine = new TransactionLineRequest(treasuryAccount, null, request.TreasuryId, type == "RECEIPT" ? request.Amount : 0, type == "RECEIPT" ? 0 : request.Amount, type == "RECEIPT" ? request.Amount : 0, type == "RECEIPT" ? 0 : request.Amount, details.CurrencyId, 1);
        // When the partner's account is in the primary currency, the partner amount is the receipt's primary value, so the entered rate wins over the stored one.
        decimal? baseRate = partnerCurrencyId != details.CurrencyId && await IsPrimaryAsync(db, partnerCurrencyId, ct) ? partnerAmount / request.Amount : null;
        var transaction = await transactions.SaveAsync(new TransactionWriteRequest(type, request.Reason, receiptNo, request.Description, details.CurrencyId, 1, [receiptLine, treasuryLine], request.BranchId, receiptDate, request.SavedBy, baseRate), ct);
        return new ReceiptWriteResult(receiptNo, type, request.PartnerId, request.TreasuryId, details.CurrencyId, partnerCurrencyId, request.Amount, partnerAmount, request.Amount, request.ExchangeRate, transaction);
    }

    public async Task<IReadOnlyList<ReceiptListItem>> GetAsync(string? type, int? branchId, DateTime? from, DateTime? to, CancellationToken ct)
    {
        if (from.HasValue && to.HasValue && from.Value.Date > to.Value.Date) throw new ReceiptException("The start date cannot be after the end date.");
        var normalizedType = string.IsNullOrWhiteSpace(type) ? null : type.Trim().ToUpperInvariant();
        if (normalizedType is not null and not ("RECEIPT" or "PAYMENT")) throw new ReceiptException("Receipt type must be RECEIPT or PAYMENT.");
        await using var db = await OpenAsync(ct); await using var command = db.CreateCommand();
        command.CommandText = "WITH grouped AS (SELECT MoveNo,MAX(RefNo) AS ReceiptNo,TransactionType,TransactionDate,MAX(PartnerId) AS PartnerId,MAX(TreasuryId) AS TreasuryId,MAX(CASE WHEN TreasuryId IS NOT NULL THEN CurrencyId END) AS CurrencyId,MAX(CASE WHEN PartnerId IS NOT NULL THEN CurrencyId END) AS PartnerCurrencyId,SUM(CASE WHEN TreasuryId IS NOT NULL THEN ForeignDebit+ForeignCredit ELSE 0 END) AS TotalDebit,MAX(CASE WHEN PartnerId IS NOT NULL THEN ForeignDebit+ForeignCredit ELSE 0 END) AS PartnerAmount,MAX(ExchangeRate) AS ExchangeRate,MAX(Pattern) AS Reason,MAX(Description) AS Description FROM dbo.Transactions WHERE TransactionType IN (N'RECEIPT',N'PAYMENT') AND (@type IS NULL OR TransactionType=@type) AND (@branch IS NULL OR BranchId=@branch) AND (@from IS NULL OR TransactionDate>=@from) AND (@to IS NULL OR TransactionDate<=@to) GROUP BY MoveNo,TransactionType,TransactionDate) SELECT g.MoveNo,g.ReceiptNo,g.TransactionType,g.TransactionDate,g.PartnerId,p.PartnerName,g.TreasuryId,COALESCE(t.NameEn,t.NameAr),g.CurrencyId,c.CurrencyCode,c.Symbol,g.TotalDebit,g.PartnerAmount,pc.CurrencyCode,pc.Symbol,g.ExchangeRate,g.Reason,g.Description FROM grouped g LEFT JOIN dbo.Partners p ON p.PartnerId=g.PartnerId LEFT JOIN dbo.Treasuries t ON t.TreasuryId=g.TreasuryId JOIN dbo.Currencies c ON c.CurrencyId=g.CurrencyId JOIN dbo.Currencies pc ON pc.CurrencyId=g.PartnerCurrencyId ORDER BY g.TransactionDate DESC,g.MoveNo DESC";
        Add(command, "@type", normalizedType, DbType.String, 10); Add(command, "@branch", branchId, DbType.Int32); Add(command, "@from", from?.Date, DbType.Date); Add(command, "@to", to?.Date, DbType.Date);
        var rows = new List<ReceiptListItem>(); await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) rows.Add(new ReceiptListItem(reader.GetInt32(0), reader.GetString(1), reader.GetString(2), reader.GetDateTime(3), reader.GetInt32(4), reader.IsDBNull(5) ? null : reader.GetString(5), reader.GetInt32(6), reader.IsDBNull(7) ? null : reader.GetString(7), reader.GetInt32(8), reader.GetString(9), reader.GetString(10), reader.GetDecimal(11), reader.GetDecimal(12), reader.GetString(13), reader.GetString(14), reader.GetDecimal(15), reader.IsDBNull(16) ? null : reader.GetString(16), reader.IsDBNull(17) ? null : reader.GetString(17)));
        return rows;
    }

    private static void Validate(ReceiptWriteRequest request)
    {
        var type = request.Type?.Trim().ToUpperInvariant();
        if (type is not ("RECEIPT" or "PAYMENT")) throw new ReceiptException("Receipt type must be RECEIPT or PAYMENT.");
        if (request.PartnerId <= 0 || request.TreasuryId <= 0) throw new ReceiptException("Choose a partner and a treasury.");
        if (request.Amount <= 0) throw new ReceiptException("Amount must be greater than zero.");
        if (request.ExchangeRate <= 0) throw new ReceiptException("Exchange rate must be greater than zero.");
        if (request.PartnerCurrencyId is 0 or < 0) throw new ReceiptException("Choose the partner account currency.");
        if (request.PartnerAmount is 0 or < 0) throw new ReceiptException("Partner amount must be greater than zero.");
    }

    private static async Task<(int CurrencyId, bool IsActive)> ReadReferencesAsync(DbConnection db, ReceiptWriteRequest request, CancellationToken ct)
    {
        await using (var partner = db.CreateCommand()) { partner.CommandText = "SELECT Status FROM dbo.Partners WHERE PartnerId=@id"; Add(partner, "@id", request.PartnerId, DbType.Int32); var status = await partner.ExecuteScalarAsync(ct); if (status is null) throw new ReceiptException("Partner was not found.", 404); if (!string.Equals(Convert.ToString(status), "ACTIVE", StringComparison.OrdinalIgnoreCase)) throw new ReceiptException("An inactive partner cannot be used in a receipt."); }
        await using var treasury = db.CreateCommand(); treasury.CommandText = "SELECT CurrencyId,IsActive FROM dbo.Treasuries WHERE TreasuryId=@id AND BranchId=@branch"; Add(treasury, "@id", request.TreasuryId, DbType.Int32); Add(treasury, "@branch", request.BranchId, DbType.Int32); await using var reader = await treasury.ExecuteReaderAsync(ct); if (!await reader.ReadAsync(ct)) throw new ReceiptException("Treasury was not found.", 404); if (!reader.GetBoolean(1)) throw new ReceiptException("An inactive treasury cannot be used in a receipt."); return (reader.GetInt32(0), reader.GetBoolean(1));
    }

    private static async Task<bool> IsPrimaryAsync(DbConnection db, int currencyId, CancellationToken ct)
    {
        await using var command = db.CreateCommand(); command.CommandText = "SELECT IsPrimary FROM dbo.Currencies WHERE CurrencyId=@id"; Add(command, "@id", currencyId, DbType.Int32);
        return Convert.ToBoolean(await command.ExecuteScalarAsync(ct) ?? false);
    }

    private static async Task<int> NextReceiptNumberAsync(DbConnection db, DateTime receiptDate, string type, CancellationToken ct)
    {
        await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            await using var update = db.CreateCommand(); update.Transaction = tx; update.CommandText = "UPDATE dbo.ReceiptSequences WITH (UPDLOCK,HOLDLOCK) SET LastNumber=LastNumber+1 OUTPUT INSERTED.LastNumber WHERE ReceiptDate=@date AND ReceiptType=@type"; Add(update, "@date", receiptDate, DbType.Date); Add(update, "@type", type, DbType.String, 10);
            var value = await update.ExecuteScalarAsync(ct);
            int number;
            if (value is null)
            {
                await using var insert = db.CreateCommand(); insert.Transaction = tx; insert.CommandText = "INSERT INTO dbo.ReceiptSequences(ReceiptDate,ReceiptType,LastNumber) VALUES(@date,@type,1)"; Add(insert, "@date", receiptDate, DbType.Date); Add(insert, "@type", type, DbType.String, 10); await insert.ExecuteNonQueryAsync(ct); number = 1;
            }
            else number = Convert.ToInt32(value);
            await tx.CommitAsync(ct); return number;
        }
        catch { await tx.RollbackAsync(ct); throw; }
    }

    private async Task<DbConnection> OpenAsync(CancellationToken ct) { var db = factory.CreateConnection(); await db.OpenAsync(ct); return db; }
    private static void Add(DbCommand command, string name, object? value, DbType type, int? size = null) { var parameter = command.CreateParameter(); parameter.ParameterName = name; parameter.DbType = type; if (size.HasValue) parameter.Size = size.Value; parameter.Value = value ?? DBNull.Value; command.Parameters.Add(parameter); }
}

public sealed class ReceiptException(string message, int statusCode = 400) : Exception(message) { public int StatusCode { get; } = statusCode; }
