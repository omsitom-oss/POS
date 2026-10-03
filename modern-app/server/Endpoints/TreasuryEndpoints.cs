using ElitePos.LocalService.Models;
using ElitePos.LocalService.Security;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;
public static class TreasuryEndpoints
{
    public static IEndpointRouteBuilder MapTreasuryEndpoints(this IEndpointRouteBuilder endpoints){var group = endpoints.MapGroup("/api/treasuries").RequireAuthorization(); var write = group.MapGroup("").RequirePermission(PermissionCodes.SettingsManage);group.MapGet("",async(bool? includeInactive,TreasuryService service,CancellationToken ct)=>Results.Ok(await service.GetAsync(includeInactive==true,ct)));write.MapPost("",(TreasuryWriteRequest request,TreasuryService service,CancellationToken ct)=>Save(null,request,service,ct));write.MapPut("/{id:int}",(int id,TreasuryWriteRequest request,TreasuryService service,CancellationToken ct)=>Save(id,request,service,ct));write.MapPost("/{id:int}/activate",(int id,TreasuryService service,CancellationToken ct)=>SetActive(id,true,service,ct));write.MapPost("/{id:int}/deactivate",(int id,TreasuryService service,CancellationToken ct)=>SetActive(id,false,service,ct));return endpoints;}
    private static async Task<IResult> Save(int? id,TreasuryWriteRequest request,TreasuryService service,CancellationToken ct){try{var result=await service.SaveAsync(id,request,ct);return id.HasValue?Results.Ok(result):Results.Created("/api/treasuries",result);}catch(TreasuryException ex){return Results.Problem(ex.Message,statusCode:ex.StatusCode);}}
    private static async Task<IResult> SetActive(int id,bool active,TreasuryService service,CancellationToken ct){try{return await service.SetActiveAsync(id,active,ct)?Results.NoContent():Results.NotFound();}catch(TreasuryException ex){return Results.Problem(ex.Message,statusCode:ex.StatusCode);}}
}
