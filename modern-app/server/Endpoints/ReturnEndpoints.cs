using System.Security.Claims;
using ElitePos.LocalService.Models;
using ElitePos.LocalService.Security;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

// Sales and purchase returns. A return always belongs to the branch of its invoice; invoices and returns of
// branches the user cannot access answer as not found.
public static class ReturnEndpoints
{
    public static IEndpointRouteBuilder MapReturnEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var sales = endpoints.MapGroup("/api/sales-returns");
        sales.MapGet("", async (int? branchId, DateTime? from, DateTime? to, ClaimsPrincipal user, SalesReturnService service, CancellationToken ct) =>
            Results.Ok(await service.GetAsync(user.ForRead(branchId), from, to, ct))).RequirePermission(PermissionCodes.SalesView);
        sales.MapGet("/{id:long}", async (long id, ClaimsPrincipal user, SalesReturnService service, CancellationToken ct) =>
            Allowed(user, await service.GetReturnBranchIdAsync(id, ct)) && await service.GetByIdAsync(id, ct) is { } item ? Results.Ok(item) : Results.NotFound()).RequirePermission(PermissionCodes.SalesView);
        sales.MapGet("/invoices", async (int? branchId, string? search, DateTime? from, DateTime? to, ClaimsPrincipal user, SalesReturnService service, CancellationToken ct) =>
            Results.Ok(await service.GetInvoicesAsync(user.ForRead(branchId), search, from, to, ct))).RequirePermission(PermissionCodes.SalesReturn);
        sales.MapGet("/invoices/{saleId:long}", async (long saleId, ClaimsPrincipal user, SalesReturnService service, CancellationToken ct) =>
            Allowed(user, await service.GetSaleBranchIdAsync(saleId, ct)) && await service.GetSourceAsync(saleId, ct) is { } item ? Results.Ok(item) : Results.NotFound()).RequirePermission(PermissionCodes.SalesReturn);
        sales.MapPost("", async (SalesReturnWriteRequest request, ClaimsPrincipal user, SalesReturnService service, CancellationToken ct) =>
        {
            if (!Allowed(user, await service.GetSaleBranchIdAsync(request.SaleId, ct))) return Results.Problem("The sales invoice was not found.", statusCode: 404);
            try { var result = await service.CreateAsync(request with { SavedBy = user.GetUserId() }, ct); return Results.Created($"/api/sales-returns/{result.SalesReturnId}", result); }
            catch (SalesReturnException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        }).RequirePermission(PermissionCodes.SalesReturn);

        var purchases = endpoints.MapGroup("/api/purchase-returns");
        purchases.MapGet("", async (int? branchId, string? status, ClaimsPrincipal user, PurchaseReturnService service, CancellationToken ct) =>
            Results.Ok(await service.GetAsync(user.ForRead(branchId), status, ct))).RequirePermission(PermissionCodes.PurchasesView);
        purchases.MapGet("/{id:long}", async (long id, ClaimsPrincipal user, PurchaseReturnService service, CancellationToken ct) =>
            Allowed(user, await service.GetReturnBranchIdAsync(id, ct)) && await service.GetByIdAsync(id, ct) is { } item ? Results.Ok(item) : Results.NotFound()).RequirePermission(PermissionCodes.PurchasesView);
        purchases.MapGet("/invoices", async (int? branchId, string? search, DateTime? from, DateTime? to, ClaimsPrincipal user, PurchaseReturnService service, CancellationToken ct) =>
            Results.Ok(await service.GetInvoicesAsync(user.ForRead(branchId), search, from, to, ct))).RequirePermission(PermissionCodes.PurchaseReturn);
        purchases.MapGet("/invoices/{purchaseId:long}", async (long purchaseId, ClaimsPrincipal user, PurchaseReturnService service, CancellationToken ct) =>
            Allowed(user, await service.GetPurchaseBranchIdAsync(purchaseId, ct)) && await service.GetSourceAsync(purchaseId, ct) is { } item ? Results.Ok(item) : Results.NotFound()).RequirePermission(PermissionCodes.PurchaseReturn);
        purchases.MapPost("", async (PurchaseReturnWriteRequest request, ClaimsPrincipal user, PurchaseReturnService service, CancellationToken ct) =>
        {
            if (!Allowed(user, await service.GetPurchaseBranchIdAsync(request.PurchaseId, ct))) return Results.Problem("The purchase invoice was not found.", statusCode: 404);
            try { var result = await service.CreateAsync(request with { SavedBy = user.GetUserId() }, ct); return Results.Created($"/api/purchase-returns/{result.PurchaseReturnId}", result); }
            catch (PurchaseReturnException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        }).RequirePermission(PermissionCodes.PurchaseReturn);
        purchases.MapPost("/{id:long}/approve", (long id, PurchaseReturnReviewRequest? request, ClaimsPrincipal user, PurchaseReturnService service, CancellationToken ct) =>
            Review(id, user, service, ct, () => service.ApproveAsync(id, user.GetUserId(), request?.Note, ct))).RequirePermission(PermissionCodes.PurchaseReturnApprove);
        purchases.MapPost("/{id:long}/reject", (long id, PurchaseReturnReviewRequest? request, ClaimsPrincipal user, PurchaseReturnService service, CancellationToken ct) =>
            Review(id, user, service, ct, () => service.RejectAsync(id, user.GetUserId(), request?.Note, ct))).RequirePermission(PermissionCodes.PurchaseReturnApprove);
        return endpoints;
    }

    private static bool Allowed(ClaimsPrincipal user, int? recordBranchId) => recordBranchId is { } branch && user.CanAccessBranch(branch);

    private static async Task<IResult> Review(long id, ClaimsPrincipal user, PurchaseReturnService service, CancellationToken ct, Func<Task<PurchaseReturnDetail?>> action)
    {
        if (!Allowed(user, await service.GetReturnBranchIdAsync(id, ct))) return Results.NotFound();
        try { return await action() is { } result ? Results.Ok(result) : Results.NotFound(); }
        catch (PurchaseReturnException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
    }
}
