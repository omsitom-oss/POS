using System.Net;
using System.Net.Http.Json;
using ElitePos.LocalService.Security;

namespace ElitePos.LocalService.Tests;

// These requests are rejected before the service opens a database connection, so they run against any provider.
public sealed class RequestValidationTests(ApiFactory factory, TestAuthApiFactory authFactory) : IClassFixture<ApiFactory>, IClassFixture<TestAuthApiFactory>
{
    public static TheoryData<string, object, string> InvalidRequests => new()
    {
        { "/api/sales", new { treasuryId = 1, currencyId = 1, lines = Array.Empty<object>() }, "at least one item" },
        { "/api/sales", new { treasuryId = 0, currencyId = 1, lines = new[] { new { itemId = 1, quantity = 1, unitPrice = 5 } } }, "Treasury" },
        { "/api/sales", new { treasuryId = 1, currencyId = 1, discount = -1, lines = new[] { new { itemId = 1, quantity = 1, unitPrice = 5 } } }, "Discount cannot be negative" },
        { "/api/purchases", new { supplierPartnerId = 0, currencyId = 1, lines = new[] { new { itemId = 1, quantity = 1, unitPrice = 5 } } }, "Supplier" },
        { "/api/treasury-transfers", new { sourceTreasuryId = 2, destinationTreasuryId = 2, sourceAmount = 10, destinationAmount = 10, exchangeRate = 1 }, "two different treasuries" },
        { "/api/treasury-transfers", new { sourceTreasuryId = 1, destinationTreasuryId = 2, sourceAmount = 0, destinationAmount = 10, exchangeRate = 1 }, "greater than zero" },
    };

    [Theory]
    [MemberData(nameof(InvalidRequests))]
    public async Task Invalid_money_requests_are_rejected_with_a_problem(string path, object body, string expectedMessage)
    {
        var client = authFactory.CreateClientAs(userId: 1, branchId: 1, permissions: PermissionCodes.All);
        var response = await client.PostAsJsonAsync(path, body, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(expectedMessage, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken), StringComparison.OrdinalIgnoreCase);
    }
}
