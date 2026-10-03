using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;

namespace ElitePos.LocalService.Security;

public static class SecurityRegistration
{
    public static IServiceCollection AddPosSecurity(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton(configuration.GetSection(AuthOptions.SectionName).Get<AuthOptions>() ?? new AuthOptions());
        services.AddSingleton(TimeProvider.System);
        services.AddAuthentication(SessionAuthenticationHandler.SchemeName)
            .AddScheme<AuthenticationSchemeOptions, SessionAuthenticationHandler>(SessionAuthenticationHandler.SchemeName, null);
        services.AddAuthorization(options =>
        {
            foreach (var code in PermissionCodes.All)
                options.AddPolicy(code, policy => policy.RequireAuthenticatedUser().RequireClaim(PosClaims.Permission, code));
        });
        return services;
    }

    public static WebApplication UsePosSecurity(this WebApplication app)
    {
        app.Use(async (context, next) =>
        {
            try { await next(context); }
            catch (BranchAccessException exception) when (!context.Response.HasStarted)
            {
                await Results.Problem(exception.Message, statusCode: StatusCodes.Status403Forbidden).ExecuteAsync(context);
            }
        });
        app.UseAuthentication();
        app.UseAuthorization();
        // A user holding a temporary password may only change it, look up their own profile, or sign out.
        app.Use(async (context, next) =>
        {
            if (context.User.Identity?.IsAuthenticated == true && context.User.MustChangePassword()
                && context.GetEndpoint()?.Metadata.GetMetadata<PasswordChangeAllowedMetadata>() is null)
            {
                await Results.Problem("You must change your temporary password before continuing.", statusCode: StatusCodes.Status403Forbidden, title: "PASSWORD_CHANGE_REQUIRED").ExecuteAsync(context);
                return;
            }
            await next(context);
        });
        return app;
    }

    public static TBuilder RequirePermission<TBuilder>(this TBuilder builder, string permissionCode) where TBuilder : IEndpointConventionBuilder
        => builder.RequireAuthorization(permissionCode);

    public static TBuilder AllowWhilePasswordChangeRequired<TBuilder>(this TBuilder builder) where TBuilder : IEndpointConventionBuilder
        => builder.WithMetadata(new PasswordChangeAllowedMetadata());
}

public sealed class PasswordChangeAllowedMetadata;
