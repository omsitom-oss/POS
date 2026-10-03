using System.Security.Claims;
using System.Text.Encodings.Web;
using ElitePos.LocalService.Security;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace ElitePos.LocalService.Tests;

// Signs requests in from an X-Test-User header instead of a database session, so authorization and
// branch-scoping rules can be tested on the SQLite host. Format: "userId;branchId;PERM1,PERM2[;must-change]".
public sealed class TestAuthHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "Test";
    public const string Header = "X-Test-User";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(Header, out var value)) return Task.FromResult(AuthenticateResult.NoResult());
        var parts = value.ToString().Split(';');
        var claims = new List<Claim>
        {
            new(PosClaims.UserId, parts[0]),
            new(ClaimTypes.Name, $"user{parts[0]}"),
            new(PosClaims.BranchId, parts[1]),
            new(PosClaims.SessionId, Guid.NewGuid().ToString()),
        };
        claims.AddRange(parts[2].Split(',', StringSplitOptions.RemoveEmptyEntries).Select(code => new Claim(PosClaims.Permission, code)));
        if (parts.Length > 3 && parts[3] == "must-change") claims.Add(new(PosClaims.MustChangePasswordClaim, "true"));
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, SchemeName));
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(principal, SchemeName)));
    }
}

// The SQLite test host with TestAuthHandler as the default scheme. Shared per test class as a fixture.
public sealed class TestAuthApiFactory : WebApplicationFactory<Program>
{
    private readonly string databaseDirectory = Path.Combine(Path.GetTempPath(), "elite-pos-tests", Guid.NewGuid().ToString("N"));

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("Database:Provider", "SQLite");
        builder.UseSetting("Database:SqliteConnectionString", $"Data Source={Path.Combine(databaseDirectory, "pos.db")};Pooling=False");
        builder.ConfigureTestServices(services =>
        {
            services.AddAuthentication().AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, null);
            services.PostConfigure<AuthenticationOptions>(options =>
            {
                options.DefaultScheme = TestAuthHandler.SchemeName;
                options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
                options.DefaultForbidScheme = TestAuthHandler.SchemeName;
            });
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing && Directory.Exists(databaseDirectory)) Directory.Delete(databaseDirectory, recursive: true);
    }
}

public static class TestAuthentication
{
    public static HttpClient CreateClientAs(this WebApplicationFactory<Program> factory, int userId, int branchId, IEnumerable<string> permissions, bool mustChangePassword = false)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.Header, $"{userId};{branchId};{string.Join(',', permissions)}{(mustChangePassword ? ";must-change" : "")}");
        return client;
    }
}
