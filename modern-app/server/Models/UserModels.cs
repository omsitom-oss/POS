namespace ElitePos.LocalService.Models;

public sealed record UserDto(int UserId, string UserName, string? Email, string? Phone, int? BranchId, int? EmployeeId, bool IsActive, bool MustChangePassword, DateTime? LastLoginAt, DateTime CreatedAt, DateTime UpdatedAt, IReadOnlyList<int> RoleIds);
public sealed record UserWriteRequest(string? UserName, string? Email, string? Phone, int? BranchId, int? EmployeeId, string? Password, IReadOnlyList<int>? RoleIds = null, bool IsActive = true);
