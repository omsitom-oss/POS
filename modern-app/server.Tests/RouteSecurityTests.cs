using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using ElitePos.LocalService.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace ElitePos.LocalService.Tests;

// Authorization rules checked on the route table and on requests that are refused before any database work.
public sealed class RouteSecurityTests(ApiFactory factory, TestAuthApiFactory authFactory) : IClassFixture<ApiFactory>, IClassFixture<TestAuthApiFactory>
{
    private static readonly string[] Anonymous = ["GET /api/health", "POST /api/auth/login"];
    private static readonly string[] WriteMethods = ["POST", "PUT", "PATCH", "DELETE"];

    private IReadOnlyList<(string Method, string Pattern, RouteEndpoint Endpoint)> Routes() =>
        factory.Services.GetRequiredService<EndpointDataSource>().Endpoints
            .OfType<RouteEndpoint>()
            .SelectMany(endpoint => (endpoint.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? ["GET"])
                .Select(method => (method, "/" + endpoint.RoutePattern.RawText!.TrimStart('/'), endpoint)))
            .ToArray();

    [Fact]
    public void Only_health_and_login_allow_anonymous_access()
    {
        var anonymous = Routes().Where(route => route.Endpoint.Metadata.GetMetadata<IAllowAnonymous>() is not null).Select(route => $"{route.Method} {route.Pattern}");
        Assert.Equal(Anonymous.Order(), anonymous.Order());
    }

    [Fact]
    public void Every_other_route_declares_authorization()
    {
        var unprotected = Routes()
            .Where(route => route.Endpoint.Metadata.GetMetadata<IAllowAnonymous>() is null && !route.Endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>().Any())
            .Select(route => $"{route.Method} {route.Pattern}");
        Assert.Empty(unprotected);
    }

    [Fact]
    public void Every_write_route_requires_a_permission()
    {
        var missing = Routes()
            .Where(route => WriteMethods.Contains(route.Method) && !route.Pattern.StartsWith("/api/auth/", StringComparison.Ordinal))
            .Where(route => !route.Endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>().Any(data => data.Policy is not null && PermissionCodes.All.Contains(data.Policy)))
            .Select(route => $"{route.Method} {route.Pattern}");
        Assert.Empty(missing);
    }

    [Fact]
    public async Task Every_protected_route_answers_401_without_a_token()
    {
        var client = factory.CreateClient();
        var failures = new List<string>();
        foreach (var (method, pattern, endpoint) in Routes())
        {
            if (endpoint.Metadata.GetMetadata<IAllowAnonymous>() is not null) continue;
            var url = Regex.Replace(pattern, @"\{(\w+)(:(\w+))?\}", match => match.Groups[3].Value switch
            {
                "int" or "long" => "1",
                "guid" => Guid.Empty.ToString(),
                _ => "value",
            });
            using var request = new HttpRequestMessage(new HttpMethod(method), url);
            if (WriteMethods.Contains(method)) request.Content = JsonContent.Create(new { });
            using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
            if (response.StatusCode != HttpStatusCode.Unauthorized) failures.Add($"{method} {url} -> {(int)response.StatusCode}");
        }
        Assert.Empty(failures);
    }

    // One read and one write per group, called by a signed-in user who holds no permissions.
    public static TheoryData<string, string> PermissionProtectedRoutes => new()
    {
        { "GET", "/api/users" }, { "POST", "/api/users" }, { "POST", "/api/users/1/reset-password" },
        { "GET", "/api/roles" }, { "POST", "/api/roles" }, { "GET", "/api/permissions" },
        { "POST", "/api/settings/types" }, { "PUT", "/api/settings/items/1" },
        { "POST", "/api/locations/countries" }, { "PUT", "/api/company-profile" },
        { "POST", "/api/currencies" }, { "PUT", "/api/currencies/rates" }, { "PUT", "/api/currencies/1/rate" },
        { "POST", "/api/branches" }, { "POST", "/api/treasuries" }, { "POST", "/api/banks" }, { "PUT", "/api/approvals/INVENTORY_DISPOSAL" },
        { "POST", "/api/items" }, { "PUT", "/api/items/1" }, { "POST", "/api/partners" },
        { "GET", "/api/sales" }, { "POST", "/api/sales" },
        { "GET", "/api/sales-returns" }, { "GET", "/api/sales-returns/1" }, { "GET", "/api/sales-returns/invoices" }, { "GET", "/api/sales-returns/invoices/1" }, { "POST", "/api/sales-returns" },
        { "GET", "/api/purchase-returns" }, { "GET", "/api/purchase-returns/invoices/1" }, { "POST", "/api/purchase-returns" }, { "POST", "/api/purchase-returns/1/approve" }, { "POST", "/api/purchase-returns/1/reject" },
        { "GET", "/api/purchases" }, { "GET", "/api/purchases/1" }, { "POST", "/api/purchases" }, { "DELETE", "/api/purchases/1" },
        { "GET", "/api/inventory" }, { "POST", "/api/inventory/disposals" }, { "POST", "/api/inventory/requests/1/approve" },
        { "GET", "/api/receipts" }, { "POST", "/api/receipts" }, { "GET", "/api/expenses" }, { "POST", "/api/expenses" },
        { "GET", "/api/transactions/treasury/1" }, { "POST", "/api/transactions" }, { "POST", "/api/treasury-transfers" },
        { "GET", "/api/accounts/chart" }, { "GET", "/api/reports/summary" },
        { "GET", "/api/management/customers" }, { "POST", "/api/management/customers" },
    };

    [Theory]
    [MemberData(nameof(PermissionProtectedRoutes))]
    public async Task A_user_without_the_permission_gets_403(string method, string path)
    {
        var client = authFactory.CreateClientAs(userId: 5, branchId: 1, permissions: []);
        using var request = new HttpRequestMessage(new HttpMethod(method), path);
        if (WriteMethods.Contains(method)) request.Content = JsonContent.Create(new { });
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task A_user_who_must_change_their_password_is_held_to_the_auth_routes()
    {
        var client = authFactory.CreateClientAs(userId: 5, branchId: 1, permissions: PermissionCodes.All, mustChangePassword: true);
        var response = await client.GetAsync("/api/reports/summary", TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Contains("PASSWORD_CHANGE_REQUIRED", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task A_user_cannot_set_another_users_password_without_user_management()
    {
        var client = authFactory.CreateClientAs(userId: 5, branchId: 1, permissions: [PermissionCodes.SalesView]);
        var response = await client.PostAsJsonAsync("/api/auth/users/6/password", new { newPassword = "Another-Pass-1" }, TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Theory]
    [InlineData("GET", "/api/sales?branchId=2")]
    [InlineData("GET", "/api/sales-returns?branchId=2")]
    [InlineData("GET", "/api/sales-returns/invoices?branchId=2")]
    [InlineData("GET", "/api/purchase-returns?branchId=2")]
    [InlineData("GET", "/api/purchase-returns/invoices?branchId=2")]
    [InlineData("GET", "/api/purchases?branchId=2")]
    [InlineData("GET", "/api/receipts?branchId=2")]
    [InlineData("GET", "/api/expenses?branchId=2")]
    [InlineData("GET", "/api/inventory?branchId=2")]
    [InlineData("GET", "/api/reports/summary?branchId=2")]
    [InlineData("GET", "/api/accounts/chart?branchId=2")]
    [InlineData("GET", "/api/transactions/treasury/1?branchId=2")]
    [InlineData("GET", "/api/treasuries?branchId=2")]
    public async Task Reading_another_branch_needs_all_branches(string method, string path)
    {
        var client = authFactory.CreateClientAs(userId: 5, branchId: 1, permissions: PermissionCodes.All.Where(code => code != PermissionCodes.AllBranches));
        using var response = await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), path), TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    public static TheoryData<string, object> OtherBranchWrites => new()
    {
        { "/api/sales", new { treasuryId = 1, currencyId = 1, branchId = 2, lines = new[] { new { itemId = 1, quantity = 1, unitPrice = 5 } } } },
        { "/api/purchases", new { supplierPartnerId = 1, currencyId = 1, branchId = 2, lines = new[] { new { itemId = 1, quantity = 1, unitPrice = 5 } } } },
        { "/api/receipts", new { type = "RECEIPT", partnerId = 1, treasuryId = 1, amount = 1, exchangeRate = 1, branchId = 2 } },
        { "/api/expenses", new { expenseAccountId = "6100", treasuryId = 1, amount = 1, branchId = 2 } },
        { "/api/treasury-transfers", new { sourceTreasuryId = 1, destinationTreasuryId = 2, sourceAmount = 1, destinationAmount = 1, exchangeRate = 1, branchId = 2 } },
        { "/api/treasuries", new { nameAr = "x", nameEn = "x", treasureType = "CASH", currencyId = 1, branchId = 2 } },
        { "/api/inventory/disposals", new { itemId = 1, purchaseLineId = 1, quantity = 1, reason = "expired", branchId = 2 } },
    };

    [Theory]
    [MemberData(nameof(OtherBranchWrites))]
    public async Task Writing_to_another_branch_needs_all_branches(string path, object body)
    {
        var client = authFactory.CreateClientAs(userId: 5, branchId: 1, permissions: PermissionCodes.All.Where(code => code != PermissionCodes.AllBranches));
        var response = await client.PostAsJsonAsync(path, body, TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
