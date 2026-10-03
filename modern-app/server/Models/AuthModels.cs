namespace ElitePos.LocalService.Models;

public sealed record LoginRequest(string? Identifier, string? Password);
public sealed record ChangePasswordRequest(string? NewPassword, string? CurrentPassword = null);
public sealed record LoginResult(int UserId, string UserName, int BranchId, string BranchCode, string BranchNameAr, string BranchNameEn, bool MustChangePassword, IReadOnlyList<int> RoleIds, IReadOnlyList<string> Permissions, string? Token = null, DateTime? ExpiresAt = null);
public sealed record AuthenticatedSession(Guid SessionId, int UserId, string UserName, int BranchId, bool MustChangePassword, IReadOnlyList<string> Permissions);
public sealed record TemporaryPasswordResult(string TemporaryPassword);
