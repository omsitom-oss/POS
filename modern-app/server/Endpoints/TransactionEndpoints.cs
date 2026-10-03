using ElitePos.LocalService.Models;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

public static class TransactionEndpoints
{
    public static IEndpointRouteBuilder MapTransactionEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/transactions");
        group.MapGet("/account/{accountId}", async (string accountId, DateTime? from, DateTime? to, TransactionService service, CancellationToken ct) =>
        {
            try { return Results.Ok(await service.GetAccountStatementAsync(accountId, from, to, ct)); }
            catch (TransactionException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        });
        group.MapGet("/treasury/{treasuryId:int}", async (int treasuryId, DateTime? from, DateTime? to, TransactionService service, CancellationToken ct) =>
        {
            try { return Results.Ok(await service.GetTreasuryStatementAsync(treasuryId, from, to, ct)); }
            catch (TransactionException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        });
        group.MapGet("/partner/{partnerId:int}/balance", async (int partnerId, int currencyId, TransactionService service, CancellationToken ct) =>
        {
            try { return Results.Ok(await service.GetPartnerBalanceAsync(partnerId, currencyId, ct)); }
            catch (TransactionException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        });
        group.MapGet("/partner/{partnerId:int}/balances", async (int partnerId, TransactionService service, CancellationToken ct) =>
        {
            try { return Results.Ok(await service.GetPartnerBalancesAsync(partnerId, ct)); }
            catch (TransactionException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        });
        group.MapGet("/partner/by-public/{publicId:guid}/balances", async (Guid publicId, TransactionService service, CancellationToken ct) =>
        {
            try { return Results.Ok(await service.GetPartnerBalancesByPublicIdAsync(publicId, ct)); }
            catch (TransactionException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        });
        group.MapPost("", async (TransactionWriteRequest request, TransactionService service, CancellationToken ct) =>
        {
            try { return Results.Created("/api/transactions", await service.SaveAsync(request, ct)); }
            catch (TransactionException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        });
        return endpoints;
    }
}
