using System.Security.Claims;
using ElitePos.LocalService.Models;
using ElitePos.LocalService.Security;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

public static class InventoryEndpoints
{
    public static IEndpointRouteBuilder MapInventoryEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/inventory");
        group.MapGet("", async (int? branchId, ClaimsPrincipal user, InventoryService service, CancellationToken ct) =>
        {
            try { return Results.Ok(await service.GetAsync(user.ForSingleBranchRead(branchId), ct)); }
            catch (InventoryException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        }).RequirePermission(PermissionCodes.InventoryView);
        group.MapGet("/{itemId:long}/batches", async (long itemId, int? branchId, ClaimsPrincipal user, InventoryService service, CancellationToken ct) => Results.Ok(await service.GetBatchesAsync(user.ForSingleBranchRead(branchId), itemId, ct))).RequirePermission(PermissionCodes.InventoryView);
        group.MapPost("/disposals", async (InventoryDisposalRequest request, ClaimsPrincipal user, InventoryService service, CancellationToken ct) =>
        {
            try { return Results.Created("/api/inventory/requests", await service.CreateDisposalAsync(request with { BranchId = user.ForWrite(request.BranchId), RequestedBy = user.GetUserId() }, ct)); }
            catch (InventoryException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        }).RequirePermission(PermissionCodes.InventoryDispose);
        group.MapGet("/requests", async (int? branchId, string? status, ClaimsPrincipal user, InventoryService service, CancellationToken ct) => Results.Ok(await service.GetRequestsAsync(user.ForSingleBranchRead(branchId), status, ct))).RequirePermission(PermissionCodes.InventoryView);
        // The reviewer is the signed-in user; the old reviewerId query parameter is ignored.
        group.MapPost("/requests/{requestId:long}/approve", async (long requestId, ClaimsPrincipal user, InventoryService service, CancellationToken ct) =>
        {
            var branch = await service.GetRequestBranchIdAsync(requestId, ct);
            if (branch is null || !user.CanAccessBranch(branch.Value)) return Results.NotFound();
            try { var result = await service.ApproveDisposalAsync(requestId, user.GetUserId(), ct); return result is null ? Results.NotFound() : Results.Ok(result); }
            catch (InventoryException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        }).RequirePermission(PermissionCodes.InventoryApprove);
        return endpoints;
    }
}
