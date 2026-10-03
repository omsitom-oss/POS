using ElitePos.LocalService.Models;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

public static class ReceiptEndpoints
{
    public static IEndpointRouteBuilder MapReceiptEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/receipts");
        group.MapGet("", async (string? type, DateTime? from, DateTime? to, ReceiptService service, CancellationToken ct) =>
        {
            try { return Results.Ok(await service.GetAsync(type, from, to, ct)); }
            catch (ReceiptException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        });
        group.MapPost("", async (ReceiptWriteRequest request, ReceiptService service, CancellationToken ct) =>
        {
            try { return Results.Created("/api/receipts", await service.SaveAsync(request, ct)); }
            catch (ReceiptException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
            catch (TransactionException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        });
        return endpoints;
    }
}
