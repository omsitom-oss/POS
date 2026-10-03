using ElitePos.LocalService.Security;
using ElitePos.LocalService.Services;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Endpoints;

public static class ItemEndpoints
{
    public static IEndpointRouteBuilder MapItemEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/items").RequireAuthorization(); var write = group.MapGroup("").RequirePermission(PermissionCodes.ItemsManage);
        group.MapGet("", async (bool? includeInactive, ItemService service, CancellationToken ct) =>
            Results.Ok(await service.GetAsync(includeInactive == true, ct)));
        group.MapGet("/{id:long}", async (long id, ItemService service, CancellationToken ct) =>
            (await service.GetDetailsAsync(id, ct)) is { } result ? Results.Ok(result) : Results.NotFound());
        write.MapPost("", (ItemWriteRequest request, ItemService service, CancellationToken ct) => Save(null, request, service, ct));
        write.MapPut("/{id:long}", (long id, ItemWriteRequest request, ItemService service, CancellationToken ct) => Save(id, request, service, ct));
        return endpoints;
    }

    private static async Task<IResult> Save(long? id, ItemWriteRequest request, ItemService service, CancellationToken ct)
    {
        try { var result = await service.SaveAsync(id, request, ct); return result is null ? Results.NotFound() : id.HasValue ? Results.Ok(result) : Results.Created("/api/items", result); }
        catch (ItemException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
    }
}
