namespace ElitePos.LocalService.Models;

public sealed record ChequeListItem(
    int ChequeId,
    int BranchId,
    string Direction,
    string ChequeNo,
    DateTime DueDate,
    int PartnerId,
    string PartnerName,
    int TreasuryId,
    string TreasuryNameAr,
    string TreasuryNameEn,
    string? BankNameAr,
    string? BankNameEn,
    int CurrencyId,
    string CurrencyCode,
    string CurrencySymbol,
    decimal Amount,
    decimal PartnerAmount,
    string PartnerCurrencySymbol,
    string VoucherNo,
    DateTime VoucherDate,
    string? Description,
    string Status,
    DateTime? StatusDate,
    string? StatusByName,
    DateTime? StatusAt,
    string? SavedByName,
    DateTime CreatedAt);

public sealed record ChequeEvent(long ChequeEventId, string? FromStatus, string ToStatus, DateTime EventDate, int? MoveNo, string? Note, string? SavedByName, DateTime SavedAt, int? TreasuryId, string? TreasuryNameAr, string? TreasuryNameEn);

public sealed record ChequeDetail(ChequeListItem Cheque, IReadOnlyList<ChequeEvent> Events);

// Action is DEPOSIT, CLEAR, BOUNCE, RETURN or CANCEL. Date is the business date of the event and defaults to today.
// TreasuryId is only for DEPOSIT: the bank treasury the received cheque goes to, when it is not the one named on the receipt.
public sealed record ChequeActionRequest(string? Action, DateTime? Date = null, string? Note = null, int? TreasuryId = null);
