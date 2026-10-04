using System.Security.Claims;
using ElitePos.LocalService.Models;
using ElitePos.LocalService.Security;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

public static class PurchaseEndpoints
{
    public static IEndpointRouteBuilder MapPurchaseEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group=endpoints.MapGroup("/api/purchases").RequirePermission(PermissionCodes.PurchasesView); var write=group.MapGroup("").RequirePermission(PermissionCodes.PurchasesManage);
        group.MapGet("",async(int? branchId,ClaimsPrincipal user,PurchaseService service,CancellationToken ct)=>Results.Ok(await service.GetAsync(user.ForRead(branchId),ct)));
        group.MapGet("/{id:long}",async(long id,ClaimsPrincipal user,PurchaseService service,CancellationToken ct)=>{if(!await CanAccess(id,user,service,ct))return Results.NotFound();var item=await service.GetByIdAsync(id,ct); return item is null?Results.NotFound():Results.Ok(item);});
        write.MapPatch("/{purchaseId:long}/lines/{lineId:long}",async(long purchaseId,long lineId,PurchaseLineMetadataUpdateRequest request,ClaimsPrincipal user,PurchaseService service,CancellationToken ct)=>{if(!await CanAccess(purchaseId,user,service,ct))return Results.NotFound();try{return await service.UpdateLineMetadataAsync(purchaseId,lineId,request,user.HasPermission(PermissionCodes.InventoryApprove),ct)?Results.NoContent():Results.NotFound();}catch(PurchaseException ex){return Results.Problem(ex.Message,statusCode:ex.StatusCode);}catch(TransactionException ex){return Results.Problem(ex.Message,statusCode:ex.StatusCode);}});
        write.MapPost("",async(PurchaseWriteRequest request,ClaimsPrincipal user,PurchaseService service,CancellationToken ct)=>{try{return Results.Created("/api/purchases",await service.SaveAsync(request with{BranchId=user.ForWrite(request.BranchId),SavedBy=user.GetUserId()},ct));}catch(PurchaseException ex){return Results.Problem(ex.Message,statusCode:ex.StatusCode);}catch(TransactionException ex){return Results.Problem(ex.Message,statusCode:ex.StatusCode);}});
        write.MapPost("/{id:long}/confirm",async(long id,ClaimsPrincipal user,PurchaseService service,CancellationToken ct)=>{if(!await CanAccess(id,user,service,ct))return Results.NotFound();try{var item=await service.PostDraftAsync(id,ct);return item is null?Results.NotFound():Results.Ok(item);}catch(PurchaseException ex){return Results.Problem(ex.Message,statusCode:ex.StatusCode);}catch(TransactionException ex){return Results.Problem(ex.Message,statusCode:ex.StatusCode);}});
        write.MapDelete("/{id:long}",async(long id,ClaimsPrincipal user,PurchaseService service,CancellationToken ct)=>await CanAccess(id,user,service,ct)?Results.Ok(new{deleted=await service.DeleteDraftAsync(id,ct)}):Results.NotFound());
        return endpoints;
    }

    // A purchase outside the user's branches is reported as not found. Unknown ids fall through to the normal not-found path.
    private static async Task<bool> CanAccess(long purchaseId,ClaimsPrincipal user,PurchaseService service,CancellationToken ct)
    {
        var branch=await service.GetBranchIdAsync(purchaseId,ct);
        return branch is null||user.CanAccessBranch(branch.Value);
    }
}
