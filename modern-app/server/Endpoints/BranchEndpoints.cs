using ElitePos.LocalService.Models;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

public static class BranchEndpoints
{
    public static IEndpointRouteBuilder MapBranchEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/branches");
        group.MapGet("", async (bool? includeInactive, BranchService service, CancellationToken ct) => Results.Ok(await service.GetAsync(includeInactive == true, ct)));
        group.MapPost("", (BranchWriteRequest request, BranchService service, CancellationToken ct) => Save(null, request, service, ct));
        group.MapPut("/{id:int}", (int id, BranchWriteRequest request, BranchService service, CancellationToken ct) => Save(id, request, service, ct));
        group.MapPost("/{id:int}/activate", (int id, BranchService service, CancellationToken ct) => SetActive(id, true, service, ct));
        group.MapPost("/{id:int}/deactivate", (int id, BranchService service, CancellationToken ct) => SetActive(id, false, service, ct));
        return endpoints;
    }
    private static async Task<IResult> Save(int? id, BranchWriteRequest request, BranchService service, CancellationToken ct) { try { var result = await service.SaveAsync(id, request, ct); return id.HasValue ? Results.Ok(result) : Results.Created("/api/branches", result); } catch (BranchException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); } }
    private static async Task<IResult> SetActive(int id, bool active, BranchService service, CancellationToken ct) { try { return await service.SetActiveAsync(id, active, ct) ? Results.NoContent() : Results.NotFound(); } catch (BranchException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); } }
}
