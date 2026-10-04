using System.Data;
using System.Data.Common;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

// Received (IN) and issued (OUT) cheques. ReceiptService creates them from a voucher paid by cheque; this service lists
// them and moves them through their statuses. Every move is dated on the day it happens (or the date the user gives),
// records who did it, and posts its journal in the same database transaction as the status change.
//
//   Received: PENDING -> DEPOSITED (moves the cheque to a bank treasury, no journal) -> CLEARED   bank / under collection
//             PENDING or DEPOSITED -> BOUNCED                   customer    / under collection
//             PENDING -> RETURNED (handed back to the customer) customer    / under collection
//             CLEARED -> BOUNCED (the bank reverses it)         customer    / bank
//   Issued:   PENDING -> CLEARED                                payable     / bank
//             PENDING -> BOUNCED or CANCELLED                   payable     / supplier
//             CLEARED -> BOUNCED (the bank reverses it)         bank        / supplier
public sealed class ChequeService(DbConnectionFactory factory, TransactionService transactions)
{
    public const string UnderCollectionAccount = "1250";
    public const string PayableAccount = "2150";
    private static readonly string[] Statuses = ["PENDING", "DEPOSITED", "CLEARED", "BOUNCED", "RETURNED", "CANCELLED"];

    private const string ListSql = """
        SELECT ch.ChequeId,ch.BranchId,ch.Direction,ch.ChequeNo,ch.DueDate,ch.PartnerId,p.PartnerName,ch.TreasuryId,t.NameAr,t.NameEn,b.NameAr,b.NameEn,
               ch.CurrencyId,c.CurrencyCode,c.Symbol,ch.Amount,ch.PartnerAmount,pc.Symbol,ch.VoucherNo,ch.VoucherDate,ch.Description,ch.Status,ch.StatusDate,
               su.UserName,ch.StatusAt,cu.UserName,ch.CreatedAt
        FROM dbo.Cheques ch
        JOIN dbo.Partners p ON p.PartnerId=ch.PartnerId
        JOIN dbo.Treasuries t ON t.TreasuryId=ch.TreasuryId
        LEFT JOIN dbo.Banks b ON b.BankId=t.BankId
        JOIN dbo.Currencies c ON c.CurrencyId=ch.CurrencyId
        JOIN dbo.Currencies pc ON pc.CurrencyId=ch.PartnerCurrencyId
        LEFT JOIN dbo.Users su ON su.UserId=ch.StatusBy
        LEFT JOIN dbo.Users cu ON cu.UserId=ch.SavedBy
        """;

    public async Task<IReadOnlyList<ChequeListItem>> GetAsync(int? branchId, string? direction, string? status, DateTime? dueFrom, DateTime? dueTo, CancellationToken ct)
    {
        var normalizedDirection = string.IsNullOrWhiteSpace(direction) ? null : direction.Trim().ToUpperInvariant();
        if (normalizedDirection is not (null or "IN" or "OUT")) throw new ChequeException("Direction must be IN or OUT.");
        var normalizedStatus = string.IsNullOrWhiteSpace(status) ? null : status.Trim().ToUpperInvariant();
        if (normalizedStatus is not null && !Statuses.Contains(normalizedStatus)) throw new ChequeException("Unknown cheque status.");
        if (dueFrom.HasValue && dueTo.HasValue && dueFrom.Value.Date > dueTo.Value.Date) throw new ChequeException("The start date cannot be after the end date.");
        await using var db = await OpenAsync(ct);
        await using var command = db.CreateCommand();
        command.CommandText = ListSql + " WHERE (@branch IS NULL OR ch.BranchId=@branch) AND (@direction IS NULL OR ch.Direction=@direction) AND (@status IS NULL OR ch.Status=@status) AND (@from IS NULL OR ch.DueDate>=@from) AND (@to IS NULL OR ch.DueDate<=@to) ORDER BY ch.DueDate,ch.ChequeId";
        Add(command, "@branch", branchId, DbType.Int32); Add(command, "@direction", normalizedDirection, DbType.String, 3); Add(command, "@status", normalizedStatus, DbType.String, 20);
        Add(command, "@from", dueFrom?.Date, DbType.Date); Add(command, "@to", dueTo?.Date, DbType.Date);
        var rows = new List<ChequeListItem>();
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) rows.Add(Read(reader));
        return rows;
    }

    public async Task<int?> GetBranchIdAsync(int chequeId, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        await using var command = db.CreateCommand(); command.CommandText = "SELECT BranchId FROM dbo.Cheques WHERE ChequeId=@id"; Add(command, "@id", chequeId, DbType.Int32);
        return await command.ExecuteScalarAsync(ct) is { } value ? Convert.ToInt32(value) : null;
    }

    public async Task<ChequeDetail?> GetByIdAsync(int chequeId, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        ChequeListItem cheque;
        await using (var command = db.CreateCommand())
        {
            command.CommandText = ListSql + " WHERE ch.ChequeId=@id"; Add(command, "@id", chequeId, DbType.Int32);
            await using var reader = await command.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) return null;
            cheque = Read(reader);
        }
        var events = new List<ChequeEvent>();
        await using (var command = db.CreateCommand())
        {
            command.CommandText = "SELECT e.ChequeEventId,e.FromStatus,e.ToStatus,e.EventDate,e.MoveNo,e.Note,u.UserName,e.SavedAt,e.TreasuryId,t.NameAr,t.NameEn FROM dbo.ChequeEvents e LEFT JOIN dbo.Users u ON u.UserId=e.SavedBy LEFT JOIN dbo.Treasuries t ON t.TreasuryId=e.TreasuryId WHERE e.ChequeId=@id ORDER BY e.ChequeEventId";
            Add(command, "@id", chequeId, DbType.Int32);
            await using var reader = await command.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                events.Add(new(reader.GetInt64(0), reader.IsDBNull(1) ? null : reader.GetString(1), reader.GetString(2), reader.GetDateTime(3), reader.IsDBNull(4) ? null : reader.GetInt32(4), reader.IsDBNull(5) ? null : reader.GetString(5), reader.IsDBNull(6) ? null : reader.GetString(6), reader.GetDateTime(7), reader.IsDBNull(8) ? null : reader.GetInt32(8), reader.IsDBNull(9) ? null : reader.GetString(9), reader.IsDBNull(10) ? null : reader.GetString(10)));
        }
        return new(cheque, events);
    }

    public async Task<ChequeDetail?> ActAsync(int chequeId, ChequeActionRequest request, int userId, CancellationToken ct)
    {
        var action = request.Action?.Trim().ToUpperInvariant();
        if (action is not ("DEPOSIT" or "CLEAR" or "BOUNCE" or "RETURN" or "CANCEL")) throw new ChequeException("Action must be DEPOSIT, CLEAR, BOUNCE, RETURN or CANCEL.");
        var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        if (note?.Length > 250) throw new ChequeException("The note must be 250 characters or fewer.");
        var date = (request.Date ?? DateTime.Today).Date;

        await using var db = await OpenAsync(ct);
        await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            var cheque = await ReadForUpdateAsync(db, tx, chequeId, ct);
            if (cheque is null) { await tx.RollbackAsync(ct); return null; }
            var target = Transition(cheque.Direction, cheque.Status, action);
            if (date < cheque.VoucherDate) throw new ChequeException("The date cannot be before the voucher date.");
            if (cheque.StatusDate is { } last && date < last) throw new ChequeException("The date cannot be before the cheque's last status change.");
            int? bank = null;
            if (target == "DEPOSITED")
            {
                // Depositing hands the cheque to a bank treasury of the same branch and currency; the money still moves only on clearing.
                bank = request.TreasuryId ?? cheque.TreasuryId;
                if (bank != cheque.TreasuryId) await EnsureBankAsync(db, tx, bank.Value, cheque, ct);
            }
            else if (request.TreasuryId is not null && request.TreasuryId != cheque.TreasuryId) throw new ChequeException("A bank can only be chosen when depositing a cheque.");

            int? moveNo = null;
            if (Lines(cheque, cheque.Status, target) is { } lines)
            {
                var type = $"CHEQUE_{action}";
                var description = $"{(cheque.Direction == "IN" ? "Received" : "Issued")} cheque {cheque.ChequeNo}" + (note is null ? "" : $": {note}");
                var posted = await transactions.PostAsync(db, tx, new TransactionWriteRequest(type, type, cheque.VoucherNo, description.Length > 250 ? description[..250] : description, cheque.CurrencyId, 1, lines, cheque.BranchId, date, userId), ct);
                moveNo = posted.MoveNo;
            }

            await using (var update = db.CreateCommand())
            {
                update.Transaction = tx;
                update.CommandText = "UPDATE dbo.Cheques SET Status=@status,TreasuryId=COALESCE(@bank,TreasuryId),StatusDate=@date,StatusBy=@user,StatusAt=SYSUTCDATETIME() WHERE ChequeId=@id";
                Add(update, "@status", target, DbType.String, 20); Add(update, "@bank", bank, DbType.Int32); Add(update, "@date", date, DbType.Date); Add(update, "@user", userId, DbType.Int32); Add(update, "@id", chequeId, DbType.Int32);
                await update.ExecuteNonQueryAsync(ct);
            }
            await AddEventAsync(db, tx, chequeId, cheque.Status, target, date, moveNo, note, userId, ct, bank);
            await tx.CommitAsync(ct);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
        return await GetByIdAsync(chequeId, ct);
    }

    internal static async Task AddEventAsync(DbConnection db, DbTransaction tx, int chequeId, string? from, string to, DateTime date, int? moveNo, string? note, int? userId, CancellationToken ct, int? treasuryId = null)
    {
        await using var insert = db.CreateCommand();
        insert.Transaction = tx;
        insert.CommandText = "INSERT INTO dbo.ChequeEvents(ChequeId,FromStatus,ToStatus,EventDate,MoveNo,TreasuryId,Note,SavedBy) VALUES(@id,@from,@to,@date,@move,@treasury,@note,@user)";
        Add(insert, "@treasury", treasuryId, DbType.Int32);
        Add(insert, "@id", chequeId, DbType.Int32); Add(insert, "@from", from, DbType.String, 20); Add(insert, "@to", to, DbType.String, 20); Add(insert, "@date", date.Date, DbType.Date);
        Add(insert, "@move", moveNo, DbType.Int32); Add(insert, "@note", note, DbType.String, 250); Add(insert, "@user", userId, DbType.Int32);
        await insert.ExecuteNonQueryAsync(ct);
    }

    // Which status an action leads to from the current one, or why it is not allowed.
    internal static string Transition(string direction, string status, string action) => (direction, status, action) switch
    {
        ("IN", "PENDING", "DEPOSIT") => "DEPOSITED",
        ("IN", "PENDING" or "DEPOSITED", "CLEAR") => "CLEARED",
        ("IN", "PENDING" or "DEPOSITED" or "CLEARED", "BOUNCE") => "BOUNCED",
        ("IN", "PENDING", "RETURN") => "RETURNED",
        ("OUT", "PENDING", "CLEAR") => "CLEARED",
        ("OUT", "PENDING" or "CLEARED", "BOUNCE") => "BOUNCED",
        ("OUT", "PENDING", "CANCEL") => "CANCELLED",
        (_, "BOUNCED" or "RETURNED" or "CANCELLED", _) => throw new ChequeException($"This cheque is already {status.ToLowerInvariant()}; nothing more can be done with it."),
        ("IN", _, "CANCEL") => throw new ChequeException("A received cheque is returned to the customer, not cancelled."),
        ("OUT", _, "DEPOSIT" or "RETURN") => throw new ChequeException("Only received cheques can be deposited or returned."),
        _ => throw new ChequeException($"A {status.ToLowerInvariant()} cheque cannot be {Past(action)}."),
    };

    // Journal lines for a move, in the cheque (treasury) currency. Null when the move posts nothing (deposit).
    // The partner line carries the partner currency amount and rate of the original voucher, so a bounce re-opens
    // exactly what the voucher settled.
    internal static IReadOnlyList<TransactionLineRequest>? Lines(ChequeState cheque, string from, string to)
    {
        if (to == "DEPOSITED") return null;
        var amount = cheque.Amount;
        TransactionLineRequest Treasury(bool debit) => new($"TREASURY:{cheque.TreasuryId}", null, cheque.TreasuryId, debit ? amount : 0, debit ? 0 : amount, debit ? amount : 0, debit ? 0 : amount, cheque.CurrencyId, 1);
        TransactionLineRequest Holding(bool debit) => new(cheque.Direction == "IN" ? UnderCollectionAccount : PayableAccount, null, null, debit ? amount : 0, debit ? 0 : amount, debit ? amount : 0, debit ? 0 : amount, cheque.CurrencyId, 1);
        TransactionLineRequest Partner(bool debit) => new($"PARTNER:{cheque.PartnerId}", cheque.PartnerId, null, debit ? amount : 0, debit ? 0 : amount, debit ? cheque.PartnerAmount : 0, debit ? 0 : cheque.PartnerAmount, cheque.PartnerCurrencyId, cheque.ExchangeRate);
        // After clearing, the money already sits in (or left) the bank, so a bounce reverses the bank instead of the holding account.
        var settled = from == "CLEARED";
        return (cheque.Direction, to) switch
        {
            ("IN", "CLEARED") => [Treasury(true), Holding(false)],
            ("IN", "BOUNCED" or "RETURNED") => [Partner(true), settled ? Treasury(false) : Holding(false)],
            ("OUT", "CLEARED") => [Holding(true), Treasury(false)],
            ("OUT", "BOUNCED" or "CANCELLED") => [settled ? Treasury(true) : Holding(true), Partner(false)],
            _ => throw new ChequeException("Unsupported cheque move."),
        };
    }

    private static async Task EnsureBankAsync(DbConnection db, DbTransaction tx, int treasuryId, ChequeState cheque, CancellationToken ct)
    {
        await using var command = db.CreateCommand();
        command.Transaction = tx;
        command.CommandText = "SELECT TreasureType,CurrencyId,IsActive FROM dbo.Treasuries WHERE TreasuryId=@id AND BranchId=@branch";
        Add(command, "@id", treasuryId, DbType.Int32); Add(command, "@branch", cheque.BranchId, DbType.Int32);
        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) throw new ChequeException("Bank treasury was not found.", 404);
        if (reader.GetString(0) != "BANK") throw new ChequeException("A cheque can only be deposited to a bank treasury.");
        if (reader.GetInt32(1) != cheque.CurrencyId) throw new ChequeException("The bank treasury must be in the cheque's currency.");
        if (!reader.GetBoolean(2)) throw new ChequeException("An inactive treasury cannot be used.");
    }

    private static string Past(string action) => action switch { "DEPOSIT" => "deposited", "CLEAR" => "cleared", "BOUNCE" => "bounced", "RETURN" => "returned", _ => "cancelled" };

    internal sealed record ChequeState(int ChequeId, int BranchId, string Direction, string ChequeNo, int PartnerId, int TreasuryId, int CurrencyId, decimal Amount, int PartnerCurrencyId, decimal PartnerAmount, decimal ExchangeRate, string VoucherNo, DateTime VoucherDate, string Status, DateTime? StatusDate);

    private static async Task<ChequeState?> ReadForUpdateAsync(DbConnection db, DbTransaction tx, int chequeId, CancellationToken ct)
    {
        await using var command = db.CreateCommand();
        command.Transaction = tx;
        command.CommandText = "SELECT ChequeId,BranchId,Direction,ChequeNo,PartnerId,TreasuryId,CurrencyId,Amount,PartnerCurrencyId,PartnerAmount,ExchangeRate,VoucherNo,VoucherDate,Status,StatusDate FROM dbo.Cheques WITH (UPDLOCK,HOLDLOCK) WHERE ChequeId=@id";
        Add(command, "@id", chequeId, DbType.Int32);
        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        return new(reader.GetInt32(0), reader.GetInt32(1), reader.GetString(2), reader.GetString(3), reader.GetInt32(4), reader.GetInt32(5), reader.GetInt32(6), reader.GetDecimal(7), reader.GetInt32(8), reader.GetDecimal(9), reader.GetDecimal(10), reader.GetString(11), reader.GetDateTime(12), reader.GetString(13), reader.IsDBNull(14) ? null : reader.GetDateTime(14));
    }

    private static ChequeListItem Read(DbDataReader r) => new(
        r.GetInt32(0), r.GetInt32(1), r.GetString(2), r.GetString(3), r.GetDateTime(4), r.GetInt32(5), r.GetString(6), r.GetInt32(7), r.GetString(8), r.GetString(9),
        r.IsDBNull(10) ? null : r.GetString(10), r.IsDBNull(11) ? null : r.GetString(11), r.GetInt32(12), r.GetString(13), r.GetString(14), r.GetDecimal(15), r.GetDecimal(16), r.GetString(17),
        r.GetString(18), r.GetDateTime(19), r.IsDBNull(20) ? null : r.GetString(20), r.GetString(21), r.IsDBNull(22) ? null : r.GetDateTime(22), r.IsDBNull(23) ? null : r.GetString(23),
        r.IsDBNull(24) ? null : r.GetDateTime(24), r.IsDBNull(25) ? null : r.GetString(25), r.GetDateTime(26));

    private async Task<DbConnection> OpenAsync(CancellationToken ct) { var db = factory.CreateConnection(); await db.OpenAsync(ct); return db; }
    private static void Add(DbCommand command, string name, object? value, DbType type, int? size = null) { var parameter = command.CreateParameter(); parameter.ParameterName = name; parameter.DbType = type; if (size.HasValue) parameter.Size = size.Value; parameter.Value = value ?? DBNull.Value; command.Parameters.Add(parameter); }
}

public sealed class ChequeException(string message, int statusCode = 400) : Exception(message) { public int StatusCode { get; } = statusCode; }
