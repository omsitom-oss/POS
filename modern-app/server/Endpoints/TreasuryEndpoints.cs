using System.Security.Claims;
using ElitePos.LocalService.Models;
using ElitePos.LocalService.Security;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;
public static class TreasuryEndpoints
{
    public static IEndpointRouteBuilder MapTreasuryEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/treasuries").RequireAuthorization();
        var write = group.MapGroup("").RequirePermission(PermissionCodes.SettingsManage);
        // Treasuries belong to a branch: users see and edit their own branch's tills; ALL_BRANCHES users see every branch and may move a till.
        group.MapGet("", async (bool? includeInactive, int? branchId, ClaimsPrincipal user, TreasuryService service, CancellationToken ct) => Results.Ok(await service.GetAsync(includeInactive == true, user.ForRead(branchId), ct)));
        write.MapPost("", (TreasuryWriteRequest request, ClaimsPrincipal user, TreasuryService service, CancellationToken ct) => Save(null, request with { BranchId = user.ForWrite(request.BranchId) }, user, service, ct));
        write.MapPut("/{id:int}", (int id, TreasuryWriteRequest request, ClaimsPrincipal user, TreasuryService service, CancellationToken ct) => Save(id, request with { BranchId = request.BranchId is null ? null : user.ForWrite(request.BranchId) }, user, service, ct));
        write.MapPost("/{id:int}/activate", (int id, ClaimsPrincipal user, TreasuryService service, CancellationToken ct) => SetActive(id, true, user, service, ct));
        write.MapPost("/{id:int}/deactivate", (int id, ClaimsPrincipal user, TreasuryService service, CancellationToken ct) => SetActive(id, false, user, service, ct));
        return endpoints;
    }
    private static async Task<IResult> Save(int? id,TreasuryWriteRequest request,ClaimsPrincipal user,TreasuryService service,CancellationToken ct){try{var result=await service.SaveAsync(id,request,user.ForRead(null),ct);return id.HasValue?Results.Ok(result):Results.Created("/api/treasuries",result);}catch(TreasuryException ex){return Results.Problem(ex.Message,statusCode:ex.StatusCode);}}
    private static async Task<IResult> SetActive(int id,bool active,ClaimsPrincipal user,TreasuryService service,CancellationToken ct){try{return await service.SetActiveAsync(id,active,user.ForRead(null),ct)?Results.NoContent():Results.NotFound();}catch(TreasuryException ex){return Results.Problem(ex.Message,statusCode:ex.StatusCode);}}
}
