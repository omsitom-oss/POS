using ElitePos.LocalService.Services;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Endpoints;

public static class InventoryEndpoints
{
    public static IEndpointRouteBuilder MapInventoryEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/inventory", async (int branchId, InventoryService service, CancellationToken ct) =>
        {
            try { return Results.Ok(await service.GetAsync(branchId, ct)); }
            catch (InventoryException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        });
        endpoints.MapGet("/api/inventory/{itemId:long}/batches", async (long itemId, int branchId, InventoryService service, CancellationToken ct) => Results.Ok(await service.GetBatchesAsync(branchId, itemId, ct)));
        endpoints.MapPost("/api/inventory/disposals", async (InventoryDisposalRequest request, InventoryService service, CancellationToken ct) =>
        {
            try { return Results.Created("/api/inventory/requests", await service.CreateDisposalAsync(request, ct)); }
            catch (InventoryException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        });
        endpoints.MapGet("/api/inventory/requests", async (int branchId, string? status, InventoryService service, CancellationToken ct) => Results.Ok(await service.GetRequestsAsync(branchId, status, ct)));
        endpoints.MapPost("/api/inventory/requests/{requestId:long}/approve", async (long requestId, int? reviewerId, InventoryService service, CancellationToken ct) =>
        {
            try { var result = await service.ApproveDisposalAsync(requestId, reviewerId, ct); return result is null ? Results.NotFound() : Results.Ok(result); }
            catch (InventoryException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        });
        return endpoints;
    }
}
