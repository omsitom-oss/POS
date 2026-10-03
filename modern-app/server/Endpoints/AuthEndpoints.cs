using ElitePos.LocalService.Models;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/auth/login", async (LoginRequest request, AuthService service, CancellationToken ct) =>
        {
            var result = await service.LoginAsync(request, ct);
            return result is null ? Results.Problem("Invalid username or password.", statusCode: 401) : Results.Ok(result);
        });
        endpoints.MapPost("/api/auth/users/{id:int}/password", async (int id, ChangePasswordRequest request, AuthService service, CancellationToken ct) => await service.ChangePasswordAsync(id, request, ct) ? Results.NoContent() : Results.BadRequest("Password is required."));
        return endpoints;
    }
}

