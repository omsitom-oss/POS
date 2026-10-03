using System.Security.Claims;
using ElitePos.LocalService.Security;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

public static class AccountEndpoints
{
    public static IEndpointRouteBuilder MapAccountEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/accounts/chart", async (int? branchId, ClaimsPrincipal user, AccountService service, CancellationToken ct) => Results.Ok(await service.GetChartAsync(user.ForRead(branchId), ct))).RequirePermission(PermissionCodes.TreasuryView);
        return endpoints;
    }
}
