using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace ElitePos.LocalService.Tests;

public sealed class ApiHostTests(ApiFactory factory, TestAuthApiFactory authFactory) : IClassFixture<ApiFactory>, IClassFixture<TestAuthApiFactory>
{
    private sealed record Health(string Provider, bool Connected, string Message);

    [Fact]
    public async Task Health_reports_the_configured_sqlite_database_as_connected()
    {
        var health = await factory.CreateClient().GetFromJsonAsync<Health>("/api/health", TestContext.Current.CancellationToken);

        Assert.NotNull(health);
        Assert.Equal("SQLite", health.Provider);
        Assert.True(health.Connected, health.Message);
    }

    [Fact]
    public async Task Provider_endpoint_returns_the_active_provider()
    {
        var response = await authFactory.CreateClientAs(userId: 1, branchId: 1, permissions: []).GetAsync("/api/database/provider", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("SQLite", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Unknown_routes_return_not_found()
    {
        var response = await factory.CreateClient().GetAsync("/api/does-not-exist", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/health")]
    [InlineData("/api/settings/types")]
    [InlineData("/api/locations/countries")]
    [InlineData("/api/company-profile")]
    [InlineData("/api/currencies")]
    [InlineData("/api/branches")]
    [InlineData("/api/treasuries")]
    [InlineData("/api/banks")]
    [InlineData("/api/partners")]
    [InlineData("/api/users")]
    [InlineData("/api/auth/login")]
    [InlineData("/api/accounts")]
    [InlineData("/api/purchases")]
    [InlineData("/api/sales")]
    [InlineData("/api/reports")]
    [InlineData("/api/roles")]
    [InlineData("/api/items")]
    [InlineData("/api/inventory")]
    [InlineData("/api/transactions")]
    [InlineData("/api/receipts")]
    [InlineData("/api/expenses")]
    [InlineData("/api/treasury-transfers")]
    [InlineData("/api/management")]
    public void Every_endpoint_group_is_registered(string prefix)
    {
        var routes = factory.Services.GetRequiredService<EndpointDataSource>().Endpoints
            .OfType<RouteEndpoint>()
            .Select(endpoint => "/" + endpoint.RoutePattern.RawText?.TrimStart('/'))
            .ToArray();

        Assert.Contains(routes, route => route.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));
    }
}
