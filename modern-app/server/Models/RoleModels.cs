namespace ElitePos.LocalService.Models;

public sealed record PermissionDto(int PermissionId, string Code, string Name, string? Description);
public sealed record RoleDto(int RoleId, string Name, bool IsActive, IReadOnlyList<PermissionDto> Permissions, DateTime CreatedAt, DateTime UpdatedAt);
public sealed record RoleWriteRequest(string? Name, bool IsActive = true, IReadOnlyList<int>? PermissionIds = null);
