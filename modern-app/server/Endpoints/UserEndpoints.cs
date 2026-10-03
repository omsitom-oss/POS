using System.Security.Claims;
using ElitePos.LocalService.Models;
using ElitePos.LocalService.Security;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

public static class UserEndpoints
{
    public static IEndpointRouteBuilder MapUserEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/users").RequirePermission(PermissionCodes.UserManagement);
        group.MapGet("", async (bool? includeInactive, UserService service, CancellationToken ct) => Results.Ok(await service.GetAsync(includeInactive == true, ct)));
        group.MapPost("", (UserWriteRequest request, ClaimsPrincipal user, UserService service, CancellationToken ct) => Save(null, request, user, service, ct));
        group.MapPut("/{id:int}", (int id, UserWriteRequest request, ClaimsPrincipal user, UserService service, CancellationToken ct) => Save(id, request, user, service, ct));
        group.MapPost("/{id:int}/activate", (int id, UserService service, CancellationToken ct) => SetActive(id, true, service, ct));
        group.MapPost("/{id:int}/deactivate", (int id, UserService service, CancellationToken ct) => SetActive(id, false, service, ct));
        group.MapPost("/{id:int}/reset-password", async (int id, ClaimsPrincipal user, UserService service, CancellationToken ct) =>
            await service.ResetPasswordAsync(id, user.GetUserId(), ct) is { } temporaryPassword ? Results.Ok(new TemporaryPasswordResult(temporaryPassword)) : Results.NotFound());
        return endpoints;
    }
    private static async Task<IResult> Save(int? id, UserWriteRequest request, ClaimsPrincipal user, UserService service, CancellationToken ct) { try { var result = await service.SaveAsync(id, request, user.GetUserId(), ct); return id.HasValue ? Results.Ok(result) : Results.Created("/api/users", result); } catch (UserException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); } }
    private static async Task<IResult> SetActive(int id, bool active, UserService service, CancellationToken ct) { try { return await service.SetActiveAsync(id, active, ct) ? Results.NoContent() : Results.NotFound(); } catch (UserException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); } }
}
