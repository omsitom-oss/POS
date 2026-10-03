using System.Security.Claims;

namespace ElitePos.LocalService.Security;

// The branch a request may act on comes from the signed-in user, never from the request body or query.
// Users with ALL_BRANCHES may name another branch; everyone else is held to their own.
public static class BranchScope
{
    // Branch for a write. A missing branch means the user's own; another branch needs ALL_BRANCHES.
    public static int ForWrite(this ClaimsPrincipal user, int? requestedBranchId)
    {
        var own = user.GetBranchId();
        if (requestedBranchId is null || requestedBranchId == own) return own;
        if (user.HasPermission(PermissionCodes.AllBranches)) return requestedBranchId.Value;
        throw new BranchAccessException();
    }

    // Branch filter for a list read. Null means every branch, which only ALL_BRANCHES users get.
    public static int? ForRead(this ClaimsPrincipal user, int? requestedBranchId)
    {
        if (user.HasPermission(PermissionCodes.AllBranches)) return requestedBranchId;
        var own = user.GetBranchId();
        if (requestedBranchId is null || requestedBranchId == own) return own;
        throw new BranchAccessException();
    }

    // Branch for a read that is always about one branch (stock levels, batches).
    public static int ForSingleBranchRead(this ClaimsPrincipal user, int? requestedBranchId) => user.ForWrite(requestedBranchId);

    // Whether the user may touch a record that belongs to recordBranchId. Callers report "not found" when false,
    // so records of other branches are not revealed.
    public static bool CanAccessBranch(this ClaimsPrincipal user, int recordBranchId)
        => recordBranchId == user.GetBranchId() || user.HasPermission(PermissionCodes.AllBranches);
}

public sealed class BranchAccessException() : Exception("You do not have access to that branch.");
