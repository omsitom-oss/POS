using System.Security.Claims;
using ElitePos.LocalService.Models;
using ElitePos.LocalService.Security;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/auth").RequireAuthorization().AllowWhilePasswordChangeRequired();
        group.MapPost("/login", async (LoginRequest request, AuthService service, CancellationToken ct) =>
        {
            var outcome = await service.LoginAsync(request, ct);
            return outcome.Status switch
            {
                LoginStatus.Success => Results.Ok(outcome.Result),
                LoginStatus.LockedOut => Results.Problem("Too many failed sign-in attempts. Try again later.", statusCode: StatusCodes.Status429TooManyRequests),
                _ => Results.Problem("Invalid username or password.", statusCode: StatusCodes.Status401Unauthorized),
            };
        }).AllowAnonymous();
        group.MapPost("/logout", async (ClaimsPrincipal user, AuthService service, CancellationToken ct) =>
        {
            await service.LogoutAsync(user.GetSessionId(), ct);
            return Results.NoContent();
        });
        group.MapGet("/me", async (ClaimsPrincipal user, AuthService service, CancellationToken ct) =>
            await service.GetProfileAsync(user.GetUserId(), ct) is { } profile ? Results.Ok(profile) : Results.NotFound());
        group.MapPost("/change-password", (ChangePasswordRequest request, ClaimsPrincipal user, AuthService service, CancellationToken ct) =>
            ChangeOwnPassword(request, user, service, ct));
        // Kept for existing clients: a user may change their own password here (current password required);
        // changing someone else's needs USER_MANAGEMENT.
        group.MapPost("/users/{id:int}/password", async (int id, ChangePasswordRequest request, ClaimsPrincipal user, AuthService service, CancellationToken ct) =>
        {
            if (id == user.GetUserId()) return await ChangeOwnPassword(request, user, service, ct);
            if (!user.HasPermission(PermissionCodes.UserManagement) || user.MustChangePassword()) return Results.Forbid();
            var (found, error) = await service.SetPasswordByAdminAsync(user.GetUserId(), id, request.NewPassword, ct);
            return !found ? Results.NotFound() : error is null ? Results.NoContent() : Results.Problem(error, statusCode: StatusCodes.Status400BadRequest);
        });
        return endpoints;
    }

    private static async Task<IResult> ChangeOwnPassword(ChangePasswordRequest request, ClaimsPrincipal user, AuthService service, CancellationToken ct)
    {
        var error = await service.ChangeOwnPasswordAsync(user.GetUserId(), user.GetSessionId(), request, ct);
        return error is null ? Results.NoContent() : Results.Problem(error, statusCode: StatusCodes.Status400BadRequest);
    }
}
