namespace ElitePos.LocalService.Models;

public sealed record LoginRequest(string? Identifier, string? Password);
public sealed record ChangePasswordRequest(string? NewPassword);
public sealed record LoginResult(int UserId, string UserName, int BranchId, string BranchCode, string BranchNameAr, string BranchNameEn, bool MustChangePassword, IReadOnlyList<int> RoleIds);
