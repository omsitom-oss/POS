using System.Security.Claims;
using ElitePos.LocalService.Models;
using ElitePos.LocalService.Security;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

public static class ExpenseEndpoints
{
    public static IEndpointRouteBuilder MapExpenseEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/expenses");
        group.MapGet("", async (int? branchId, DateTime? from, DateTime? to, ClaimsPrincipal user, ExpenseService service, CancellationToken ct) =>
        {
            try { return Results.Ok(await service.GetAsync(user.ForRead(branchId), from, to, ct)); }
            catch (ExpenseException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        }).RequirePermission(PermissionCodes.TreasuryView);
        group.MapPost("", async (ExpenseWriteRequest request, ClaimsPrincipal user, ExpenseService service, CancellationToken ct) =>
        {
            try { return Results.Created("/api/expenses", await service.SaveAsync(request with { BranchId = user.ForWrite(request.BranchId), SavedBy = user.GetUserId() }, ct)); }
            catch (ExpenseException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
            catch (TransactionException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); }
        }).RequirePermission(PermissionCodes.TreasuryManage);
        return endpoints;
    }
}
