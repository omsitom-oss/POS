using ElitePos.LocalService.Models;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

public static class ExpenseEndpoints
{
    public static IEndpointRouteBuilder MapExpenseEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/expenses");
        group.MapGet("", async (DateTime? from, DateTime? to, ExpenseService service, CancellationToken ct) =>
        {
            try { return Results.Ok(await service.GetAsync(from, to, ct)); }
            catch (ExpenseException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        });
        group.MapPost("", async (ExpenseWriteRequest request, ExpenseService service, CancellationToken ct) =>
        {
            try { return Results.Created("/api/expenses", await service.SaveAsync(request, ct)); }
            catch (ExpenseException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
            catch (TransactionException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        });
        return endpoints;
    }
}
