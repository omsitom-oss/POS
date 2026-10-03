using ElitePos.LocalService.Models;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

public static class TreasuryTransferEndpoints
{
    public static IEndpointRouteBuilder MapTreasuryTransferEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/treasury-transfers", async (TreasuryTransferRequest request, TreasuryTransferService service, CancellationToken ct) =>
        {
            try { return Results.Created("/api/treasury-transfers", await service.SaveAsync(request, ct)); }
            catch (TreasuryTransferException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
            catch (TransactionException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        });
        return endpoints;
    }
}
