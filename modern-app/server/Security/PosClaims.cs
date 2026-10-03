using System.Security.Claims;

namespace ElitePos.LocalService.Security;

public static class PosClaims
{
    public const string UserId = "pos:user";
    public const string BranchId = "pos:branch";
    public const string SessionId = "pos:session";
    public const string Permission = "pos:perm";
    public const string MustChangePasswordClaim = "pos:must_change_password";

    public static int GetUserId(this ClaimsPrincipal user) => int.Parse(user.FindFirstValue(UserId) ?? throw new InvalidOperationException("The request is not authenticated."));
    public static int GetBranchId(this ClaimsPrincipal user) => int.Parse(user.FindFirstValue(BranchId) ?? throw new InvalidOperationException("The request is not authenticated."));
    public static Guid GetSessionId(this ClaimsPrincipal user) => Guid.Parse(user.FindFirstValue(SessionId) ?? throw new InvalidOperationException("The request is not authenticated."));
    public static bool HasPermission(this ClaimsPrincipal user, string code) => user.HasClaim(Permission, code);
    public static bool MustChangePassword(this ClaimsPrincipal user) => user.HasClaim(MustChangePasswordClaim, "true");
}
