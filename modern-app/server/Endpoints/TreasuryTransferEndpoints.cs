using System.Security.Claims;
using ElitePos.LocalService.Models;
using ElitePos.LocalService.Security;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

public static class TreasuryTransferEndpoints
{
    public static IEndpointRouteBuilder MapTreasuryTransferEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/treasury-transfers", async (TreasuryTransferRequest request, ClaimsPrincipal user, TreasuryTransferService service, CancellationToken ct) =>
        {
            try { return Results.Created("/api/treasury-transfers", await service.SaveAsync(request with { BranchId = user.ForWrite(request.BranchId), SavedBy = user.GetUserId() }, ct)); }
            catch (TreasuryTransferException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
            catch (TransactionException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        }).RequirePermission(PermissionCodes.TreasuryManage);
        return endpoints;
    }
}
