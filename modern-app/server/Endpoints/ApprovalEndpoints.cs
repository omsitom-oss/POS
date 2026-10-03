using ElitePos.LocalService.Models;
using ElitePos.LocalService.Security;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

public static class ApprovalEndpoints
{
    public static IEndpointRouteBuilder MapApprovalEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/approvals").RequireAuthorization(); var write = group.MapGroup("").RequirePermission(PermissionCodes.SettingsManage);
        group.MapGet("", async (ApprovalService service, CancellationToken ct) => Results.Ok(await service.GetAsync(ct)));
        write.MapPut("/{requestType}", async (string requestType, ApprovalSettingWriteRequest request, ApprovalService service, CancellationToken ct) =>
        {
            var result = await service.SetAsync(requestType, request, ct); return result is null ? Results.NotFound() : Results.Ok(result);
        });
        return endpoints;
    }
}
