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
        var byCheque = IsCheque(request);
        await using var db = await OpenAsync(ct);
        var details = await ReadReferencesAsync(db, request, ct);
        var partnerCurrencyId = request.PartnerCurrencyId ?? details.CurrencyId;
        var partnerAmount = request.PartnerAmount ?? request.Amount;
        var expectedTreasuryAmount = Math.Round(partnerAmount * request.ExchangeRate, 4, MidpointRounding.AwayFromZero);
        if (Math.Abs(expectedTreasuryAmount - request.Amount) > 0.01m) throw new ReceiptException("The treasury amount must equal the partner amount multiplied by the exchange rate.");
        var receiptDate = (request.ReceiptDate ?? DateTime.Today).Date;
        var receiptNumber = await NextReceiptNumberAsync(db, receiptDate, type, ct);
        var receiptNo = $"{(byCheque ? "CHQ" : "CSH")}-{(type == "RECEIPT" ? "IN" : "OUT")}-{receiptDate:ddMMyy}-{receiptNumber:D4}";
        // The accounts follow from the partner and treasury; account codes sent by the client are ignored so a receipt cannot post to an arbitrary account.
        var partnerAccount = $"PARTNER:{request.PartnerId}";
        var treasuryAccount = $"TREASURY:{request.TreasuryId}";
        var receiptLine = new TransactionLineRequest(partnerAccount, request.PartnerId, null, type == "RECEIPT" ? 0 : request.Amount, type == "RECEIPT" ? request.Amount : 0, type == "RECEIPT" ? 0 : partnerAmount, type == "RECEIPT" ? partnerAmount : 0, partnerCurrencyId, request.ExchangeRate);
        if (!byCheque)
        {
            var treasuryLine = new TransactionLineRequest(treasuryAccount, null, request.TreasuryId, type == "RECEIPT" ? request.Amount : 0, type == "RECEIPT" ? 0 : request.Amount, type == "RECEIPT" ? request.Amount : 0, type == "RECEIPT" ? 0 : request.Amount, details.CurrencyId, 1);
            var transaction = await transactions.SaveAsync(new TransactionWriteRequest(type, request.Reason, receiptNo, request.Description, details.CurrencyId, 1, [receiptLine, treasuryLine], request.BranchId, receiptDate, request.SavedBy), ct);
            return new ReceiptWriteResult(receiptNo, type, request.PartnerId, request.TreasuryId, details.CurrencyId, partnerCurrencyId, request.Amount, partnerAmount, request.Amount, request.ExchangeRate, transaction);
        }

        // A cheque leaves the bank treasury untouched: the partner is settled against cheques under collection (received)
        // or cheques payable (issued), and the treasury moves only when the cheque clears.
        var direction = type == "RECEIPT" ? "IN" : "OUT";
        var holdingLine = new TransactionLineRequest(direction == "IN" ? ChequeService.UnderCollectionAccount : ChequeService.PayableAccount, null, null, type == "RECEIPT" ? request.Amount : 0, type == "RECEIPT" ? 0 : request.Amount, type == "RECEIPT" ? request.Amount : 0, type == "RECEIPT" ? 0 : request.Amount, details.CurrencyId, 1);
        var chequeNo = request.ChequeNo!.Trim();
        await using (var bank = db.CreateCommand())
        {
            bank.CommandText = "SELECT TreasureType FROM dbo.Treasuries WHERE TreasuryId=@id"; Add(bank, "@id", request.TreasuryId, DbType.Int32);
            if (!string.Equals(Convert.ToString(await bank.ExecuteScalarAsync(ct)), "BANK", StringComparison.Ordinal)) throw new ReceiptException("A cheque must be drawn on or deposited to a bank treasury.");
        }
        await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            await using (var duplicate = db.CreateCommand())
            {
                // An open cheque with the same number from the same customer (received) or on the same bank account (issued) is a double entry.
                duplicate.Transaction = tx;
                duplicate.CommandText = "SELECT TOP 1 VoucherNo FROM dbo.Cheques WITH (UPDLOCK,HOLDLOCK) WHERE Direction=@direction AND ChequeNo=@no AND Status IN (N'PENDING',N'DEPOSITED',N'CLEARED') AND ((@direction=N'IN' AND PartnerId=@partner) OR (@direction=N'OUT' AND TreasuryId=@treasury))";
                Add(duplicate, "@direction", direction, DbType.String, 3); Add(duplicate, "@no", chequeNo, DbType.String, 50); Add(duplicate, "@partner", request.PartnerId, DbType.Int32); Add(duplicate, "@treasury", request.TreasuryId, DbType.Int32);
                if (await duplicate.ExecuteScalarAsync(ct) is string existing) throw new ReceiptException($"Cheque {chequeNo} is already recorded on voucher {existing}.", 409);
            }
            var transaction = await transactions.PostAsync(db, tx, new TransactionWriteRequest(type, request.Reason, receiptNo, request.Description, details.CurrencyId, 1, [receiptLine, holdingLine], request.BranchId, receiptDate, request.SavedBy), ct);
            int chequeId;
            await using (var insert = db.CreateCommand())
            {
                insert.Transaction = tx;
                insert.CommandText = "INSERT INTO dbo.Cheques(BranchId,Direction,ChequeNo,DueDate,PartnerId,TreasuryId,CurrencyId,Amount,PartnerCurrencyId,PartnerAmount,ExchangeRate,VoucherNo,VoucherMoveNo,VoucherDate,Description,Status,StatusDate,StatusBy,StatusAt,SavedBy) OUTPUT INSERTED.ChequeId VALUES(@branch,@direction,@no,@due,@partner,@treasury,@currency,@amount,@partnerCurrency,@partnerAmount,@rate,@voucher,@move,@date,@description,N'PENDING',@date,@user,SYSUTCDATETIME(),@user)";
                Add(insert, "@branch", request.BranchId, DbType.Int32); Add(insert, "@direction", direction, DbType.String, 3); Add(insert, "@no", chequeNo, DbType.String, 50); Add(insert, "@due", request.ChequeDueDate!.Value.Date, DbType.Date);
                Add(insert, "@partner", request.PartnerId, DbType.Int32); Add(insert, "@treasury", request.TreasuryId, DbType.Int32); Add(insert, "@currency", details.CurrencyId, DbType.Int32); AddDecimal(insert, "@amount", request.Amount, 19, 4);
                Add(insert, "@partnerCurrency", partnerCurrencyId, DbType.Int32); AddDecimal(insert, "@partnerAmount", partnerAmount, 19, 4); AddDecimal(insert, "@rate", request.ExchangeRate, 19, 8);
                Add(insert, "@voucher", receiptNo, DbType.String, 50); Add(insert, "@move", transaction.MoveNo, DbType.Int32); Add(insert, "@date", receiptDate, DbType.Date); Add(insert, "@description", string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(), DbType.String, 250); Add(insert, "@user", request.SavedBy, DbType.Int32);
                chequeId = Convert.ToInt32(await insert.ExecuteScalarAsync(ct));
            }
            await ChequeService.AddEventAsync(db, tx, chequeId, null, "PENDING", receiptDate, transaction.MoveNo, null, request.SavedBy, ct);
            await tx.CommitAsync(ct);
            return new ReceiptWriteResult(receiptNo, type, request.PartnerId, request.TreasuryId, details.CurrencyId, partnerCurrencyId, request.Amount, partnerAmount, request.Amount, request.ExchangeRate, transaction, "CHEQUE", chequeId);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }

    public async Task<IReadOnlyList<ReceiptListItem>> GetAsync(string? type, int? branchId, DateTime? from, DateTime? to, CancellationToken ct)
    {
        if (from.HasValue && to.HasValue && from.Value.Date > to.Value.Date) throw new ReceiptException("The start date cannot be after the end date.");
        var normalizedType = string.IsNullOrWhiteSpace(type) ? null : type.Trim().ToUpperInvariant();
        if (normalizedType is not null and not ("RECEIPT" or "PAYMENT")) throw new ReceiptException("Receipt type must be RECEIPT or PAYMENT.");
        await using var db = await OpenAsync(ct); await using var command = db.CreateCommand();
        command.CommandText = "WITH grouped AS (SELECT MoveNo,MAX(RefNo) AS ReceiptNo,TransactionType,TransactionDate,MAX(PartnerId) AS PartnerId,MAX(TreasuryId) AS TreasuryId,MAX(CASE WHEN PartnerId IS NULL THEN CurrencyId END) AS CurrencyId,MAX(CASE WHEN PartnerId IS NOT NULL THEN CurrencyId END) AS PartnerCurrencyId,SUM(Debit) AS TotalDebit,MAX(CASE WHEN PartnerId IS NOT NULL THEN ForeignDebit+ForeignCredit ELSE 0 END) AS PartnerAmount,MAX(ExchangeRate) AS ExchangeRate,MAX(Pattern) AS Reason,MAX(Description) AS Description FROM dbo.Transactions WHERE TransactionType IN (N'RECEIPT',N'PAYMENT') AND (@type IS NULL OR TransactionType=@type) AND (@branch IS NULL OR BranchId=@branch) AND (@from IS NULL OR TransactionDate>=@from) AND (@to IS NULL OR TransactionDate<=@to) GROUP BY MoveNo,TransactionType,TransactionDate) SELECT g.MoveNo,g.ReceiptNo,g.TransactionType,g.TransactionDate,g.PartnerId,p.PartnerName,COALESCE(g.TreasuryId,ch.TreasuryId),COALESCE(t.NameEn,t.NameAr),g.CurrencyId,c.CurrencyCode,c.Symbol,g.TotalDebit,g.PartnerAmount,pc.CurrencyCode,pc.Symbol,g.ExchangeRate,g.Reason,g.Description,ch.ChequeId,ch.ChequeNo,ch.DueDate,ch.Status FROM grouped g LEFT JOIN dbo.Cheques ch ON ch.VoucherMoveNo=g.MoveNo LEFT JOIN dbo.Partners p ON p.PartnerId=g.PartnerId LEFT JOIN dbo.Treasuries t ON t.TreasuryId=COALESCE(g.TreasuryId,ch.TreasuryId) JOIN dbo.Currencies c ON c.CurrencyId=g.CurrencyId JOIN dbo.Currencies pc ON pc.CurrencyId=g.PartnerCurrencyId ORDER BY g.TransactionDate DESC,g.MoveNo DESC";
        Add(command, "@type", normalizedType, DbType.String, 10); Add(command, "@branch", branchId, DbType.Int32); Add(command, "@from", from?.Date, DbType.Date); Add(command, "@to", to?.Date, DbType.Date);
        var rows = new List<ReceiptListItem>(); await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) rows.Add(new ReceiptListItem(reader.GetInt32(0), reader.GetString(1), reader.GetString(2), reader.GetDateTime(3), reader.GetInt32(4), reader.IsDBNull(5) ? null : reader.GetString(5), reader.GetInt32(6), reader.IsDBNull(7) ? null : reader.GetString(7), reader.GetInt32(8), reader.GetString(9), reader.GetString(10), reader.GetDecimal(11), reader.GetDecimal(12), reader.GetString(13), reader.GetString(14), reader.GetDecimal(15), reader.IsDBNull(16) ? null : reader.GetString(16), reader.IsDBNull(17) ? null : reader.GetString(17), reader.IsDBNull(18) ? "CASH" : "CHEQUE", reader.IsDBNull(18) ? null : reader.GetInt32(18), reader.IsDBNull(19) ? null : reader.GetString(19), reader.IsDBNull(20) ? null : reader.GetDateTime(20), reader.IsDBNull(21) ? null : reader.GetString(21)));
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
        var method = request.Method?.Trim().ToUpperInvariant();
        if (method is not (null or "" or "CASH" or "CHEQUE")) throw new ReceiptException("Payment method must be CASH or CHEQUE.");
        if (method != "CHEQUE") return;
        if (string.IsNullOrWhiteSpace(request.ChequeNo)) throw new ReceiptException("Enter the cheque number.");
        if (request.ChequeNo.Trim().Length > 50) throw new ReceiptException("Cheque number must be 50 characters or fewer.");
        if (request.ChequeDueDate is null) throw new ReceiptException("Enter the cheque due date.");
    }

    private static bool IsCheque(ReceiptWriteRequest request) => string.Equals(request.Method?.Trim(), "CHEQUE", StringComparison.OrdinalIgnoreCase);

    private static async Task<(int CurrencyId, bool IsActive)> ReadReferencesAsync(DbConnection db, ReceiptWriteRequest request, CancellationToken ct)
    {
        await using (var partner = db.CreateCommand()) { partner.CommandText = "SELECT Status FROM dbo.Partners WHERE PartnerId=@id"; Add(partner, "@id", request.PartnerId, DbType.Int32); var status = await partner.ExecuteScalarAsync(ct); if (status is null) throw new ReceiptException("Partner was not found.", 404); if (!string.Equals(Convert.ToString(status), "ACTIVE", StringComparison.OrdinalIgnoreCase)) throw new ReceiptException("An inactive partner cannot be used in a receipt."); }
        await using var treasury = db.CreateCommand(); treasury.CommandText = "SELECT CurrencyId,IsActive FROM dbo.Treasuries WHERE TreasuryId=@id AND BranchId=@branch"; Add(treasury, "@id", request.TreasuryId, DbType.Int32); Add(treasury, "@branch", request.BranchId, DbType.Int32); await using var reader = await treasury.ExecuteReaderAsync(ct); if (!await reader.ReadAsync(ct)) throw new ReceiptException("Treasury was not found.", 404); if (!reader.GetBoolean(1)) throw new ReceiptException("An inactive treasury cannot be used in a receipt."); return (reader.GetInt32(0), reader.GetBoolean(1));
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
    private static void AddDecimal(DbCommand command, string name, decimal value, byte precision, byte scale) { var parameter = command.CreateParameter(); parameter.ParameterName = name; parameter.DbType = DbType.Decimal; parameter.Precision = precision; parameter.Scale = scale; parameter.Value = value; command.Parameters.Add(parameter); }
    private static void Add(DbCommand command, string name, object? value, DbType type, int? size = null) { var parameter = command.CreateParameter(); parameter.ParameterName = name; parameter.DbType = type; if (size.HasValue) parameter.Size = size.Value; parameter.Value = value ?? DBNull.Value; command.Parameters.Add(parameter); }
}

public sealed class ReceiptException(string message, int statusCode = 400) : Exception(message) { public int StatusCode { get; } = statusCode; }
