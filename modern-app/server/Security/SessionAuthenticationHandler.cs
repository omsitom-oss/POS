using System.Security.Claims;
using System.Text.Encodings.Web;
using ElitePos.LocalService.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace ElitePos.LocalService.Security;

// Authenticates "Authorization: Bearer <token>" against dbo.UserSessions.
public sealed class SessionAuthenticationHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder, AuthService auth)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "PosSession";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var header = Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) return AuthenticateResult.NoResult();
        var token = header["Bearer ".Length..].Trim();
        var session = await auth.ValidateSessionAsync(token, Context.RequestAborted);
        if (session is null) return AuthenticateResult.Fail("The session is invalid or has expired.");

        var claims = new List<Claim>
        {
            new(PosClaims.UserId, session.UserId.ToString()),
            new(ClaimTypes.Name, session.UserName),
            new(PosClaims.BranchId, session.BranchId.ToString()),
            new(PosClaims.SessionId, session.SessionId.ToString()),
        };
        if (session.MustChangePassword) claims.Add(new(PosClaims.MustChangePasswordClaim, "true"));
        claims.AddRange(session.Permissions.Select(code => new Claim(PosClaims.Permission, code)));
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, SchemeName));
        return AuthenticateResult.Success(new AuthenticationTicket(principal, SchemeName));
    }
}
