using System.Security.Claims;
using ElitePos.LocalService.Models;
using ElitePos.LocalService.Security;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

public static class ReceiptEndpoints
{
    public static IEndpointRouteBuilder MapReceiptEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/receipts");
        group.MapGet("", async (string? type, int? branchId, DateTime? from, DateTime? to, ClaimsPrincipal user, ReceiptService service, CancellationToken ct) =>
        {
            try { return Results.Ok(await service.GetAsync(type, user.ForRead(branchId), from, to, ct)); }
            catch (ReceiptException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        }).RequirePermission(PermissionCodes.TreasuryView);
        group.MapPost("", async (ReceiptWriteRequest request, ClaimsPrincipal user, ReceiptService service, CancellationToken ct) =>
        {
            try { return Results.Created("/api/receipts", await service.SaveAsync(request with { BranchId = user.ForWrite(request.BranchId), SavedBy = user.GetUserId() }, ct)); }
            catch (ReceiptException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
            catch (TransactionException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        }).RequirePermission(PermissionCodes.TreasuryManage);
        return endpoints;
    }
}
