namespace ElitePos.LocalService.Models;

public sealed record ApprovalSettingDto(string RequestType, bool RequiresApproval, DateTime UpdatedAt);
public sealed record ApprovalSettingWriteRequest(bool RequiresApproval);
