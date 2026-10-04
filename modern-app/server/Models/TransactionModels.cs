namespace ElitePos.LocalService.Models;

public sealed record TransactionLineRequest(
    string? AccountId,
    int? PartnerId,
    int? TreasuryId,
    decimal Debit,
    decimal Credit,
    decimal ForeignDebit = 0,
    decimal ForeignCredit = 0,
    int? CurrencyId = null,
    decimal? ExchangeRate = null);

public sealed record TransactionWriteRequest(
    string? TransactionType,
    string? Pattern,
    string? RefNo,
    string? Description,
    int CurrencyId,
    decimal ExchangeRate,
    IReadOnlyList<TransactionLineRequest>? Lines,
    int? BranchId = null,
    DateTime? TransactionDate = null,
    int? SavedBy = null,
    // Primary-currency units per one unit of CurrencyId for this document; when null the latest stored rate is used.
    decimal? BaseRate = null);

public sealed record TransactionWriteResult(
    int MoveNo,
    DateTime TransactionDate,
    int CurrencyId,
    decimal ExchangeRate,
    IReadOnlyList<long> TransactionIds);

public sealed record TransactionStatementRow(
    long TransactionId,
    DateTime TransactionDate,
    int MoveNo,
    string TransactionType,
    string? Pattern,
    string AccountId,
    int? PartnerId,
    int? TreasuryId,
    string? RefNo,
    string? Description,
    decimal Debit,
    decimal Credit,
    decimal ForeignDebit,
    decimal ForeignCredit,
    int CurrencyId,
    string CurrencyCode,
    string CurrencySymbol,
    decimal ExchangeRate,
    int? SavedBy,
    DateTime SavedOn,
    decimal Balance);

public sealed record TransactionStatement(
    string Subject,
    IReadOnlyList<TransactionStatementRow> Rows,
    decimal TotalDebit,
    decimal TotalCredit,
    decimal Balance,
    DateTime? From,
    DateTime? To);

public sealed record PartnerBalance(decimal Amount, decimal Debit, decimal Credit, int CurrencyId, string CurrencyCode, string CurrencySymbol, string CurrencyNameEn, string CurrencyNameAr, string? FlagBase64);

public sealed record ReceiptWriteRequest(
    string? Type,
    int PartnerId,
    int TreasuryId,
    decimal Amount,
    decimal ExchangeRate,
    string? PartnerAccountId = null,
    string? TreasuryAccountId = null,
    string? Reason = null,
    string? Description = null,
    DateTime? ReceiptDate = null,
    int? BranchId = null,
    int? SavedBy = null,
    int? PartnerCurrencyId = null,
    decimal? PartnerAmount = null);

public sealed record ReceiptWriteResult(
    string ReceiptNo,
    string Type,
    int PartnerId,
    int TreasuryId,
    int CurrencyId,
    int PartnerCurrencyId,
    decimal Amount,
    decimal PartnerAmount,
    decimal LocalAmount,
    decimal ExchangeRate,
    TransactionWriteResult Transaction);

public sealed record ReceiptListItem(
    int MoveNo,
    string ReceiptNo,
    string Type,
    DateTime ReceiptDate,
    int PartnerId,
    string? PartnerName,
    int TreasuryId,
    string? TreasuryName,
    int CurrencyId,
    string CurrencyCode,
    string CurrencySymbol,
    decimal Amount,
    decimal PartnerAmount,
    string PartnerCurrencyCode,
    string PartnerCurrencySymbol,
    decimal ExchangeRate,
    string? Reason,
    string? Description);

public sealed record ExpenseWriteRequest(
    string? ExpenseAccountId,
    int TreasuryId,
    decimal Amount,
    DateTime? ExpenseDate = null,
    string? Description = null,
    int? BranchId = null,
    int? SavedBy = null);

public sealed record ExpenseWriteResult(string ExpenseNo, int TreasuryId, string ExpenseAccountId, decimal Amount, TransactionWriteResult Transaction);

public sealed record ExpenseListItem(int MoveNo, string ExpenseNo, DateTime ExpenseDate, string ExpenseAccountId, string ExpenseNameEn, string ExpenseNameAr, int TreasuryId, string TreasuryName, int CurrencyId, string CurrencyCode, string CurrencySymbol, decimal Amount, string? Description);

public sealed record TreasuryTransferRequest(
    int SourceTreasuryId,
    int DestinationTreasuryId,
    decimal SourceAmount,
    decimal DestinationAmount,
    decimal ExchangeRate,
    DateTime? TransferDate = null,
    string? Description = null,
    int? BranchId = null,
    int? SavedBy = null);

public sealed record TreasuryTransferResult(
    int MoveNo,
    DateTime TransferDate,
    int SourceTreasuryId,
    int DestinationTreasuryId,
    int SourceCurrencyId,
    int DestinationCurrencyId,
    decimal SourceAmount,
    decimal DestinationAmount,
    decimal ExchangeRate,
    TransactionWriteResult Transaction);
