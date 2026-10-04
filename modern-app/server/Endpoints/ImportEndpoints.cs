using System.Security.Claims;
using ElitePos.LocalService.Models;
using ElitePos.LocalService.Security;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

// Import shipments. A shipment outside the user's branches answers as not found.
public static class ImportEndpoints
{
    public static IEndpointRouteBuilder MapImportEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/imports").RequirePermission(PermissionCodes.PurchasesView);
        var write = group.MapGroup("").RequirePermission(PermissionCodes.PurchasesManage);

        group.MapGet("/payable-accounts", async (ImportShipmentService service, CancellationToken ct) => Results.Ok(await service.GetPayableAccountsAsync(ct)));
        group.MapGet("/{id:long}", (long id, ClaimsPrincipal user, ImportShipmentService service, CancellationToken ct) =>
            Run(id, user, service, ct, () => service.GetAsync(id, ct)));

        write.MapPost("", async (ImportShipmentWriteRequest request, ClaimsPrincipal user, ImportShipmentService service, CancellationToken ct) =>
        {
            try
            {
                var created = await service.CreateAsync(request with { BranchId = user.ForWrite(request.BranchId), SavedBy = user.GetUserId() }, ct);
                return Results.Created($"/api/imports/{created.PurchaseId}", created);
            }
            catch (ImportShipmentException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        });
        write.MapPut("/{id:long}", (long id, ImportShipmentWriteRequest request, ClaimsPrincipal user, ImportShipmentService service, CancellationToken ct) =>
            Run(id, user, service, ct, () => service.UpdateAsync(id, request with { SavedBy = user.GetUserId() }, ct)));
        write.MapPost("/{id:long}/costs", (long id, ImportCostWriteRequest request, ClaimsPrincipal user, ImportShipmentService service, CancellationToken ct) =>
            CanPay(user, request) is { } denied ? Task.FromResult(denied) : Run(id, user, service, ct, () => service.AddCostAsync(id, request, user.GetUserId(), ct)));
        write.MapPut("/{id:long}/costs/{costId:long}", (long id, long costId, ImportCostWriteRequest request, ClaimsPrincipal user, ImportShipmentService service, CancellationToken ct) =>
            CanPay(user, request) is { } denied ? Task.FromResult(denied) : Run(id, user, service, ct, () => service.UpdateCostAsync(id, costId, request, user.GetUserId(), ct)));
        write.MapDelete("/{id:long}/costs/{costId:long}", (long id, long costId, ClaimsPrincipal user, ImportShipmentService service, CancellationToken ct) =>
            Run(id, user, service, ct, () => service.RemoveCostAsync(id, costId, user.GetUserId(), ct)));
        write.MapPost("/{id:long}/receive", (long id, ClaimsPrincipal user, ImportShipmentService service, CancellationToken ct) =>
            Run(id, user, service, ct, () => service.ReceiveAsync(id, user.GetUserId(), ct)));
        write.MapPost("/{id:long}/cancel", async (long id, ClaimsPrincipal user, ImportShipmentService service, CancellationToken ct) =>
        {
            if (!await CanAccess(id, user, service, ct)) return Results.NotFound();
            try { return await service.CancelAsync(id, user.GetUserId(), ct) ? Results.NoContent() : Results.NotFound(); }
            catch (ImportShipmentException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        });
        return endpoints;
    }

    // Paying a cost from a treasury moves till money, so it also needs the treasury permission.
    private static IResult? CanPay(ClaimsPrincipal user, ImportCostWriteRequest request) =>
        string.Equals(request.PayeeType, "TREASURY", StringComparison.OrdinalIgnoreCase) && !user.HasPermission(PermissionCodes.TreasuryManage)
            ? Results.Problem("Paying a cost from a treasury needs the treasury permission.", statusCode: 403)
            : null;

    private static async Task<IResult> Run(long id, ClaimsPrincipal user, ImportShipmentService service, CancellationToken ct, Func<Task<ImportShipmentDetail?>> action)
    {
        if (!await CanAccess(id, user, service, ct)) return Results.NotFound();
        try { return await action() is { } detail ? Results.Ok(detail) : Results.NotFound(); }
        catch (ImportShipmentException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
    }

    private static async Task<bool> CanAccess(long id, ClaimsPrincipal user, ImportShipmentService service, CancellationToken ct) =>
        await service.GetBranchIdAsync(id, ct) is { } branch && user.CanAccessBranch(branch);
}
