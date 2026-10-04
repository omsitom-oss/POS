using System.Security.Claims;
using ElitePos.LocalService.Models;
using ElitePos.LocalService.Security;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

public static class SalesEndpoints
{
    public static IEndpointRouteBuilder MapSalesEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group=endpoints.MapGroup("/api/sales");
        group.MapGet("",async(int? branchId,DateTime? from,DateTime? to,ClaimsPrincipal user,SalesService service,CancellationToken ct)=>Results.Ok(await service.GetAsync(user.ForRead(branchId),from,to,ct))).RequirePermission(PermissionCodes.SalesView);
        group.MapPost("",async(SaleWriteRequest request,ClaimsPrincipal user,SalesService service,CancellationToken ct)=>{try{return Results.Created("/api/sales",await service.CreateAsync(request with{BranchId=user.ForWrite(request.BranchId),SavedBy=user.GetUserId(),CanOverridePrice=user.HasPermission(PermissionCodes.SalesPriceOverride)},ct));}catch(SalesException ex){return Results.Problem(ex.Message,statusCode:ex.StatusCode);}catch(TransactionException ex){return Results.Problem(ex.Message,statusCode:ex.StatusCode);}}).RequirePermission(PermissionCodes.SalesCreate);
        return endpoints;
    }
}
