using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

public static class AccountEndpoints
{
    public static IEndpointRouteBuilder MapAccountEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/accounts/chart", async (AccountService service, CancellationToken ct) => Results.Ok(await service.GetChartAsync(ct)));
        return endpoints;
    }
}
