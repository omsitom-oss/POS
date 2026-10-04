namespace ElitePos.LocalService.Models;

public sealed record PermissionDto(int PermissionId, string Code, string Name, string? Description);
public sealed record RoleDto(int RoleId, string Name, bool IsActive, IReadOnlyList<PermissionDto> Permissions, DateTime CreatedAt, DateTime UpdatedAt, decimal MaxDiscountPercent = 0);
// MaxDiscountPercent caps the invoice discount a member of this role may give; null keeps the current value (0 for a new role).
public sealed record RoleWriteRequest(string? Name, bool IsActive = true, IReadOnlyList<int>? PermissionIds = null, decimal? MaxDiscountPercent = null);
