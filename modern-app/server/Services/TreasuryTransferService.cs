using System.Data;
using System.Data.Common;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

public sealed class TreasuryTransferService(DbConnectionFactory factory, TransactionService transactions)
{
    public async Task<TreasuryTransferResult> SaveAsync(TreasuryTransferRequest request, CancellationToken ct)
    {
        if (request.SourceTreasuryId <= 0 || request.DestinationTreasuryId <= 0 || request.SourceTreasuryId == request.DestinationTreasuryId)
            throw new TreasuryTransferException("Choose two different treasuries.");
        if (request.SourceAmount <= 0 || request.DestinationAmount <= 0 || request.ExchangeRate <= 0)
            throw new TreasuryTransferException("Amounts and exchange rate must be greater than zero.");

        var date = (request.TransferDate ?? DateTime.UtcNow).Date;
        await using var db = factory.CreateConnection(); await db.OpenAsync(ct);
        var source = await ReadTreasuryAsync(db, request.SourceTreasuryId, ct);
        var destination = await ReadTreasuryAsync(db, request.DestinationTreasuryId, ct);
        var available = await ReadBalanceAsync(db, source.TreasuryId, ct);
        if (request.SourceAmount > available + 0.0001m)
            throw new TreasuryTransferException("The transfer amount exceeds the available source treasury balance.");
        if (source.CurrencyId == destination.CurrencyId)
        {
            if (Math.Abs(request.ExchangeRate - 1m) > 0.000001m || Math.Abs(request.SourceAmount - request.DestinationAmount) > 0.01m)
                throw new TreasuryTransferException("Transfers between treasuries with the same currency must use rate 1 and equal amounts.");
        }
        else if (Math.Abs(request.DestinationAmount * request.ExchangeRate - request.SourceAmount) > 0.01m)
            throw new TreasuryTransferException("The source amount must equal the destination amount multiplied by the exchange rate.");

        var transaction = await transactions.SaveAsync(new TransactionWriteRequest(
            "TREASURY_TRANSFER", "TRANSFER", null, request.Description, source.CurrencyId, 1,
            [
                new TransactionLineRequest($"TREASURY:{destination.TreasuryId}", null, destination.TreasuryId, request.SourceAmount, 0, request.DestinationAmount, 0, destination.CurrencyId, request.ExchangeRate),
                new TransactionLineRequest($"TREASURY:{source.TreasuryId}", null, source.TreasuryId, 0, request.SourceAmount, 0, request.SourceAmount, source.CurrencyId, 1),
            ], request.BranchId, date, request.SavedBy), ct);
        return new TreasuryTransferResult(transaction.MoveNo, date, source.TreasuryId, destination.TreasuryId, source.CurrencyId, destination.CurrencyId, request.SourceAmount, request.DestinationAmount, request.ExchangeRate, transaction);
    }

    private static async Task<(int TreasuryId, int CurrencyId)> ReadTreasuryAsync(DbConnection db, int treasuryId, CancellationToken ct)
    {
        await using var command = db.CreateCommand(); command.CommandText = "SELECT CurrencyId,IsActive FROM dbo.Treasuries WHERE TreasuryId=@id"; Add(command, "@id", treasuryId, DbType.Int32);
        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) throw new TreasuryTransferException("Treasury was not found.", 404);
        if (!reader.GetBoolean(1)) throw new TreasuryTransferException("Inactive treasuries cannot be used.");
        return (treasuryId, reader.GetInt32(0));
    }

    private static async Task<decimal> ReadBalanceAsync(DbConnection db, int treasuryId, CancellationToken ct)
    {
        await using var command = db.CreateCommand(); command.CommandText = "SELECT COALESCE(SUM(ForeignDebit-ForeignCredit),0) FROM dbo.Transactions WHERE TreasuryId=@id"; Add(command, "@id", treasuryId, DbType.Int32);
        return Convert.ToDecimal(await command.ExecuteScalarAsync(ct));
    }

    private static void Add(DbCommand command, string name, object value, DbType type) { var parameter = command.CreateParameter(); parameter.ParameterName = name; parameter.DbType = type; parameter.Value = value; command.Parameters.Add(parameter); }
}

public sealed class TreasuryTransferException(string message, int statusCode = 400) : Exception(message) { public int StatusCode { get; } = statusCode; }
