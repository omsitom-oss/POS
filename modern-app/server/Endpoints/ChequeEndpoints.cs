using System.Security.Claims;
using ElitePos.LocalService.Models;
using ElitePos.LocalService.Security;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

// Received and issued cheques. Cheques are created by receipt and payment vouchers paid by cheque (/api/receipts);
// these routes list them and move them through their statuses. Cheques of branches the user cannot access answer as not found.
public static class ChequeEndpoints
{
    public static IEndpointRouteBuilder MapChequeEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/cheques");
        group.MapGet("", async (int? branchId, string? direction, string? status, DateTime? dueFrom, DateTime? dueTo, ClaimsPrincipal user, ChequeService service, CancellationToken ct) =>
        {
            try { return Results.Ok(await service.GetAsync(user.ForRead(branchId), direction, status, dueFrom, dueTo, ct)); }
            catch (ChequeException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        }).RequirePermission(PermissionCodes.TreasuryView);
        group.MapGet("/{id:int}", async (int id, ClaimsPrincipal user, ChequeService service, CancellationToken ct) =>
            Allowed(user, await service.GetBranchIdAsync(id, ct)) && await service.GetByIdAsync(id, ct) is { } item ? Results.Ok(item) : Results.NotFound()).RequirePermission(PermissionCodes.TreasuryView);
        group.MapPost("/{id:int}/actions", async (int id, ChequeActionRequest request, ClaimsPrincipal user, ChequeService service, CancellationToken ct) =>
        {
            if (!Allowed(user, await service.GetBranchIdAsync(id, ct))) return Results.NotFound();
            try { return await service.ActAsync(id, request, user.GetUserId(), ct) is { } result ? Results.Ok(result) : Results.NotFound(); }
            catch (ChequeException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
            catch (TransactionException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        }).RequirePermission(PermissionCodes.ChequesManage);
        return endpoints;
    }

    private static bool Allowed(ClaimsPrincipal user, int? recordBranchId) => recordBranchId is { } branch && user.CanAccessBranch(branch);
}
